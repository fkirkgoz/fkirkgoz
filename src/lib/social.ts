import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../screens/AuthScreen';

// ── Real friendship & messaging data layer ─────────────────────────────────────
// 100% real data — no seeded messages, no fake friends, no mock notifications.
// Every row in these stores was created by an actual user action.
//
// Storage schemas:
//
// @randevu_friendships_v1 : Friendship[]
//   {
//     id:          string          // unique row id
//     requester:   string          // email (lowercase) of the user who sent the request
//     addressee:   string          // email (lowercase) of the user who received it
//     status:      'pending' | 'accepted'
//     createdAt:   string          // ISO timestamp
//     respondedAt: string | null   // ISO timestamp when accepted
//   }
//   Declining a request deletes the row (no 'declined' tombstones to re-surface).
//
// @randevu_messages_v1 : Message[]
//   {
//     id:        string
//     sender:    string            // email (lowercase)
//     receiver:  string            // email (lowercase)
//     text:      string
//     timestamp: string            // ISO timestamp
//     readAt:    string | null     // ISO timestamp when the receiver opened it
//   }
//
// Scope note: this device-local store is the single source of truth for all
// accounts registered on this device (@randevu_users), which is exactly what
// TestFlight review and multi-account device testing need. The API surface
// (sendFriendRequest / respondToFriendRequest / sendMessage / getConversation)
// is deliberately backend-shaped so a server sync can replace the storage layer
// without touching any UI component.

const FRIENDSHIPS_KEY = '@randevu_friendships_v1';
const MESSAGES_KEY    = '@randevu_messages_v1';
const USERS_KEY       = '@randevu_users';

export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  id: string;
  requester: string;
  addressee: string;
  status: FriendshipStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  text: string;
  timestamp: string;
  readAt: string | null;
}

// Public, non-sensitive projection of a registered account.
// Passwords and phone numbers never leave this module.
export interface PublicUser {
  name: string;
  email: string;
  bio?: string;
  vibes?: string[];
}

const norm = (email: string) => (email || '').trim().toLowerCase();
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function loadList<T>(key: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(key);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveList<T>(key: string, list: T[]): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(list)); } catch {}
}

// ── Users directory ────────────────────────────────────────────────────────────
export async function listRegisteredUsers(excludeEmail?: string): Promise<PublicUser[]> {
  const users = await loadList<AuthUser>(USERS_KEY);
  const ex = norm(excludeEmail ?? '');
  return users
    .filter(u => norm(u.email) !== ex)
    .map(u => ({ name: u.name, email: norm(u.email), bio: u.bio, vibes: u.vibes }));
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const users = await loadList<AuthUser>(USERS_KEY);
  const found = users.find(u => norm(u.email) === norm(email));
  return found ? { name: found.name, email: norm(found.email), bio: found.bio, vibes: found.vibes } : null;
}

// ── Friendships ────────────────────────────────────────────────────────────────
function pairMatch(f: Friendship, a: string, b: string): boolean {
  return (f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a);
}

export async function sendFriendRequest(fromEmail: string, toEmail: string): Promise<Friendship | null> {
  const from = norm(fromEmail), to = norm(toEmail);
  if (!from || !to || from === to) return null;
  const list = await loadList<Friendship>(FRIENDSHIPS_KEY);
  if (list.some(f => pairMatch(f, from, to))) return null; // already pending or friends
  const row: Friendship = {
    id: newId(), requester: from, addressee: to,
    status: 'pending', createdAt: new Date().toISOString(), respondedAt: null,
  };
  await saveList(FRIENDSHIPS_KEY, [...list, row]);
  return row;
}

export async function respondToFriendRequest(id: string, accept: boolean): Promise<void> {
  const list = await loadList<Friendship>(FRIENDSHIPS_KEY);
  const next = accept
    ? list.map(f => f.id === id ? { ...f, status: 'accepted' as const, respondedAt: new Date().toISOString() } : f)
    : list.filter(f => f.id !== id);
  await saveList(FRIENDSHIPS_KEY, next);
}

export async function removeFriend(myEmail: string, friendEmail: string): Promise<void> {
  const me = norm(myEmail), them = norm(friendEmail);
  const list = await loadList<Friendship>(FRIENDSHIPS_KEY);
  await saveList(FRIENDSHIPS_KEY, list.filter(f => !pairMatch(f, me, them)));
}

export interface FriendshipView {
  friends:  { user: PublicUser; since: string }[];
  incoming: { id: string; from: PublicUser; at: string }[];
  outgoing: { id: string; to: PublicUser; at: string }[];
}

