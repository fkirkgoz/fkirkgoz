import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, C } from '../constants/theme';
import { AuthUser } from './AuthScreen';
import {
  PublicUser, FriendshipView,
  getFriendships, listRegisteredUsers,
  sendFriendRequest, respondToFriendRequest, removeFriend,
} from '../lib/social';
import GradBg from '../components/GradBg';
import Tap from '../components/Tap';

type Tab = 'friends' | 'requests' | 'discover';

interface Props {
  user: AuthUser;
  onBack: () => void;
  onOpenChat: (peer: PublicUser) => void;
  T: Theme;
}

export default function FriendsScreen({ user, onBack, onOpenChat, T }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('friends');
  const [view, setView] = useState<FriendshipView>({ friends: [], incoming: [], outgoing: [] });
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [v, all] = await Promise.all([
        getFriendships(user.email),
        listRegisteredUsers(user.email),
      ]);
      setView(v);
      // Discover = registered accounts that aren't already friends or in a pending request
      const taken = new Set([
        ...v.friends.map(f => f.user.email),
        ...v.incoming.map(r => r.from.email),
        ...v.outgoing.map(r => r.to.email),
      ]);
      setPeople(all.filter(p => !taken.has(p.email)));
    } finally {
      setRefreshing(false);
    }
  }, [user.email]);

  useEffect(() => { refresh(); }, [refresh]);

  const doAdd = async (email: string) => { await sendFriendRequest(user.email, email); refresh(); };
  const doRespond = async (id: string, accept: boolean) => { await respondToFriendRequest(id, accept); refresh(); };
  const doRemove = async (email: string) => { await removeFriend(user.email, email); refresh(); };

  const filteredPeople = q
    ? people.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.email.toLowerCase().includes(q.toLowerCase()))
    : people;

  const requestCount = view.incoming.length;

  const TABS: [Tab, string][] = [
    ['friends',  `Friends · ${view.friends.length}`],
    ['requests', requestCount > 0 ? `Requests · ${requestCount}` : 'Requests'],
    ['discover', 'Find People'],
  ];

  const initials = (n: string) => (n || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      {/* Header */}
      <LinearGradient colors={[C.lav, C.teal] as [string, string]} style={[styles.headerGrad, { paddingTop: insets.top + 12 }]}>
        <Tap onPress={onBack}>
          <View style={styles.backBtn}><Text style={styles.backBtnTxt}>← Back</Text></View>
        </Tap>
        <Text style={styles.title}>👥 Friends</Text>
        <Text style={styles.subtitle}>Add people and chat about events</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: T.border }]}>
        {TABS.map(([key, label]) => (
          <Tap key={key} onPress={() => setTab(key)} style={{ flex: 1 }}>
            <View style={[styles.tabBtn, tab === key && { borderBottomColor: C.lav, borderBottomWidth: 3 }]}>
              <Text style={{ fontWeight: '800', fontSize: 13, color: tab === key ? C.lav : T.sub }}>{label}</Text>
            </View>
          </Tap>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.lav} />}
      >
        {/* ── Friends ── */}
        {tab === 'friends' && (
          view.friends.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🫂</Text>
              <Text style={[styles.emptyTitle, { color: T.text }]}>No friends yet</Text>
              <Text style={[styles.emptySub, { color: T.sub }]}>
                Head to "Find People" to add someone — friends can message each other about events.
              </Text>
            </View>
          ) : view.friends.map(({ user: f, since }) => (
            <View key={f.email} style={[styles.row, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={[styles.avatar, { backgroundColor: `${C.lav}30` }]}>
                <Text style={{ fontWeight: '900', color: C.lav, fontSize: 16 }}>{initials(f.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: T.text }]}>{f.name}</Text>
                <Text style={[styles.rowSub, { color: T.sub }]}>
                  Friends since {new Date(since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <Tap onPress={() => onOpenChat(f)}>
                <View style={[styles.actionBtn, { backgroundColor: C.lav }]}>
                  <Text style={styles.actionTxt}>💬 Chat</Text>
                </View>
              </Tap>
              <Tap onPress={() => doRemove(f.email)}>
                <View style={[styles.actionBtn, { backgroundColor: T.pill }]}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: T.sub }}>✕</Text>
                </View>
              </Tap>
            </View>
          ))
        )}

        {/* ── Requests ── */}
        {tab === 'requests' && (
          <>
            <Text style={[styles.sectionLabel, { color: T.sub }]}>INCOMING · {view.incoming.length}</Text>
            {view.incoming.length === 0 && (
              <Text style={[styles.emptySub, { color: T.sub, marginBottom: 18 }]}>No incoming requests.</Text>
            )}
            {view.incoming.map(r => (
              <View key={r.id} style={[styles.row, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={[styles.avatar, { backgroundColor: `${C.teal}30` }]}>
                  <Text style={{ fontWeight: '900', color: C.tealD, fontSize: 16 }}>{initials(r.from.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: T.text }]}>{r.from.name}</Text>
                  <Text style={[styles.rowSub, { color: T.sub }]}>wants to be friends</Text>
                </View>
                <Tap onPress={() => doRespond(r.id, true)}>
                  <View style={[styles.actionBtn, { backgroundColor: C.green }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.dark }}>✓ Accept</Text>
                  </View>
                </Tap>
                <Tap onPress={() => doRespond(r.id, false)}>
                  <View style={[styles.actionBtn, { backgroundColor: T.pill }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: T.sub }}>✕</Text>
                  </View>
                </Tap>
              </View>
            ))}

            <Text style={[styles.sectionLabel, { color: T.sub, marginTop: 20 }]}>SENT · {view.outgoing.length}</Text>
            {view.outgoing.length === 0 && (
              <Text style={[styles.emptySub, { color: T.sub }]}>No pending sent requests.</Text>
            )}
            {view.outgoing.map(r => (
              <View key={r.id} style={[styles.row, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={[styles.avatar, { backgroundColor: T.pill }]}>
                  <Text style={{ fontWeight: '900', color: T.sub, fontSize: 16 }}>{initials(r.to.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: T.text }]}>{r.to.name}</Text>
                  <Text style={[styles.rowSub, { color: T.sub }]}>request pending…</Text>
                </View>
                <Tap onPress={() => doRespond(r.id, false)}>
                  <View style={[styles.actionBtn, { backgroundColor: T.pill }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: T.sub }}>Cancel</Text>
                  </View>
                </Tap>
              </View>
            ))}
          </>
        )}

        {/* ── Discover ── */}
        {tab === 'discover' && (
          <>
            <View style={[styles.searchBox, { backgroundColor: T.input, borderColor: T.border }]}>
              <Text>🔍</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search by name or email…"
                placeholderTextColor={T.sub}
                autoCapitalize="none"
                style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.text }}
              />
            </View>
            {filteredPeople.length === 0 && (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🔭</Text>
                <Text style={[styles.emptyTitle, { color: T.text }]}>
                  {q ? 'No matches' : 'No one new to add'}
                </Text>
                <Text style={[styles.emptySub, { color: T.sub }]}>
                  {q
                    ? 'No registered account matches that search.'
                    : 'Everyone registered on this device is already connected with you.'}
                </Text>
              </View>
            )}
            {filteredPeople.map(p => (
              <View key={p.email} style={[styles.row, { backgroundColor: T.card, borderColor: T.border }]}>
                <View style={[styles.avatar, { backgroundColor: `${C.pink}40` }]}>
                  <Text style={{ fontWeight: '900', color: C.dark, fontSize: 16 }}>{initials(p.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: T.text }]}>{p.name}</Text>
                  {!!p.bio && <Text style={[styles.rowSub, { color: T.sub }]} numberOfLines={1}>{p.bio}</Text>}
                  {(p.vibes ?? []).length > 0 && (
                    <Text style={[styles.rowSub, { color: C.lav }]}>{(p.vibes ?? []).join(' · ')}</Text>
                  )}
                </View>
                <Tap onPress={() => doAdd(p.email)}>
                  <View style={[styles.actionBtn, { backgroundColor: C.lav }]}>
                    <Text style={styles.actionTxt}>+ Add</Text>
                  </View>
                </Tap>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </GradBg>
  );
}

const styles = StyleSheet.create({
  headerGrad:  { paddingHorizontal: 22, paddingBottom: 20 },
  backBtn:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 14 },
  backBtnTxt:  { color: 'white', fontWeight: '800', fontSize: 13 },
  title:       { fontSize: 22, fontWeight: '900', color: 'white' },
  subtitle:    { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  tabRow:      { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn:      { alignItems: 'center', paddingVertical: 13 },
  sectionLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 10 },
  avatar:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowName:     { fontSize: 14, fontWeight: '800' },
  rowSub:      { fontSize: 11, marginTop: 1 },
  actionBtn:   { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  actionTxt:   { color: 'white', fontSize: 12, fontWeight: '800' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 },
  empty:       { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle:  { fontWeight: '900', fontSize: 16 },
  emptySub:    { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
