import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, EVENTS } from '../data/events';
import { Theme, C } from '../constants/theme';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

type VenueGroup = {
  key:    string;
  venue:  string;
  events: Event[];
  lat:    number;
  lng:    number;
};

function venueKey(venue: string): string {
  return venue.split(',')[0].toLowerCase().trim();
}

function groupEvents(events: Event[]): VenueGroup[] {
  const map = new Map<string, Event[]>();
  for (const ev of events) {
    if (!ev.lat || !ev.lng || (ev.lat === 0 && ev.lng === 0)) continue;
    const key = venueKey(ev.venue);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  const groups: VenueGroup[] = [];
  map.forEach((evs, key) => {
    const lat = evs.reduce((s, e) => s + e.lat, 0) / evs.length;
    const lng = evs.reduce((s, e) => s + e.lng, 0) / evs.length;
    groups.push({ key, venue: evs[0].venue.split(',')[0].trim(), events: evs, lat, lng });
  });
  return groups;
}

export default function MapScreen({ onEventPress, T }: Props) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<VenueGroup | null>(null);

  const groups      = useMemo(() => groupEvents(EVENTS), []);
  const mappedCount = useMemo(() => groups.reduce((s, g) => s + g.events.length, 0), [groups]);

  const onMarkerPress = (group: VenueGroup) => {
    if (group.events.length === 1) {
      onEventPress(group.events[0]);
    } else {
      setSheet(group);
    }
  };

  return (
    <View style={styles.container}>

      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: 50.8503, longitude: 4.3517, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {groups.map(group => {
          const first   = group.events[0];
          const isMulti = group.events.length > 1;

          return (
            <Marker
              key={group.key}
              coordinate={{ latitude: group.lat, longitude: group.lng }}
              onPress={() => onMarkerPress(group)}
              tracksViewChanges={false}
            >
              <View style={[styles.markerBubble, { backgroundColor: first.color }]}>
                <Text style={styles.markerEmoji}>{first.emoji}</Text>
                {isMulti && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{group.events.length}</Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: T.isDark ? 'rgba(26,26,26,0.93)' : 'rgba(255,255,255,0.93)',
      }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>🗺️ Brussels Events Map</Text>
        <Text style={[styles.headerSub, { color: T.sub }]}>
          {mappedCount} events · {groups.length} venues · tap a pin to open
        </Text>
      </View>

      {/* Venue bottom sheet */}
      {sheet && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSheet(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable style={[StyleSheet.absoluteFillObject, styles.overlay]} onPress={() => setSheet(null)} />

            <View style={[styles.sheet, { backgroundColor: T.card, paddingBottom: insets.bottom + 12 }]}>
              <View style={[styles.handle, { backgroundColor: T.border }]} />

              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetVenue, { color: T.text }]}>{sheet.venue}</Text>
                  <Text style={[styles.sheetSub, { color: T.sub }]}>
                    {sheet.events.length} upcoming events
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSheet(null)}>
                  <View style={[styles.closeBtn, { backgroundColor: T.pill }]}>
                    <Text style={{ color: T.sub, fontWeight: '700', fontSize: 13 }}>✕</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {sheet.events.map(ev => (
                  <TouchableOpacity
                    key={ev.id}
                    activeOpacity={0.75}
                    onPress={() => { setSheet(null); setTimeout(() => onEventPress(ev), 60); }}
                  >
                    <View style={[styles.eventRow, { borderColor: T.border }]}>
                      <View style={[styles.eventEmoji, { backgroundColor: `${ev.color}28` }]}>
                        <Text style={{ fontSize: 20 }}>{ev.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.eventTitle, { color: T.text }]} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={[styles.eventMeta, { color: T.sub }]}>
                          {ev.date} · {ev.time}
                        </Text>
                      </View>
                      <Text style={{ color: T.sub, fontSize: 18, paddingLeft: 4 }}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 22, paddingBottom: 14 },
  headerTitle:  { fontSize: 20, fontWeight: '900' },
  headerSub:    { fontSize: 12, marginTop: 2 },

  markerBubble: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  markerEmoji:  { fontSize: 18 },
  badge:        { position: 'absolute', top: -5, right: -5, backgroundColor: C.pink, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', paddingHorizontal: 3 },
  badgeTxt:     { color: 'white', fontSize: 10, fontWeight: '900' },

  overlay:      { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:        { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHead:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  sheetVenue:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sheetSub:     { fontSize: 12, marginTop: 3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  eventRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  eventEmoji:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventTitle:   { fontSize: 14, fontWeight: '700' },
  eventMeta:    { fontSize: 12, marginTop: 2 },
});
