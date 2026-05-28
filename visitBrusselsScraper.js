/**
 * visitBrusselsScraper.js  —  Standalone Visit.Brussels Excel → events
 *
 * SAFE: reads/writes ONLY scraped_events.json (upsert, never overwrites).
 *       Does NOT touch eventScraper.js or its logic in any way.
 *
 * Usage:
 *   1. Copy the Excel file into the project root.
 *   2. node visitBrusselsScraper.js
 *
 * Deps (already in package.json): xlsx, axios, cheerio
 */

'use strict';

const XLSX    = require('xlsx');
const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const EXCEL_PATH   = path.join(__dirname, 'lieux_culturels_touristiques_evenementiels_visitbrussels_vbx.xlsx');
const DB_PATH      = path.join(__dirname, 'src/data/scraped_events.json');
const BATCH_SIZE   = 5;          // how many venues to test in one run
const VB_ID_START  = 2000;       // well above existing range (100–201)
const REQ_TIMEOUT  = 12000;      // ms per HTTP request
const REQ_DELAY    = 1200;       // ms between requests (rate-limit courtesy)

// Target rows from the Excel
const TARGET_CATS = ['live music', 'performing arts venue'];

// Multilingual keywords for event-page discovery
const EVENT_KW = [
  'events', 'calendar', 'agenda', 'agenda', 'concerts',
  'programmation', 'programme', 'shows', "what's on",
  'événements', 'evenementen', 'spectacles',
];

// Visit category → Randevu cat
const CAT_MAP = {
  'live music':            'Music',
  'performing arts venue': 'Culture',
  'nightclubs':            'Nightlife',
  'clubbing agenda':       'Nightlife',
  'cultural agenda':       'Culture',
};

const EMOJI_MAP = { Music: '🎸', Culture: '🎭', Nightlife: '🎷' };
const COLOR_MAP = { Music: '#8E7DBE', Culture: '#FF6B9D', Nightlife: '#4ECDC4' };

// Category-aware default times (mirrors eventScraper.js smartDefaultTime)
const DEFAULT_TIME = { Music: { time: '20:00', startH: 20 }, Culture: { time: '19:00', startH: 19 }, Nightlife: { time: '23:00', startH: 23 } };

// Month abbreviations for date parsing (EN + FR + NL)
const MONTH_ABB = {
  jan:1, feb:2, fév:2, fev:2, mar:3, apr:4, avr:4,
  may:5, mai:5, jun:6, jul:7, aug:8, aoû:8, aou:8,
  sep:9, oct:10, nov:11, dec:12, déc:12,
};
const MONTH_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizeUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try { new URL(raw); return raw; } catch { return null; }
}

function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: REQ_TIMEOUT,
      headers: { 'User-Agent': 'Mozilla/5.0 (Randevu/1.0; +https://randevu.app)' },
      maxRedirects: 5,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

// ─── Step 1: Parse Excel → venue batch ───────────────────────────────────────

function loadVenueBatch() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`\n  ✗ Excel file not found at:\n    ${EXCEL_PATH}`);
    console.error('  Copy the .xlsx file into the project root and re-run.\n');
    process.exit(1);
  }

  const wb   = XLSX.readFile(EXCEL_PATH);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const venues = rows
    .filter(r => {
      const cats = r['Visit category'].toLowerCase();
      const url  = (r['Web link'] || '').trim();
      const isTarget  = TARGET_CATS.some(c => cats.includes(c));
      const hasRealUrl = url && !url.includes('facebook') && !url.includes('instagram');
      return isTarget && hasRealUrl;
    })
    .slice(0, BATCH_SIZE)
    .map(r => {
      const [lat, lng] = (r['Geo Point'] || '0,0').split(',').map(s => parseFloat(s.trim()));
      const rawCats    = r['Visit category'].split(',').map(s => s.trim().toLowerCase());
      const matchedKey = rawCats.find(c => CAT_MAP[c]);
      const cat        = CAT_MAP[matchedKey] ?? 'Music';
      const defaults   = DEFAULT_TIME[cat] ?? DEFAULT_TIME.Music;
      return {
        name:        r.Name,
        url:         normalizeUrl(r['Web link']),
        addr:        `${r.Address}, ${r['Postal Code']} ${r.Municipality}`,
        lat:         isNaN(lat) ? 0 : lat,
        lng:         isNaN(lng) ? 0 : lng,
        cat,
        source:      r.Name,
        defaultTime: defaults.time,
        defaultStartH: defaults.startH,
      };
    })
    .filter(v => v.url);

  return venues;
}

// ─── Step 2a: Discover event-page links on the homepage ──────────────────────

