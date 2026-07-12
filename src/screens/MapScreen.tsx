import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Pressable, Linking,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, EVENTS, eventMatchesDate } from '../data/events';
import { EDITORS_PICKS, PICK_STYLE } from '../config/editorsPicks';
import { Theme, C } from '../constants/theme';

type MapMode = 'events' | 'picks';

function prettyISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
  dateFilter?: string | null;
  onClearDateFilter?: () => void;
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

export default function MapScreen({ onEventPress, T, dateFilter = null, onClearDateFilter }: Props) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<VenueGroup | null>(null);
  const [mode, setMode] = useState<MapMode>('events');

  // Map markers respect the same single-date filter as the Home feed
  const visibleEvents = useMemo(
    () => dateFilter ? EVENTS.filter(e => eventMatchesDate(e, dateFilter)) : EVENTS,
    [dateFilter],
  );
  const groups      = useMemo(() => groupEvents(visibleEvents), [visibleEvents]);
  const mappedCount = useMemo(() => groups.reduce((s, g) => s + g.events.length, 0), [groups]);

  // Close any open venue sheet when the filter changes (its events may vanish)
  React.useEffect(() => { setSheet(null); }, [dateFilter]);

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
        {mode === 'events' && groups.map(group => {
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

        {/* Editor's Picks curated pins — tap opens Google Maps */}
        {mode === 'picks' && EDITORS_PICKS.map(p => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => Linking.openURL(p.link).catch(() => {})}
            tracksViewChanges={false}
          >
            <View style={[styles.markerBubble, { backgroundColor: p.color }]}>
              <Text style={styles.markerEmoji}>{p.emoji}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: T.isDark ? 'rgba(26,26,26,0.93)' : 'rgba(255,255,255,0.93)',
      }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          {mode === 'events' ? '🗺️ Brussels Events Map' : "✨ Editor's Picks Guide"}
        </Text>
        <Text style={[styles.headerSub, { color: T.sub }]}>
          {mode === 'events'
            ? `${mappedCount} events · ${groups.length} venues · tap a pin to open`
            : `${EDITORS_PICKS.length} curated cafés & restaurants · tap a pin for directions`}
        </Text>

        {/* Segmented toggle: Events ↔ Editor's Picks */}
        <View style={[styles.segment, { backgroundColor: T.pill }]}>
          {([['events', '🗓️ Events'], ['picks', '✨ Editor\'s Picks']] as [MapMode, string][]).map(([m, label]) => (
            <TouchableOpacity key={m} style={{ flex: 1 }} activeOpacity={0.8} onPress={() => { setMode(m); setSheet(null); }}>
              <View style={[styles.segmentBtn, mode === m && { backgroundColor: C.lav }]}>
                <Text style={[styles.segmentTxt, { color: mode === m ? 'white' : T.sub }]}>{label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'events' && dateFilter && (
          <View style={[styles.filterBar, { backgroundColor: `${C.lav}18`, borderColor: `${C.lav}40` }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.lav, flex: 1 }}>
              📅 {prettyISO(dateFilter)} only
            </Text>
            <TouchableOpacity onPress={() => onClearDateFilter?.()}>
              <View style={[styles.clearBadge, { backgroundColor: C.lav }]}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>✕ Clear</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Editor's Picks legend */}
      {mode === 'picks' && (
        <View style={[styles.legend, { backgroundColor: T.isDark ? 'rgba(26,26,26,0.93)' : 'rgba(255,255,255,0.93)', bottom: insets.bottom + 16 }]}>
          {(Object.keys(PICK_STYLE) as (keyof typeof PICK_STYLE)[]).map(k => (
            <View key={k} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: PICK_STYLE[k].color }]}>
                <Text style={{ fontSize: 12 }}>{PICK_STYLE[k].emoji}</Text>
              </View>
              <Text style={[styles.legendTxt, { color: T.text }]}>{PICK_STYLE[k].label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state when the date filter hides every pin */}
      {mode === 'events' && dateFilter && mappedCount === 0 && (
        <View style={styles.mapEmpty} pointerEvents="none">
          <View style={[styles.mapEmptyCard, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={{ fontSize: 30, marginBottom: 6 }}>🗓️</Text>
            <Text style={{ color: T.text, fontWeight: '800', fontSize: 14 }}>No mapped events on this date</Text>
            <Text style={{ color: T.sub, fontSize: 12, marginTop: 4, textAlign: 'center' }}>Clear the filter to see everything again.</Text>
          </View>
        </View>
      )}

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
  segment:      { flexDirection: 'row', borderRadius: 14, padding: 3, marginTop: 12, gap: 3 },
  segmentBtn:   { paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  segmentTxt:   { fontSize: 13, fontWeight: '800' },
  filterBar:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  clearBadge:   { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 5 },
  legend:       { position: 'absolute', left: 22, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white' },
  legendTxt:    { fontSize: 12, fontWeight: '800' },
  mapEmpty:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  mapEmptyCard: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },

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
