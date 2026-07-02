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
  const [sort, setSort] = useState<'date-asc' | 'date-desc' | 'alpha-asc' | 'alpha-desc'>('date-asc');
  const [sortOpen, setSortOpen] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const SORT_OPTIONS = [
    ['date-asc',   '📅 Earliest first'],
    ['date-desc',  '📅 Latest first'],
    ['alpha-asc',  '🔤 A → Z'],
    ['alpha-desc', '🔤 Z → A'],
  ] as const;
  const currentSortLabel = SORT_OPTIONS.find(([m]) => m === sort)?.[1] ?? '📅 Earliest first';

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

  const DATE_WEIGHT: Record<string, number> = {
    Today: 0, Tonight: 1, Tomorrow: 2, 'This Weekend': 3,
    'Next Week': 4, 'Next Month': 5, Ongoing: 99,
  };
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'alpha-asc':  return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'alpha-desc': return arr.sort((a, b) => b.title.localeCompare(a.title));
      case 'date-desc':
        return arr.sort((a, b) => {
          const wa = DATE_WEIGHT[a.date] ?? 6;
          const wb = DATE_WEIGHT[b.date] ?? 6;
          if (wa !== wb) return wb - wa;
          return (b.startH ?? 0) - (a.startH ?? 0);
        });
      default: // 'date-asc'
        return arr.sort((a, b) => {
          const wa = DATE_WEIGHT[a.date] ?? 6;
          const wb = DATE_WEIGHT[b.date] ?? 6;
          if (wa !== wb) return wa - wb;
          return (a.startH ?? 0) - (b.startH ?? 0);
        });
    }
  }, [filtered, sort]);

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
      </View>

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

      {/* Sort dropdown */}
      {!q && (
        <View style={{ paddingHorizontal: 22, marginTop: 12 }}>
          <Tap onPress={() => setSortOpen(s => !s)}>
            <View style={[styles.sortHeader, { backgroundColor: T.card, borderColor: T.border }]}>
              <Text style={[styles.sortLabel, { color: T.sub }]}>Sort</Text>
              <Text style={[styles.sortHeaderValue, { color: T.text }]}>{currentSortLabel}</Text>
              <Text style={{ color: T.sub, fontSize: 11, fontWeight: '700' }}>{sortOpen ? '▲' : '▼'}</Text>
            </View>
          </Tap>
          {sortOpen && (
            <View style={[styles.sortDropdown, { backgroundColor: T.card, borderColor: T.border }]}>
              {SORT_OPTIONS.map(([mode, label]) => {
                const active = sort === mode;
                return (
                  <Tap key={mode} onPress={() => { setSort(mode); setSortOpen(false); }}>
                    <View style={[styles.sortOption, { borderBottomColor: T.border }]}>
                      <Text style={[styles.sortOptionTxt, { color: active ? T.accent : T.text }]}>{label}</Text>
                      {active && <Text style={{ color: T.accent, fontWeight: '900' }}>✓</Text>}
                    </View>
                  </Tap>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Section label */}
      <View style={{ paddingHorizontal: 22, marginTop: 18, marginBottom: 14 }}>
        <Text style={[styles.sectionLabel, { color: T.sub }]}>
          {q ? `Results for "${q}"` : cat !== 'All' ? cat : date !== 'All' ? date : 'All events'} · {sorted.length}
        </Text>
      </View>
    </View>
  );

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      <FlatList
        data={sorted}
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
  sortLabel:         { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sortHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5 },
  sortHeaderValue:   { flex: 1, fontSize: 13, fontWeight: '700' },
  sortDropdown:      { borderRadius: 16, borderWidth: 1.5, marginTop: 6, overflow: 'hidden' },
  sortOption:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sortOptionTxt:     { fontSize: 13, fontWeight: '700' },
  noResultsTitle:    { fontWeight: '700', fontSize: 16 },
  noResultsSub:      { fontSize: 13, marginTop: 6 },
});
