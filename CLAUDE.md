# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Randevu** — a React Native / Expo app for discovering social events in Brussels. Expo account: `figenkirkgoz`, bundle ID: `app.randevu.brussels`.

## Commands

```bash
# Install dependencies (always use --legacy-peer-deps due to @types/react peer conflict)
npm install --legacy-peer-deps

# Start dev server for Expo Go (use host machine's LAN IP from ipconfig)
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.104 && npx expo start --clear

# Always use --clear after running the scraper — JSON is baked at bundle time

# Run event scraper locally
node eventScraper.js

# Install scraper packages (first time only)
npm install puppeteer axios cheerio --legacy-peer-deps

# Lint
npm run lint
```

No test suite exists.

## Architecture

Single-file navigation setup in `App.tsx`:
- **Stack navigator** (`RootStackParamList`): `Main` (tabs) → `Detail` → `Settings` → `Friends` → `Chat` → `Admin` (Admin route is registered ONLY when `isAdminUser(user)` — see RBAC below)
- **Tab navigator** (`TabParamList`) nested inside `Main`: Home / Map / Now / Profile
- All screens are stateless; state (`user`, `joinedEvents`, `avatar`, `isDark`, `profileData`, `locale`) lives in `App.tsx` and is passed as props
- Tab labels are translated via `t('tab.home', locale)` — locale is passed into TabNavigator as a prop
- `AsyncStorage` keys: `@randevu_user` (current session), `@randevu_users` (all registered accounts), `@randevu_locale` (language preference), `@randevu_joined:<email>` (per-account joined events), `@randevu_metrics_v1` (operational metrics), `@randevu_friendships_v1` (friendship rows), `@randevu_messages_v1` (message rows)
- **No simulated data**: social features (friends, chat, notifications) are 100% REAL — every row comes from an actual user action. Never seed mock messages, fake attendees, or hardcoded notification items.

### Real social layer (`src/lib/social.ts`)
- **Friendships**: `{ id, requester, addressee, status: 'pending'|'accepted', createdAt, respondedAt }` — declining deletes the row
- **Messages**: `{ id, sender, receiver, text, timestamp, readAt }` — capped at 2000 chars
- API is backend-shaped (`sendFriendRequest`, `respondToFriendRequest`, `sendMessage`, `getConversation`, `markConversationRead`, `getNotifications`, `purgeUserSocialData`) so a server can replace the AsyncStorage layer without touching UI
- `PublicUser` projection strips passwords/phones before anything reaches the UI
- FriendsScreen (Friends / Requests / Find People tabs), ChatScreen (real DM thread, 2.5s poll), HomeScreen bell (real notifications: pending requests + unread DMs, 5s poll)
- Account deletion calls `purgeUserSocialData` — no orphaned social rows

### Theme system (`src/constants/theme.ts`)
`makeTheme(isDark)` returns a `Theme` object. All screens receive `T: Theme` as a prop. The brand palette is in the `C` constant (e.g. `C.lav` = `#8E7DBE` is the primary accent). Always use `C.lav → C.lavD` for gradient CTAs.

### Data (`src/data/events.ts`)
Events come entirely from `scraped_events.json` (auto-updated nightly by the scraper).
```ts
export const EVENTS: Event[] = scrapedRaw as unknown as Event[];
```
The `Event` type has:
- `lat`/`lng` for map markers
- `date` — relative string: `'Today'`, `'Tonight'`, `'Tomorrow'`, `'This Weekend'`, `'Next Week'`, `'Next Month'`, named months (`'July'`, `'August'`, …), or `'Ongoing'`
- `_rawDate?: string` — ISO date string (`YYYY-MM-DD`) used by `getDisplayDate()` for accurate calendar display
- `startH` / `endH` — decimal hour values (e.g. `23.5` = 23:30) used by NowScreen live clock logic
- No social fields — `attendees`, `chatSeed`, `friends`, `going` were removed in the production reset; the scraper strips them from stored data on every run

```ts
export const DATES = ['All', 'Today', 'Tonight', 'Tomorrow', 'This Weekend', 'Next Week', 'Next Month'];
```
HomeScreen appends any extra named-month labels found in live event data via `availableDates` useMemo.

### i18n (`src/i18n/index.ts`)
- `Locale = 'en' | 'fr' | 'nl'`
- `t(key, locale)` — translation helper with English fallback
- `LOCALE_LABELS`, `LOCALE_FLAGS` — used in SettingsScreen language selector
- Current keys: tab labels, HomeScreen search/filter strings, no-results messages

### Key conventions
- **`Tap`** (`src/components/Tap.tsx`) — use instead of `TouchableOpacity` everywhere except inside `FlatList` render items or modals. Adds press-scale feedback via `Pressable`.
- **`GradBg`** — wraps screens that need the gradient background.
- **Safe area**: use `useSafeAreaInsets()` for header padding (`insets.top + 8`), not hardcoded values.
- **Navigation**: use `navigation.push('Detail', { event })` (not `navigate`) when navigating to a Detail screen from within another Detail screen, so the back stack is preserved.
- All screens use inline `StyleSheet.create` at the bottom of the file.
- No React Navigation headers — `headerShown: false` globally, all headers are custom.

