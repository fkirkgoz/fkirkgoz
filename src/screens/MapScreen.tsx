import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, EVENTS } from '../data/events';
import { Theme } from '../constants/theme';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

function spiderfyEvents(events: Event[]): Array<{ event: Event; lat: number; lng: number }> {
  const coordMap = new Map<string, Event[]>();
  for (const ev of events) {
    if (!ev.lat || !ev.lng || (ev.lat === 0 && ev.lng === 0)) continue;
    const key = `${ev.lat.toFixed(6)},${ev.lng.toFixed(6)}`;
    if (!coordMap.has(key)) coordMap.set(key, []);
    coordMap.get(key)!.push(ev);
  }
  const result: Array<{ event: Event; lat: number; lng: number }> = [];
  coordMap.forEach((evs) => {
    const n = evs.length;
    evs.forEach((ev, i) => {
      if (n === 1) {
        result.push({ event: ev, lat: ev.lat, lng: ev.lng });
      } else {
        const angle = (2 * Math.PI * i) / n;
        const radius = n <= 3 ? 0.00012 : n <= 6 ? 0.00018 : 0.00025;
        result.push({
          event: ev,
          lat: ev.lat + radius * Math.sin(angle),
          lng: ev.lng + radius * Math.cos(angle),
        });
      }
    });
  });
  return result;
}

export default function MapScreen({ onEventPress, T }: Props) {
  const insets = useSafeAreaInsets();

  const spiderfied  = useMemo(() => spiderfyEvents(EVENTS), []);
  const mappedCount = spiderfied.length;

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ latitude: 50.8503, longitude: 4.3517, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {spiderfied.map(({ event: ev, lat, lng }) => (
          <Marker
            key={ev.id}
            coordinate={{ latitude: lat, longitude: lng }}
            onPress={() => onEventPress(ev)}
            tracksViewChanges={false}
          >
            <View style={[styles.markerBubble, { backgroundColor: ev.color }]}>
              <Text style={styles.markerEmoji}>{ev.emoji}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={[styles.header, {
        paddingTop: insets.top + 8,
        backgroundColor: T.isDark ? 'rgba(26,26,26,0.93)' : 'rgba(255,255,255,0.93)',
      }]}>
        <Text style={[styles.headerTitle, { color: T.text }]}>🗺️ Brussels Events Map</Text>
        <Text style={[styles.headerSub, { color: T.sub }]}>
          {mappedCount} events · tap a pin to open
        </Text>
      </View>
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
});