export async function getFriendships(myEmail: string): Promise<FriendshipView> {
  const me = norm(myEmail);
  const [list, users] = await Promise.all([
    loadList<Friendship>(FRIENDSHIPS_KEY),
    loadList<AuthUser>(USERS_KEY),
  ]);
  const byEmail = new Map(users.map(u => [norm(u.email), u]));
  const pub = (email: string): PublicUser => {
    const u = byEmail.get(email);
    return u
      ? { name: u.name, email, bio: u.bio, vibes: u.vibes }
      : { name: email, email }; // account deleted — show address stub
  };

  const friends:  FriendshipView['friends']  = [];
  const incoming: FriendshipView['incoming'] = [];
  const outgoing: FriendshipView['outgoing'] = [];

  for (const f of list) {
    if (f.status === 'accepted') {
      if (f.requester === me) friends.push({ user: pub(f.addressee), since: f.respondedAt ?? f.createdAt });
      else if (f.addressee === me) friends.push({ user: pub(f.requester), since: f.respondedAt ?? f.createdAt });
    } else if (f.status === 'pending') {
      if (f.addressee === me) incoming.push({ id: f.id, from: pub(f.requester), at: f.createdAt });
      else if (f.requester === me) outgoing.push({ id: f.id, to: pub(f.addressee), at: f.createdAt });
    }
  }
  return { friends, incoming, outgoing };
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const list = await loadList<Friendship>(FRIENDSHIPS_KEY);
  return list.some(f => f.status === 'accepted' && pairMatch(f, norm(a), norm(b)));
}

// ── Messages ───────────────────────────────────────────────────────────────────
export async function sendMessage(fromEmail: string, toEmail: string, text: string): Promise<Message | null> {
  const from = norm(fromEmail), to = norm(toEmail);
  const body = (text || '').trim();
  if (!from || !to || !body) return null;
  const row: Message = {
    id: newId(), sender: from, receiver: to,
    text: body.slice(0, 2000), timestamp: new Date().toISOString(), readAt: null,
  };
  const list = await loadList<Message>(MESSAGES_KEY);
  await saveList(MESSAGES_KEY, [...list, row]);
  return row;
}

export async function getConversation(myEmail: string, peerEmail: string): Promise<Message[]> {
  const me = norm(myEmail), peer = norm(peerEmail);
  const list = await loadList<Message>(MESSAGES_KEY);
  return list
    .filter(m => (m.sender === me && m.receiver === peer) || (m.sender === peer && m.receiver === me))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function markConversationRead(myEmail: string, peerEmail: string): Promise<void> {
  const me = norm(myEmail), peer = norm(peerEmail);
  const list = await loadList<Message>(MESSAGES_KEY);
  let changed = false;
  const next = list.map(m => {
    if (m.receiver === me && m.sender === peer && !m.readAt) {
      changed = true;
      return { ...m, readAt: new Date().toISOString() };
    }
    return m;
  });
  if (changed) await saveList(MESSAGES_KEY, next);
}

export async function getUnreadCount(myEmail: string): Promise<number> {
  const me = norm(myEmail);
  const list = await loadList<Message>(MESSAGES_KEY);
  return list.filter(m => m.receiver === me && !m.readAt).length;
}

// ── Real notification feed ─────────────────────────────────────────────────────
// Derived exclusively from live data: pending friend requests + unread messages.
export interface SocialNotification {
  kind: 'friend_request' | 'message';
  from: PublicUser;
  at: string;
  count?: number;   // unread count for message notifications
}

export async function getNotifications(myEmail: string): Promise<SocialNotification[]> {
  const me = norm(myEmail);
  const [{ incoming }, msgs] = await Promise.all([
    getFriendships(me),
    loadList<Message>(MESSAGES_KEY),
  ]);

  const notes: SocialNotification[] = incoming.map(r => ({
    kind: 'friend_request' as const, from: r.from, at: r.at,
  }));

  const unreadBySender = new Map<string, { latest: string; count: number }>();
  for (const m of msgs) {
    if (m.receiver === me && !m.readAt) {
      const cur = unreadBySender.get(m.sender);
      unreadBySender.set(m.sender, {
        latest: cur && cur.latest > m.timestamp ? cur.latest : m.timestamp,
        count: (cur?.count ?? 0) + 1,
      });
    }
  }
  for (const [sender, { latest, count }] of unreadBySender) {
    const from = await getUserByEmail(sender);
    notes.push({ kind: 'message', from: from ?? { name: sender, email: sender }, at: latest, count });
  }

  return notes.sort((a, b) => b.at.localeCompare(a.at));
}

// ── Account lifecycle ──────────────────────────────────────────────────────────
// Called on account deletion so no orphaned social rows survive (GDPR hygiene).
export async function purgeUserSocialData(email: string): Promise<void> {
  const me = norm(email);
  const [friendships, messages] = await Promise.all([
    loadList<Friendship>(FRIENDSHIPS_KEY),
    loadList<Message>(MESSAGES_KEY),
  ]);
  await Promise.all([
    saveList(FRIENDSHIPS_KEY, friendships.filter(f => f.requester !== me && f.addressee !== me)),
    saveList(MESSAGES_KEY, messages.filter(m => m.sender !== me && m.receiver !== me)),
  ]);
}