---

## Features Built

### Auth & User Profile (`src/screens/AuthScreen.tsx`)
- Sign up / log in with email + password
- Bio field and vibe selection (up to 3 from 12 options) during sign-up
- Mandatory Terms & Conditions checkbox with full GDPR legal modal
- `AuthUser` interface: `{ name, email, password, phone?, bio?, vibes?, createdAt?, role? }`
- Sign-up stamps `createdAt` (ISO) and `role` (`roleForEmail()` from the admin allowlist), then calls `logAccountCreated()`

### Persistence (`App.tsx`)
- `@randevu_user` — auto-login on relaunch, saved on sign-in, cleared on sign-out
- `@randevu_users` — stores all registered accounts (cleared on Delete Account)
- `@randevu_joined:<email>` — joined event IDs persist per account and reload on login/auto-login
- `handleUserUpdate(Partial<AuthUser>)` merges partial updates and re-saves
- Session starts (login + auto-login) and event saves are logged to the metrics store

### Metrics & Admin (`src/lib/metrics.ts`, `src/screens/AdminScreen.tsx`)
- `@randevu_metrics_v1` schema: `{ accountsCreated[], sessions[] (capped 200), eventSaves{} }`
- Loggers: `logAccountCreated`, `logSessionStart`, `logEventSaved` — all fire-and-forget
- `getAdminMetrics()` aggregates: total accounts, sessions (total + last 7d), top saved events — emails are ALWAYS masked via `maskEmail()`, passwords never surface
- **Admin gate (strict RBAC)** — `isAdminUser(user)` returns true ONLY for an exact email match against the hardcoded `ADMIN_PROFILE` in `metrics.ts`. The stored `role` field is informational and deliberately NOT trusted (AsyncStorage is device-writable). No env bypass. Three enforcement layers: (1) Admin route only registered in the navigator for the admin profile, (2) Settings entry card only rendered when admin, (3) AdminScreen itself renders "Access denied" unless authorized

### HomeScreen (`src/screens/HomeScreen.tsx`)
- `FlatList` (not ScrollView) for performance with large event lists
- All header/filter content in `ListHeaderComponent`
- Category chips, date pills, search bar
- **Dynamic date pills** — `availableDates` useMemo builds the pill list from `DATES` + any named-month labels present in live event data (e.g. July, August)
- **Sort dropdown** — earliest/latest/A–Z/Z–A. `sorted` useMemo applies on top of `filtered`: date sort uses a weight table (Today=0 … Ongoing=99) with `startH` as tiebreaker; alpha sort uses `localeCompare`
- Mock notification feed and bell removed in the production reset

### MapScreen (`src/screens/MapScreen.tsx`)
- **Venue grouping**: events at the same venue (matched by name prefix) share one marker
- Single-event markers → tap opens DetailScreen directly
- Multi-event markers → show pink count badge → tap opens slide-up bottom sheet
- Bottom sheet lists all venue events (emoji, title, date/time/price); tap any → DetailScreen
- Events with `lat:0, lng:0` are excluded from the map

### NowScreen (`src/screens/NowScreen.tsx`)
- Live clock ticks every second via `setInterval`
- `todayEvents` — events with `date === 'Today' | 'Tonight' | 'Ongoing'`
- **Happening Now**: Today/Ongoing events always show regardless of clock position; Tonight events show only when `curH >= startH && curH < endH`
- **Starting Soon**: Tonight events where `startH - curH <= 1` (within 60 minutes)
- Empty state shown when nothing is active and nothing starts soon

### EventDetailScreen (`src/screens/EventDetailScreen.tsx`)
- `getDisplayDate(relative, rawDate?)` — uses `_rawDate` ISO string directly for accurate calendar display (avoids approximation from relative labels). Falls back to offset-based approximation for base events without `_rawDate`
- Pure event detail: hero, info card, about + official-link button, map preview, join/tickets CTA bar
- Chat teaser, Who's Going, guest-profile modals, and add-friend simulation removed in the production reset (ChatScreen deleted)

### ProfileScreen (`src/screens/ProfileScreen.tsx`)
- Editable bio saved via `onUserUpdate` (empty-state placeholder, no fake persona)
- Vibe tags displayed from `user.vibes`; stats row shows REAL counts (upcoming / attended / vibes)
- **My Schedule** — horizontal scroll of `myEvents` (events the user joined)
- **My Past Events** — horizontal scroll of events from the full `EVENTS` dataset where `_rawDate < today's ISO date`. Shows "Attended" badge. Empty state if none found
- Avatar picker modal — full grid of all AVATARS, no pagination
- "Meaningful Impact" badges and "My Perks" discount modules removed

