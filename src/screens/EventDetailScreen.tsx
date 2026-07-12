import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, ImageBackground,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';
import SrcBadge from '../components/SrcBadge';
import Toast from '../components/Toast';

function getDisplayDate(relative: string, rawDate?: string): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  // Prefer the raw ISO date (e.g. "2026-05-29") — avoids addDays(28) approximation
  // that mapped all "Next Month" events to exactly 28 days out (e.g. June 18).
  if (rawDate) {
    const [y, mo, d] = rawDate.split('-').map(Number);
    if (y && mo && d) return fmt(new Date(y, mo - 1, d));
  }
  // Fallback for hardcoded base events that have no _rawDate
  const today = new Date();
  const day = today.getDay();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
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
  if (relative === 'Ongoing') return relative;
  return fmt(addDays(30));
}

interface Props {
  event: Event;
  onBack: () => void;
  onJoin: (e: Event) => void;
  joined: boolean;
  T: Theme;
  onEventPress?: (e: Event) => void;
}

export default function EventDetailScreen({ event: e, onBack, onJoin, joined, T }: Props) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved]           = useState(false);
  const [calDone, setCalDone]       = useState(false);
  const [toast, setToast]           = useState('');
  const [shareToast, setShareToast] = useState(false);

  const showToast  = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const showShare  = () => { setShareToast(true); setTimeout(() => setShareToast(false), 2200); };

  const handleShare = async () => {
    const link = e.officialEventLink || `https://randevu.app/events/${e.id}`;
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
    } else if (e.officialEventLink) {
      Linking.openURL(e.officialEventLink).catch(() => {});
      onJoin(e); showToast('🎟️ Opening tickets…');
    } else {
      onJoin(e); showToast('🎉 You\'re in! See you there!');
    }
  };

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
        {/* Optional event graphic (e.g. Hangar poster) above the hero */}
        {!!e.image && (
          <ImageBackground source={{ uri: e.image }} style={styles.heroImage} resizeMode="cover">
            <LinearGradient colors={['transparent', `${C.dark}CC`] as [string, string]} style={StyleSheet.absoluteFillObject} />
          </ImageBackground>
        )}
        {/* Hero — padded to clear the floating header */}
        <LinearGradient
          colors={[`${e.color}CC`, `${C.lav}55`] as [string, string]}
          style={[styles.hero, { paddingTop: e.image ? 22 : insets.top + 60 }]}
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
              ['📅', `${getDisplayDate(e.date, e._rawDate)} · ${e.time}`, null],
            ] as [string, string, string | null][]).map(([ic, main, sub], i) => (
              <View key={i} style={[styles.infoRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={{ fontSize: 18, marginTop: 1 }}>{ic}</Text>
                <View>
                  <Text style={[styles.infoMain, { color: T.text }]}>{main}</Text>
                  {sub && <Text style={[styles.infoSub, { color: T.sub }]}>{sub}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* About */}
          <View style={{ marginBottom: 22 }}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>About this event</Text>
            <Text style={[styles.descText, { color: T.sub }]}>{e.desc}</Text>
            {!!e.officialEventLink && (
              <Tap onPress={() => Linking.openURL(e.officialEventLink).catch(() => {})}>
                <View style={[styles.sourceLinkBtn, { backgroundColor: `${C.lav}12`, borderColor: `${C.lav}30` }]}>
                  <Text style={{ color: C.lav, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>
                    🔗 {e.source ? `${e.source} — Official page` : 'View event'} ↗
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
                {e.officialEventLink ? '🎟️ Get Tickets →' : '🙌 I\'m Going!'}
              </Text>
            </LinearGradient>
          </Tap>
        )}
      </View>

      {shareToast && <Toast msg="🔗 Link copied to clipboard!" position="top" />}
      {!!toast    && <Toast msg={toast} position="bottom" />}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  backBtn:       { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 50, paddingHorizontal: 20, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  backBtnTxt:    { fontWeight: '800', fontSize: 14, color: C.dark },
  topActionBtn:  { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  topActionTxt:  { fontWeight: '800', fontSize: 13, color: C.dark },

  heroImage:     { width: '100%', height: 220, justifyContent: 'flex-end' },
  hero:          { paddingHorizontal: 22, paddingBottom: 28 },
  heroTitle:     { fontSize: 22, fontWeight: '900', color: C.dark, lineHeight: 28, marginVertical: 10 },
  heroTag:       { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },

  infoCard:      { borderRadius: 22, padding: 16, marginBottom: 20, borderWidth: 1 },
  infoRow:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
  infoMain:      { fontWeight: '800', fontSize: 14 },
  infoSub:       { fontSize: 12, marginTop: 1 },

  sectionTitle:  { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  descText:      { fontSize: 14, lineHeight: 26, fontWeight: '600' },
  sourceLinkBtn: { marginTop: 14, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, alignSelf: 'flex-start' },

  mapContainer:  { borderRadius: 22, overflow: 'hidden', height: 180, borderWidth: 1.5 },
  mapMarker:     { backgroundColor: 'white', borderRadius: 22, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  openMapsOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.60)', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  openMapsTxt:   { color: 'white', fontWeight: '800', fontSize: 12 },

  ctaBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingTop: 14, borderTopWidth: 1.5 },
  calBtn:        { borderRadius: 18, padding: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:     { backgroundColor: '#FEE2E2', borderRadius: 22, padding: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  cancelBtnTxt:  { color: '#DC2626', fontWeight: '800', fontSize: 14 },
  goBtn:         { borderRadius: 22, padding: 15, alignItems: 'center' },
  goBtnTxt:      { color: C.white, fontWeight: '900', fontSize: 15 },
});
