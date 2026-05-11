# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Randevu** — a React Native / Expo app for discovering social events in Brussels. Expo account: `figenkirkgoz`, bundle ID: `app.randevu.brussels`.

## Commands

```bash
# Install dependencies (always use --legacy-peer-deps due to @types/react peer conflict)
npm install --legacy-peer-deps

# Start dev server for Expo Go (replace IP with host machine's LAN IP from ipconfig)
set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.68.101 && npx expo start

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
Single source of truth: `EVENTS` array (38 events) and `FRIEND_PROFILES` lookup. The `Event` type has `lat`/`lng` for map markers, relative `date` strings (`'Tonight'`, `'Tomorrow'`, `'This Weekend'`, `'Next Week'`, `'Next Month'`, `'Ongoing'`), and `attendees: Attendee[]` where `isFriend` distinguishes friends from others.

### Key conventions
- **`Tap`** (`src/components/Tap.tsx`) — use instead of `TouchableOpacity` everywhere except inside `FlatList` render items or modals where `TouchableOpacity` is already used for consistency. `Tap` adds press-scale feedback via `Pressable`.
- **`GradBg`** — wraps screens that need the gradient background.
- **Safe area**: use `useSafeAreaInsets()` for header padding (`insets.top + 8`), not hardcoded values.
- **Navigation**: use `navigation.push('Detail', { event })` (not `navigate`) when navigating to a Detail screen from within another Detail screen, so the back stack is preserved.
- All screens use inline `StyleSheet.create` at the bottom of the file.
- No React Navigation headers — `headerShown: false` globally, all headers are custom.