### SettingsScreen (`src/screens/SettingsScreen.tsx`)
- Editable email, phone, password fields with inline save
- Notification toggles (3 items) via Switch
- **Language selector** — EN / FR / NL pill buttons, wired to `locale` prop via `onLocaleChange`
- Dark mode toggle
- **Admin Console entry** — rendered only when `isAdmin` prop is true; navigates to the `Admin` route
- **Delete Account** — two-step flow:
  1. `Alert.alert` confirmation ("Are you sure?")
  2. Slide-up modal with 4 radio-style reason options; last option ("Other") shows a free-text `TextInput`
  3. On confirm: clears `@randevu_user` + `@randevu_users` from AsyncStorage, calls `onSignOut`
- Sign Out clears `@randevu_user` only and returns to auth screen

---

## Event Scraper (`eventScraper.js`)

Node.js script that populates `src/data/scraped_events.json` with real Brussels events.

### Sources (7 Brussels venues)
| Venue | Emoji | Category |
|---|---|---|
| Ancienne Belgique | 🎸 | Music |
| Le Botanique | 🎸 | Music / Indie |
| Fuse | ⚡ | Techno / Nightlife |
| C12 | 💃 | Electronic / Art |
| Cirque Royal | 🎹 | Music |
| La Madeleine | 🎸 | Music |
| Bozar | 🏛️ | Culture / Classical |

### Scraper strategy
Strategy routing is purely config-flag driven (see the extensibility contract comment
above `VENUE_CONFIGS` — adding a venue = appending one object, zero structural changes):
1. **JSON-LD first** — `extractJsonLd(page)` reads `<script type="application/ld+json">` for structured Event data
2. **Strategy 1.8** (`useAgendaBrussels: true`) — agenda.brussels search-results parser with explicit location-field extraction
3. **Strategy 1.9a** (`useRaClub: true`) — Resident Advisor club page (e.g. Circle Park, `ra.co/clubs/189275`). Tier 1 parses the `__NEXT_DATA__` GraphQL payload (`__typename === 'Event'`, `contentUrl` `/events/XXXXXX`) — immune to CSS churn; Tier 2 falls back to RA DOM cards (`[data-testid="event-listing-card"]`, `a[href^="/events/"]`)
4. **Strategy 1.9b** (`useResidentAdvisor: true`) — RA Brussels regional listing filtered by open-air/festival/day-party keywords
5. **Strategy 1.7** (`jsHeavy: true`) — live DOM scrape via `page.evaluate()` after SPA hydration
6. **HTML fallback** — heading + date presence filter: candidates must contain a heading tag AND a date element or text matching a date pattern
7. HTML candidate limit: 50 per page; Agenda Brussels cap: 30 events
8. The scraper writes NO simulated fields — a per-run migration strips `attendees`/`chatSeed`/`friends`/`going` from any stored events

### Date labelling pipeline
- `parseRawDate(str)` — multi-pattern parser with 12-month year-inference cap (dates inferred >12 months ahead are rejected to avoid 2027 bleed-through)
- `toRelativeDate(iso, endIso)` — buckets into Today/Tonight/Tomorrow/This Weekend/Next Week/Next Month; events beyond next calendar month get a named-month label (July, August, …)
- `refineDateLabel(relDate, startH)` — splits Tonight → Today when `startH < 19` (daytime events shouldn't show as "Tonight")
- `smartDefaultTime(cat)` — category-aware time fallback when no time is found on the page:
  - Nightlife → 23:00; Music → 20:00; Festival → 12:00; Culture/Arts → 11:00; Market → 10:00; Sports/Wellness → 10:00; Food & Drink → 12:00; default → 19:00

### Price logic
- `extractAllPrices(text)` — scans for `€` or `EUR` only; never grabs random numbers
- Multiple prices → `From €[lowest]`; single price → `€[price]`; free → `Free`; unknown → `''` (blank, never TBA)
- `EventCard` hides the price badge entirely when price is `''`

### Deduplication (`smartMerge`)
Three-tier lookup on each incoming event:
1. Same `title` + same `_rawDate`
2. Same `title` + same venue (regardless of stored `_rawDate`)
3. Same title + same venue (fallback)

On match, always overwrites `_rawDate` and `date` with fresh scraped values. IDs for scraped events start at 100.

### Purge (runs before each scrape)
Removes events where:
- `_rawDate` matches pattern `*-06-18` (any year) — legacy bad date
- `_rawDate` year ≥ 2027 — year-inference overreach

### Geocoding
Nominatim (OpenStreetMap) with `"Venue Name + Brussels, Belgium"` query. 1200ms delay between calls to respect rate limits. Falls back to randomised Brussels centre coords if geocoding fails.

---

## Automation (`.github/workflows/daily_scrape.yml`)

GitHub Actions workflow that runs automatically every night at **03:00 UTC**.

- Node.js 24 runtime
- Installs app deps + scraper packages + Puppeteer Chrome
- Runs `node eventScraper.js`
- Commits and pushes updated `scraped_events.json` back to the repo
- Each venue is wrapped in try/catch — one failing site never crashes the full run
- Can also be triggered manually: GitHub → Actions → Daily Event Scrape → Run workflow

> **Note:** Scheduled workflows only run on the default (main) branch. Merge the PR first to activate the schedule.
