import scrapedRaw from './scraped_events.json';

// ── Production event model ─────────────────────────────────────────────────────
// Events come exclusively from scraped_events.json (refreshed nightly by
// eventScraper.js). No simulated social fields — the app's core is real-time
// event discovery and navigation.
export interface Event {
  id: number;
  cat: string;
  date: string;              // relative label: 'Today' | 'Tonight' | … | named month
  title: string;
  venue: string;
  addr: string;
  time: string;
  startH: number;            // decimal hour, e.g. 23.5 = 23:30
  endH: number;
  emoji: string;
  color: string;
  tags: string[];
  source: string;
  officialEventLink: string;
  lat: number;
  lng: number;
  neighbourhood: string;
  desc: string;
  status?: string;           // 'SOLD OUT' | 'POSTPONED' | 'CANCELLED'
  _rawDate?: string;         // ISO YYYY-MM-DD used for accurate calendar display
  _endDate?: string;         // ISO end date for multi-day events
}

export const EVENTS: Event[] = scrapedRaw as unknown as Event[];

export const CATS  = ['All', 'Nightlife', 'Music', 'Culture', 'Festival', 'Arts', 'Sports', 'Wellness', 'Food & Drink', 'Market', 'Volunteering'];
export const DATES = ['All', 'Today', 'Tonight', 'Tomorrow', 'This Weekend', 'Next Week', 'Next Month'];

// ── Single-date filter helpers ─────────────────────────────────────────────────
// An event matches an ISO date (YYYY-MM-DD) when that date falls within its
// [_rawDate, _endDate] window (single-day events use _rawDate for both). ISO
// strings compare correctly with <=/>= so no Date objects are needed.
export function eventMatchesDate(e: Event, iso: string): boolean {
  const start = e._rawDate;
  if (!start) return false;
  const end = e._endDate || start;
  return iso >= start && iso <= end;
}

// Set of ISO dates that have at least one event — used to mark days on the
// calendar so users see which dates actually have something on.
export function availableEventDates(events: Event[]): Set<string> {
  const s = new Set<string>();
  for (const e of events) {
    if (!e._rawDate) continue;
    s.add(e._rawDate);
    if (e._endDate && e._endDate !== e._rawDate) s.add(e._endDate);
  }
  return s;
}
