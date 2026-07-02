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
