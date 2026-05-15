#!/usr/bin/env node
/**
 * Randevu Event Scraper
 *
 * Scrapes AB Concerts and visit.brussels, maps events to the Randevu
 * Event interface, geocodes venues via Nominatim, and writes the result
 * to src/data/scraped_events.json.  The app imports this file at build
 * time and merges it with the base EVENTS array.
 *
 * Install: npm install puppeteer axios cheerio
 * Run:     node eventScraper.js
 */

const puppeteer = require('puppeteer');
const axios     = require('axios');
const cheerio   = require('cheerio');
const fs        = require('fs');
const path      = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────
const SCRAPED_JSON   = path.join(__dirname, 'src', 'data', 'scraped_events.json');
const SCRAPED_ID_MIN = 100;       // scraped events use IDs 100+
const GEOCODE_DELAY  = 1150;      // ms — Nominatim rate limit: 1 req/s

// ── Keyword → emoji / color / category mapping ────────────────────────────────
const KEYWORD_MAP = [
  { kw: ['techno','electronic','rave','dj set','club night','trance','house'], emoji:'⚡', color:'#7B2FBE', cat:'Nightlife',    tags:['Techno','Electronic']   },
  { kw: ['jazz','blues','swing','bossa nova'],                                 emoji:'🎷', color:'#C77DFF', cat:'Music',        tags:['Jazz','Live Music']      },
  { kw: ['rock','indie','punk','metal','alternative','grunge'],                emoji:'🎸', color:'#C77DFF', cat:'Music',        tags:['Rock','Live Music']      },
  { kw: ['pop','rnb','hip-hop','hip hop','rap','soul','r&b'],                 emoji:'🎤', color:'#F7CFD8', cat:'Music',        tags:['Pop','Live Music']       },
  { kw: ['classical','orchestra','opera','choir','symphony'],                  emoji:'🎻', color:'#E76F51', cat:'Culture',      tags:['Classical','Culture']    },
  { kw: ['concert','live music','band','singer'],                              emoji:'🎵', color:'#8E7DBE', cat:'Music',        tags:['Concert','Live Music']   },
  { kw: ['food','cook','taste','eat','cuisine','gastro','brunch','dinner'],    emoji:'🍕', color:'#F4C87A', cat:'Food & Drink', tags:['Food','Social']          },
  { kw: ['beer','wine','cocktail','bar','drink','brewery'],                    emoji:'🍹', color:'#F4C87A', cat:'Food & Drink', tags:['Drinks','Social']        },
  { kw: ['market','flea','brocante','vintage','antique','bazaar'],             emoji:'🛍️', color:'#F4C87A', cat:'Market',       tags:['Market','Outdoors']      },
  { kw: ['art','exhibit','museum','gallery','paint','photo','sculpture'],      emoji:'🎨', color:'#F4A261', cat:'Culture',      tags:['Art','Culture']          },
  { kw: ['sport','football','run','yoga','fitness','padel','tennis','cycle'],  emoji:'⚽', color:'#90E0EF', cat:'Sports',       tags:['Sports','Active']        },
  { kw: ['eco','nature','green','garden','clean','environment','sustainability'],emoji:'🌿',color:'#B8E5C0', cat:'Community',   tags:['Eco','Community']        },
  { kw: ['festival','open air','open-air','outdoor','park','summer'],          emoji:'🌍', color:'#F4A261', cat:'Festival',     tags:['Festival','Outdoors']    },
  { kw: ['theatre','theater','play','comedy','improv','stand-up','cabaret'],   emoji:'🎭', color:'#E76F51', cat:'Arts',         tags:['Theatre','Performance']  },
  { kw: ['cinema','film','movie','screening','documentary'],                   emoji:'🎬', color:'#6C63FF', cat:'Arts',         tags:['Cinema','Film']          },
  { kw: ['dance','ballet','tango','salsa','bachata'],                          emoji:'💃', color:'#F7CFD8', cat:'Arts',         tags:['Dance','Performance']    },
  { kw: ['walk','tour','guided','heritage','architecture'],                    emoji:'🚶', color:'#A6D6D6', cat:'Culture',      tags:['Culture','City']         },
];
const DEFAULT_CLASS = { emoji: '📍', color: '#8E7DBE', cat: 'Event', tags: ['Brussels'] };

const NEIGHBOURHOODS = [
  'Ixelles','Saint-Gilles','Molenbeek','Anderlecht','Laeken',
  'Etterbeek','Schaerbeek','Forest','Uccle','Centre','Sablon','Marolles',
];