function findEventLinks(html, baseUrl) {
  const $      = cheerio.load(html);
  const origin = new URL(baseUrl).hostname;
  const found  = [];

  // Scan <a> tags whose text or href contain an event keyword
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const text = $(el).text().toLowerCase();
    const combined = text + ' ' + href.toLowerCase();
    if (!EVENT_KW.some(kw => combined.includes(kw))) return;

    let full;
    try {
      full = /^https?:\/\//i.test(href) ? href : new URL(href, baseUrl).href;
      const u = new URL(full);
      // Keep only same-domain links (or subdomains)
      if (u.hostname !== origin && !u.hostname.endsWith('.' + origin)) return;
    } catch { return; }

    found.push({ url: full, text: $(el).text().trim(), isAnchor: false });
  });

  // Also flag in-page anchor IDs matching keywords (single-page sites)
  $('[id]').each((_, el) => {
    const id = ($(el).attr('id') || '').toLowerCase();
    if (EVENT_KW.some(kw => id.includes(kw))) {
      found.push({ url: `${baseUrl.split('#')[0]}#${$(el).attr('id')}`, text: id, isAnchor: true });
    }
  });

  // Deduplicate by URL
  const seen = new Set();
  return found.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}

// ─── Step 2b: Extract event listings from a fetched page ─────────────────────

function parseRawDate(text) {
  // dd/mm/yyyy or dd-mm-yyyy
  let m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime())) return toLocalISO(d);
  }
  // dd Mon(th) yyyy  or  Mon(th) dd, yyyy
  m = text.match(/\b(\d{1,2})\s+([a-záàâéèêïîôùûü]{3,})\s+(\d{4})\b/i)
    || text.match(/\b([a-záàâéèêïîôùûü]{3,})\s+(\d{1,2})[,\s]+(\d{4})\b/i);
  if (m) {
    const abbr = (m[2] || m[1]).slice(0, 3).toLowerCase();
    const mo   = MONTH_ABB[abbr];
    const day  = +(m[1].match(/^\d/) ? m[1] : m[2]);
    const yr   = +(m[3]);
    if (mo && day && yr) {
      const d = new Date(yr, mo - 1, day);
      if (!isNaN(d.getTime())) return toLocalISO(d);
    }
  }
  return null;
}

function toRelativeDate(iso) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eDay  = new Date(iso + 'T00:00:00');
  const diff  = Math.round((eDay.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return null;          // past — skip
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 3)  return 'This Weekend';
  if (diff <= 7)  return 'Next Week';
  if (diff <= 31) return 'Next Month';
  return MONTH_LONG[eDay.getMonth()];  // named month for far-future events
}

