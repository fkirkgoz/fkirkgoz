#!/usr/bin/env node
/**
 * Randevu Event Scraper — Brussels venue-specific edition
 *
 * Sources: AB · Botanique · Fuse · C12 · Cirque Royal · La Madeleine · Bozar
 *          RSC Anderlecht · Union Saint-Gilloise · City of Brussels
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
const GEOCODE_DELAY  = 1200;

// ── Brussels venue definitions ────────────────────────────────────────────────
// extraWait: ms to wait after DOM ready so JS can render event cards
// jsHeavy:   use networkidle2 wait mode + extra scroll passes
const VENUE_CONFIGS = [
  {
    id: 'ab',
    name: 'Ancienne Belgique',
    addr: 'Boulevard Anspach 110, 1000 Brussels',
    lat: 50.8483, lng: 4.3512,
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Concert', 'Live Music'],
    defaultTime: '20:00',
    extraWait: 5000,
    urls: [
      'https://www.abconcerts.be/en/agenda',
      'https://abconcerts.be/en/agenda',
    ],
  },
  {
    id: 'botanique',
    name: 'Le Botanique',
    addr: 'Rue Royale 236, 1210 Saint-Josse',
    lat: 50.8587, lng: 4.3634,
    neighbourhood: 'Saint-Josse',
    emoji: '🎸', color: '#B8E5C0', cat: 'Music',
    tags: ['Concert', 'Indie', 'Alternative'],
    defaultTime: '20:00',
    extraWait: 7000,
    urls: [
      'https://botanique.be/en',
      'https://botanique.be/en/agenda',
      'https://botanique.be/en/activities',
      'https://www.botanique.be/en',
      'https://botanique.be/fr/agenda',
    ],
  },
  {
    id: 'fuse',
    name: 'Fuse',
    addr: 'Rue Blaes 208, 1000 Brussels',
    lat: 50.8451, lng: 4.3506,
    neighbourhood: 'Marolles',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Techno', 'Electronic', 'Nightlife'],
    defaultTime: '23:00',
    extraWait: 9000,
    jsHeavy: true,
    urls: [
      'https://fuse.be',
      'https://www.fuse.be',
      'https://fuse.be/agenda',
      'https://www.fuse.be/agenda',
      'https://fuse.be/en',
    ],
  },
  {
    id: 'c12',
    name: 'C12',
    addr: 'Rue du Fossé aux Loups 43, 1000 Brussels',
    lat: 50.8500, lng: 4.3539,
    neighbourhood: 'Centre',
    emoji: '💃', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Electronic', 'Art', 'Nightlife'],
    defaultTime: '22:00',
    extraWait: 9000,
    jsHeavy: true,
    urls: [
      'https://c12space.com/agenda/',
      'https://c12space.com/agenda',
      'https://www.c12space.com/agenda',
      'https://c12space.com',
      'https://www.c12space.com',
    ],
  },
  {
    id: 'cirqueRoyal',
    name: 'Cirque Royal',
    addr: "Rue de l'Enseignement 81, 1000 Brussels",
    lat: 50.8549, lng: 4.3620,
    neighbourhood: 'Centre',
    emoji: '🎹', color: '#C77DFF', cat: 'Music',
    tags: ['Concert', 'Live Music'],
    defaultTime: '20:00',
    extraWait: 6000,
    urls: [
      'https://www.cirque-royal.org',
      'https://cirque-royal.org',
      'https://www.cirque-royal.org/en',
      'https://www.cirque-royal.org/agenda',
      'https://www.cirque-royal.org/programmation',
      'https://www.cirque-royal.org/spectacles',
    ],
  },
  {
    id: 'laMadeleine',
    name: 'La Madeleine',
    addr: 'Rue de la Madeleine 51, 1000 Brussels',
    lat: 50.8459, lng: 4.3562,
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#8E7DBE', cat: 'Music',
    tags: ['Concert', 'Live Music'],
    defaultTime: '20:00',
    extraWait: 6000,
    urls: [
      'https://www.la-madeleine.be',
      'https://la-madeleine.be',
      'https://www.la-madeleine.be/agenda',
      'https://www.la-madeleine.be/programmation',
      'https://www.la-madeleine.be/spectacles',
      'https://www.la-madeleine.be/concerts',
    ],
  },
  {
    id: 'bozar',
    name: 'Bozar',
    addr: 'Rue Ravenstein 23, 1000 Brussels',
    lat: 50.8445, lng: 4.3609,
    neighbourhood: 'Centre',
    emoji: '🏛️', color: '#E76F51', cat: 'Culture',
    tags: ['Classical', 'Culture', 'Arts'],
    defaultTime: '20:00',
    extraWait: 5000,
    urls: [
      'https://www.bozar.be/en/calendar',
      'https://www.bozar.be/en',
      'https://bozar.be/en/calendar',
    ],
  },
  {
    id: 'rsca',
    name: 'RSC Anderlecht',
    addr: 'Avenue Théo Verbeeck 2, 1070 Anderlecht',
    lat: 50.8341, lng: 4.3021,
    neighbourhood: 'Anderlecht',
    emoji: '⚽', color: '#6EC6CA', cat: 'Sports',
    tags: ['Football', 'Sports', 'Anderlecht'],
    defaultTime: '18:00',
    extraWait: 6000,
    urls: [
      'https://www.rsca.be/en/calendar',
      'https://www.rsca.be/en/matches',
      'https://rsca.be/en/calendar',
      'https://www.rsca.be/en/fixtures',
      'https://www.rsca.be/en',
    ],
  },
  {
    id: 'unionsg',
    name: 'Union Saint-Gilloise',
    addr: 'Avenue du Stade 2, 1190 Forest',
    lat: 50.8165, lng: 4.3372,
    neighbourhood: 'Forest',
    emoji: '⚽', color: '#F4C87A', cat: 'Sports',
    tags: ['Football', 'Sports', 'Union'],
    defaultTime: '18:00',
    extraWait: 6000,
    urls: [
      'https://www.rusg.brussels/en/tickets',
      'https://www.rusg.brussels/en/agenda',
      'https://www.rusg.brussels/en/calendar',
      'https://www.rusg.brussels/en',
      'https://rusg.brussels/en',
    ],
  },
  {
    id: 'brussels',
    name: 'City of Brussels',
    addr: 'Brussels, Belgium',
    lat: 50.8503, lng: 4.3517,
    neighbourhood: 'Centre',
    emoji: '🏛️', color: '#8E7DBE', cat: 'Culture',
    tags: ['Brussels', 'Culture', 'City'],
    defaultTime: '10:00',
    extraWait: 5000,
    urls: [
      'https://www.brussels.be/agenda',
      'https://brussels.be/agenda',
    ],
  },
];

// ── Keyword classification ────────────────────────────────────────────────────
const KEYWORD_MAP = [
  { kw:['techno','electronic','rave','dj set','club night','trance','house'], emoji:'⚡', color:'#7B2FBE', cat:'Nightlife',    tags:['Techno','Electronic']   },
  { kw:['jazz','blues','swing','bossa nova'],                                 emoji:'🎷', color:'#C77DFF', cat:'Music',        tags:['Jazz','Live Music']      },
  { kw:['rock','indie','punk','metal','alternative','grunge'],                emoji:'🎸', color:'#C77DFF', cat:'Music',        tags:['Rock','Live Music']      },
  { kw:['pop','rnb','hip-hop','hip hop','rap','soul','r&b'],                 emoji:'🎤', color:'#F7CFD8', cat:'Music',        tags:['Pop','Live Music']       },
  { kw:['classical','orchestra','opera','choir','symphony','philharmonic'],   emoji:'🎻', color:'#E76F51', cat:'Culture',      tags:['Classical','Culture']    },
  { kw:['concert','live music','band','singer','live set'],                   emoji:'🎵', color:'#8E7DBE', cat:'Music',        tags:['Concert','Live Music']   },
  { kw:['food','cook','taste','eat','cuisine','gastro','brunch'],             emoji:'🍕', color:'#F4C87A', cat:'Food & Drink', tags:['Food','Social']          },
  { kw:['beer','wine','cocktail','bar','drink'],                              emoji:'🍹', color:'#F4C87A', cat:'Food & Drink', tags:['Drinks','Social']        },
  { kw:['market','flea','brocante','vintage','antique'],                      emoji:'🛍️', color:'#F4C87A', cat:'Market',       tags:['Market','Outdoors']      },
  { kw:['art','exhibit','museum','gallery','paint','photo','sculpture'],      emoji:'🎨', color:'#F4A261', cat:'Culture',      tags:['Art','Culture']          },
  { kw:['sport','football','run','yoga','fitness'],                           emoji:'⚽', color:'#90E0EF', cat:'Sports',       tags:['Sports','Active']        },
  { kw:['festival','open air','open-air','outdoor','park'],                   emoji:'🌍', color:'#F4A261', cat:'Festival',     tags:['Festival','Outdoors']    },
  { kw:['theatre','theater','play','comedy','improv','stand-up'],             emoji:'🎭', color:'#E76F51', cat:'Arts',         tags:['Theatre','Performance']  },
  { kw:['cinema','film','movie','screening','documentary'],                   emoji:'🎬', color:'#6C63FF', cat:'Arts',         tags:['Cinema','Film']          },
  { kw:['dance','ballet','tango','salsa'],                                    emoji:'💃', color:'#F7CFD8', cat:'Arts',         tags:['Dance','Performance']    },
];
const DEFAULT_CLASS = { emoji:'📍', color:'#8E7DBE', cat:'Event', tags:['Brussels'] };

function classify(text) {
  const lower = (text||'').toLowerCase();
  for (const e of KEYWORD_MAP) if (e.kw.some(k => lower.includes(k))) return { emoji:e.emoji, color:e.color, cat:e.cat, tags:e.tags };
  return DEFAULT_CLASS;
}

function classifyForVenue(text, config) {
  const cls = classify(text);
  return cls.emoji === DEFAULT_CLASS.emoji
    ? { emoji: config.emoji, color: config.color, cat: config.cat, tags: config.tags }
    : cls;
}

// ── Price logic ───────────────────────────────────────────────────────────────

function extractAllPrices(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  if (t.includes('free') || t.includes('gratuit') || t.includes('gratis') ||
      t.includes('free entry') || t.includes('entrée libre')) return [0];
  const prices = [];
  const re = /€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseFloat((m[1] || m[2]).replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500) prices.push(val);
  }
  return [...new Set(prices)];
}

function extractPriceFromOffers(offers) {
  if (!offers) return [];
  const list = Array.isArray(offers) ? offers : [offers];
  const prices = [];
  for (const o of list) {
    const desc = ((o.description || '') + ' ' + (o.name || '')).toLowerCase();
    if (desc.includes('free') || desc.includes('gratuit')) { prices.push(0); continue; }
    const p = parseFloat(o.price);
    if (!isNaN(p) && p >= 0 && p < 500) prices.push(p);
  }
  return prices;
}

function formatPrice(prices) {
  if (!prices || prices.length === 0) return '';
  const hasFree = prices.includes(0);
  const paid    = prices.filter(p => p > 0);
  if (hasFree && paid.length === 0) return 'Free';
  if (paid.length === 0) return '';
  const min = Math.min(...paid);
  const max = Math.max(...paid);
  const fmt = n => Number.isInteger(n) ? `${n}` : n.toFixed(2);
  if (hasFree) return `Free – €${fmt(max)}`;
  if (min === max) return `€${fmt(min)}`;
  return `From €${fmt(min)}`;
}

// ── Two-step price extraction ─────────────────────────────────────────────────
// For events that landed with no price, follow their detail URL and look for €
async function deepFetchPrices(page, events) {
  const toFetch = events.filter(e => !e.price && e.sourceURL?.startsWith('http')).slice(0, 5);
  if (toFetch.length === 0) return;
  console.log(`    💰 Deep-fetching prices for ${toFetch.length} events…`);
  for (const ev of toFetch) {
    try {
      await page.goto(ev.sourceURL, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await sleep(1500);
      const text = await page.evaluate(() => document.body?.innerText || '');
      const prices = extractAllPrices(text);
      if (prices.length > 0) {
        ev.price = formatPrice(prices);
        console.log(`      ✓ "${ev.title.slice(0, 30)}": ${ev.price}`);
      }
    } catch (err) {
      console.log(`      ✗ price fetch failed: ${err.message.slice(0, 50)}`);
    }
    await sleep(1000);
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTH_FR = { janvier:'January',février:'February',mars:'March',avril:'April',mai:'May',juin:'June',juillet:'July','août':'August',septembre:'September',octobre:'October',novembre:'November',décembre:'December' };
const MONTH_NL = { januari:'January',februari:'February',maart:'March',april:'April',mei:'May',juni:'June',juli:'July',augustus:'August',september:'September',oktober:'October',november:'November',december:'December' };

function toRelativeDate(iso) {
  const ev = new Date(iso);
  if (isNaN(ev.getTime())) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const eDay  = new Date(ev); eDay.setHours(0,0,0,0);
  const diff  = Math.round((eDay - today) / 86400000);
  if (diff < 0)  return null;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) { const d=new Date(t); if(!isNaN(d.getTime())&&d.getFullYear()>2020)return t.slice(0,10); }
  const tLow = t.toLowerCase();
  for (const [fr,en] of Object.entries(MONTH_FR)) t = tLow.includes(fr) ? t.replace(new RegExp(fr,'i'), en) : t;
  for (const [nl,en] of Object.entries(MONTH_NL)) t = tLow.includes(nl) ? t.replace(new RegExp(nl,'i'), en) : t;
  let m = t.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (m) { const y=m[3].length===2?`20${m[3]}`:m[3]; const d=new Date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`); if(!isNaN(d.getTime()))return d.toISOString().split('T')[0]; }
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) { const d=new Date(`${m[2]} ${m[1]}, ${m[3]}`); if(!isNaN(d.getTime()))return d.toISOString().split('T')[0]; }
  m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) { const d=new Date(`${m[1]} ${m[2]}, ${m[3]}`); if(!isNaN(d.getTime()))return d.toISOString().split('T')[0]; }
  m = t.match(/(?:[A-Za-z]+\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (m) { const yr=new Date().getFullYear(); let d=new Date(`${m[2]} ${m[1]}, ${yr}`); if(!isNaN(d.getTime())){ if(d<new Date())d=new Date(`${m[2]} ${m[1]}, ${yr+1}`); return d.toISOString().split('T')[0]; } }
  const d=new Date(t); if(!isNaN(d.getTime())&&d.getFullYear()>2020)return d.toISOString().split('T')[0];
  return null;
}

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
  for (const p of patterns) { const m=s.match(p); if(m)return m[0].trim(); }
  return null;
}

function parseTime(str, defaultTime) {
  const def = defaultTime || '20:00';
  if (!str) return { time:def, startH:parseInt(def,10)||20, endH:(parseInt(def,10)||20)+3 };
  const m = str.match(/(\d{1,2})[h:\.](\d{2})?/);
  if (m) { const h=parseInt(m[1],10); const min=m[2]?parseInt(m[2],10):0; return { time:`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`, startH:h, endH:h+3 }; }
  return { time:def, startH:parseInt(def,10)||20, endH:(parseInt(def,10)||20)+3 };
}

// ── Other helpers ─────────────────────────────────────────────────────────────
function clean(s) { return (s||'').replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isValidTitle(t) {
  if (!t || t.length < 5 || t.length > 200) return false;
  const skip = [
    'grand-place','atomium','manneken','mini europe',
    'home','search','filter','load more','see all','back to','read more',
    'cookie','privacy','newsletter','login','sign in','menu','close',
    'accept','reject','settings','language','share','buy ticket',
    'add to cart','sold out','more info','subscribe','follow us',
  ];
  const tl = t.toLowerCase();
  return !skip.some(s => tl === s || tl.startsWith(s+' ') || tl.endsWith(' '+s));
}

const FRIEND_NAMES = ['Zoë','Kaan','Léa','Iris','Nora','Hugo','Axel','Ali','Kai','Fleur'];
const AV_COLORS    = ['#F7CFD8','#A6D6D6','#8E7DBE','#F4A261','#90E0EF','#B8E5C0','#C77DFF','#F4C87A'];
const HYPE = [
  "Can't wait for this one! 🔥","Who else is going?? 🙋","Already got my ticket! 👋",
  "This is going to be AMAZING","First time at this venue!","Brussels never disappoints ❤️",
  "Counting down the days 🗓️","Grab tickets fast, selling out!",
];
function generateAttendees() {
  const fc=Math.floor(Math.random()*4), oc=Math.floor(Math.random()*6)+2;
  return [
    ...FRIEND_NAMES.slice(0,fc).map(n=>({n,c:AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)],isFriend:true})),
    ...Array.from({length:oc},()=>({n:`Guest${String(Math.floor(Math.random()*999)).padStart(3,'0')}`,c:AV_COLORS[Math.floor(Math.random()*AV_COLORS.length)],isFriend:false})),
  ];
}
function generateChatSeed() {
  return Array.from({length:2+Math.floor(Math.random()*2)},()=>({
    user:FRIEND_NAMES[Math.floor(Math.random()*FRIEND_NAMES.length)],
    text:HYPE[Math.floor(Math.random()*HYPE.length)],
    time:`${Math.floor(Math.random()*12+1)}:${String(Math.floor(Math.random()*60)).padStart(2,'0')} ${Math.random()>.5?'AM':'PM'}`,
  }));
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocode(venue) {
  try {
    const q   = encodeURIComponent(`${venue}, Brussels, Belgium`);
    const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers:{'User-Agent':'Randevu Brussels App (randevu.app)'}, timeout:8000 });
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
  const today=new Date(); today.setHours(0,0,0,0);
  const kept=events.filter(e=>!e._rawDate||new Date(e._rawDate)>=today);
  const n=events.length-kept.length;
  if(n) console.log(`🗑️   Removed ${n} expired event(s)`);
  return kept;
}
function nextId(existing) { return Math.max(existing.reduce((m,e)=>Math.max(m,e.id||0),0)+1, SCRAPED_ID_MIN); }

// ── JSON-LD extraction ────────────────────────────────────────────────────────
async function extractJsonLd(page) {
  try {
    const blobs = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s=>{try{return JSON.parse(s.textContent);}catch{return null;}})
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

// ── Generic venue scraper ─────────────────────────────────────────────────────
async function scrapeVenue(browser, config) {
  console.log(`\n${config.emoji}  Scraping ${config.name}…`);
  const events = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    let loaded = false;
    for (const url of config.urls) {
      try {
        // JS-heavy sites: networkidle2 (may partially timeout — that's OK)
        const waitMode = config.jsHeavy ? 'networkidle2' : 'domcontentloaded';
        try {
          await page.goto(url, { waitUntil: waitMode, timeout: 30000 });
        } catch (navErr) {
          if (!navErr.message.includes('timeout')) throw navErr;
          console.log(`    Navigation timeout — using partial content`);
        }

        const extraWait = config.extraWait || 5000;
        await sleep(extraWait);
        // Two scroll passes to trigger any lazy-loading
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(1500);
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(1000);

        const title   = await page.title();
        const bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
        console.log(`    Loaded: "${title}" (${bodyLen} chars)`);

        // Accept any page with a real title and some content
        if (title && title.length > 3 && bodyLen > 300) {
          loaded = true; break;
        }
      } catch (err) { console.log(`    URL failed: ${err.message.slice(0,80)}`); }
    }
    if (!loaded) { await page.close(); return events; }

    // ── Strategy 1: JSON-LD structured data ──
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
        const venue   = clean(ev.location?.name || config.name);
        const desc    = clean(ev.description || '');
        const url     = ev.url || ev['@id'] || '';
        const offerPs = extractPriceFromOffers(ev.offers);
        const descPs  = offerPs.length === 0 ? extractAllPrices(desc) : [];
        const price   = formatPrice([...offerPs, ...descPs]);
        const timeStr = ev.startDate?.length > 10 ? ev.startDate.slice(11,16) : config.defaultTime;
        const startH  = parseInt((timeStr||config.defaultTime).split(':')[0], 10) || 20;
        const cls     = classifyForVenue(title+' '+desc, config);
        events.push({ _rawDate:rawDate, title, venue, addr:config.addr,
          date:relDate, time:timeStr||config.defaultTime, startH, endH:startH+3,
          price, emoji:cls.emoji, color:cls.color, cat:cls.cat, tags:cls.tags,
          source:config.name, sourceURL:url, ticket:url,
          desc:desc||`${title} at ${config.name}.`,
          neighbourhood:config.neighbourhood, lat:config.lat, lng:config.lng });
      }
      console.log(`    → ${events.length} valid from JSON-LD`);
    }

    // ── Strategy 2: HTML — heading + date presence filter ──────────────────
    // This works regardless of CSS class names by requiring that a candidate
    // element contains BOTH a heading AND something that looks like a date.
    if (events.length === 0) {
      const $ = cheerio.load(await page.content());

      // Prefer a scoped container; fall back to body
      const scope = $([
        'main','#content','[role="main"]',
        '.agenda','.programme','.calendar','.events-list','.event-list',
        '.event-overview','.listing','.schedule',
      ].join(',')).first();
      const root = scope.length ? scope : $('body');
      console.log(`    HTML scope: ${scope.length ? (scope.get(0).tagName+(scope.attr('class')||'').slice(0,30)) : 'body'}`);

      // Cast a very wide net — any container element
      const candidates = root.find([
        'article',
        '.card','[class*="card"]',
        '[class*="event"]','[class*="show"]','[class*="concert"]',
        '[class*="agenda"]','[class*="programme"]','[class*="listing"]',
        '[class*="item"]',
        // CMS-specific
        '.node','.views-row',          // Drupal
        '.eventlist-event',            // Squarespace
        '.wp-block-post','.entry',     // WordPress
        '.tribe-event',                // The Events Calendar
        'li',
      ].join(',')).filter((_, el) => {
        const $el  = $(el);
        const text = $el.text().trim();
        if (text.length < 15 || text.length > 1200) return false;

        // Must have a heading-like element (event title)
        const hasHeading = $el.find([
          'h1','h2','h3','h4','h5','strong','b',
          '[class*="title"]','[class*="name"]','[class*="artist"]','[class*="heading"]',
        ].join(',')).length > 0;
        if (!hasHeading) return false;

        // Must have a date element OR text that parses as a date
        const hasDateEl  = $el.find('time,[datetime],[class*="date"],[class*="dag"],[class*="when"],[class*="period"]').length > 0;
        const hasDateTxt = hasDateEl || !!scanTextForDate(text);
        return hasDateTxt;
      });

      console.log(`    HTML candidates (heading+date filter): ${candidates.length}`);
      if (candidates.length > 0) {
        console.log(`    First candidate: ${($(candidates.get(0)).html()||'').replace(/\s+/g,' ').slice(0,250)}`);
      }

      const baseOrigin = config.urls[0].match(/^https?:\/\/[^\/]+/)?.[0] || '';

      candidates.each((i, el) => {
        if (i >= 30) return;
        const $el  = $(el);
        const title = clean($el.find([
          'h1','h2','h3','h4','h5','strong',
          '[class*="title"]','[class*="name"]','[class*="artist"]','[class*="heading"]',
        ].join(',')).first().text());
        if (!isValidTitle(title)) return;

        // Date: datetime attribute → specific selector → full text scan
        const dtAttr    = $el.find('[datetime]').first().attr('datetime') || $el.find('time').first().attr('datetime') || '';
        const dtSpecific = clean($el.find([
          'time','[class*="date"]','[class*="when"]','[class*="dag"]',
          '[class*="datum"]','[class*="day"]','[class*="period"]',
        ].join(',')).first().text());
        const dtScanned  = (!dtAttr && !dtSpecific) ? scanTextForDate($el.text()) : null;
        const dateText   = dtAttr || dtSpecific || dtScanned || '';
        console.log(`    ${config.id}: "${title.slice(0,35)}" | date: "${dateText.slice(0,35)}"`);

        const rawDate = parseRawDate(dateText);
        if (!rawDate) { console.log(`      → date not parsed`); return; }
        const relDate = toRelativeDate(rawDate);
        if (!relDate) return;

        const timeText  = clean($el.find('[class*="time"],[class*="hour"],[class*="uur"]').first().text());
        const priceText = clean($el.find([
          '[class*="price"]','[class*="ticket"]','[class*="cost"]',
          '[class*="tarif"]','[class*="rate"]',
        ].join(',')).first().text());
        const desc = clean($el.find('p,[class*="desc"],[class*="intro"],[class*="summary"]').first().text());
        const link = $el.find('a[href]').first().attr('href') || '';
        const url  = link.startsWith('http') ? link : link.startsWith('/') ? `${baseOrigin}${link}` : link;

        // Price: specific element first, then scan the whole card text
        const allPrices = extractAllPrices(priceText) || extractAllPrices($el.text());
        const price     = formatPrice(allPrices);
        const { time, startH, endH } = parseTime(timeText, config.defaultTime);
        const cls = classifyForVenue(title+' '+desc, config);

        events.push({ _rawDate:rawDate, title, venue:config.name, addr:config.addr,
          date:relDate, time, startH, endH, price,
          emoji:cls.emoji, color:cls.color, cat:cls.cat, tags:cls.tags,
          source:config.name, sourceURL:url, ticket:url,
          desc:desc||`${title} at ${config.name}.`,
          neighbourhood:config.neighbourhood, lat:config.lat, lng:config.lng });
      });
    }

    // Deep-fetch prices for events that still have none
    await deepFetchPrices(page, events);

    await page.close();
  } catch (err) {
    console.warn(`    ⚠️  ${config.name} failed: ${err.message}`);
  }
  console.log(`    ✓ ${events.length} events from ${config.name}`);
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
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  });

  let raw = [];
  try {
    for (const config of VENUE_CONFIGS) {
      try {
        const venueEvents = await scrapeVenue(browser, config);
        raw = [...raw, ...venueEvents];
      } catch (err) {
        // One venue failing never stops the rest
        console.warn(`  ⚠️  Skipping ${config.name}: ${err.message}`);
      }
    }
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
      time:r.time, startH:r.startH, endH:r.endH, price:r.price,
      emoji:r.emoji, color:r.color,
      friends:Math.floor(Math.random()*4), tags:r.tags,
      source:r.source, sourceURL:r.sourceURL, ticket:r.ticket,
      lat:r.lat, lng:r.lng, going:Math.floor(Math.random()*300)+20,
      neighbourhood:r.neighbourhood, desc:r.desc,
      attendees:generateAttendees(), chatSeed:generateChatSeed(), _rawDate:r._rawDate,
    });
    added++;
    console.log(`  ✅  Added: "${r.title}" (${r.date})${r.price ? ' — '+r.price : ''}`);
  }

  console.log(`\n📊  +${added} new  |  ${existing.length} total`);
  saveScraped(existing);
  console.log('\n✨  Done! Restart Expo to load the new events.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
