import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, FlatList,
} from 'react-native';
import { Theme, C } from '../constants/theme';
import { Locale, t } from '../i18n';
import { EVENTS, CATS, DATES, Event } from '../data/events';
import EventCard from '../components/EventCard';
import GradBg from '../components/GradBg';
import Tap from '../components/Tap';

interface Props {
  onEventPress: (e: Event) => void;
  T: Theme;
  myEvents: Event[];
  locale?: Locale;
}

export default function HomeScreen({ onEventPress, T, myEvents, locale = 'en' }: Props) {
  const [cat,  setCat]  = useState('All');
  const [date, setDate] = useState('All');
  const [q, setQ]       = useState('');
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [nRead, setNRead] = useState(false);
  const searchRef = useRef<TextInput>(null);

  // Build date pill list: standard labels first, then any named-month labels
  // (e.g. 'July', 'August') that exist in the current event data.
  const availableDates = useMemo(() => {
    const seen = new Set(DATES);
    const extra: string[] = [];
    for (const e of EVENTS) {
      if (e.date && !seen.has(e.date) && e.date !== 'Ongoing') {
        seen.add(e.date);
        extra.push(e.date);
      }
    }
    return [...DATES, ...extra];
  }, []);

  const filtered = useMemo(() => EVENTS.filter(e => {
    if (cat  !== 'All' && e.cat  !== cat)  return false;
    if (date !== 'All' && e.date !== date) return false;
    if (q) {
      const ql = q.toLowerCase();
      return (
        e.title.toLowerCase().includes(ql) ||
        e.venue.toLowerCase().includes(ql) ||
        e.tags.some(t => t.toLowerCase().includes(ql)) ||
        e.cat.toLowerCase().includes(ql)
      );
    }
    return true;
  }), [cat, date, q]);

  const listHeader = (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerCity, { color: T.sub }]}>Brussels 🇧🇪</Text>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            What's your{'\n'}<Text style={{ color: T.accent }}>vibe tonight?</Text>
          </Text>
        </View>
        <View>
          <Tap onPress={() => { setNotifOpen(s => !s); setNRead(true); }}>
            <View style={[styles.bellBtn, { backgroundColor: notifOpen ? T.accent : undefined }]}>
              <Text style={styles.bellEmoji}>🔔</Text>
            </View>
          </Tap>
          {!nRead && <View style={[styles.bellDot, { borderColor: T.bg }]} />}
        </View>
      </View>

      {/* Notification panel */}
      {notifOpen && (
        <View style={[styles.notifPanel, { backgroundColor: T.card, borderColor: T.border }]}>
          <Text style={[styles.notifTitle, { color: T.text }]}>🔔 Notifications</Text>
          {[
            { e: '🎛️', t: '3 friends added Fuse RA Night — join?', a: '2m ago' },
            { e: '⚽',  t: 'Union SG fan zone filling up fast!',     a: '15m ago' },
            { e: '🌿', t: 'Canal Cleanup starts in 1 hour.',         a: '45m ago' },
          ].map((n, i) => (
            <View key={i} style={[styles.notifRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
              <Text style={{ fontSize: 18 }}>{n.e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifText, { color: T.text }]}>{n.t}</Text>
                <Text style={[styles.notifTime, { color: T.sub }]}>{n.a}</Text>
              </View>
            </View>
          ))}
          <Tap onPress={() => setNotifOpen(false)}>
            <View style={[styles.dismissBtn, { backgroundColor: T.pill }]}>
              <Text style={[styles.dismissTxt, { color: T.sub }]}>Dismiss all</Text>
            </View>
          </Tap>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        {searching ? (
          <View style={styles.searchActive}>
            <View style={[styles.searchInner, { backgroundColor: T.input, borderColor: T.accent }]}>
              <Text>🔍</Text>
              <TextInput
                ref={searchRef}
                value={q}
                onChangeText={setQ}
                placeholder={t('home.searchActive', locale)}
                placeholderTextColor={T.sub}
                style={[styles.searchInput, { color: T.text }]}
                autoFocus
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ('')}>
                  <Text style={{ color: T.sub, fontSize: 20 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSearching(false); setQ(''); }}>
              <Text style={{ color: T.accent, fontWeight: '800', fontSize: 13 }}>{t('home.cancel', locale)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Tap onPress={() => setSearching(true)}>
            <View style={[styles.searchPlaceholder, { backgroundColor: T.input }]}>
              <Text>🔍</Text>
              <Text style={[styles.searchPlaceholderTxt, { color: T.sub }]}>{t('home.search', locale)}</Text>
            </View>
          </Tap>
        )}
      </View>

      {/* Category filter */}
      {!q && (
        <View style={{ marginTop: 18 }}>
          <Text style={[styles.sectionLabel, { color: T.sub, paddingLeft: 22 }]}>{t('home.category', locale)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 9, paddingTop: 10 }}>
            {CATS.map(c => {
              const active = cat === c;
              return (
                <Tap key={c} onPress={() => setCat(active ? 'All' : c)}>
                  <View style={[
                    styles.filterChip,
                    { backgroundColor: active ? T.accent : T.card, borderColor: active ? T.accent : T.border },
                  ]}>
                    <Text style={[styles.filterChipTxt, { color: active ? C.white : T.text }]}>{c}</Text>
                  </View>
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Date tabs */}
      {!q && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 8, paddingTop: 12, paddingBottom: 2 }}>
          {availableDates.map(d => (
            <Tap key={d} onPress={() => setDate(d)}>
              <View style={[
                styles.datePill,
                { backgroundColor: date === d ? T.text : 'transparent', borderColor: date === d ? T.text : `${T.sub}55` },
              ]}>
                <Text style={{ color: date === d ? T.bg : T.sub, fontSize: 12, fontWeight: '700' }}>{d}</Text>
              </View>
            </Tap>
          ))}
        </ScrollView>
      )}

      {/* FOMO banner */}
      {!q && date === 'All' && cat === 'All' && (
        <Tap onPress={() => onEventPress(EVENTS[0])} style={{ marginHorizontal: 22, marginTop: 14 }}>
          <View style={styles.fomoBanner}>
            <Text style={{ fontSize: 24 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.fomoTitle}>3 friends going to the RA Techno Night!</Text>
              <Text style={styles.fomoSub}>Fuse · Tonight · Only 12 spots left</Text>
            </View>
            <View style={styles.fomoJoin}>
              <Text style={styles.fomoJoinTxt}>Join →</Text>
            </View>
          </View>
        </Tap>
      )}

      {/* Section label */}
      <View style={{ paddingHorizontal: 22, marginTop: 18, marginBottom: 14 }}>
        <Text style={[styles.sectionLabel, { color: T.sub }]}>
          {q ? `Results for "${q}"` : cat !== 'All' ? cat : date !== 'All' ? date : 'All events'} · {filtered.length}
        </Text>
      </View>
    </View>
  );

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      <FlatList
        data={filtered}
        keyExtractor={ev => String(ev.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item: ev }) => (
          <View style={{ paddingHorizontal: 22 }}>
            <EventCard
              event={ev}
              onPress={() => onEventPress(ev)}
              T={T}
              joined={myEvents.some(m => m.id === ev.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 22 }}>
            <Text style={{ fontSize: 44, marginBottom: 10 }}>😕</Text>
            <Text style={[styles.noResultsTitle, { color: T.text }]}>{t('home.noResults', locale)}</Text>
            <Text style={[styles.noResultsSub, { color: T.sub }]}>{t('home.noResultsSub', locale)}</Text>
          </View>
        }
      />
    </GradBg>
  );
}

const styles = StyleSheet.create({
  header:            { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCity:        { fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle:       { fontSize: 27, fontWeight: '900', lineHeight: 34, marginTop: 4, letterSpacing: -0.5 },
  bellBtn:           { width: 46, height: 46, borderRadius: 23, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center', shadowColor: C.lav, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  bellEmoji:         { fontSize: 20 },
  bellDot:           { position: 'absolute', top: 2, right: 2, width: 11, height: 11, backgroundColor: C.pink, borderWidth: 2, borderRadius: 6 },
  notifPanel:        { marginHorizontal: 22, marginTop: 10, borderRadius: 22, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8, zIndex: 100 },
  notifTitle:        { fontWeight: '900', fontSize: 14, marginBottom: 12 },
  notifRow:          { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  notifText:         { fontSize: 12, fontWeight: '700', lineHeight: 18 },
  notifTime:         { fontSize: 11, marginTop: 2 },
  dismissBtn:        { marginTop: 10, borderRadius: 12, padding: 8, alignItems: 'center' },
  dismissTxt:        { fontSize: 12, fontWeight: '800' },
  searchWrap:        { paddingHorizontal: 22, marginTop: 16 },
  searchActive:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInner:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2 },
  searchInput:       { flex: 1, fontSize: 14, fontWeight: '600' },
  searchPlaceholder: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: C.lav, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 3 },
  searchPlaceholderTxt: { fontSize: 14, fontWeight: '600' },
  sectionLabel:      { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  filterChip:        { borderRadius: 16, paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1.5 },
  filterChipTxt:     { fontSize: 12, fontWeight: '800' },
  datePill:          { borderRadius: 50, paddingHorizontal: 15, paddingVertical: 7, borderWidth: 1.5 },
  fomoBanner:        { backgroundColor: C.lav, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fomoTitle:         { color: C.white, fontWeight: '900', fontSize: 13 },
  fomoSub:           { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2 },
  fomoJoin:          { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  fomoJoinTxt:       { color: C.white, fontSize: 12, fontWeight: '800' },
  noResultsTitle:    { fontWeight: '700', fontSize: 16 },
  noResultsSub:      { fontSize: 13, marginTop: 6 },
});