function extractEventsFromPage(html, venue) {
  const $      = cheerio.load(html);
  const events = [];

  // Candidate selectors: semantic event containers + generic heading blocks
  const selectors = [
    'article', '[class*="event"]', '[class*="concert"]',
    '[class*="show"]', '[class*="agenda"]', '[class*="program"]',
    'li', 'h2', 'h3', 'h4',
  ].join(', ');

  $(selectors).each((_, el) => {
    const container = $(el);
    const fullText  = container.text().replace(/\s+/g, ' ').trim();
    if (fullText.length < 8) return;

    const rawDate = parseRawDate(fullText);
    if (!rawDate) return;

    const relDate = toRelativeDate(rawDate);
    if (!relDate) return; // skip past events

    // Title: prefer first heading inside container, else first non-empty line
    let title = container.find('h1,h2,h3,h4,strong').first().text().trim()
             || fullText.split(/[\n|]+/)[0].trim();
    title = title.replace(/\s+/g, ' ').slice(0, 120);
    if (!title || title.length < 5) return;

    // Time: look for HH:MM or HHhMM patterns
    const timeM  = fullText.match(/\b(\d{1,2})[h:]\s*(\d{2})\b/i);
    const timeStr = timeM
      ? `${String(timeM[1]).padStart(2, '0')}:${timeM[2]}`
      : venue.defaultTime;
    const startH = timeM
      ? parseInt(timeM[1], 10) + parseInt(timeM[2], 10) / 60
      : venue.defaultStartH;

    // Official link: first <a> inside the container
    const href    = container.find('a[href]').first().attr('href') || '';
    let eventLink = '';
    try {
      eventLink = /^https?:\/\//i.test(href) ? href : new URL(href, venue.url).href;
    } catch { eventLink = venue.url; }

    events.push({ title, rawDate, relDate, timeStr, startH, eventLink });
  });

  // Deduplicate within this page by title + date
  const seen = new Set();
  return events.filter(ev => {
    const key = ev.title.toLowerCase() + ev.rawDate;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Step 3: Safe upsert into scraped_events.json ────────────────────────────

function upsertEvents(newEvents, venue) {
  const db    = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const maxId = db.reduce((m, e) => Math.max(m, e.id ?? 0), VB_ID_START - 1);
  let nextId  = Math.max(maxId + 1, VB_ID_START);
  let added = 0, updated = 0;

  for (const ev of newEvents) {
    // Tier 1: same title (case-insensitive) + same _rawDate
    let idx = db.findIndex(e =>
      e._rawDate === ev.rawDate &&
      (e.title || '').toLowerCase() === ev.title.toLowerCase()
    );
    // Tier 2: same title + same venue name
    if (idx === -1) idx = db.findIndex(e =>
      (e.venue || '').toLowerCase() === venue.name.toLowerCase() &&
      (e.title || '').toLowerCase() === ev.title.toLowerCase()
    );

    const record = {
      id:               idx !== -1 ? db[idx].id : nextId++,
      cat:              venue.cat,
      date:             ev.relDate,
      _rawDate:         ev.rawDate,
      title:            ev.title,
      venue:            venue.name,
      addr:             venue.addr,
      time:             ev.timeStr,
      startH:           parseFloat(ev.startH.toFixed(2)),
      endH:             parseFloat((ev.startH + 3).toFixed(2)),
      emoji:            EMOJI_MAP[venue.cat]  ?? '🎵',
      color:            COLOR_MAP[venue.cat]  ?? '#8E7DBE',
      friends:          0,
      tags:             [venue.cat, 'Brussels', 'Live'],
      source:           venue.name,
      officialEventLink: ev.eventLink || venue.url,
      lat:              venue.lat,
      lng:              venue.lng,
      going:            Math.floor(Math.random() * 80) + 20,
      neighbourhood:    'Brussels',
      desc:             `Live event at ${venue.name}.`,
      attendees:        idx !== -1 ? db[idx].attendees : [],
      chatSeed:         idx !== -1 ? db[idx].chatSeed  : [],
    };

    if (idx !== -1) {
      // Only overwrite date/time fields; preserve everything else the main scraper may have set
      db[idx] = { ...db[idx], ...record };
      updated++;
    } else {
      db.push(record);
      added++;
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return { added, updated, total: db.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Visit.Brussels Scraper  —  standalone test run  ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Step 1 — load venue batch from Excel
  const venues = loadVenueBatch();
  console.log(`Loaded ${venues.length} venue(s) from Excel (first ${BATCH_SIZE} music/performing):\n`);
  venues.forEach(v => console.log(`  • [${v.cat}] ${v.name}\n    ${v.url}`));
  console.log();

  let totalAdded = 0, totalUpdated = 0;

  for (const venue of venues) {
    console.log(`\n${'─'.repeat(56)}`);
    console.log(`Venue: ${venue.name}`);
    console.log(`URL:   ${venue.url}`);

    // Step 2a — fetch homepage
    const homeHtml = await fetchHtml(venue.url);
    if (!homeHtml) {
      console.log('  ✗ Could not fetch homepage (timeout / blocked)');
      continue;
    }
    console.log('  ✓ Homepage fetched');

    // Step 2b — discover event sub-pages
    const links = findEventLinks(homeHtml, venue.url);
    if (links.length > 0) {
      console.log(`  ✓ ${links.length} event-related link(s) found:`);
      links.slice(0, 4).forEach(l => {
        const tag = l.isAnchor ? '[anchor]' : '[link]';
        console.log(`    ${tag} "${l.text}" → ${l.url}`);
      });
    } else {
      console.log('  ℹ No event sub-links found — will scan homepage directly');
    }

    // Step 2c — scrape event pages
    let allEvents = [];
    // Try up to 2 discovered event links; fall back to homepage itself
    const pagesToScrape = links.length > 0 ? links.slice(0, 2) : [{ url: venue.url, isAnchor: false }];

    for (const link of pagesToScrape) {
      const html = link.isAnchor ? homeHtml : await fetchHtml(link.url);
      if (!html) continue;
      const evs = extractEventsFromPage(html, venue);
      allEvents.push(...evs);
      if (!link.isAnchor) await sleep(REQ_DELAY);
    }

    // Global dedup across pages
    const seen = new Set();
    allEvents = allEvents.filter(ev => {
      const key = ev.title.toLowerCase() + ev.rawDate;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`\n  Events extracted with parseable dates: ${allEvents.length}`);
    allEvents.slice(0, 5).forEach(ev =>
      console.log(`    ✓ "${ev.title}"\n      ${ev.rawDate} (${ev.relDate}) @ ${ev.timeStr}`)
    );

    // Step 3 — upsert
    if (allEvents.length > 0) {
      const result = upsertEvents(allEvents, venue);
      console.log(`\n  DB update: +${result.added} new  |  ~${result.updated} updated  |  total ${result.total}`);
      totalAdded   += result.added;
      totalUpdated += result.updated;
    } else {
      console.log('\n  ℹ No parseable events found for this venue — DB unchanged');
    }

    await sleep(REQ_DELAY);
  }

  console.log(`\n${'═'.repeat(56)}`);
  console.log(`Done.  +${totalAdded} new events  |  ${totalUpdated} updated`);
  console.log('Run "npx expo start --clear" to reload the app.\n');
}

main().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