const FRIEND_NAMES  = ['Zoë','Kaan','Léa','Iris','Nora','Hugo','Axel','Ali','Kai','Fleur'];
const AVATAR_COLORS = ['#F7CFD8','#A6D6D6','#8E7DBE','#F4A261','#90E0EF','#B8E5C0','#C77DFF','#F4C87A'];

const HYPE = [
  "Can't wait for this one! 🔥",
  "Who else is going?? 🙋",
  "Already got my ticket! See you there 👋",
  "This is going to be AMAZING",
  "First time at this venue — so excited!",
  "Told all my friends, gonna be 🔥",
  "The lineup looks incredible!",
  "Brussels never disappoints ❤️",
  "Counting down the days 🗓️",
  "Grab tickets fast, it's selling out!",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function classify(text) {
  const lower = (text || '').toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.kw.some(k => lower.includes(k)))
      return { emoji: entry.emoji, color: entry.color, cat: entry.cat, tags: entry.tags };
  }
  return DEFAULT_CLASS;
}

function toRelativeDate(isoDate) {
  const event = new Date(isoDate);
  if (isNaN(event.getTime())) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eDay  = new Date(event); eDay.setHours(0, 0, 0, 0);
  const diff  = Math.round((eDay - today) / 86400000);
  if (diff < 0) return null;

  const dow = event.getDay();
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 6 && (dow === 0 || dow === 6)) return 'This Weekend';
  if (diff <= 7)  return 'Next Week';
  if (diff <= 30) return 'Next Month';
  return 'Ongoing';
}

function parseTime(str) {
  if (!str) return { time: '20:00', startH: 20, endH: 23 };
  const m = str.match(/(\d{1,2})[h:\.](\d{2})?/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    return { time: `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`, startH: h, endH: h + 3 };
  }
  return { time: '20:00', startH: 20, endH: 23 };
}

function parseRawDate(text) {
  if (!text) return null;
  // Try ISO / standard Date parse
  const d = new Date(text);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  // Try DD/MM/YYYY or DD.MM.YYYY
  const m = text.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  // Try "14 June 2025" / "June 14, 2025"
  const m2 = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m2) { const d2 = new Date(`${m2[2]} ${m2[1]}, ${m2[3]}`); if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]; }
  const m3 = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m3) { const d3 = new Date(`${m3[1]} ${m3[2]}, ${m3[3]}`); if (!isNaN(d3.getTime())) return d3.toISOString().split('T')[0]; }
  return null;
}

function generateAttendees() {
  const fc = Math.floor(Math.random() * 4);
  const oc = Math.floor(Math.random() * 6) + 2;
  const friends = FRIEND_NAMES.slice(0, fc).map(n => ({
    n, c: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)], isFriend: true,
  }));
  const others = Array.from({ length: oc }, () => ({
    n: `Guest${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
    c: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    isFriend: false,
  }));
  return [...friends, ...others];
}

function generateChatSeed() {
  const count = 2 + Math.floor(Math.random() * 2);
  return Array.from({ length: count }, () => ({
    user: FRIEND_NAMES[Math.floor(Math.random() * FRIEND_NAMES.length)],
    text: HYPE[Math.floor(Math.random() * HYPE.length)],
    time: `${Math.floor(Math.random() * 12 + 1)}:${String(Math.floor(Math.random() * 60)).padStart(2,'0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
  }));
}

function clean(str) {
  return (str || '').replace(/\s+/g, ' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Geocoding via Nominatim ───────────────────────────────────────────────────
async function geocode(venueName) {
  try {
    const q   = encodeURIComponent(`${venueName}, Brussels, Belgium`);
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'Randevu Brussels App (randevu.app)' }, timeout: 8000 }
    );
    if (res.data?.length > 0)
      return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
  } catch { /* fall through */ }
  // Brussels centre with small random offset so pins don't overlap
  return {
    lat: 50.8503 + (Math.random() - 0.5) * 0.04,
    lng: 4.3517  + (Math.random() - 0.5) * 0.04,
  };
}

// ── Load / save ───────────────────────────────────────────────────────────────
function loadScraped() {
  if (!fs.existsSync(SCRAPED_JSON)) return [];
  try { return JSON.parse(fs.readFileSync(SCRAPED_JSON, 'utf8')); }
  catch { return []; }
}

