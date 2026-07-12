import React, { useState, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, C } from '../constants/theme';
import Tap from './Tap';

// Self-contained month-grid calendar — no external dependency (keeps the Expo Go
// bundle stable). Pick a single day to filter the feed + map; Clear resets.

interface Props {
  visible: boolean;
  selected: string | null;         // ISO YYYY-MM-DD
  markedDates: Set<string>;        // ISO dates that have >= 1 event
  onSelect: (iso: string) => void;
  onClear: () => void;
  onClose: () => void;
  T: Theme;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DateFilterModal({ visible, selected, markedDates, onSelect, onClear, onClose, T }: Props) {
  const today = new Date();
  const todayISO = isoOf(today.getFullYear(), today.getMonth(), today.getDate());

  // Calendar view starts on the selected month, else the current month
  const initial = selected ? new Date(selected + 'T00:00:00') : today;
  const [viewY, setViewY] = useState(initial.getFullYear());
  const [viewM, setViewM] = useState(initial.getMonth());

  // Build the 6-row grid for the current view month (Monday-first)
  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    // JS getDay: 0=Sun … 6=Sat. Convert to Monday-first offset.
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewY, viewM]);

  const stepMonth = (delta: number) => {
    let m = viewM + delta, y = viewY;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  };

  const goToday = () => { setViewY(today.getFullYear()); setViewM(today.getMonth()); };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: T.card }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: T.text }]}>📅 Pick a date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 22, color: T.sub }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <Tap onPress={() => stepMonth(-1)}>
              <View style={[styles.navBtn, { backgroundColor: T.pill }]}>
                <Text style={{ color: T.accent, fontWeight: '900', fontSize: 16 }}>‹</Text>
              </View>
            </Tap>
            <Text style={[styles.monthLabel, { color: T.text }]}>{MONTHS[viewM]} {viewY}</Text>
            <Tap onPress={() => stepMonth(1)}>
              <View style={[styles.navBtn, { backgroundColor: T.pill }]}>
                <Text style={{ color: T.accent, fontWeight: '900', fontSize: 16 }}>›</Text>
              </View>
            </Tap>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map(w => (
              <Text key={w} style={[styles.weekday, { color: T.sub }]}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (d === null) return <View key={i} style={styles.cell} />;
              const iso = isoOf(viewY, viewM, d);
              const isSelected = iso === selected;
              const isToday = iso === todayISO;
              const hasEvents = markedDates.has(iso);
              const isPast = iso < todayISO;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.cell}
                  activeOpacity={0.7}
                  onPress={() => onSelect(iso)}
                >
                  {isSelected ? (
                    <LinearGradient colors={[C.lav, C.lavD] as [string, string]} style={styles.dayFill}>
                      <Text style={[styles.dayTxt, { color: 'white' }]}>{d}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.dayPlain, isToday && { borderColor: C.lav, borderWidth: 1.5 }]}>
                      <Text style={[styles.dayTxt, { color: isPast ? T.sub : T.text, opacity: isPast ? 0.5 : 1 }]}>{d}</Text>
                    </View>
                  )}
                  {hasEvents && !isSelected && <View style={[styles.dot, { backgroundColor: C.lav }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Tap onPress={goToday} style={{ flex: 1 }}>
              <View style={[styles.actionBtn, { backgroundColor: T.pill }]}>
                <Text style={{ color: T.accent, fontWeight: '800', fontSize: 14 }}>Today</Text>
              </View>
            </Tap>
            <Tap onPress={onClear} style={{ flex: 1 }}>
              <View style={[styles.actionBtn, { backgroundColor: selected ? '#FEE2E2' : T.pill }]}>
                <Text style={{ color: selected ? '#DC2626' : T.sub, fontWeight: '800', fontSize: 14 }}>Clear filter</Text>
              </View>
            </Tap>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:      { fontSize: 18, fontWeight: '900' },
  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '900' },
  weekRow:    { flexDirection: 'row', marginBottom: 6 },
  weekday:    { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:       { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayFill:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayPlain:   { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayTxt:     { fontSize: 14, fontWeight: '700' },
  dot:        { position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 2.5 },
  actions:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn:  { borderRadius: 16, paddingVertical: 13, alignItems: 'center' },
});
