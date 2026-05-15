# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Randevu** — a React Native / Expo app for discovering social events in Brussels. Expo account: `figenkirkgoz`, bundle ID: `app.randevu.brussels`.

## Commands

```bash
# Install dependencies (always use --legacy-peer-deps due to @types/react peer conflict)
npm install --legacy-peer-deps

# Start dev server for Expo Go (use host machine's LAN IP from ipconfig)
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.104 && npx expo start

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
- All screens are stateless; state (user, joinedEvents, avatar, isDark, profileData) lives in `App.tsx` and is passed as props
- `AsyncStorage` key `@randevu_user` persists the `AuthUser` object across launches

### Theme system (`src/constants/theme.ts`)
`makeTheme(isDark)` returns a `Theme` object. All screens receive `T: Theme` as a prop. The brand palette is in the `C` constant (e.g. `C.lav` = `#8E7DBE` is the primary accent). Always use `C.lav → C.lavD` for gradient CTAs.

### Data (`src/data/events.ts`)
Two-source merge: `BASE_EVENTS` (38 hardcoded events) + `scraped_events.json` (auto-updated nightly).
```ts
export const EVENTS: Event[] = [...BASE_EVENTS, ...(scrapedRaw as unknown as Event[])];
```
The `Event` type has `lat`/`lng` for map markers, relative `date` strings (`'Tonight'`, `'Tomorrow'`, `'This Weekend'`, `'Next Week'`, `'Next Month'`, `'Ongoing'`), and `attendees: Attendee[]` where `isFriend` distinguishes friends from others. The `price` field is `''` (blank) when unknown — never `'TBA'`.

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
- `AsyncStorage` key `@randevu_user` — auto-login on relaunch, saved on sign-in, cleared on sign-out
- `handleUserUpdate(Partial<AuthUser>)` merges partial updates and re-saves

### HomeScreen (`src/screens/HomeScreen.tsx`)
- `FlatList` (not ScrollView) for performance with large event lists
- All header/filter content in `ListHeaderComponent`
- Category chips, date pills, search bar, FOMO banner, notification panel

### MapScreen (`src/screens/MapScreen.tsx`)
- **Venue grouping**: events at the same venue (matched by name prefix) share one marker
- Single-event markers → tap opens DetailScreen directly
- Multi-event markers → show pink count badge → tap opens slide-up bottom sheet
- Bottom sheet lists all venue events (emoji, title, date/time/price); tap any → DetailScreen
- Events with `lat:0, lng:0` are excluded from the map

### EventDetailScreen
- `getDisplayDate(relative)` converts relative dates to real calendar dates for display
- Friend profile navigation: closes modal → stores guest in ref → pushes new Detail → focus listener restores modal on back

### ProfileScreen (`src/screens/ProfileScreen.tsx`)
- Editable bio saved via `onUserUpdate`
- Vibe tags displayed from `user.vibes`

### SettingsScreen
- Sign Out button clears AsyncStorage and returns to auth screen

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
2. **HTML fallback** — `heading + date presence filter`: candidate elements must contain a heading tag AND either a date element or text matching a date pattern (works across any CMS)
3. **JS-heavy sites** (Fuse, C12) — `networkidle2` wait mode + 9 second wait + double scroll pass

### Price logic
- `extractAllPrices(text)` — scans for `€` or `EUR` only; never grabs random numbers
- Multiple prices → `From €[lowest]`; single price → `€[price]`; free → `Free`; unknown → `''` (blank, never TBA)
- `EventCard` hides the price badge entirely when price is `''`

### Geocoding
Nominatim (OpenStreetMap) with `"Venue Name + Brussels, Belgium"` query. 1200ms delay between calls to respect rate limits. Falls back to randomised Brussels centre coords if geocoding fails.

### Deduplication & expiry
Events are deduplicated by `(title, rawDate)`. Past events are removed on each run. IDs for scraped events start at 100.

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