function saveScraped(events) {
  // Strip the internal _rawDate field before writing so TypeScript
  // doesn't need to know about it — the scraper re-reads it on next run
  // but it's stored as a spare field in the JSON (TypeScript ignores unknowns).
  fs.writeFileSync(SCRAPED_JSON, JSON.stringify(events, null, 2), 'utf8');
  console.log(`\n✅  Saved ${events.length} events → scraped_events.json`);
}

function isDuplicate(existing, title, rawDate) {
  return existing.some(e =>
    e.title?.toLowerCase() === title?.toLowerCase() && e._rawDate === rawDate
  );
}

function removeExpired(events) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const kept    = events.filter(e => !e._rawDate || new Date(e._rawDate) >= today);
  const removed = events.length - kept.length;
  if (removed) console.log(`🗑️   Removed ${removed} expired event(s)`);
  return kept;
}

function nextId(existing) {
  return Math.max(existing.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1, SCRAPED_ID_MIN);
}

// ── Scraper helpers ───────────────────────────────────────────────────────────
function trySelectors($, selectors) {
  for (const sel of selectors) {
    const found = $(sel);
    if (found.length > 2) return found;
  }
  return $();
}

// ── AB Concerts ───────────────────────────────────────────────────────────────
async function scrapeABConcerts(browser) {
  console.log('\n🎸  Scraping AB Concerts (abconcerts.be)…');
  const events = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://www.abconcerts.be/en/agenda', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);

    const $ = cheerio.load(await page.content());

    const items = trySelectors($, [
      '.event-item','.agenda-item','.show-item','.programme-item',
      '[class*="event"]','[class*="show"]','[class*="concert"]',
      'article','.card','li',
    ]);
    console.log(`    ${items.length} raw elements found`);

    items.each((i, el) => {
      if (i >= 25) return;
      const $el = $(el);

      const title = clean(
        $el.find('h1,h2,h3,h4,.title,[class*="title"],[class*="name"]').first().text() ||
        $el.attr('title') || ''
      );
      if (!title || title.length < 4) return;

      const dateText  = clean($el.find('time,[class*="date"],[datetime]').first().text() || $el.find('[datetime]').attr('datetime') || '');
      const timeText  = clean($el.find('[class*="time"],[class*="hour"]').first().text());
      const desc      = clean($el.find('p,[class*="desc"],[class*="intro"],[class*="summary"]').first().text());
      const priceText = clean($el.find('[class*="price"],[class*="ticket"],[class*="cost"]').first().text());
      const link      = $el.find('a[href]').first().attr('href') || '';

      const rawDate = parseRawDate(dateText);
      if (!rawDate) return;
      const relDate = toRelativeDate(rawDate);
      if (!relDate) return;

      const { emoji, color, cat, tags } = classify(title + ' ' + desc);
      const { time, startH, endH }      = parseTime(timeText);
      const price = /\d/.test(priceText) ? priceText.replace(/[^0-9€£$.,]/g,'').substring(0,10) || 'TBC' : 'Free';
      const url   = link.startsWith('http') ? link : `https://www.abconcerts.be${link}`;

      events.push({ _rawDate: rawDate, title, venue: 'Ancienne Belgique', addr: 'Boulevard Anspach 110, 1000 Brussels',
        date: relDate, time, startH, endH, price, emoji, color, cat, tags,
        source: 'AB', sourceURL: url, ticket: url,
        desc: desc || `Live at AB — ${title}. One of Brussels' most iconic concert venues.`,
        neighbourhood: 'Centre', lat: 50.8483, lng: 4.3512 });
    });

    await page.close();
  } catch (err) {
    console.warn(`    ⚠️   AB Concerts failed: ${err.message}`);
  }
  console.log(`    ✓ ${events.length} events from AB Concerts`);
  return events;
}

