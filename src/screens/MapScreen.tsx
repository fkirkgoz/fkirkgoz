import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Linking, Dimensions, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Event } from '../data/events';
import { MAP_PINS } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';
import SrcBadge from '../components/SrcBadge';

const { height: SCREEN_H } = Dimensions.get('window');

function fmtPrice(p: string) {
  if (!p || p === 'Free') return 'Free';
  const num = parseFloat(p.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return p;
  const sym = p.match(/[€$£]/)?.[0] ?? '€';
  return `${sym}${num.toFixed(2)}`;
}

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

export default function MapScreen({ onEventPress, T }: Props) {
  const [sel, setSel] = useState<Event | null>(null);

  const openInMaps = (lat: number, lng: number) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.isDark ? 'rgba(26,26,26,0.96)' : 'rgba(248,249,250,0.96)' }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>🗺️ Brussels Events Map</Text>
        <Text style={[styles.headerSub, { color: T.sub }]}>Tap a pin to see event details</Text>
      </View>

      {/* Map placeholder – interactive event grid */}
      <View style={styles.mapWrap}>
        <LinearGradient colors={['#dce8f5', '#c8dff0']} style={{ flex: 1 }}>
          <View style={styles.mapGrid}>
            {MAP_PINS.map(({ event: ev, area }) => (
              <TouchableOpacity
                key={ev.id}
                style={[styles.mapPin, { borderColor: ev.color, backgroundColor: `${ev.color}22` }]}
                onPress={() => setSel(ev)}
                activeOpacity={0.7}
              >
                <Text style={styles.mapPinEmoji}>{ev.emoji}</Text>
                <Text style={[styles.mapPinArea, { color: C.dark }]} numberOfLines={1}>{area}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.openMapsBtn}
            onPress={() => Linking.openURL('https://www.google.com/maps/@50.848,4.352,13z').catch(() => {})}
          >
            <Text style={styles.openMapsBtnTxt}>🗺️ Open full map in Google Maps →</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Selected event card */}
      {sel && (
        <View style={[styles.selCard, { backgroundColor: T.card, shadowColor: C.lav }]}>
          <View style={styles.selRow}>
            <View style={[styles.selEmoji, { backgroundColor: C.lav }]}>
              <Text style={{ fontSize: 18 }}>{sel.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.selTitle, { color: T.text }]}>{sel.title}</Text>
              <SrcBadge source={sel.source} />
              <Text style={[styles.selVenue, { color: T.sub }]}>📍 {sel.venue}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Text style={{ color: C.lav, fontWeight: '700', fontSize: 12 }}>⏰ {sel.time}</Text>
                <View style={[styles.priceBadge, { backgroundColor: sel.price === 'Free' ? C.green : C.pink }]}>
                  <Text style={{ fontWeight: '800', fontSize: 11, color: C.dark }}>{fmtPrice(sel.price)}</Text>
                </View>
              </View>
            </View>
            <Tap onPress={() => setSel(null)}>
              <Text style={{ fontSize: 22, color: T.sub, paddingLeft: 10 }}>×</Text>
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Tap onPress={() => { onEventPress(sel); setSel(null); }} style={{ flex: 1 }}>
              <View style={styles.detailsBtn}>
                <Text style={styles.detailsBtnTxt}>View Details →</Text>
              </View>
            </Tap>
            <Tap onPress={() => openInMaps(sel.lat, sel.lng)}>
              <View style={styles.mapsBtn}>
                <Text style={{ color: C.white, fontWeight: '800', fontSize: 13 }}>📍 Maps</Text>
              </View>
            </Tap>
          </View>
        </View>
      )}

      {/* Horizontal event strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {MAP_PINS.map(({ event: ev, area }) => (
          <Tap key={ev.id} onPress={() => onEventPress(ev)}>
            <View style={[styles.stripCard, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={[styles.stripEmoji, { backgroundColor: C.lav }]}>
                <Text style={{ fontSize: 14 }}>{ev.emoji}</Text>
              </View>
              <View>
                <Text style={[styles.stripArea, { color: T.text }]}>{area}</Text>
                <Text style={{ fontSize: 10, color: C.lav, fontWeight: '700' }}>{ev.going} going</Text>
              </View>
            </View>
          </Tap>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { paddingTop: 52, paddingHorizontal: 22, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub:   { fontSize: 12, marginTop: 2 },
  mapWrap:     { flex: 1, marginHorizontal: 16, marginBottom: 8, borderRadius: 28, overflow: 'hidden' },
  mapGrid:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, alignContent: 'flex-start' },
  mapPin:      { width: '22%', alignItems: 'center', borderRadius: 16, padding: 8, borderWidth: 2 },
  mapPinEmoji: { fontSize: 22, marginBottom: 2 },
  mapPinArea:  { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  openMapsBtn: { margin: 12, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  openMapsBtnTxt: { fontSize: 13, fontWeight: '800', color: C.lav },
  selCard:     { marginHorizontal: 16, marginBottom: 8, borderRadius: 22, padding: 16, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  selRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  selEmoji:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  selTitle:    { fontWeight: '900', fontSize: 15, marginBottom: 4 },
  selVenue:    { fontSize: 12, marginTop: 4 },
  priceBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  detailsBtn:  { backgroundColor: C.lav, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  detailsBtnTxt: { color: C.white, fontWeight: '900', fontSize: 14 },
  mapsBtn:     { backgroundColor: '#34A853', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  strip:       { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  stripCard:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, padding: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  stripEmoji:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stripArea:   { fontSize: 11, fontWeight: '900' },
});
