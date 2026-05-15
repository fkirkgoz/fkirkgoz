#!/usr/bin/env node
/**
 * Randevu Event Scraper
 *
 * Sources: AB Concerts (abconcerts.be) + Eventbrite Brussels
 * Run:     node eventScraper.js
 * Install: npm install puppeteer axios cheerio --legacy-peer-deps
 */

const puppeteer = require('puppeteer');
const axios     = require('axios');
const cheerio   = require('cheerio');
const fs        = require('fs');
const path      = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const SCRAPED_JSON   = path.join(__dirname, 'src', 'data', 'scraped_events.json');
const SCRAPED_ID_MIN = 100;
const GEOCODE_DELAY  = 1200; // ms — Nominatim rate limit

// ── Keyword → emoji / color / category ───────────────────────────────────────
const KEYWORD_MAP = [
  { kw:['techno','electronic','rave','dj set','club night','trance','house'], emoji:'⚡', color:'#7B2FBE', cat:'Nightlife',    tags:['Techno','Electronic']   },
  { kw:['jazz','blues','swing','bossa nova'],                                 emoji:'🎷', color:'#C77DFF', cat:'Music',        tags:['Jazz','Live Music']      },
  { kw:['rock','indie','punk','metal','alternative','grunge'],                emoji:'🎸', color:'#C77DFF', cat:'Music',        tags:['Rock','Live Music']      },
  { kw:['pop','rnb','hip-hop','hip hop','rap','soul','r&b'],                 emoji:'🎤', color:'#F7CFD8', cat:'Music',        tags:['Pop','Live Music']       },
  { kw:['classical','orchestra','opera','choir','symphony'],                  emoji:'🎻', color:'#E76F51', cat:'Culture',      tags:['Classical','Culture']    },
  { kw:['concert','live music','band','singer','live set'],                   emoji:'🎵', color:'#8E7DBE', cat:'Music',        tags:['Concert','Live Music']   },
  { kw:['food','cook','taste','eat','cuisine','gastro','brunch','dinner'],    emoji:'🍕', color:'#F4C87A', cat:'Food & Drink', tags:['Food','Social']          },
  { kw:['beer','wine','cocktail','bar','drink','brewery'],                    emoji:'🍹', color:'#F4C87A', cat:'Food & Drink', tags:['Drinks','Social']        },
  { kw:['market','flea','brocante','vintage','antique','bazaar'],             emoji:'🛍️', color:'#F4C87A', cat:'Market',       tags:['Market','Outdoors']      },
  { kw:['art','exhibit','museum','gallery','paint','photo','sculpture'],      emoji:'🎨', color:'#F4A261', cat:'Culture',      tags:['Art','Culture']          },
  { kw:['sport','football','run','yoga','fitness','padel','tennis','cycle'],  emoji:'⚽', color:'#90E0EF', cat:'Sports',       tags:['Sports','Active']        },
  { kw:['eco','nature','green','garden','clean','environment'],               emoji:'🌿', color:'#B8E5C0', cat:'Community',    tags:['Eco','Community']        },
  { kw:['festival','open air','open-air','outdoor','park','summer'],          emoji:'🌍', color:'#F4A261', cat:'Festival',     tags:['Festival','Outdoors']    },
  { kw:['theatre','theater','play','comedy','improv','stand-up','cabaret'],   emoji:'🎭', color:'#E76F51', cat:'Arts',         tags:['Theatre','Performance']  },
  { kw:['cinema','film','movie','screening','documentary'],                   emoji:'🎬', color:'#6C63FF', cat:'Arts',         tags:['Cinema','Film']          },
  { kw:['dance','ballet','tango','salsa','bachata'],                          emoji:'💃', color:'#F7CFD8', cat:'Arts',         tags:['Dance','Performance']    },
];
const DEFAULT_CLASS = { emoji:'📍', color:'#8E7DBE', cat:'Event', tags:['Brussels'] };
// Music fallback for known concert venues (AB etc.)
const MUSIC_CLASS   = { emoji:'🎵', color:'#8E7DBE', cat:'Music', tags:['Concert','Live Music'] };

