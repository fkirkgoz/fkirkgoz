import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Modal, FlatList, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, Attendee, EVENTS, FRIEND_PROFILES } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';
import SrcBadge from '../components/SrcBadge';
import Toast from '../components/Toast';

function getDisplayDate(relative: string): string {
  const today = new Date();
  const day = today.getDay();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (relative === 'Tonight')      return fmt(today);
  if (relative === 'Tomorrow')     return fmt(addDays(1));
  if (relative === 'This Weekend') {
    if (day === 0) return fmt(today);
    const toSat = (6 - day + 7) % 7;
    return fmt(addDays(toSat === 0 ? 7 : toSat));
  }
  if (relative === 'Next Week') {
    const toMon = ((1 - day) + 7) % 7 || 7;
    return fmt(addDays(toMon));
  }
  if (relative === 'Next Month') return fmt(addDays(28));
  return relative;
}

function fmtPrice(p: string) {
  if (!p) return '';
  if (p === 'Free') return 'Free';
  const num = parseFloat(p.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return p;
  const sym = p.match(/[€$£]/)?.[0] ?? '€';
  return `${sym}${num.toFixed(2)}`;
}

function getMutualEvents(name: string, currentId: number): Event[] {
  return EVENTS.filter(ev =>
    ev.id !== currentId &&
    ev.attendees.some(a => a.n === name)
  ).slice(0, 6);
}

interface Props {
  event: Event;
  onBack: () => void;
  onOpenChat: () => void;
  onJoin: (e: Event) => void;
  joined: boolean;
  T: Theme;
  onEventPress?: (e: Event) => void;
}

export default function EventDetailScreen({ event: e, onBack, onOpenChat, onJoin, joined, T, onEventPress }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [saved, setSaved]           = useState(false);
  const [calDone, setCalDone]       = useState(false);
  const [toast, setToast]           = useState('');
  const [shareToast, setShareToast] = useState(false);
  const [guestModal, setGuestModal] = useState<Attendee | null>(null);
  const [viewAll, setViewAll]       = useState(false);
  const [addedFriends, setAddedFriends] = useState<string[]>([]);
  const pendingGuestRef = useRef<Attendee | null>(null);

  // Re-open friend modal when returning from a pushed EventDetail screen
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (pendingGuestRef.current) {
        setGuestModal(pendingGuestRef.current);
        pendingGuestRef.current = null;
      }
    });
    return unsub;
  }, [navigation]);

  const showToast  = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const showShare  = () => { setShareToast(true); setTimeout(() => setShareToast(false), 2200); };

  const handleShare = async () => {
    const link = e.sourceURL ?? e.ticket ?? `https://randevu.app/events/${e.id}`;
    await Clipboard.setStringAsync(
      `Hey! Join me for ${e.title} at ${e.venue}!\n\n${e.desc ?? ''}\n\nTickets: ${link}\n\nLet's go via Randevu!`
    );
    showShare();
  };

  const handleCal = () => {
    if (!joined) onJoin(e);
    setCalDone(true);
    showToast('📅 Added to My Schedule!');
    setTimeout(() => setCalDone(false), 2800);
  };

  const handleGoing = () => {
    if (joined) {
      onJoin(e); showToast('❌ Attendance cancelled');
    } else if (e.ticket ?? e.sourceURL) {
      Linking.openURL((e.ticket ?? e.sourceURL)!).catch(() => {});
      onJoin(e); showToast('🎟️ Opening tickets…');
    } else {
      onJoin(e); showToast('🎉 You\'re in! See you there!');
    }
  };

  const friends = (e.attendees ?? []).filter(a => a.isFriend);
  const others  = (e.attendees ?? []).filter(a => !a.isFriend);

  return (
    <View style={{ flex: 1, backgroundColor: T.card }}>

      {/* ── Transparent header bar — uses real safe area top ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Tap onPress={onBack}>
          <View style={styles.backBtn}>
            <Text style={styles.backBtnTxt}>‹ Back</Text>
          </View>
        </Tap>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Tap onPress={handleShare}>
            <View style={styles.topActionBtn}><Text style={styles.topActionTxt}>🔗 Share</Text></View>
          </Tap>
          <Tap onPress={() => setSaved(s => !s)}>
            <View style={styles.topActionBtn}><Text style={{ fontSize: 18 }}>{saved ? '❤️' : '🤍'}</Text></View>
          </Tap>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero — padded to clear the floating header */}
        <LinearGradient
          colors={[`${e.color}CC`, `${C.lav}55`] as [string, string]}
          style={[styles.hero, { paddingTop: insets.top + 60 }]}
        >
          <Text style={{ fontSize: 58, marginBottom: 10 }}>{e.emoji}</Text>
          <SrcBadge source={e.source} />
          <Text style={styles.heroTitle}>{e.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {e.tags.map(t => (
              <View key={t} style={styles.heroTag}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.dark }}>{t}</Text>
              </View>
            ))}
            <View style={[styles.heroTag, { backgroundColor: C.lav }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.white }}>{e.cat}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 22 }}>
          {/* Info card */}
          <View style={[styles.infoCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
            {([
              ['📍', e.venue, e.addr],
              ['📅', `${getDisplayDate(e.date)} · ${e.time}`, null],
              ...(e.price ? [['💶', fmtPrice(e.price), null]] : []),
            ] as [string, string, string | null][]).map(([ic, main, sub], i) => (
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={{ fontSize: 18, marginTop: 1 }}>{ic}</Text>
                <View>
                  <Text style={[styles.infoMain, {
                    color: ic === '💶' && e.price === 'Free' ? '#1a7a35'
                      : ic === '💶' && e.price === 'Sold Out' ? '#E8294A'
                      : T.text,
                  }]}>{main}</Text>
                  {sub && <Text style={[styles.infoSub, { color: T.sub }]}>{sub}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* Who's Going */}
          <View style={[styles.whoCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => setViewAll(true)} style={styles.whoHeader}>
              <Text style={[styles.whoTitle, { color: T.text }]}>👥 Who's Going</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.accent, textDecorationLine: 'underline' }}>View All →</Text>
            </TouchableOpacity>
            {/* Smooth horizontal scroll — every element opens the attendee list */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', gap: 8, paddingRight: 4 }}
            >
              {(e.attendees ?? []).map((a, i) => (
                <TouchableOpacity key={i} onPress={() => setViewAll(true)} activeOpacity={0.75}>
                  <View style={[styles.attendeeCircle, {
                    backgroundColor: a.c,
                    borderColor: a.isFriend ? C.lav : T.card,
                  }]}>
                    <Text style={styles.attendeeTxt}>{a.n[0]}</Text>
                    {a.isFriend && <View style={[styles.friendDot, { borderColor: T.card }]} />}
                  </View>
                </TouchableOpacity>
              ))}
              {e.going > (e.attendees?.length ?? 0) && (
                <TouchableOpacity onPress={() => setViewAll(true)} activeOpacity={0.75}>
                  <View style={[styles.morePill, { backgroundColor: `${C.lav}18`, borderColor: `${C.lav}30` }]}>
                    <Text style={{ color: C.lav, fontWeight: '900', fontSize: 11 }}>
                      +{(e.going - (e.attendees?.length ?? 0)).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setViewAll(true)} activeOpacity={0.75}>
                <View style={[styles.chevronBtn, { backgroundColor: `${C.lav}12` }]}>
                  <Ionicons name="chevron-forward" size={18} color={C.lav} />
                </View>
              </TouchableOpacity>
            </ScrollView>
            {(e.friends ?? 0) > 0 && (
              <View style={[styles.friendsBanner, { backgroundColor: `${C.lav}14` }]}>
                <Text>✨</Text>
                <Text style={[styles.friendsBannerTxt, { color: T.accent }]}>
                  {e.friends} of your friends are going!
                </Text>
              </View>
            )}
          </View>

          {/* About */}
          <View style={{ marginBottom: 22 }}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>About this event</Text>
            <Text style={[styles.descText, { color: T.sub }]}>{e.desc}</Text>
            {!!(e.sourceURL ?? e.ticket) && (
              <Tap onPress={() => Linking.openURL((e.sourceURL ?? e.ticket)!).catch(() => {})}>
                <View style={[styles.sourceLinkBtn, { backgroundColor: `${C.lav}12`, borderColor: `${C.lav}30` }]}>
                  <Text style={{ color: C.lav, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                    🔗 {e.source ? `${e.source} — Official page` : 'View tickets'} ↗
                  </Text>
                </View>
              </Tap>
            )}
          </View>

          {/* ── Map preview with event pin ── */}
          <View style={{ marginBottom: 22 }}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Location</Text>
            <View style={[styles.mapContainer, { borderColor: T.border }]}>
              <MapView
                style={StyleSheet.absoluteFillObject}
                liteMode={Platform.OS === 'android'}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                initialRegion={{
                  latitude: e.lat,
                  longitude: e.lng,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
              >
                <Marker coordinate={{ latitude: e.lat, longitude: e.lng }}>
                  <View style={styles.mapMarker}>
                    <Text style={{ fontSize: 22 }}>{e.emoji}</Text>
                  </View>
                </Marker>
              </MapView>
              <TouchableOpacity
                style={styles.openMapsOverlay}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`
                  ).catch(() => {})
                }
              >
                <Text style={styles.openMapsTxt}>📍 {e.venue}  ·  Open in Google Maps →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Group Chat teaser */}
          <View style={[styles.chatTeaser, { backgroundColor: `${C.lav}14`, borderColor: `${C.lav}30` }]}>
            <Text style={[styles.chatTeaserTitle, { color: T.text }]}>💬 Event Group Chat</Text>
            <Text style={[styles.chatTeaserSub, { color: T.sub }]}>
              {e.chatSeed?.length ?? 0} messages · {e.going} people
            </Text>
            {(e.chatSeed?.length ?? 0) > 0 && (
              <View style={[styles.chatPreview, { backgroundColor: T.card }]}>
                <Text style={{ fontWeight: '800', color: C.lav }}>
                  {e.chatSeed[e.chatSeed.length - 1].user}:{' '}
                </Text>
                <Text style={{ color: T.text, fontSize: 13 }}>
                  {e.chatSeed[e.chatSeed.length - 1].text}
                </Text>
              </View>
            )}
            <Tap onPress={onOpenChat}>
              <View style={styles.chatOpenBtn}>
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 13 }}>Open chat →</Text>
              </View>
            </Tap>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom CTA — brand gradient for primary action ── */}
      <View style={[styles.ctaBar, {
        backgroundColor: T.isDark ? '#1A1A1A' : C.white,
        borderTopColor: T.border,
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        <Tap onPress={handleCal}>
          <View style={[styles.calBtn, {
            backgroundColor: calDone ? C.green : T.cardAlt,
            borderColor: calDone ? C.tealD : T.border,
          }]}>
            <Text style={{ fontSize: 20 }}>{calDone ? '✅' : '📅'}</Text>
          </View>
        </Tap>
        {joined ? (
          <Tap onPress={handleGoing} style={{ flex: 1 }}>
            <View style={styles.cancelBtn}>
              <Text style={styles.cancelBtnTxt}>✕ Cancel Attendance</Text>
            </View>
          </Tap>
        ) : (
          <Tap onPress={handleGoing} style={{ flex: 1 }}>
            <LinearGradient
              colors={[C.lav, C.lavD] as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.goBtn}
            >
              <Text style={styles.goBtnTxt}>
                {(e.ticket ?? e.sourceURL) ? '🎟️ Get Tickets →' : '🙌 I\'m Going!'}
              </Text>
            </LinearGradient>
          </Tap>
        )}
      </View>

      {shareToast && <Toast msg="🔗 Link copied to clipboard!" position="top" />}
      {!!toast    && <Toast msg={toast} position="bottom" />}

      {/* ══════════════════════════════════════════════
          GUEST PROFILE MODAL
      ══════════════════════════════════════════════ */}
      <Modal visible={!!guestModal} animationType="slide" presentationStyle="pageSheet">
        {guestModal && (
          <View style={[styles.modalContainer, { backgroundColor: T.card }]}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
              <Tap onPress={() => setGuestModal(null)}>
                <View style={[styles.modalBack, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                  <Text style={{ fontSize: 20, color: T.text }}>‹</Text>
                </View>
              </Tap>
              <Text style={[styles.modalTitle, { color: T.text }]}>
                {guestModal.isFriend ? 'Friend Profile' : 'Attendee'}
              </Text>
            </View>

            {guestModal.isFriend ? (
              /* ── FRIEND: full profile ── */
              <ScrollView contentContainerStyle={{ padding: 22, alignItems: 'center' }}>
                <LinearGradient
                  colors={[guestModal.c, `${guestModal.c}88`] as [string, string]}
                  style={[styles.bigAvatar, { borderColor: C.lav }]}
                >
                  <Text style={{ fontSize: 36, fontWeight: '900', color: C.white }}>
                    {guestModal.n[0]}
                  </Text>
                </LinearGradient>
                <Text style={[styles.guestName, { color: T.text }]}>{guestModal.n}</Text>
                <View style={[styles.friendBadge, { backgroundColor: `${C.lav}18` }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.lav }}>✓ Friend</Text>
                </View>

                {FRIEND_PROFILES[guestModal.n] && (
                  <Text style={[styles.friendBio, { color: T.sub }]}>
                    {FRIEND_PROFILES[guestModal.n].bio}
                  </Text>
                )}

                {/* Vibes */}
                {(FRIEND_PROFILES[guestModal.n]?.vibes ?? []).length > 0 && (
                  <View style={{ width: '100%', marginTop: 16 }}>
                    <Text style={[styles.subSectionTitle, { color: T.text }]}>Vibes</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {FRIEND_PROFILES[guestModal.n].vibes.map(v => (
                        <View key={v} style={[styles.vibePill, { backgroundColor: `${C.lav}16`, borderColor: `${C.lav}30` }]}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: C.lav }}>{v}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Mutual events */}
                {(() => {
                  const mutual = getMutualEvents(guestModal.n, e.id);
                  if (!mutual.length) return null;
                  return (
                    <View style={{ width: '100%', marginTop: 22 }}>
                      <Text style={[styles.subSectionTitle, { color: T.text }]}>
                        Also Attending  ·  {mutual.length} events
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 10, marginTop: 10 }}
                      >
                        {mutual.map(ev => (
                          <TouchableOpacity
                            key={ev.id}
                            activeOpacity={0.75}
                            onPress={() => {
                              pendingGuestRef.current = guestModal;
                              setGuestModal(null);
                              setTimeout(() => onEventPress?.(ev), 320);
                            }}
                          >
                            <View style={[styles.mutualCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                              <View style={[styles.mutualBar, { backgroundColor: ev.color }]} />
                              <View style={{ padding: 10 }}>
                                <Text style={{ fontSize: 20, marginBottom: 4 }}>{ev.emoji}</Text>
                                <Text style={[styles.mutualTitle, { color: T.text }]} numberOfLines={2}>
                                  {ev.title.length > 16 ? ev.title.slice(0, 15) + '…' : ev.title}
                                </Text>
                                <Text style={{ fontSize: 10, color: T.sub, fontWeight: '700' }}>{getDisplayDate(ev.date)}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  );
                })()}

                <Tap onPress={() => { setGuestModal(null); onOpenChat(); }} style={{ width: '100%', marginTop: 24 }}>
                  <LinearGradient
                    colors={[C.lav, C.lavD] as [string, string]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.goBtn}
                  >
                    <Text style={styles.goBtnTxt}>💬 Message in Group Chat</Text>
                  </LinearGradient>
                </Tap>
              </ScrollView>
            ) : (
              /* ── NON-FRIEND: private profile ── */
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <View style={[styles.privateAvatar, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                  <Text style={{ fontSize: 44 }}>🔒</Text>
                </View>
                <Text style={[styles.guestName, { color: T.text, marginTop: 18 }]}>{guestModal.n}</Text>
                <Text style={[styles.privateLabel, { color: T.sub }]}>Private Profile</Text>
                <Text style={[styles.privateSub, { color: T.sub }]}>
                  Add {guestModal.n} as a friend to see their full profile, bio, and upcoming events.
                </Text>
                <Tap
                  onPress={() => setAddedFriends(p => p.includes(guestModal.n) ? p : [...p, guestModal.n])}
                  style={{ width: '100%', marginTop: 28 }}
                >
                  <LinearGradient
                    colors={
                      addedFriends.includes(guestModal.n)
                        ? [C.tealD, C.teal] as [string, string]
                        : [C.lav, C.lavD] as [string, string]
                    }
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.goBtn}
                  >
                    <Text style={styles.goBtnTxt}>
                      {addedFriends.includes(guestModal.n) ? '✓ Friend Request Sent!' : '+ Add Friend'}
                    </Text>
                  </LinearGradient>
                </Tap>
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════
          VIEW ALL ATTENDEES MODAL — Friends / Others
      ══════════════════════════════════════════════ */}
      <Modal visible={viewAll} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: T.card }]}>
          <View style={[styles.modalHeader, {
            paddingTop: insets.top + 16,
            borderBottomWidth: 1,
            borderBottomColor: T.border,
          }]}>
            <Tap onPress={() => setViewAll(false)}>
              <View style={[styles.modalBack, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                <Text style={{ fontSize: 20, color: T.text }}>‹</Text>
              </View>
            </Tap>
            <View>
              <Text style={[styles.modalTitle, { color: T.text }]}>All Attendees</Text>
              <Text style={{ fontSize: 12, color: T.sub, marginTop: 1 }}>
                {e.going} going · {e.venue}
              </Text>
            </View>
          </View>

          <FlatList
            data={[...friends, ...others]}
            keyExtractor={(_, i) => String(i)}
            ListHeaderComponent={
              friends.length > 0 ? (
                <View style={[styles.listSectionHeader, { backgroundColor: `${C.lav}12` }]}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.lav }}>
                    ✓  Friends Going  ·  {friends.length}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item: a, index }) => (
              <>
                {index === friends.length && others.length > 0 && (
                  <View style={[styles.listSectionHeader, { backgroundColor: T.cardAlt }]}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: T.sub }}>
                      Others  ·  {others.length}
                    </Text>
                  </View>
                )}
                <Tap onPress={() => { setViewAll(false); setGuestModal(a); }}>
                  <View style={[styles.attendeeRow, { borderBottomColor: T.border }]}>
                    <View style={[styles.attendeeCircleLg, {
                      backgroundColor: a.c,
                      borderColor: a.isFriend ? C.lav : 'transparent',
                    }]}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: C.dark }}>{a.n[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: T.text }}>{a.n}</Text>
                      {a.isFriend
                        ? <Text style={{ fontSize: 12, color: C.lav, fontWeight: '600' }}>✓ Friend  ·  tap to view profile</Text>
                        : <Text style={{ fontSize: 12, color: T.sub }}>Attending</Text>
                      }
                    </View>
                    {!a.isFriend && (
                      <Tap onPress={() => setAddedFriends(p => p.includes(a.n) ? p : [...p, a.n])}>
                        <View style={[styles.addFriendBtn, {
                          backgroundColor: addedFriends.includes(a.n) ? `${C.green}22` : `${C.lav}18`,
                          borderColor: addedFriends.includes(a.n) ? '#1a7a35' : `${C.lav}30`,
                        }]}>
                          <Text style={{
                            color: addedFriends.includes(a.n) ? '#1a7a35' : C.lav,
                            fontSize: 12, fontWeight: '800',
                          }}>
                            {addedFriends.includes(a.n) ? '✓ Sent' : '+ Add'}
                          </Text>
                        </View>
                      </Tap>
                    )}
                  </View>
                </Tap>
              </>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  backBtn:       { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  backBtnTxt:    { fontWeight: '800', fontSize: 14, color: C.dark },
  topActionBtn:  { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  topActionTxt:  { fontWeight: '800', fontSize: 13, color: C.dark },

  hero:          { paddingHorizontal: 22, paddingBottom: 28 },
  heroTitle:     { fontSize: 22, fontWeight: '900', color: C.dark, lineHeight: 28, marginVertical: 10 },
  heroTag:       { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },

  infoCard:      { borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1 },
  infoRow:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
  infoMain:      { fontWeight: '800', fontSize: 14 },
  infoSub:       { fontSize: 12, marginTop: 1 },

  whoCard:       { borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1 },
  whoHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  whoTitle:      { fontSize: 15, fontWeight: '900' },
  attendeeCircle:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  attendeeTxt:   { fontSize: 13, fontWeight: '800', color: C.dark },
  friendDot:     { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.lav, borderWidth: 2 },
  whoMore:       { marginLeft: 14, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  friendsBanner: { marginTop: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendsBannerTxt: { fontSize: 13, fontWeight: '700' },

  sectionTitle:  { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  subSectionTitle: { fontSize: 14, fontWeight: '900' },
  descText:      { fontSize: 14, lineHeight: 26, fontWeight: '600' },
  sourceLinkBtn: { marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, alignSelf: 'flex-start' },

  mapContainer:  { borderRadius: 22, overflow: 'hidden', height: 180, borderWidth: 1.5 },
  mapMarker:     { backgroundColor: 'white', borderRadius: 22, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  openMapsOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.60)', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  openMapsTxt:   { color: 'white', fontWeight: '800', fontSize: 12 },

  chatTeaser:    { borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1.5 },
  chatTeaserTitle: { fontWeight: '900', fontSize: 14, marginBottom: 4 },
  chatTeaserSub: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chatPreview:   { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap' },
  chatOpenBtn:   { backgroundColor: C.lav, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, alignSelf: 'flex-start' },

  ctaBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1.5 },
  calBtn:        { borderRadius: 18, padding: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:     { backgroundColor: '#FEE2E2', borderRadius: 22, padding: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  cancelBtnTxt:  { color: '#DC2626', fontWeight: '800', fontSize: 14 },
  goBtn:         { borderRadius: 22, padding: 15, alignItems: 'center' },
  goBtnTxt:      { color: C.white, fontWeight: '900', fontSize: 15 },

  modalContainer: { flex: 1 },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingBottom: 16 },
  modalBack:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalTitle:     { fontSize: 17, fontWeight: '800' },
  bigAvatar:      { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3 },
  guestName:      { fontSize: 22, fontWeight: '900' },
  friendBadge:    { marginTop: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  friendBio:      { fontSize: 14, lineHeight: 22, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  vibePill:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  mutualCard:     { width: 130, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  mutualBar:      { height: 4 },
  mutualTitle:    { fontSize: 11, fontWeight: '900', lineHeight: 15, marginBottom: 4 },

  privateAvatar:  { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  privateLabel:   { fontSize: 16, fontWeight: '700', marginTop: 6 },
  privateSub:     { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 },

  listSectionHeader: { paddingHorizontal: 22, paddingVertical: 10 },
  attendeeRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1 },
  attendeeCircleLg: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  addFriendBtn:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  morePill:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  chevronBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
