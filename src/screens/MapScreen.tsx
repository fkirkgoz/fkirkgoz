import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Event, EVENTS } from '../data/events';
import { Theme, C } from '../constants/theme';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

export default function MapScreen({ onEventPress, T }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>

      {/* ── Full-screen map — initialRegion so position persists on tab return ── */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude:      50.8503,
          longitude:     4.3517,
          latitudeDelta:  0.05,
          longitudeDelta: 0.05,
        }}
      >
        {EVENTS.map(ev => (
          <Marker
            key={ev.id}
            coordinate={{ latitude: ev.lat, longitude: ev.lng }}
            onPress={() => onEventPress(ev)}
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
          {EVENTS.length} events · tap a pin to open
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
  markerBubble: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  markerEmoji:  { fontSize: 18 },
});