const NEIGHBOURHOODS = ['Ixelles','Saint-Gilles','Molenbeek','Anderlecht','Laeken','Etterbeek','Schaerbeek','Forest','Uccle','Centre','Sablon','Marolles'];
const FRIEND_NAMES   = ['Zoë','Kaan','Léa','Iris','Nora','Hugo','Axel','Ali','Kai','Fleur'];
const AV_COLORS      = ['#F7CFD8','#A6D6D6','#8E7DBE','#F4A261','#90E0EF','#B8E5C0','#C77DFF','#F4C87A'];
const HYPE = [
  "Can't wait for this one! 🔥","Who else is going?? 🙋","Already got my ticket! 👋",
  "This is going to be AMAZING","First time at this venue!","Brussels never disappoints ❤️",
  "Counting down the days 🗓️","Grab tickets fast, selling out!",
];

// French/Dutch month names → English
const MONTH_FR = { janvier:'January',février:'February',mars:'March',avril:'April',mai:'May',juin:'June',juillet:'July','août':'August',septembre:'September',octobre:'October',novembre:'November',décembre:'December' };
const MONTH_NL = { januari:'January',februari:'February',maart:'March',april:'April',mei:'May',juni:'June',juli:'July',augustus:'August',september:'September',oktober:'October',november:'November',december:'December' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function classify(text) {
  const lower = (text||'').toLowerCase();
  for (const e of KEYWORD_MAP) if (e.kw.some(k => lower.includes(k))) return { emoji:e.emoji, color:e.color, cat:e.cat, tags:e.tags };
  return DEFAULT_CLASS;
}

// Force music classification for AB Concerts — it's always a concert venue
function classifyAB(text) {
  const cls = classify(text);
  return cls.emoji === DEFAULT_CLASS.emoji ? MUSIC_CLASS : cls;
}

function toRelativeDate(iso) {
  const ev = new Date(iso);
  if (isNaN(ev.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const eDay  = new Date(ev); eDay.setHours(0,0,0,0);
  const diff  = Math.round((eDay - today) / 86400000);
  if (diff < 0) return null;
  const dow = ev.getDay();
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 6 && (dow === 0 || dow === 6)) return 'This Weekend';
  if (diff <= 7)  return 'Next Week';
  if (diff <= 30) return 'Next Month';
  return 'Ongoing';
}

function parseRawDate(raw) {
  if (!raw) return null;
  let t = (raw||'').replace(/\s+/g,' ').trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2020) return t.slice(0,10);
  }

  const tLow = t.toLowerCase();
  for (const [fr,en] of Object.entries(MONTH_FR)) t = tLow.includes(fr) ? t.replace(new RegExp(fr,'i'), en) : t;
  for (const [nl,en] of Object.entries(MONTH_NL)) t = tLow.includes(nl) ? t.replace(new RegExp(nl,'i'), en) : t;

  let m = t.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (m) {
    const y = m[3].length===2 ? `20${m[3]}` : m[3];
    const d = new Date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) { const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; }

  m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) { const d = new Date(`${m[1]} ${m[2]}, ${m[3]}`); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]; }

  // "Fri 14 Jun" / "14 Jun" (no year — assume this or next year)
  m = t.match(/(?:[A-Za-z]+\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (m) {
    const yr = new Date().getFullYear();
    let d = new Date(`${m[2]} ${m[1]}, ${yr}`);
    if (!isNaN(d.getTime())) {
      if (d < new Date()) d = new Date(`${m[2]} ${m[1]}, ${yr+1}`);
      return d.toISOString().split('T')[0];
    }
  }

  const d = new Date(t);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2020) return d.toISOString().split('T')[0];
  return null;
}

