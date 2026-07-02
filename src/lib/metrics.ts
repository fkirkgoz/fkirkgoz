import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser } from '../screens/AuthScreen';

// ── Operational metrics store ──────────────────────────────────────────────────
// AsyncStorage-backed metrics layer. Records genuine app activity:
//   · account creation timestamps
//   · session start timestamps (per login / auto-login)
//   · event save/unsave analytics (which events users actually join)
//
// Storage schema (key: @randevu_metrics_v1):
// {
//   accountsCreated: { email: string; at: string }[]     // ISO timestamps
//   sessions:        { email: string; at: string }[]     // capped at SESSION_CAP
//   eventSaves:      Record<string, {                    // keyed by event id
//     id: number; title: string; venue: string;
//     saves: number; lastSavedAt: string;
//   }>
// }
//
// Privacy: emails are stored as-entered (needed to join against @randevu_users)
// but are ALWAYS masked before display — see maskEmail(). Passwords never enter
// this store and are never surfaced by getAdminMetrics().

const METRICS_KEY = '@randevu_metrics_v1';
const USERS_KEY   = '@randevu_users';
const SESSION_CAP = 200;

export interface MetricsStore {
  accountsCreated: { email: string; at: string }[];
  sessions:        { email: string; at: string }[];
  eventSaves:      Record<string, { id: number; title: string; venue: string; saves: number; lastSavedAt: string }>;
}

const EMPTY: MetricsStore = { accountsCreated: [], sessions: [], eventSaves: {} };

async function load(): Promise<MetricsStore> {
  try {
    const json = await AsyncStorage.getItem(METRICS_KEY);
    if (!json) return { ...EMPTY };
    const parsed = JSON.parse(json);
    return {
      accountsCreated: Array.isArray(parsed.accountsCreated) ? parsed.accountsCreated : [],
      sessions:        Array.isArray(parsed.sessions)        ? parsed.sessions        : [],
      eventSaves:      parsed.eventSaves && typeof parsed.eventSaves === 'object' ? parsed.eventSaves : {},
    };
  } catch {
    return { ...EMPTY };
  }
}

async function save(store: MetricsStore): Promise<void> {
  try { await AsyncStorage.setItem(METRICS_KEY, JSON.stringify(store)); } catch {}
}

// ── Loggers ────────────────────────────────────────────────────────────────────
export async function logAccountCreated(email: string): Promise<void> {
  const store = await load();
  store.accountsCreated.push({ email, at: new Date().toISOString() });
  await save(store);
}

export async function logSessionStart(email: string): Promise<void> {
  const store = await load();
  store.sessions.push({ email, at: new Date().toISOString() });
  if (store.sessions.length > SESSION_CAP) {
    store.sessions = store.sessions.slice(-SESSION_CAP);
  }
  await save(store);
}

export async function logEventSaved(id: number, title: string, venue: string): Promise<void> {
  const store = await load();
  const key = String(id);
  const cur = store.eventSaves[key];
  store.eventSaves[key] = {
    id, title, venue,
    saves: (cur?.saves ?? 0) + 1,
    lastSavedAt: new Date().toISOString(),
  };
  await save(store);
}

// ── Privacy helpers ────────────────────────────────────────────────────────────
// "figenkirkgoz98@gmail.com" → "fi•••@gm•••.com" — enough to identify visually,
// never enough to expose the full address in the admin UI.
export function maskEmail(email: string): string {
  const [local, domain] = (email || '').split('@');
  if (!local || !domain) return '•••';
  const dotIdx = domain.lastIndexOf('.');
  const dName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
  const dTld  = dotIdx > 0 ? domain.slice(dotIdx) : '';
  return `${local.slice(0, 2)}•••@${dName.slice(0, 2)}•••${dTld}`;
}

// ── Admin gate ─────────────────────────────────────────────────────────────────
// A user is admin when ANY of:
//   1. their stored account has role === 'admin'
//   2. their email is on the compile-time allowlist below
//   3. the app runs with EXPO_PUBLIC_ADMIN_MODE=true (dev/staging builds only)
const ADMIN_EMAILS = ['figenkirkgoz98@gmail.com'];

export function isAdminUser(user: Pick<AuthUser, 'email' | 'role'> | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) return true;
  return process.env.EXPO_PUBLIC_ADMIN_MODE === 'true';
}

export function roleForEmail(email: string): 'admin' | 'user' {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';
}

// ── Aggregated admin view model ────────────────────────────────────────────────
export interface AdminMetrics {
  totalAccounts: number;
  accounts: { name: string; emailMasked: string; createdAt: string | null; vibes: string[] }[];
  totalSessions: number;
  sessionsLast7d: number;
  recentSessions: { emailMasked: string; at: string }[];
  totalEventSaves: number;
  topSavedEvents: { id: number; title: string; venue: string; saves: number }[];
  generatedAt: string;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const store = await load();

  // Real registered accounts — sensitive fields (password, phone, full email)
  // are stripped/masked here so the UI layer can never leak them.
  let users: AuthUser[] = [];
  try {
    const json = await AsyncStorage.getItem(USERS_KEY);
    users = json ? JSON.parse(json) : [];
  } catch {}

  const createdByEmail = new Map(store.accountsCreated.map(a => [a.email.toLowerCase(), a.at]));
  const accounts = users.map(u => ({
    name: u.name,
    emailMasked: maskEmail(u.email),
    createdAt: u.createdAt ?? createdByEmail.get(u.email.toLowerCase()) ?? null,
    vibes: u.vibes ?? [],
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionsLast7d = store.sessions.filter(s => new Date(s.at).getTime() >= weekAgo).length;
  const recentSessions = [...store.sessions]
    .slice(-20)
    .reverse()
    .map(s => ({ emailMasked: maskEmail(s.email), at: s.at }));

  const saveList = Object.values(store.eventSaves);
  const topSavedEvents = [...saveList]
    .sort((a, b) => b.saves - a.saves)
    .slice(0, 10)
    .map(({ id, title, venue, saves }) => ({ id, title, venue, saves }));

  return {
    totalAccounts: users.length,
    accounts,
    totalSessions: store.sessions.length,
    sessionsLast7d,
    recentSessions,
    totalEventSaves: saveList.reduce((s, e) => s + e.saves, 0),
    topSavedEvents,
    generatedAt: new Date().toISOString(),
  };
}
