import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Event } from '../data/events';
import { Theme, C } from '../constants/theme';
import SrcBadge from './SrcBadge';
import Tap from './Tap';

function fmtPrice(p: string) {
  if (!p) return '';
  if (p === 'Free') return 'Free';
  if (p.startsWith('From ') || p.startsWith('Free')) return p;
  const num = parseFloat(p.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return p;
  const sym = p.match(/[€$£]/)?.[0] ?? '€';
  return `${sym}${Number.isInteger(num) ? num : num.toFixed(2)}`;
}

interface EventCardProps {
  event: Event;
  onPress: () => void;
  T: Theme;
  joined: boolean;
}

export default function EventCard({ event: e, onPress, T, joined }: EventCardProps) {
  const [saved, setSaved] = useState(false);

  return (
    <Tap onPress={onPress}>
      <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
        <View style={[styles.colorBar, { backgroundColor: e.color }]} />
        <View style={styles.body}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={[styles.emojiBox, { backgroundColor: e.color }]}>
              <Text style={styles.emoji}>{e.emoji}</Text>
            </View>
            <View style={styles.titleText}>
              <Text style={[styles.title, { color: T.text }]} numberOfLines={1}>{e.title}</Text>
              <Text style={[styles.venue, { color: T.sub }]} numberOfLines={1}>📍 {e.venue}</Text>
            </View>
            <TouchableOpacity onPress={() => setSaved(s => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.heart}>{saved ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          {/* Badges row */}
          <View style={styles.badgeRow}>
            <SrcBadge source={e.source} />
            <View style={[styles.catBadge, { backgroundColor: T.pill }]}>
              <Text style={[styles.catBadgeTxt, { color: T.pillTxt }]}>{e.cat}</Text>
            </View>
            {joined && (
              <View style={[styles.catBadge, { backgroundColor: C.green }]}>
                <Text style={[styles.catBadgeTxt, { color: C.dark }]}>✓ Going</Text>
              </View>
            )}
            {(e.attendees ?? []).slice(0, 3).map((a, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: a.c, marginLeft: i === 0 ? 4 : -6 }]}>
                <Text style={styles.avatarTxt}>{a.n[0]}</Text>
              </View>
            ))}
            {e.going > 0 && (
              <Text style={[styles.goingCount, { color: T.sub }]}>+{e.going}</Text>
            )}
          </View>

          {/* Tags */}
          <View style={styles.tagRow}>
            {e.tags.map(t => (
              <View key={t} style={[styles.tag, { backgroundColor: T.pill }]}>
                <Text style={[styles.tagTxt, { color: T.pillTxt }]}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.timeText, { color: T.sub }]}>🗓 {e.date}  ⏰ {e.time}</Text>
            <View style={styles.footerRight}>
              {e.friends > 0 && (
                <Text style={[styles.friendsCount, { color: T.accent }]}>👥 {e.friends}</Text>
              )}
              {!!e.price && (
                <View style={[styles.priceBadge, {
                  backgroundColor: e.price === 'Free' ? C.green
                    : e.price === 'Sold Out' ? '#E8294A'
                    : C.pink,
                }]}>
                  <Text style={[styles.priceTxt, { color: e.price === 'Sold Out' ? '#fff' : C.dark }]}>
                    {fmtPrice(e.price)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  colorBar: { height: 5 },
  body: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  titleText: { flex: 1 },
  title: { fontWeight: '900', fontSize: 15, lineHeight: 20 },
  venue: { fontSize: 12, marginTop: 2 },
  heart: { fontSize: 20, paddingLeft: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  catBadgeTxt: { fontSize: 10, fontWeight: '800' },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 9, fontWeight: '800', color: '#22202E' },
  goingCount: { fontSize: 11, fontWeight: '700' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagTxt: { fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  timeText: { fontSize: 12 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendsCount: { fontSize: 11, fontWeight: '700' },
  priceBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  priceTxt: { fontSize: 12, fontWeight: '900' },
});