// Scan raw element text for any date-like pattern when CSS selectors miss
function scanTextForDate(text) {
  if (!text) return null;
  const s = text.replace(/\s+/g,' ');
  const MS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const MF = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const patterns = [
    /\d{4}-\d{2}-\d{2}/,
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    new RegExp(`(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*\\s+\\d{1,2}\\s+(?:${MS})\\w*`, 'i'),
    new RegExp(`\\d{1,2}\\s+(?:${MF})\\s+\\d{4}`, 'i'),
    new RegExp(`(?:${MF})\\s+\\d{1,2},?\\s+\\d{4}`, 'i'),
    new RegExp(`\\d{1,2}\\s+(?:${MS})\\w*\\s+\\d{4}`, 'i'),
    new RegExp(`\\d{1,2}\\s+(?:${MS})`, 'i'),
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[0].trim();
  }
  return null;
}

function parseTime(str) {
  if (!str) return { time:'20:00', startH:20, endH:23 };
  const m = str.match(/(\d{1,2})[h:\.](\d{2})?/);
  if (m) { const h = parseInt(m[1],10); const min = m[2]?parseInt(m[2],10):0; return { time:`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`, startH:h, endH:h+3 }; }
  return { time:'20:00', startH:20, endH:23 };
}

// ── Price extraction ──────────────────────────────────────────────────────────

// Extract price from a JSON-LD offers object (or array of offers)
function extractPriceFromOffers(offers) {
  if (!offers) return null;
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (!o) return null;

  const desc = ((o.description || '') + ' ' + (o.name || '')).toLowerCase();
  if (desc.includes('free') || desc.includes('gratuit')) return 'Free';

  const p = parseFloat(o.price);
  if (!isNaN(p) && p === 0) return 'Free';
  if (!isNaN(p) && p > 0) {
    const sym = o.priceCurrency === 'USD' ? '$' : o.priceCurrency === 'GBP' ? '£' : '€';
    return `${sym}${Number.isInteger(p) ? p : p.toFixed(2)}`;
  }
  // Has an offer object but price is missing/unparseable → paid but unknown amount
  if (o.url || o.availability) return 'TBA';
  return null;
}

// Extract price from a plain text string (HTML scraping fallback)
function extractPriceFromText(text) {
  if (!text) return 'TBA';
  const t = text.toLowerCase();
  if (t.includes('free')  || t.includes('gratuit') ||
      t.includes('gratis') || t.includes('free entry') ||
      t.includes('free admission')) return 'Free';

  const m1 = text.match(/[€£$]\s*(\d+(?:[.,]\d{1,2})?)/);
  if (m1) return `€${m1[1].replace(',','.')}`;
  const m2 = text.match(/(\d+(?:[.,]\d{1,2})?)\s*[€£$]/);
  if (m2) return `€${m2[1].replace(',','.')}`;
  const m3 = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur\b)/i);
  if (m3) return `€${m3[1].replace(',','.')}`;

  return 'TBA';
}

function generateAttendees() {
  const fc = Math.floor(Math.random()*4), oc = Math.floor(Math.random()*6)+2;
  return [
    ...FRIEND_NAMES.slice(0,fc).map(n => ({ n, c:AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)], isFriend:true })),
    ...Array.from({length:oc}, () => ({ n:`Guest${String(Math.floor(Math.random()*999)).padStart(3,'0')}`, c:AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)], isFriend:false })),
  ];
}

function generateChatSeed() {
  return Array.from({length:2+Math.floor(Math.random()*2)}, () => ({
    user: FRIEND_NAMES[Math.floor(Math.random()*FRIEND_NAMES.length)],
    text: HYPE[Math.floor(Math.random()*HYPE.length)],
    time: `${Math.floor(Math.random()*12+1)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')} ${Math.random()>.5?'AM':'PM'}`,
  }));
}

