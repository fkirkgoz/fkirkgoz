import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { EVENTS, Event } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
}

export default function NowScreen({ onEventPress, T }: Props) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const upd = () => {
      const n = new Date();
      setSecs(n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds());
    };
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);

  // Today events = anything labeled Today, Tonight, or Ongoing
  const todayEvents = EVENTS.filter(e => e.date === 'Today' || e.date === 'Tonight' || e.date === 'Ongoing');
  const curH = secs / 3600; // live clock hour (0–24)
  // Daytime events ('Today') show all day — they're open now regardless of clock position.
  // Evening events ('Tonight') use the hour window so they don't clutter before they start.
  const happening = todayEvents.filter(e => {
    if (e.date === 'Today' || e.date === 'Ongoing') return true;
    return e.startH !== undefined && curH >= e.startH && curH < e.endH;
  });
  const startingSoon = todayEvents.filter(e =>
    e.date === 'Tonight' && e.startH !== undefined && curH < e.startH && e.startH - curH <= 1
  );

  const hh = String(Math.floor(secs / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.isDark ? '#0D0D0D' : C.dark }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTxt}>LIVE NOW</Text>
        </View>
        <Text style={styles.title}>Happening in{'\n'}<Text style={{ color: C.teal }}>Brussels right now ⚡</Text></Text>
        <Text style={styles.demoNote}>Today, Tonight &amp; Ongoing events · live clock</Text>
      </View>

      {/* Live clock */}
      <View style={styles.clockCard}>
        {[[hh, 'HRS'], [mm, 'MIN'], [ss, 'SEC']].map(([val, label]) => (
          <View key={label} style={{ alignItems: 'center' }}>
            <Text style={styles.clockNum}>{val}</Text>
            <Text style={styles.clockLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Happening NOW */}
      {happening.length > 0 && (
        <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
          <Text style={styles.nowSectionLabel}>🔴 Happening Now</Text>
          <View style={{ gap: 12 }}>
            {happening.map(ev => (
              <Tap key={ev.id} onPress={() => onEventPress(ev)}>
                <View style={styles.nowCard}>
                  <View style={[styles.nowBar, { backgroundColor: ev.color }]} />
                  <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <View style={[styles.nowEmoji, { backgroundColor: ev.color }]}>
                        <Text style={{ fontSize: 20 }}>{ev.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nowTitle}>{ev.title}</Text>
                        <Text style={styles.nowVenue}>📍 {ev.venue}</Text>
                      </View>
                    </View>
                    <View style={styles.nowFooter}>
                      <View style={styles.nowLiveBadge}>
                        <Text style={styles.nowLiveTxt}>🔴 Now · {ev.time}</Text>
                      </View>
                      <Text style={{ color: C.teal, fontSize: 12, fontWeight: '700' }}>{ev.going} going</Text>
                    </View>
                  </View>
                </View>
              </Tap>
            ))}
          </View>
        </View>
      )}

      {/* Starting Soon */}
      {startingSoon.length > 0 && (
        <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
          <Text style={[styles.nowSectionLabel, { color: C.teal }]}>⏱ Starting Within 60 Minutes</Text>
          <View style={{ gap: 12 }}>
            {startingSoon.map(ev => {
              const minsUntil = Math.round((ev.startH - curH) * 60);
              return (
                <Tap key={ev.id} onPress={() => onEventPress(ev)}>
                  <View style={styles.soonCard}>
                    <View style={[styles.nowBar, { backgroundColor: ev.color }]} />
                    <View style={{ padding: 14 }}>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <View style={[styles.nowEmoji, { backgroundColor: ev.color }]}>
                          <Text style={{ fontSize: 20 }}>{ev.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.nowTitle}>{ev.title}</Text>
                          <Text style={styles.nowVenue}>📍 {ev.venue}</Text>
                        </View>
                      </View>
                      <View style={styles.nowFooter}>
                        <View style={styles.soonBadge}>
                          <Text style={styles.soonBadgeTxt}>⏱ In {minsUntil} min · {ev.time}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' }}>{ev.going} going</Text>
                      </View>
                    </View>
                  </View>
                </Tap>
              );
            })}
          </View>
        </View>
      )}

      {happening.length === 0 && startingSoon.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🌙</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.cream }}>All quiet right now</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 22, textAlign: 'center' }}>
            Next events kick off this evening.{'\n'}Check Home for the full schedule.
          </Text>
        </View>
      )}
      <Text style={styles.demoFooter}>Live clock · updates every second ↻</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header:       { paddingTop: 52, paddingHorizontal: 22 },
  liveBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E8294A', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 },
  liveDot:      { width: 8, height: 8, backgroundColor: 'white', borderRadius: 4 },
  liveTxt:      { color: 'white', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title:        { fontSize: 24, fontWeight: '900', color: C.cream, lineHeight: 32 },
  demoNote:     { fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 6 },
  clockCard:    { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 22, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: 22, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  clockNum:     { fontSize: 30, fontWeight: '900', color: C.teal, letterSpacing: -1 },
  clockLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: '700' },
  nowSectionLabel: { fontSize: 13, fontWeight: '900', color: '#E8294A', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  nowCard:      { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  soonCard:     { backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  nowBar:       { height: 5 },
  nowEmoji:     { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nowTitle:     { fontWeight: '900', fontSize: 15, color: C.cream },
  nowVenue:     { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  nowFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  nowLiveBadge: { backgroundColor: '#E8294A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  nowLiveTxt:   { color: 'white', fontSize: 12, fontWeight: '800' },
  soonBadge:    { backgroundColor: 'rgba(166,214,214,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  soonBadgeTxt: { color: C.teal, fontSize: 12, fontWeight: '800' },
  demoFooter:   { textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.22)', fontWeight: '600', paddingBottom: 8 },
});
