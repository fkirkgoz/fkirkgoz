import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, EVENTS } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

export default function MapScreen({ onEventPress, T }: Props) {
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<Event | null>(null);

  return (
    <View style={styles.container}>

      {/* ── Full-screen interactive map ── */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 50.8503,
          longitude: 4.3517,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={() => setSel(null)}
      >
        {EVENTS.map(ev => (
          <Marker
            key={ev.id}
            coordinate={{ latitude: ev.lat, longitude: ev.lng }}
            onPress={() => setSel(ev)}
            tracksViewChanges={false}
          >
            <View style={[styles.markerBubble, { backgroundColor: ev.color }]}>
              <Text style={styles.markerEmoji}>{ev.emoji}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── Header overlay ── */}
      <View style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          backgroundColor: T.isDark
            ? 'rgba(26,26,26,0.93)'
            : 'rgba(255,255,255,0.93)',
        },
      ]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>🗺️ Brussels Events Map</Text>
        <Text style={[styles.headerSub, { color: T.sub }]}>
          {EVENTS.length} events · tap a pin to preview
        </Text>
      </View>

      {/* ── Floating event preview card ── */}
      {sel && (
        <View style={[styles.previewCard, { backgroundColor: T.card, shadowColor: C.lav }]}>
          {/* Dismiss button */}
          <TouchableOpacity style={styles.dismissBtn} onPress={() => setSel(null)}>
            <Text style={[styles.dismissTxt, { color: T.sub }]}>✕</Text>
          </TouchableOpacity>

          {/* Event info row */}
          <View style={styles.previewRow}>
            <View style={[styles.previewEmojiBox, { backgroundColor: sel.color }]}>
              <Text style={{ fontSize: 26 }}>{sel.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.previewTitle, { color: T.text }]} numberOfLines={1}>
                {sel.title}
              </Text>
              <Text style={[styles.previewMeta, { color: T.sub }]} numberOfLines={1}>
                📍 {sel.venue}
              </Text>
              <Text style={[styles.previewMeta, { color: T.sub }]}>
                {sel.date} · {sel.time}
              </Text>
              <Text style={{
                fontSize: 12, fontWeight: '800',
                color: sel.price === 'Free' ? '#1a7a35' : C.lav,
              }}>
                {sel.price === 'Free' ? '✓ Free entry' : sel.price}
              </Text>
            </View>
          </View>

          {/* CTA */}
          <Tap onPress={() => { onEventPress(sel); setSel(null); }} style={{ marginTop: 12 }}>
            <LinearGradient
              colors={[C.lav, C.lavD] as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.previewBtn}
            >
              <Text style={styles.previewBtnTxt}>View Details →</Text>
            </LinearGradient>
          </Tap>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },

  header:         { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 22, paddingBottom: 14 },
  headerTitle:    { fontSize: 20, fontWeight: '900' },
  headerSub:      { fontSize: 12, marginTop: 2 },

  markerBubble:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  markerEmoji:    { fontSize: 18 },

  previewCard:    { position: 'absolute', bottom: 16, left: 16, right: 16, borderRadius: 24, padding: 16, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 },
  dismissBtn:     { position: 'absolute', top: 12, right: 12, zIndex: 1, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dismissTxt:     { fontSize: 16, fontWeight: '800' },
  previewRow:     { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  previewEmojiBox:{ width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  previewTitle:   { fontSize: 15, fontWeight: '900', lineHeight: 20 },
  previewMeta:    { fontSize: 12, fontWeight: '600' },
  previewBtn:     { borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
  previewBtnTxt:  { color: 'white', fontWeight: '900', fontSize: 14 },
});