function clean(s) { return (s||'').replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isValidTitle(t) {
  if (!t || t.length < 5) return false;
  const skip = [
    'grand-place','atomium','manneken','mini europe','brussels',
    'home','search','filter','load more','see all','back to',
    'cookie','privacy','newsletter','login','sign in','menu','close',
    'accept','reject','settings','language','share','buy ticket',
    'add to cart','sold out','more info',
  ];
  const tl = t.toLowerCase();
  return !skip.some(s => tl === s || tl.startsWith(s+' ') || tl.endsWith(' '+s));
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocode(venue) {
  try {
    // "Venue Name + Brussels" gives scattered, accurate markers
    const q   = encodeURIComponent(`${venue}, Brussels, Belgium`);
    const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers:{ 'User-Agent':'Randevu Brussels App (randevu.app)' }, timeout:8000 });
    if (res.data?.length > 0) return { lat:parseFloat(res.data[0].lat), lng:parseFloat(res.data[0].lon) };
  } catch {}
  return { lat:50.8503+(Math.random()-.5)*.04, lng:4.3517+(Math.random()-.5)*.04 };
}

// ── Persistence ───────────────────────────────────────────────────────────────
function loadScraped() {
  if (!fs.existsSync(SCRAPED_JSON)) return [];
  try { return JSON.parse(fs.readFileSync(SCRAPED_JSON,'utf8')); } catch { return []; }
}
function saveScraped(events) {
  fs.writeFileSync(SCRAPED_JSON, JSON.stringify(events,null,2),'utf8');
  console.log(`\n✅  Saved ${events.length} events → scraped_events.json`);
}
function isDuplicate(existing, title, rawDate) {
  return existing.some(e => e.title?.toLowerCase()===title?.toLowerCase() && e._rawDate===rawDate);
}
function removeExpired(events) {
  const today = new Date(); today.setHours(0,0,0,0);
  const kept = events.filter(e => !e._rawDate || new Date(e._rawDate) >= today);
  const n = events.length - kept.length;
  if (n) console.log(`🗑️   Removed ${n} expired event(s)`);
  return kept;
}
function nextId(existing) { return Math.max(existing.reduce((m,e) => Math.max(m,e.id||0),0)+1, SCRAPED_ID_MIN); }

// ── Extract JSON-LD events from a page ───────────────────────────────────────
async function extractJsonLd(page) {
  try {
    const blobs = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
        .filter(Boolean)
    );
    const found = [];
    for (const blob of blobs) {
      const list = Array.isArray(blob) ? blob
        : blob['@type']==='Event'      ? [blob]
        : blob['@type']==='MusicEvent' ? [blob]
        : blob['@graph'] ? blob['@graph'] : [];
      for (const item of list) {
        if (item['@type']==='Event' || item['@type']==='MusicEvent') found.push(item);
      }
    }
    return found;
  } catch { return []; }
}