// ── visit.brussels ────────────────────────────────────────────────────────────
async function scrapeVisitBrussels(browser) {
  console.log('\n🌆  Scraping visit.brussels…');
  const events = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto('https://visit.brussels/en/search-results?category=Event', { waitUntil: 'networkidle2', timeout: 40000 });
    await sleep(3000);
    // Scroll to trigger lazy-loaded cards
    await page.evaluate(() => window.scrollBy(0, 1000));
    await sleep(1500);

    const $ = cheerio.load(await page.content());

    const items = trySelectors($, [
      '.search-result-item','.event-card','.result-item','.node--type-event',
      '[class*="result"]','[class*="event-card"]','[class*="card"]',
      'article','.tile','.views-row',
    ]);
    console.log(`    ${items.length} raw elements found`);

    items.each((i, el) => {
      if (i >= 25) return;
      const $el = $(el);

      const title = clean($el.find('h1,h2,h3,h4,.title,[class*="title"]').first().text());
      if (!title || title.length < 4) return;

      const dateText  = clean($el.find('time,[class*="date"],[datetime]').first().text() || $el.find('[datetime]').attr('datetime') || '');
      const venueText = clean($el.find('[class*="venue"],[class*="location"],[class*="place"],[class*="address"]').first().text()) || '';
      const desc      = clean($el.find('p,[class*="desc"],[class*="summary"],[class*="intro"]').first().text());
      const link      = $el.find('a[href]').first().attr('href') || '';

      let rawDate = parseRawDate(dateText);
      // If no date found, default to next week so it's not immediately expired
      if (!rawDate) rawDate = new Date(Date.now() + 8 * 86400000).toISOString().split('T')[0];
      const relDate = toRelativeDate(rawDate);
      if (!relDate) return;

      const { emoji, color, cat, tags } = classify(title + ' ' + desc);
      const url = link.startsWith('http') ? link : `https://visit.brussels${link}`;

      events.push({ _rawDate: rawDate, title,
        venue: venueText || 'Brussels', addr: venueText ? `${venueText}, Brussels` : 'Brussels, Belgium',
        date: relDate, time: '19:00', startH: 19, endH: 22, price: 'Free',
        emoji, color, cat, tags, source: 'visit.brussels', sourceURL: url,
        desc: desc || `Discover ${title} in Brussels.`,
        neighbourhood: NEIGHBOURHOODS[Math.floor(Math.random() * NEIGHBOURHOODS.length)],
        lat: 0, lng: 0 });
    });

    await page.close();
  } catch (err) {
    console.warn(`    ⚠️   visit.brussels failed: ${err.message}`);
  }
  console.log(`    ✓ ${events.length} events from visit.brussels`);
  return events;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Randevu Event Scraper\n');

  let existing = loadScraped();
  console.log(`📂  Loaded ${existing.length} existing scraped events`);
  existing = removeExpired(existing);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
  });

  let raw = [];
  try {
    const [ab, vb] = await Promise.allSettled([
      scrapeABConcerts(browser),
      scrapeVisitBrussels(browser),
    ]);
    if (ab.status === 'fulfilled') raw = [...raw, ...ab.value];
    if (vb.status === 'fulfilled') raw = [...raw, ...vb.value];
  } finally {
    await browser.close();
  }

  console.log(`\n📡  Processing ${raw.length} scraped candidates…`);

  let idCounter = nextId(existing);
  let added = 0;

  for (const r of raw) {
    if (isDuplicate(existing, r.title, r._rawDate)) {
      console.log(`  ⏭   Duplicate: "${r.title}"`);
      continue;
    }

    // Geocode venues that don't have coordinates yet
    if (!r.lat || !r.lng) {
      process.stdout.write(`  📍  Geocoding "${r.venue}"… `);
      const coords = await geocode(r.venue);
      r.lat = coords.lat;
      r.lng = coords.lng;
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`);
      await sleep(GEOCODE_DELAY);
    }

    const friendCount = Math.floor(Math.random() * 4);
    existing.push({
      id:           idCounter++,
      cat:          r.cat,
      date:         r.date,
      title:        r.title,
      venue:        r.venue,
      addr:         r.addr,
      time:         r.time,
      startH:       r.startH,
      endH:         r.endH,
      price:        r.price,
      emoji:        r.emoji,
      color:        r.color,
      friends:      friendCount,
      tags:         r.tags,
      source:       r.source,
      sourceURL:    r.sourceURL,
      ticket:       r.ticket,
      lat:          r.lat,
      lng:          r.lng,
      going:        Math.floor(Math.random() * 300) + 20,
      neighbourhood:r.neighbourhood,
      desc:         r.desc,
      attendees:    generateAttendees(),
      chatSeed:     generateChatSeed(),
      _rawDate:     r._rawDate,
    });
    added++;
    console.log(`  ✅  Added: "${r.title}" (${r.date})`);
  }

  console.log(`\n📊  +${added} new  |  ${existing.length} total in database`);
  saveScraped(existing);
  console.log('\n✨  Done! Restart Expo to load the new events.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
