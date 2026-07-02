import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, C } from '../constants/theme';
import { AdminMetrics, getAdminMetrics, isAdminUser } from '../lib/metrics';
import { AuthUser } from './AuthScreen';
import GradBg from '../components/GradBg';
import Tap from '../components/Tap';

interface Props {
  onBack: () => void;
  user: AuthUser | null;
  T: Theme;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminScreen({ onBack, user, T }: Props) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const authorized = isAdminUser(user);

  const refresh = useCallback(async () => {
    if (!authorized) return;
    setRefreshing(true);
    try { setMetrics(await getAdminMetrics()); } finally { setRefreshing(false); }
  }, [authorized]);

  useEffect(() => { refresh(); }, [refresh]);

  // Defense in depth: the route is only registered for the admin profile, but
  // even if this screen is ever mounted another way, it renders no data.
  if (!authorized) {
    return (
      <GradBg isDark={T.isDark} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={{ color: T.text, fontWeight: '900', fontSize: 16 }}>Access denied</Text>
        <Tap onPress={onBack}>
          <View style={{ marginTop: 18, backgroundColor: C.lav, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: 'white', fontWeight: '800' }}>← Back</Text>
          </View>
        </Tap>
      </GradBg>
    );
  }

  const tiles: [string, string | number, string][] = metrics ? [
    ['👥', metrics.totalAccounts,   'Accounts'],
    ['🕐', metrics.sessionsLast7d,  'Sessions · 7d'],
    ['💾', metrics.totalEventSaves, 'Event saves'],
  ] : [];

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.lav} />}
      >
        {/* Header */}
        <LinearGradient colors={[C.lavD, C.lav] as [string, string]} style={styles.headerGrad}>
          <Tap onPress={onBack}>
            <View style={styles.backBtn}>
              <Text style={styles.backBtnTxt}>← Back</Text>
            </View>
          </Tap>
          <Text style={styles.title}>🛡️ Admin Console</Text>
          <Text style={styles.subtitle}>
            Operational metrics · updated {metrics ? fmtTime(metrics.generatedAt) : '…'}
          </Text>
        </LinearGradient>

        <View style={{ padding: 22 }}>
          {/* Metric tiles */}
          <View style={styles.tileRow}>
            {tiles.map(([icon, val, label]) => (
              <View key={label} style={[styles.tile, { backgroundColor: T.card, borderColor: T.border }]}>
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={[styles.tileVal, { color: T.accent }]}>{val}</Text>
                <Text style={[styles.tileLabel, { color: T.sub }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Registered accounts */}
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>
              👥 Registered accounts · {metrics?.totalAccounts ?? 0}
            </Text>
            <Text style={[styles.privacyNote, { color: T.sub }]}>
              Emails masked · passwords are never read by this console
            </Text>
            {(metrics?.accounts ?? []).length === 0 && (
              <Text style={[styles.emptyTxt, { color: T.sub }]}>No accounts registered on this device yet.</Text>
            )}
            {(metrics?.accounts ?? []).map((a, i) => (
              <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowMain, { color: T.text }]}>{a.name}</Text>
                  <Text style={[styles.rowSub, { color: T.sub }]}>{a.emailMasked}</Text>
                  {a.vibes.length > 0 && (
                    <Text style={[styles.rowSub, { color: T.sub }]}>{a.vibes.join(' · ')}</Text>
                  )}
                </View>
                <Text style={[styles.rowTime, { color: T.sub }]}>{fmtTime(a.createdAt)}</Text>
              </View>
            ))}
          </View>

          {/* Recent sessions */}
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>
              🕐 Recent sessions · {metrics?.totalSessions ?? 0} total
            </Text>
            {(metrics?.recentSessions ?? []).length === 0 && (
              <Text style={[styles.emptyTxt, { color: T.sub }]}>No sessions logged yet.</Text>
            )}
            {(metrics?.recentSessions ?? []).map((s, i) => (
              <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={[styles.rowMain, { color: T.text, flex: 1 }]}>{s.emailMasked}</Text>
                <Text style={[styles.rowTime, { color: T.sub }]}>{fmtTime(s.at)}</Text>
              </View>
            ))}
          </View>

          {/* Saved event analytics */}
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>
              💾 Top saved events
            </Text>
            {(metrics?.topSavedEvents ?? []).length === 0 && (
              <Text style={[styles.emptyTxt, { color: T.sub }]}>
                No event saves yet — counts appear when users tap "I'm Going!".
              </Text>
            )}
            {(metrics?.topSavedEvents ?? []).map((ev, i) => (
              <View key={ev.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowMain, { color: T.text }]} numberOfLines={1}>{ev.title}</Text>
                  <Text style={[styles.rowSub, { color: T.sub }]}>{ev.venue}</Text>
                </View>
                <View style={[styles.saveBadge, { backgroundColor: `${C.lav}18` }]}>
                  <Text style={{ color: C.lav, fontWeight: '900', fontSize: 12 }}>{ev.saves}×</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </GradBg>
  );
}

const styles = StyleSheet.create({
  headerGrad:  { paddingTop: 52, paddingHorizontal: 22, paddingBottom: 24 },
  backBtn:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 18 },
  backBtnTxt:  { color: 'white', fontWeight: '800', fontSize: 13 },
  title:       { fontSize: 22, fontWeight: '900', color: 'white' },
  subtitle:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  tileRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile:        { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, alignItems: 'center', gap: 2 },
  tileVal:     { fontSize: 22, fontWeight: '900' },
  tileLabel:   { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  card:        { borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1 },
  cardTitle:   { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  privacyNote: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  emptyTxt:    { fontSize: 13, fontWeight: '600', paddingVertical: 10 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowMain:     { fontSize: 13, fontWeight: '800' },
  rowSub:      { fontSize: 11, marginTop: 1 },
  rowTime:     { fontSize: 11, fontWeight: '600' },
  saveBadge:   { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
});