// ── AB Concerts ───────────────────────────────────────────────────────────────
async function scrapeABConcerts(browser) {
  console.log('\n🎸  Scraping AB Concerts (abconcerts.be)…');
  const events = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.goto('https://www.abconcerts.be/en/agenda', { waitUntil:'domcontentloaded', timeout:30000 });
    await sleep(5000);
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(2000);
    console.log(`    Page: "${await page.title()}"`);

    // ── Strategy 1: JSON-LD ──
    const jsonEvents = await extractJsonLd(page);
    if (jsonEvents.length > 0) {
      console.log(`    JSON-LD: ${jsonEvents.length} events`);
      for (const ev of jsonEvents) {
        const title = clean(ev.name || '');
        if (!isValidTitle(title)) continue;
        const rawDate = parseRawDate(ev.startDate || ev.datePublished || '');
        if (!rawDate) continue;
        const relDate = toRelativeDate(rawDate);
        if (!relDate) continue;
        const venue  = clean(ev.location?.name || 'Ancienne Belgique');
        const desc   = clean(ev.description || '');
        const url    = ev.url || ev['@id'] || '';
        // Proper price: never default to Free unless explicitly stated
        const price  = extractPriceFromOffers(ev.offers) ||
                       extractPriceFromText(ev.description || '') ||
                       'TBA';
        const { emoji, color, cat, tags } = classifyAB(title + ' ' + desc);
        const timeStr = ev.startDate?.length > 10 ? ev.startDate.slice(11,16) : '20:00';
        const startH  = parseInt((timeStr||'20').split(':')[0], 10) || 20;
        events.push({ _rawDate:rawDate, title, venue, addr:'Boulevard Anspach 110, 1000 Brussels',
          date:relDate, time:timeStr, startH, endH:startH+3, price, emoji, color, cat, tags,
          source:'AB', sourceURL:url, ticket:url,
          desc:desc||`Live at Ancienne Belgique — ${title}.`, neighbourhood:'Centre', lat:50.8483, lng:4.3512 });
      }
    }

    // ── Strategy 2: HTML fallback ──
    if (events.length === 0) {
      const $ = cheerio.load(await page.content());
      const scope = $('main, #content, .main-content, [role="main"], .agenda, .programme, .events-list').first();
      const root  = scope.length ? scope : $('body');
      console.log(`    Scope: ${scope.length ? (scope.get(0).tagName + (scope.attr('class')||'').slice(0,30)) : 'body'}`);

      const candidates = root.find([
        'article','[class*="event"]','[class*="show"]','[class*="concert"]',
        '[class*="agenda-item"]','[class*="programme-item"]','[class*="listing"]','li',
      ].join(',')).filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 20 && text.length < 600;
      });
      console.log(`    HTML: ${candidates.length} candidates`);

      if (candidates.length > 0) {
        const snippet = ($(candidates.get(0)).html()||'').replace(/\s+/g,' ').slice(0,200);
        console.log(`    First candidate HTML: ${snippet}`);
      }

      candidates.each((i, el) => {
        if (i >= 30) return;
        const $el    = $(el);
        const title  = clean($el.find('h1,h2,h3,h4,strong,[class*="title"],[class*="name"],[class*="artist"]').first().text());
        if (!isValidTitle(title)) return;

        // Date: attribute → specific selector → full text scan
        const datetimeAttr  = $el.find('[datetime]').first().attr('datetime') ||
                              $el.find('time').first().attr('datetime') || '';
        const specificText  = clean($el.find([
          'time','[class*="date"]','[class*="when"]','[class*="dag"]',
          '[class*="datum"]','[class*="day"]','[class*="period"]',
        ].join(',')).first().text());
        const scannedDate   = (!datetimeAttr && !specificText) ? scanTextForDate($el.text()) : null;
        const dateText      = datetimeAttr || specificText || scannedDate || '';
        console.log(`    AB: "${title.slice(0,40)}" | date: "${dateText.slice(0,40)}"`);

        const rawDate = parseRawDate(dateText);
        if (!rawDate) { console.log(`      → date not parsed, skipping`); return; }
        const relDate = toRelativeDate(rawDate);
        if (!relDate) return;

        const timeText  = clean($el.find('[class*="time"],[class*="hour"],[class*="uur"]').first().text());
        const priceText = clean($el.find('[class*="price"],[class*="ticket"],[class*="cost"]').first().text());
        const desc      = clean($el.find('p,[class*="desc"],[class*="intro"]').first().text());
        const link      = $el.find('a[href]').first().attr('href') || '';
        const url       = link.startsWith('http') ? link : `https://www.abconcerts.be${link}`;
        const price     = extractPriceFromText(priceText || $el.text());
        const { emoji, color, cat, tags } = classifyAB(title + ' ' + desc);
        const { time, startH, endH }      = parseTime(timeText);

        events.push({ _rawDate:rawDate, title, venue:'Ancienne Belgique', addr:'Boulevard Anspach 110, 1000 Brussels',
          date:relDate, time, startH, endH, price, emoji, color, cat, tags,
          source:'AB', sourceURL:url, ticket:url,
          desc:desc||`Live at Ancienne Belgique — ${title}.`, neighbourhood:'Centre', lat:50.8483, lng:4.3512 });
      });
    }

    await page.close();
  } catch (err) { console.warn(`    ⚠️  AB Concerts failed: ${err.message}`); }

  console.log(`    ✓ ${events.length} events from AB Concerts`);
  return events;
}

