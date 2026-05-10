import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Modal, FlatList,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { Event, Attendee } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';
import SrcBadge from '../components/SrcBadge';
import Toast from '../components/Toast';

function fmtPrice(p: string) {
  if (!p || p === 'Free') return 'Free';
  const num = parseFloat(p.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return p;
  const sym = p.match(/[€$£]/)?.[0] ?? '€';
  return `${sym}${num.toFixed(2)}`;
}

interface Props {
  event: Event;
  onBack: () => void;
  onOpenChat: () => void;
  onJoin: (e: Event) => void;
  joined: boolean;
  T: Theme;
}

export default function EventDetailScreen({ event: e, onBack, onOpenChat, onJoin, joined, T }: Props) {
  const [saved, setSaved]           = useState(false);
  const [calDone, setCalDone]       = useState(false);
  const [toast, setToast]           = useState('');
  const [shareToast, setShareToast] = useState(false);
  const [guestModal, setGuestModal] = useState<Attendee | null>(null);
  const [viewAll, setViewAll]       = useState(false);
  const [addedFriends, setAddedFriends] = useState<string[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const showShareMsg = () => { setShareToast(true); setTimeout(() => setShareToast(false), 2200); };

  const handleShare = async () => {
    const link = e.sourceURL ?? e.ticket ?? `https://randevu.app/events/${e.id}`;
    const text = `Hey! Join me for ${e.title} at ${e.venue}!\n\n${e.desc ?? ''}\n\nTickets: ${link}\n\nLet's go via Randevu!`;
    await Clipboard.setStringAsync(text);
    showShareMsg();
  };

  const handleCal = () => {
    if (!joined) onJoin(e);
    setCalDone(true);
    showToast('📅 Added to My Schedule!');
    setTimeout(() => setCalDone(false), 2800);
  };

  const handleGoing = () => {
    if (joined) {
      onJoin(e);
      showToast('❌ Attendance cancelled');
    } else if (e.ticket ?? e.sourceURL) {
      Linking.openURL((e.ticket ?? e.sourceURL)!).catch(() => {});
      onJoin(e);
      showToast('🎟️ Opening tickets…');
    } else {
      onJoin(e);
      showToast('🎉 You\'re in! See you there!');
    }
  };

  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${e.lng - 0.009},${e.lat - 0.006},${e.lng + 0.009},${e.lat + 0.006}&layer=mapnik&marker=${e.lat},${e.lng}`;

  return (
    <View style={{ flex: 1, backgroundColor: T.card }}>
      {/* Sticky back / share bar */}
      <View style={styles.topBar}>
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
        {/* Hero gradient */}
        <LinearGradient colors={[`${e.color}CC`, `${C.lav}55`] as [string, string]} style={styles.hero}>
          <View style={{ height: 54 }} />
          <Text style={{ fontSize: 58, marginBottom: 10 }}>{e.emoji}</Text>
          <SrcBadge source={e.source} />
          <Text style={styles.heroTitle}>{e.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {e.tags.map(t => (
              <View key={t} style={styles.heroTag}><Text style={{ fontSize: 12, fontWeight: '700', color: C.dark }}>{t}</Text></View>
            ))}
            <View style={[styles.heroTag, { backgroundColor: C.lav }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.white }}>{e.cat}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 22 }}>
          {/* Info card */}
          <View style={[styles.infoCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
            {[['📍', e.venue, e.addr], ['📅', `${e.date} · ${e.time}`, null], ['💶', fmtPrice(e.price), null]].map(([ic, main, sub], i) => (
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={{ fontSize: 18, marginTop: 1 }}>{ic}</Text>
                <View>
                  <Text style={[styles.infoMain, { color: ic === '💶' && e.price === 'Free' ? '#1a7a35' : T.text }]}>{main}</Text>
                  {sub && <Text style={[styles.infoSub, { color: T.sub }]}>{sub}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* Who's Going */}
          <View style={[styles.whoCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
            <View style={styles.whoHeader}>
              <Text style={[styles.whoTitle, { color: T.text }]}>👥 Who's Going</Text>
              <Tap onPress={() => setViewAll(true)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.accent, textDecorationLine: 'underline' }}>View All</Text>
              </Tap>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              {(e.attendees ?? []).slice(0, 5).map((a, i) => (
                <Tap key={i} onPress={() => setGuestModal(a)}>
                  <View style={[styles.attendeeCircle, { backgroundColor: a.c, marginLeft: i === 0 ? 0 : -10, borderColor: a.isFriend ? C.lav : T.card }]}>
                    <Text style={styles.attendeeTxt}>{a.n[0]}</Text>
                    {a.isFriend && <View style={[styles.friendDot, { borderColor: T.card }]} />}
                  </View>
                </Tap>
              ))}
              <Text style={[styles.whoMore, { color: T.sub }]}>
                <Text style={{ color: T.accent, fontWeight: '900' }}>+{Math.max(0, e.going - Math.min(5, e.attendees?.length ?? 0))} more</Text>
                {' '}from {e.neighbourhood}
              </Text>
            </View>
            {(e.friends ?? 0) > 0 && (
              <View style={[styles.friendsBanner, { backgroundColor: `${C.lav}14` }]}>
                <Text>✨</Text>
                <Text style={[styles.friendsBannerTxt, { color: T.accent }]}>{e.friends} of your friends are going!</Text>
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

          {/* Map */}
          <View style={{ marginBottom: 22 }}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Location</Text>
            <View style={[styles.mapContainer, { borderColor: T.border }]}>
              <WebView source={{ uri: mapSrc }} style={{ flex: 1 }} scrollEnabled={false} />
            </View>
          </View>

          {/* Group Chat teaser */}
          <View style={[styles.chatTeaser, { backgroundColor: `${C.lav}14`, borderColor: `${C.lav}30` }]}>
            <Text style={[styles.chatTeaserTitle, { color: T.text }]}>💬 Event Group Chat</Text>
            <Text style={[styles.chatTeaserSub, { color: T.sub }]}>{e.chatSeed?.length ?? 0} messages · {e.going} people</Text>
            {(e.chatSeed?.length ?? 0) > 0 && (
              <View style={[styles.chatPreview, { backgroundColor: T.card }]}>
                <Text style={{ fontWeight: '800', color: C.lav }}>{e.chatSeed[e.chatSeed.length - 1].user}: </Text>
                <Text style={{ color: T.text, fontSize: 13 }}>{e.chatSeed[e.chatSeed.length - 1].text}</Text>
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

      {/* Bottom CTA */}
      <View style={[styles.ctaBar, { backgroundColor: T.isDark ? '#1A1A1A' : C.white, borderTopColor: T.border }]}>
        <Tap onPress={handleCal}>
          <View style={[styles.calBtn, { backgroundColor: calDone ? C.green : T.cardAlt, borderColor: calDone ? C.tealD : T.border }]}>
            <Text style={{ fontSize: 20 }}>{calDone ? '✅' : '📅'}</Text>
          </View>
        </Tap>
        {joined ? (
          <Tap onPress={handleGoing} style={{ flex: 1 }}>
            <View style={styles.cancelBtn}><Text style={styles.cancelBtnTxt}>✕ Cancel Attendance</Text></View>
          </Tap>
        ) : (e.ticket ?? e.sourceURL) ? (
          <Tap onPress={handleGoing} style={{ flex: 1 }}>
            <View style={[styles.goBtn, { backgroundColor: C.lav }]}><Text style={styles.goBtnTxt}>🎟️ Get Tickets →</Text></View>
          </Tap>
        ) : (
          <Tap onPress={handleGoing} style={{ flex: 1 }}>
            <View style={[styles.goBtn, { backgroundColor: C.lav }]}><Text style={styles.goBtnTxt}>🙌 I'm Going!</Text></View>
          </Tap>
        )}
      </View>

      {shareToast && <Toast msg="🔗 Link copied to clipboard!" position="top" />}
      {!!toast    && <Toast msg={toast} position="bottom" />}

      {/* Guest modal */}
      <Modal visible={!!guestModal} animationType="slide" presentationStyle="pageSheet">
        {guestModal && (
          <View style={[styles.modalContainer, { backgroundColor: T.card }]}>
            <View style={styles.modalHeader}>
              <Tap onPress={() => setGuestModal(null)}>
                <View style={[styles.modalBack, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                  <Text style={{ fontSize: 20, color: T.text }}>‹</Text>
                </View>
              </Tap>
              <Text style={[styles.modalTitle, { color: T.text }]}>{guestModal.isFriend ? 'Friend Profile' : 'Attendee'}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 22, alignItems: 'center' }}>
              <View style={[styles.bigAvatar, { backgroundColor: guestModal.c, borderColor: guestModal.isFriend ? C.lav : 'transparent' }]}>
                <Text style={{ fontSize: 36, fontWeight: '800', color: C.dark }}>{guestModal.n[0]}</Text>
              </View>
              <Text style={[styles.guestName, { color: T.text }]}>{guestModal.n}</Text>
              {guestModal.isFriend && (
                <View style={[styles.friendBadge, { backgroundColor: `${C.lav}18` }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.lav }}>✓ Friend</Text>
                </View>
              )}
              {guestModal.isFriend ? (
                <Tap onPress={() => { setGuestModal(null); onOpenChat(); }} style={{ width: '100%', marginTop: 20 }}>
                  <View style={[styles.goBtn, { backgroundColor: C.lav }]}><Text style={styles.goBtnTxt}>💬 Message in Group Chat</Text></View>
                </Tap>
              ) : (
                <>
                  <Tap onPress={() => setAddedFriends(p => p.includes(guestModal.n) ? p : [...p, guestModal.n])} style={{ width: '100%', marginTop: 20 }}>
                    <View style={[styles.goBtn, { backgroundColor: addedFriends.includes(guestModal.n) ? C.green : C.lav }]}>
                      <Text style={[styles.goBtnTxt, { color: addedFriends.includes(guestModal.n) ? C.dark : C.white }]}>
                        {addedFriends.includes(guestModal.n) ? '✓ Friend Request Sent!' : '+ Add Friend'}
                      </Text>
                    </View>
                  </Tap>
                  <Tap onPress={() => { setGuestModal(null); onOpenChat(); }} style={{ width: '100%', marginTop: 10 }}>
                    <View style={[styles.calBtn, { backgroundColor: T.cardAlt, borderColor: T.border, width: '100%', borderRadius: 18, padding: 14 }]}>
                      <Text style={{ color: T.sub, fontWeight: '700', textAlign: 'center' }}>💬 Message in Group Chat</Text>
                    </View>
                  </Tap>
                </>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* View All Attendees */}
      <Modal visible={viewAll} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: T.card }]}>
          <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: T.border }]}>
            <Tap onPress={() => setViewAll(false)}>
              <View style={[styles.modalBack, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                <Text style={{ fontSize: 20, color: T.text }}>‹</Text>
              </View>
            </Tap>
            <View>
              <Text style={[styles.modalTitle, { color: T.text }]}>All Attendees</Text>
              <Text style={{ fontSize: 12, color: T.sub, marginTop: 1 }}>{e.going} going · {e.venue}</Text>
            </View>
          </View>
          <FlatList
            data={e.attendees ?? []}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item: a }) => (
              <Tap onPress={() => { setViewAll(false); setGuestModal(a); }}>
                <View style={[styles.attendeeRow, { borderBottomColor: T.border }]}>
                  <View style={[styles.attendeeCircleLg, { backgroundColor: a.c, borderColor: a.isFriend ? C.lav : 'transparent' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.dark }}>{a.n[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 15, fontWeight: '700' }, { color: T.text }]}>{a.n}</Text>
                    {a.isFriend
                      ? <Text style={{ fontSize: 12, color: C.lav, fontWeight: '600' }}>✓ Friend</Text>
                      : <Text style={{ fontSize: 12, color: T.sub }}>Attending</Text>
                    }
                  </View>
                  {!a.isFriend && (
                    <Tap onPress={() => setAddedFriends(p => p.includes(a.n) ? p : [...p, a.n])}>
                      <View style={[styles.addFriendBtn, {
                        backgroundColor: addedFriends.includes(a.n) ? `${C.green}22` : `${C.lav}18`,
                        borderColor: addedFriends.includes(a.n) ? '#1a7a35' : `${C.lav}30`,
                      }]}>
                        <Text style={{ color: addedFriends.includes(a.n) ? '#1a7a35' : C.lav, fontSize: 12, fontWeight: '800' }}>
                          {addedFriends.includes(a.n) ? '✓ Sent' : '+ Add'}
                        </Text>
                      </View>
                    </Tap>
                  )}
                </View>
              </Tap>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 10 },
  backBtn:       { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
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
  descText:      { fontSize: 14, lineHeight: 26, fontWeight: '600' },
  sourceLinkBtn: { marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, alignSelf: 'flex-start' },
  mapContainer:  { borderRadius: 22, overflow: 'hidden', height: 155, borderWidth: 1.5 },
  chatTeaser:    { borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1.5 },
  chatTeaserTitle:{ fontWeight: '900', fontSize: 14, marginBottom: 4 },
  chatTeaserSub: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chatPreview:   { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap' },
  chatOpenBtn:   { backgroundColor: C.lav, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, alignSelf: 'flex-start' },
  ctaBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingVertical: 14, paddingBottom: 32, borderTopWidth: 1.5 },
  calBtn:        { borderRadius: 18, padding: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:     { backgroundColor: '#FEE2E2', borderRadius: 22, padding: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  cancelBtnTxt:  { color: '#DC2626', fontWeight: '800', fontSize: 14 },
  goBtn:         { borderRadius: 22, padding: 15, alignItems: 'center' },
  goBtnTxt:      { color: C.white, fontWeight: '900', fontSize: 15 },
  modalContainer:{ flex: 1 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 52, paddingHorizontal: 22, paddingBottom: 16 },
  modalBack:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  modalTitle:    { fontSize: 17, fontWeight: '800' },
  bigAvatar:     { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3 },
  guestName:     { fontSize: 22, fontWeight: '900' },
  friendBadge:   { marginTop: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  attendeeRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1 },
  attendeeCircleLg: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  addFriendBtn:  { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
});
