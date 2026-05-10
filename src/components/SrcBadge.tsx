import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';

const BADGE_COLORS: Record<string, { bg: string; tx: string }> = {
  RA:              { bg: '#1a1a2e', tx: '#e0d7ff' },
  'Visit.Brussels':{ bg: '#003580', tx: '#cce4ff' },
  'Brussels.be':   { bg: '#005f3e', tx: '#c8f0dc' },
  'The Guide BXL': { bg: '#8B2252', tx: '#ffd6ec' },
  Randevu:         { bg: C.lav,    tx: C.white    },
  URBSFA:          { bg: '#c0392b', tx: '#ffd6d6' },
};

export default function SrcBadge({ source }: { source: string }) {
  const c = BADGE_COLORS[source] ?? { bg: C.mid, tx: C.white };
  return (
    <Text style={[styles.badge, { backgroundColor: c.bg, color: c.tx }]}>
      {source}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    overflow: 'hidden',
  },
});