// ── Eventbrite Brussels ───────────────────────────────────────────────────────
async function scrapeEventbrite(browser) {
  console.log('\n🎟️  Scraping Eventbrite Brussels…');
  const events = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    const URLS = [
      'https://www.eventbrite.com/d/belgium--brussels/events/',
      'https://www.eventbrite.be/d/belgium--brussels/events/',
      'https://www.eventbrite.com/d/belgium--brussels/all-events/',
    ];

    let loaded = false;
    for (const url of URLS) {
      try {
        console.log(`    Trying ${url}`);
        await page.goto(url, { waitUntil:'domcontentloaded', timeout:30000 });
        await sleep(5000);
        await page.evaluate(() => window.scrollBy(0, 600));
        await sleep(2000);
        const title = await page.title();
        console.log(`    Title: "${title}"`);
        if (title && !title.toLowerCase().includes('error') && !title.toLowerCase().includes('not found')) {
          loaded = true; break;
        }
      } catch (err) { console.log(`    Failed: ${err.message}`); }
    }
    if (!loaded) { await page.close(); return events; }

    // ── Strategy 1: JSON-LD ──
    const jsonEvents = await extractJsonLd(page);
    if (jsonEvents.length > 0) {
      console.log(`    JSON-LD: ${jsonEvents.length} events`);
      for (const ev of jsonEvents) {
        const title = clean(ev.name || '');
        if (!isValidTitle(title)) continue;
        const rawDate = parseRawDate(ev.startDate || '');
        if (!rawDate) continue;
        const relDate = toRelativeDate(rawDate);
        if (!relDate) continue;
        const venue  = clean(ev.location?.name || ev.location?.address?.name || 'Brussels');
        const addr   = clean(ev.location?.address?.streetAddress || `${venue}, Brussels`);
        const desc   = clean(ev.description || '');
        const url    = ev.url || ev['@id'] || '';
        const price  = extractPriceFromOffers(ev.offers) ||
                       extractPriceFromText(ev.description || '') ||
                       'TBA';
        const { emoji, color, cat, tags } = classify(title + ' ' + desc);
        const timeStr = ev.startDate?.length > 10 ? ev.startDate.slice(11,16) : '19:00';
        const startH  = parseInt((timeStr||'19').split(':')[0], 10) || 19;
        events.push({ _rawDate:rawDate, title, venue, addr,
          date:relDate, time:timeStr, startH, endH:startH+3, price, emoji, color, cat, tags,
          source:'Eventbrite', sourceURL:url, ticket:url,
          desc:desc||`Event in Brussels — ${title}.`,
          neighbourhood:NEIGHBOURHOODS[Math.floor(Math.random()*NEIGHBOURHOODS.length)],
          lat:0, lng:0 });
      }
    }

    // ── Strategy 2: HTML ──
    if (events.length === 0) {
      const $ = cheerio.load(await page.content());
      const candidates = $([
        'article','[class*="event-card"]','[class*="search-event-card"]',
        '[class*="discover-search"]','[data-event-id]','[data-automation="event-card"]',
      ].join(',')).filter((_, el) => {
        const text = $(el).text().trim();
        return text.length > 20 && text.length < 800;
      });
      console.log(`    HTML: ${candidates.length} cards`);

      if (candidates.length > 0) {
        const snippet = ($(candidates.get(0)).html()||'').replace(/\s+/g,' ').slice(0,200);
        console.log(`    First card HTML: ${snippet}`);
      }

      candidates.each((i, el) => {
        if (i >= 25) return;
        const $el  = $(el);
        const title = clean($el.find('h2,h3,[class*="title"],[class*="event-name"]').first().text());
        if (!isValidTitle(title)) return;

        const datetimeAttr = $el.find('[datetime]').first().attr('datetime') || '';
        const specificText = clean($el.find('time,[class*="date"],[class*="when"],[class*="start"]').first().text());
        const scannedDate  = (!datetimeAttr && !specificText) ? scanTextForDate($el.text()) : null;
        const dateText     = datetimeAttr || specificText || scannedDate || '';

        const rawDate = parseRawDate(dateText);
        if (!rawDate) return;
        const relDate = toRelativeDate(rawDate);
        if (!relDate) return;

        const venueText = clean($el.find('[class*="venue"],[class*="location"],[class*="place"]').first().text());
        const priceText = clean($el.find('[class*="price"],[class*="ticket"],[class*="cost"]').first().text());
        const desc      = clean($el.find('p,[class*="desc"],[class*="summary"]').first().text());
        const link      = $el.find('a[href]').first().attr('href') || '';
        const url       = link.startsWith('http') ? link : `https://www.eventbrite.com${link}`;
        const price     = extractPriceFromText(priceText || $el.text());
        const { emoji, color, cat, tags } = classify(title + ' ' + desc);

        events.push({ _rawDate:rawDate, title, venue:venueText||'Brussels', addr:venueText?`${venueText}, Brussels`:'Brussels, Belgium',
          date:relDate, time:'19:00', startH:19, endH:22, price, emoji, color, cat, tags,
          source:'Eventbrite', sourceURL:url, ticket:url,
          desc:desc||`Event in Brussels — ${title}.`,
          neighbourhood:NEIGHBOURHOODS[Math.floor(Math.random()*NEIGHBOURHOODS.length)],
          lat:0, lng:0 });
      });
    }

    await page.close();
  } catch (err) { console.warn(`    ⚠️  Eventbrite failed: ${err.message}`); }

  console.log(`    ✓ ${events.length} events from Eventbrite`);
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
    // Support CI environments that provide their own Chrome
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });

  let raw = [];
  try {
    raw = [...raw, ...(await scrapeABConcerts(browser))];
    raw = [...raw, ...(await scrapeEventbrite(browser))];
  } finally {
    await browser.close();
  }

  console.log(`\n📡  Processing ${raw.length} scraped candidates…`);

  let idCounter = nextId(existing);
  let added = 0;

  for (const r of raw) {
    if (isDuplicate(existing, r.title, r._rawDate)) { console.log(`  ⏭   Duplicate: "${r.title}"`); continue; }

    if (!r.lat || !r.lng) {
      process.stdout.write(`  📍  Geocoding "${r.venue}"… `);
      const coords = await geocode(r.venue);
      r.lat = coords.lat; r.lng = coords.lng;
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`);
      await sleep(GEOCODE_DELAY);
    }

    existing.push({
      id:idCounter++, cat:r.cat, date:r.date, title:r.title, venue:r.venue, addr:r.addr,
      time:r.time, startH:r.startH, endH:r.endH, price:r.price, emoji:r.emoji, color:r.color,
      friends:Math.floor(Math.random()*4), tags:r.tags, source:r.source, sourceURL:r.sourceURL, ticket:r.ticket,
      lat:r.lat, lng:r.lng, going:Math.floor(Math.random()*300)+20,
      neighbourhood:r.neighbourhood, desc:r.desc,
      attendees:generateAttendees(), chatSeed:generateChatSeed(), _rawDate:r._rawDate,
    });
    added++;
    console.log(`  ✅  Added: "${r.title}" (${r.date}) — ${r.price}`);
  }

  console.log(`\n📊  +${added} new  |  ${existing.length} total`);
  saveScraped(existing);
  console.log('\n✨  Done! Restart Expo to load the new events.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
