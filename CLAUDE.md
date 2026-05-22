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
- **Stack navigator** (`RootStackParamList`): `Main` (tabs) → `Detail` → `Chat` → `Settings`
- **Tab navigator** (`TabParamList`) nested inside `Main`: Home / Map / Now / Profile
- All screens are stateless; state (`user`, `joinedEvents`, `avatar`, `isDark`, `profileData`, `locale`) lives in `App.tsx` and is passed as props
- Tab labels are translated via `t('tab.home', locale)` — locale is passed into TabNavigator as a prop
- `AsyncStorage` keys: `@randevu_user` (current session), `@randevu_users` (all registered accounts), `@randevu_locale` (language preference)

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
- `attendees: Attendee[]` where `isFriend: boolean` distinguishes friends from strangers
- `price` is `''` (blank) when unknown — never `'TBA'`

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
- `AuthUser` interface: `{ name, email, password, bio?, vibes? }`

### Persistence (`App.tsx`)
- `@randevu_user` — auto-login on relaunch, saved on sign-in, cleared on sign-out
- `@randevu_users` — stores all registered accounts (cleared on Delete Account)
- `handleUserUpdate(Partial<AuthUser>)` merges partial updates and re-saves

### HomeScreen (`src/screens/HomeScreen.tsx`)
- `FlatList` (not ScrollView) for performance with large event lists
- All header/filter content in `ListHeaderComponent`
- Category chips, date pills, search bar, FOMO banner, notification panel
- **Dynamic date pills** — `availableDates` useMemo builds the pill list from `DATES` + any named-month labels present in live event data (e.g. July, August)
- **Sort toggle** — `📅 Date` / `🔤 A–Z` chips appear below date pills when not searching. `sorted` useMemo applies on top of `filtered`: date sort uses a weight table (Today=0 … Ongoing=99) with `startH` as tiebreaker; alpha sort uses `localeCompare`
- **Notifications panel** — 2 contextual alerts (Union SG fan zone, Canal Cleanup). The hardcoded "Fuse RA Night" fake entry has been removed

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
- Friend profile navigation: closes modal → stores guest in ref → pushes new Detail → focus listener restores modal on back

### ChatScreen (`src/screens/ChatScreen.tsx`)
- **Friends-only**: on mount builds `friendNames` from `event.attendees` where `isFriend === true`. `chatSeed` is filtered to only messages from friends or self (`isMe === true`)
- 🔒 friends-only info banner below header explains privacy scope
- Header subtitle shows friend count: "Friends chat · N friends going"
- Empty state when no friends are attending yet
- New messages from "You" are appended in real time

### ProfileScreen (`src/screens/ProfileScreen.tsx`)
- Editable bio saved via `onUserUpdate`
- Vibe tags displayed from `user.vibes`
- **My Schedule** — horizontal scroll of `myEvents` (events the user joined)
- **My Past Events** — horizontal scroll of events from the full `EVENTS` dataset where `_rawDate < today's ISO date`. Shows "Attended" badge. Empty state if none found
- Avatar picker modal — full grid of all AVATARS, no pagination
- "Meaningful Impact" badges section has been removed

### SettingsScreen (`src/screens/SettingsScreen.tsx`)
- Editable email, phone, password fields with inline save
- Notification toggles (4 items) via Switch
- **Language selector** — EN / FR / NL pill buttons, wired to `locale` prop via `onLocaleChange`
- Dark mode toggle
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
1. **JSON-LD first** — `extractJsonLd(page)` reads `<script type="application/ld+json">` for structured Event data
2. **HTML fallback** — heading + date presence filter: candidates must contain a heading tag AND a date element or text matching a date pattern
3. **JS-heavy sites** (Fuse, C12) — `networkidle2` wait mode + 9-second wait + 4 scroll passes (scrolls to `document.body.scrollHeight` on pass 3)
4. HTML candidate limit: 50 per page; Agenda Brussels cap: 30 events

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
