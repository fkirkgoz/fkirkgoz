#!/usr/bin/env node
/**
 * Randevu Event Scraper — Brussels venue-specific edition
 *
 * Sources: AB · Botanique · Fuse · C12 · La Madeleine · Bozar · Couleur Café · Agenda Brussels
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

// ── Hardcoded venue truths (no-guess rule) ────────────────────────────────────
// All lat/lng values below are exact — the geocoder is NEVER called for these.
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
    enforceVisuals: true,
    urls: [
      'https://www.abconcerts.be/en/agenda',
      'https://abconcerts.be/en/agenda',
    ],
  },
  {
    id: 'botanique',
    name: 'Le Botanique',
    addr: 'Rue Royale 236, 1210 Brussels',
    lat: 50.8554, lng: 4.3664,   // HARDCODED — Rue Royale 236
    neighbourhood: 'Saint-Josse',
    emoji: '🎸', color: '#B8E5C0', cat: 'Music',
    tags: ['Concert', 'Indie', 'Alternative'],
    defaultTime: '20:00',
    extraWait: 7000,
    enforceVisuals: true,
    urls: [
      'https://botanique.be/en/agenda',
      'https://botanique.be/en',
      'https://botanique.be/en/activities',
      'https://www.botanique.be/en',
      'https://botanique.be/fr/agenda',
    ],
  },
  {
    id: 'fuse',
    name: 'Fuse',
    addr: 'Rue Blaes 208, 1000 Brussels',
    lat: 50.8365, lng: 4.3435,   // HARDCODED — Rue Blaes 208, Marolles
    neighbourhood: 'Marolles',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Techno', 'Electronic', 'Nightlife'],
    defaultTime: '23:00',
    extraWait: 9000,
    jsHeavy: true,
    enforceVisuals: true,
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
    addr: 'Rue du Marché aux Herbes 116, 1000 Brussels',
    lat: 50.8462, lng: 4.3556,   // HARDCODED — Rue du Marché aux Herbes 116
    neighbourhood: 'Centre',
    emoji: '💃', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Electronic', 'Art', 'Nightlife'],
    defaultTime: '22:00',
    extraWait: 9000,
    jsHeavy: true,
    enforceVisuals: true,
    waitForSelector: '.event-list,.event-item,.event,.agenda,[class*="event"]',
    urls: [
      'https://agenda.paylogic.com/3b4e4443dd994952aaa213113e5d01a9',
      'https://c12space.com/agenda/',
      'https://c12space.com/agenda',
      'https://www.c12space.com/agenda',
      'https://c12space.com',
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
    extraWait: 7000,
    enforceVisuals: true,
    urls: [
      'https://la-madeleine.be/en/agenda',
      'https://www.la-madeleine.be/en/agenda',
      'https://la-madeleine.be/agenda/',
      'https://www.la-madeleine.be/agenda/',
      'https://la-madeleine.be/agenda',
      'https://www.la-madeleine.be',
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
    id: 'agendaBrussels',
    name: 'Agenda Brussels',
    addr: 'Brussels, Belgium',
    lat: 50.8503, lng: 4.3517,
    neighbourhood: 'Centre',
    emoji: '🏛️', color: '#E76F51', cat: 'Culture',
    tags: ['Culture', 'Brussels'],
    defaultTime: '10:00',
    extraWait: 5000,
    // No enforceVisuals — each event is classified by its own content
    urls: [
      'https://www.agenda.brussels/en',
      'https://agenda.brussels/en',
      'https://www.agenda.brussels/en/agenda',
      'https://www.agenda.brussels/en/events',
    ],
  },
  {
    id: 'couleurCafe',
    name: 'Couleur Café',
    addr: 'Ossegempark, 1020 Laeken',
    lat: 50.8948, lng: 4.3411,
    neighbourhood: 'Laeken',
    emoji: '🎸', color: '#F4A261', cat: 'Festival',
    tags: ['World Music', 'Hip Hop', 'Festival'],
    defaultTime: '14:00',
    extraWait: 6000,
    enforceVisuals: true,
    urls: [
      'https://www.couleurcafe.be',
      'https://couleurcafe.be',
      'https://www.couleurcafe.be/programme',
      'https://couleurcafe.be/programme',
    ],
  },
];

// ── Keyword classification ─────────────────────────────────────────────────────
const KEYWORD_MAP = [
  { kw:['techno','electronic','rave','dj set','club night','trance','house'],  emoji:'⚡', color:'#7B2FBE', cat:'Nightlife',    tags:['Techno','Electronic']   },
  { kw:['jazz','blues','swing','bossa nova'],                                  emoji:'🎷', color:'#C77DFF', cat:'Music',        tags:['Jazz','Live Music']      },
  { kw:['rock','indie','punk','metal','alternative','grunge'],                 emoji:'🎸', color:'#C77DFF', cat:'Music',        tags:['Rock','Live Music']      },
  { kw:['pop','rnb','hip-hop','hip hop','rap','soul','r&b'],                  emoji:'🎤', color:'#F7CFD8', cat:'Music',        tags:['Pop','Live Music']       },
  { kw:['classical','orchestra','opera','choir','symphony','philharmonic'],    emoji:'🎻', color:'#E76F51', cat:'Culture',      tags:['Classical','Culture']    },
  { kw:['concert','live music','band','singer','live set'],                    emoji:'🎵', color:'#8E7DBE', cat:'Music',        tags:['Concert','Live Music']   },
  { kw:['food','cook','taste','eat','cuisine','gastro','brunch'],              emoji:'🍕', color:'#F4C87A', cat:'Food & Drink', tags:['Food','Social']          },
  { kw:['beer','wine','cocktail','bar','drink'],                               emoji:'🍹', color:'#F4C87A', cat:'Food & Drink', tags:['Drinks','Social']        },
  { kw:['market','flea','brocante','vintage','antique'],                       emoji:'🛍️', color:'#F4C87A', cat:'Market',       tags:['Market','Outdoors']      },
  { kw:['art','exhibit','museum','gallery','paint','photo','sculpture'],       emoji:'🎨', color:'#F4A261', cat:'Culture',      tags:['Art','Culture']          },
  { kw:['football','match','vs.','home game','kick-off','ligue','jupiler'],    emoji:'⚽', color:'#90E0EF', cat:'Sports',       tags:['Football','Sports']      },
  { kw:['sport','run','yoga','fitness','athletics'],                           emoji:'🏃', color:'#90E0EF', cat:'Sports',       tags:['Sports','Active']        },
  { kw:['festival','open air','open-air','outdoor','park'],                    emoji:'🌍', color:'#F4A261', cat:'Festival',     tags:['Festival','Outdoors']    },
  { kw:['theatre','theater','play','comedy','improv','stand-up'],              emoji:'🎭', color:'#E76F51', cat:'Arts',         tags:['Theatre','Performance']  },
  { kw:['cinema','film','movie','screening','documentary'],                    emoji:'🎬', color:'#6C63FF', cat:'Arts',         tags:['Cinema','Film']          },
  { kw:['dance','ballet','tango','salsa'],                                     emoji:'💃', color:'#F7CFD8', cat:'Arts',         tags:['Dance','Performance']    },
];
const DEFAULT_CLASS = { emoji:'📍', color:'#8E7DBE', cat:'Event', tags:['Brussels'] };

function classify(text) {
  const lower = (text || '').toLowerCase();
  for (const e of KEYWORD_MAP) if (e.kw.some(k => lower.includes(k))) return { emoji:e.emoji, color:e.color, cat:e.cat, tags:e.tags };
  return DEFAULT_CLASS;
}

function classifyForVenue(text, config) {
  // enforceVisuals locks emoji/color/cat to the venue definition regardless of keywords
  if (config.enforceVisuals) {
    return { emoji: config.emoji, color: config.color, cat: config.cat, tags: config.tags };
  }
  const cls = classify(text);
  return cls.emoji === DEFAULT_CLASS.emoji
    ? { emoji: config.emoji, color: config.color, cat: config.cat, tags: config.tags }
    : cls;
}

// ── Smart venue detection ─────────────────────────────────────────────────────
// For C12 and Fuse events held at external Brussels locations, we geocode the
// actual venue instead of pinning to the club's home address.
const EXTERNAL_VENUE_PATTERNS = [
  { re: /gare\s+maritime/i,                        name: 'Gare Maritime Brussels'        },
  { re: /circle\s*park|cercle\s*park/i,            name: 'Circle Park Brussels'          },
  { re: /brussels\s*expo|expo\s*brussels/i,        name: 'Brussels Expo'                 },
  { re: /palais\s*12/i,                            name: 'Palais 12 Brussels'            },
  { re: /wolvendael/i,                             name: 'Wolvendael Park Brussels'      },
  { re: /forest\s+national/i,                      name: 'Forest National Brussels'      },
  { re: /tour\s*(?:&|et|and)\s*taxis/i,           name: 'Tour et Taxis Brussels'        },
  { re: /bois\s+de\s+la\s+cambre|ter\s+kameren/i, name: 'Bois de la Cambre Brussels'    },
  { re: /stade\s+roi\s+baudouin/i,                 name: 'Stade Roi Baudouin Brussels'   },
  { re: /atomium/i,                                name: 'Atomium Brussels'              },
  { re: /hangar\s+flagey|flagey/i,                 name: 'Flagey Brussels'               },
  { re: /terminal\s+brussels|hangar\s+terminal/i,  name: 'Terminal Brussels'             },
  { re: /recyclart/i,                              name: 'Recyclart Brussels'            },
];

function detectExternalVenue(text) {
  for (const { re, name } of EXTERNAL_VENUE_PATTERNS) {
    if (re.test(text || '')) return name;
  }
  return null;
}


// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTH_FR = { janvier:'January',février:'February',fevrier:'February',mars:'March',avril:'April',mai:'May',juin:'June',juillet:'July','août':'August',aout:'August',septembre:'September',octobre:'October',novembre:'November',décembre:'December',decembre:'December' };
const MONTH_NL = { januari:'January',februari:'February',maart:'March',april:'April',mei:'May',juni:'June',juli:'July',augustus:'August',september:'September',oktober:'October',november:'November',december:'December' };

function toRelativeDate(iso, endIso) {
  if (!iso) return null;
  // Parse ISO into LOCAL calendar parts — eliminates UTC-midnight timezone drift.
  // new Date("2026-06-26") is interpreted as UTC midnight, which shifts by ±hours
  // in local timezones; new Date(yr, mo-1, dy) is always local midnight.
  const parts = iso.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const eDay = new Date(parts[0], parts[1] - 1, parts[2]); // local midnight

  // Multi-day festival check: 'Ongoing' ONLY when today sits between start and end.
  // This is the SOLE path by which 'Ongoing' can be returned.
  if (endIso) {
    const ep = endIso.split('-').map(Number);
    if (ep.length >= 3) {
      const eEnd = new Date(ep[0], ep[1] - 1, ep[2]);
      const now  = new Date(); now.setHours(0, 0, 0, 0);
      if (now >= eDay && now <= eEnd) return 'Ongoing';
    }
  }

  // Strict future-only path — Math.ceil guarantees future events are NEVER "Tonight".
  // A future event at midnight vs. now at 3 PM = +9h → ceil(9/24) = 1 → "Tomorrow". ✓
  // Today's event at midnight vs. now at 3 PM  = −15h → ceil(−0.625) = 0 → "Tonight". ✓
  const now   = new Date();
  const diffTime = eDay.getTime() - now.getTime();
  const diffDays  = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0)  return null;  // past → expired
  const dow = eDay.getDay();
  if (diffDays === 0) return 'Tonight';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 6 && (dow === 0 || dow === 6)) return 'This Weekend';
  if (diffDays <= 7)  return 'Next Week';
  return 'Next Month';  // strictly future; never "Ongoing"
}

// Returns "YYYY-MM-DD" using LOCAL calendar parts — avoids UTC midnight timezone drift.
// new Date("2026-06-06").toISOString() in UTC+2 gives "2026-06-05T22:00:00Z" (wrong).
// new Date(y, m, d) is always local midnight, so getFullYear/Month/Date are correct.
function toLocalISODate(d) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function parseRawDate(raw) {
  if (!raw) return null;
  let t = (raw || '').replace(/\s+/g,' ').trim();

  // Strip "Now →" prefix — Bozar exhibitions like "Now → 30 May'26" mean
  // the show is CURRENTLY running; we parse the end date as the event date.
  t = t.replace(/^Now\s*[→>]\s*/i, '');

  // Strip trailing weekday-based ranges — keep only the start date block.
  // "Fri 22 May — Sun 24 May" → "Fri 22 May"
  // "Tue 09 June — Sat 13 June" → "Tue 09 June"
  // "Sat 23 May — Thu 31 December" → "Sat 23 May"
  t = t.replace(/\s*[-–—]\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+\d{1,2}\s+[A-Za-z]+.*/i, '');

  // Strip simple numeric ranges (existing patterns)
  t = t.replace(/([A-Za-z]+\s+\d{1,2})\s*[–—-]\s*\d{1,2}(,?\s*\d{4})/i, '$1$2');
  t = t.replace(/(\d{1,2})\s*[–—]\s*\d{1,2}(\s+[A-Za-z])/,               '$1$2');

  // Strip trailing time suffix — "21 May'26 - 18:00" → "21 May'26"
  t = t.replace(/\s*[-–]\s*\d{1,2}:\d{2}.*$/, '');

  // Fast path: already ISO "2026-06-06…"
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const [yr, mo, dy] = t.slice(0, 10).split('-').map(Number);
    if (yr > 2020 && yr <= 2030 && mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31)
      return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
  }

  // Translate French/Dutch month names to English (word-boundary safe)
  const tLow = t.toLowerCase();
  for (const [fr,en] of Object.entries(MONTH_FR)) {
    if (tLow.includes(fr)) t = t.replace(new RegExp(`(?<![a-zÀ-ÿ])${fr}(?![a-zÀ-ÿ])`, 'i'), en);
  }
  for (const [nl,en] of Object.entries(MONTH_NL)) {
    if (tLow.includes(nl)) t = t.replace(new RegExp(`(?<![a-zÀ-ÿ])${nl}(?![a-zÀ-ÿ])`, 'i'), en);
  }

  // Validates the constructed Date — rejects out-of-range and pre-2021 dates.
  function checked(d) {
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear(), mo = d.getMonth() + 1, dy = d.getDate();
    if (y <= 2020 || y > 2030 || mo < 1 || mo > 12 || dy < 1 || dy > 31) return null;
    return toLocalISODate(d);
  }

  // "13 . 05 . 2026" (Fuse) / "15.05.26" (La Madeleine compact)
  let m = t.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return checked(new Date(parseInt(y,10), parseInt(m[2],10)-1, parseInt(m[1],10))); }

  // "16/05/2026" / "16-05-2026"
  m = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return checked(new Date(parseInt(y,10), parseInt(m[2],10)-1, parseInt(m[1],10))); }

  // "16 June 2026" / "16 Jun 2026" — 4-digit year
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) return checked(new Date(`${m[2]} ${m[1]}, ${m[3]}`));

  // "June 16, 2026" / "Jun 16 2026" — 4-digit year
  m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) return checked(new Date(`${m[1]} ${m[2]}, ${m[3]}`));

  // "21 May'26" / "16 Aug.'26" — Bozar abbreviated 2-digit year
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\.?'(\d{2})/);
  if (m) return checked(new Date(`${m[2].replace('.','').trim()} ${m[1]}, 20${m[3]}`));

  // Safe year inference — "Thu 21 May", "Fri 22 May", "09 Jun", "22 May"
  // Requires an explicit month name to prevent matching stray digit pairs.
  // If the inferred date is already past, try next year.
  const MS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const MF = 'January|February|March|April|May|June|July|August|September|October|November|December';
  m = t.match(new RegExp(`(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*\\s+)?(\\d{1,2})\\s+(${MF}|${MS})(?![a-zA-Z])`, 'i'));
  if (m) {
    const yr = new Date().getFullYear();
    let d = new Date(`${m[2]} ${m[1]}, ${yr}`);
    if (!isNaN(d.getTime())) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (d < today) d = new Date(`${m[2]} ${m[1]}, ${yr + 1}`);
      return checked(d);
    }
  }

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
    /\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{2,4}/,   // "13 . 05 . 2026" Fuse / "15.05.26" La Madeleine
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
  if (m) { const h=parseInt(m[1],10); const mn=m[2]?parseInt(m[2],10):0; return { time:`${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`, startH:h, endH:h+3 }; }
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
// Only called for events from sources that have no hardcoded lat/lng.
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
// Smart dedup: if same title+date exists, keep whichever version has a price
// and the longer description. Returns true if a duplicate was found (and merged).
// Always overwrites _rawDate and date with fresh scraped values so stale/broken
// placeholder dates are never locked in place by a matching title.
function smartMerge(existing, incoming) {
  // Primary: exact title + raw date match
  let idx = existing.findIndex(e =>
    e.title?.toLowerCase() === incoming.title?.toLowerCase() &&
    e._rawDate === incoming._rawDate
  );
  // C12/Fuse: same venue+date but title may differ across Paylogic vs own site
  if (idx === -1) {
    const v = (incoming.venue || '').toLowerCase();
    if (['c12', 'fuse'].some(n => v.includes(n))) {
      idx = existing.findIndex(e =>
        (e.venue || '').toLowerCase() === v &&
        e._rawDate === incoming._rawDate
      );
    }
  }
  // Fallback: same title + same venue regardless of stored _rawDate.
  // Catches events whose _rawDate was previously broken — always overwrites
  // with the freshly parsed value from the current scrape run.
  if (idx === -1) {
    idx = existing.findIndex(e =>
      e.title?.toLowerCase() === incoming.title?.toLowerCase() &&
      (e.venue || '').toLowerCase() === (incoming.venue || '').toLowerCase()
    );
  }
  if (idx === -1) return false;
  const old = existing[idx];
  const betterDesc = (incoming.desc?.length || 0) > (old.desc?.length || 0) ? incoming.desc : old.desc;
  const dateChanged = old._rawDate !== incoming._rawDate;
  // Always stamp fresh _rawDate and date — never let a stored broken date survive
  existing[idx] = {
    ...old,
    _rawDate: incoming._rawDate,
    date: incoming.date,
    ...(betterDesc !== old.desc ? { desc: betterDesc } : {}),
  };
  if (dateChanged) {
    console.log(`  📅  Date-fixed: "${old.title.slice(0,40)}" ${old._rawDate || '?'} → ${incoming._rawDate}`);
  } else if (betterDesc !== old.desc) {
    console.log(`  🔄  Upgraded: "${old.title.slice(0,40)}" +desc`);
  } else {
    console.log(`  ⏭   Duplicate (no upgrade): "${old.title.slice(0,40)}"`);
  }
  return true;
}
function removeExpired(events) {
  const today=new Date(); today.setHours(0,0,0,0);
  const kept=events.filter(e=>!e._rawDate||new Date(e._rawDate)>=today);
  const n=events.length-kept.length;
  if(n) console.log(`🗑️   Removed ${n} expired event(s)`);
  return kept;
}
// For C12 and Fuse, one event per date is the rule.
// Cross-run scrapes from Paylogic vs own-site produce different titles for the same night.
// This collapses them, keeping the version with the longer title.
function deduplicateExisting(events) {
  const NIGHTLIFE = ['c12', 'fuse'];
  const seen = {};
  const result = [];
  let removed = 0;
  for (const e of events) {
    const v = (e.venue || '').toLowerCase();
    if (NIGHTLIFE.some(n => v.includes(n))) {
      const key = `${v}|${e._rawDate || ''}`;
      if (key in seen) {
        const kept = seen[key];
        if ((e.title?.length || 0) > (kept.title?.length || 0)) kept.title = e.title;
        removed++;
        continue;
      }
      seen[key] = e;
    }
    result.push(e);
  }
  if (removed) console.log(`🔧  Removed ${removed} venue+date duplicate(s) (C12/Fuse multi-source)`);
  return result;
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
  const events  = [];
  let failReason = '';

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    // ── Load page ──
    let loaded = false;
    for (const url of config.urls) {
      try {
        const waitMode = config.jsHeavy ? 'networkidle2' : 'domcontentloaded';
        try {
          await page.goto(url, { waitUntil: waitMode, timeout: 30000 });
        } catch (navErr) {
          if (!navErr.message.includes('timeout')) throw navErr;
          console.log(`    Navigation timeout — using partial content`);
        }

        const extraWait = config.extraWait || 5000;
        await sleep(extraWait);

        // C12 and similar: wait for a specific DOM element to appear
        if (config.waitForSelector) {
          try {
            await page.waitForSelector(config.waitForSelector, { timeout: 15000 });
            console.log(`    ✓ Selector found: ${config.waitForSelector}`);
          } catch {
            failReason = `Selector '${config.waitForSelector}' not found — timeout after 15s`;
            console.log(`    ✗ ${failReason}`);
          }
        }

        // Two scroll passes to trigger lazy-loading
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(1500);
        await page.evaluate(() => window.scrollBy(0, 800));
        await sleep(1000);

        const title   = await page.title();
        const bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
        console.log(`    Loaded: "${title}" (${bodyLen} chars)`);

        if (title && title.length > 3 && bodyLen > 300) {
          loaded = true; break;
        }
      } catch (err) {
        const msg = err.message.slice(0, 80);
        console.log(`    URL failed: ${msg}`);
        failReason = `Page load failed: ${msg}`;
      }
    }

    if (!loaded) {
      failReason = failReason || 'All URLs failed or returned empty page';
      await page.close();
    } else {
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
          const desc    = clean(ev.description || '');
          const url     = ev.url || ev['@id'] || '';
          const timeStr = ev.startDate?.length > 10 ? ev.startDate.slice(11,16) : config.defaultTime;
          const startH  = parseInt((timeStr || config.defaultTime).split(':')[0], 10) || 20;
          const cls              = classifyForVenue(title+' '+desc, config);
          const externalVenueHint = (config.id === 'c12' || config.id === 'fuse')
            ? detectExternalVenue(title+' '+desc+' '+(ev.location?.name||'')) : null;
          events.push({ _rawDate:rawDate, title, venue:config.name, addr:config.addr,
            date:relDate, time:timeStr||config.defaultTime, startH, endH:startH+3,
            emoji:cls.emoji, color:cls.color, cat:cls.cat, tags:cls.tags,
            source:config.name, officialEventLink:url,
            desc:desc||`${title} at ${config.name}.`,
            neighbourhood:config.neighbourhood, lat:config.lat, lng:config.lng,
            ...(externalVenueHint ? { externalVenueHint } : {}) });
        }
        console.log(`    → ${events.length} valid from JSON-LD`);
      }

      // ── Strategy 1.5: La Madeleine (JetEngine/Elementor layout) ──
      // Primary: <a> tags containing .jet-listing-dynamic-field__content (title + date fields)
      // Fallback: .flex-col.border-2 Tailwind grid cards
      if (config.id === 'laMadeleine' && events.length === 0) {
        try {
          console.log('    La Madeleine: scanning for JetEngine / grid cards…');
          await sleep(2000); // extra render time beyond extraWait
          const cards = await page.evaluate(() => {
            // Primary path: Elementor/JetEngine — anchors wrapping field elements
            const jetLinks = [...document.querySelectorAll('a')].filter(a =>
              a.querySelector('.jet-listing-dynamic-field__content')
            );
            function detectStatus(el) {
              const txt = (el.innerText || '').toUpperCase();
              if (txt.includes('SOLD OUT'))  return 'SOLD OUT';
              if (txt.includes('POSTPONED')) return 'POSTPONED';
              if (txt.includes('CANCELLED')) return 'CANCELLED';
              return '';
            }
            if (jetLinks.length > 0) {
              return jetLinks.map(a => {
                const fields = [...a.querySelectorAll('.jet-listing-dynamic-field__content')]
                  .map(f => (f.innerText || '').trim()).filter(Boolean);
                const dateStr = fields.find(f => /\d{1,2}\s*\.\s*\d{2}\s*\.\s*\d{2,4}/.test(f)) || '';
                const title = fields
                  .filter(f => !/\d{2}\.\d{2}/.test(f))
                  .sort((x, y) => y.length - x.length)[0] || '';
                return { dateStr, title, link: a.href, status: detectStatus(a) };
              });
            }
            // Fallback: Tailwind grid cards
            return [...document.querySelectorAll('.flex-col.border-2')].map(card => {
              const lines = (card.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
              const dateStr = lines.find(l => /\d{1,2}\s*\.\s*\d{2}\s*\.\s*\d{2,4}/.test(l)) || '';
              const heading = card.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"]');
              const title = (
                heading?.innerText?.trim() ||
                lines.find(l => l.length > 4 && !/\d{2}\.\d{2}/.test(l) && !/^(tickets?|buy|info)$/i.test(l)) ||
                ''
              ).trim();
              const ticketA = [...card.querySelectorAll('a')].find(a => /tickets?/i.test(a.textContent));
              const link = ticketA?.href || [...card.querySelectorAll('a')].map(a => a.href).find(Boolean) || '';
              return { dateStr, title, link, status: detectStatus(card) };
            });
          });
          console.log(`    La Madeleine: ${cards.length} card(s) found`);
          const baseOrigin = (config.urls[0] || '').match(/^https?:\/\/[^/]+/)?.[0] || '';
          for (const { dateStr, title, link, status } of cards) {
            if (!isValidTitle(title)) continue;
            const rawDate = parseRawDate(dateStr);
            if (!rawDate) { console.log(`    skip "${title.slice(0,30)}" — date not parsed (raw:"${dateStr}")`); continue; }
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;
            const url = link.startsWith('http') ? link : link.startsWith('/') ? `${baseOrigin}${link}` : link;
            const cls = classifyForVenue(title, config);
            events.push({
              _rawDate: rawDate, title, venue: config.name, addr: config.addr,
              date: relDate, time: config.defaultTime,
              startH: parseInt(config.defaultTime, 10) || 20,
              endH: (parseInt(config.defaultTime, 10) || 20) + 3,
              emoji: cls.emoji, color: cls.color, cat: cls.cat, tags: cls.tags,
              source: config.name, officialEventLink: url,
              desc: `${title} at ${config.name}.`,
              neighbourhood: config.neighbourhood, lat: config.lat, lng: config.lng,
              ...(status ? { status } : {}),
            });
          }
          console.log(`    La Madeleine → ${events.length} event(s) parsed`);
        } catch (err) {
          console.log(`    La Madeleine scraper failed: ${err.message.slice(0, 60)}`);
        }
      }

      // ── Strategy 1.6: Agenda Brussels — culture & sports activities ──
      // agenda.brussels lists city-wide exhibitions, sports events, and activities.
      // No enforceVisuals — each event is classified by its own content keywords.
      if (config.id === 'agendaBrussels' && events.length === 0) {
        try {
          console.log('    Agenda Brussels: scanning event grid…');
          await sleep(3000);

          const agendaItems = await page.evaluate(() => {
            const selectors = [
              '.event-card','[class*="event-card"]',
              '.event-item','[class*="event-item"]',
              '[class*="EventCard"]','[class*="EventItem"]',
              'article','[class*="card"]','.item',
            ];
            const seen = new Set();
            let best = [];
            for (const sel of selectors) {
              const els = [...document.querySelectorAll(sel)].filter(el => {
                const t = (el.innerText || '').trim();
                return t.length > 20 && t.length < 800;
              });
              if (els.length > best.length) best = els;
            }
            return best.map(el => {
              const h = el.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"]');
              const dateEl = el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="dag"]');
              const locEl  = el.querySelector('[class*="location"],[class*="venue"],[class*="place"],[class*="address"]');
              const catEl  = el.querySelector('[class*="category"],[class*="type"],[class*="tag"],[class*="label"]');
              return {
                title:    (h?.innerText || '').replace(/\s+/g, ' ').trim(),
                allText:  (el.innerText || '').replace(/\s+/g, ' ').trim(),
                dateStr:  dateEl?.getAttribute('datetime') || (dateEl?.innerText || '').trim(),
                location: (locEl?.innerText || '').replace(/\s+/g, ' ').trim(),
                category: (catEl?.innerText || '').replace(/\s+/g, ' ').trim(),
                link:     el.querySelector('a[href]')?.href || '',
              };
            }).filter(Boolean);
          });

          console.log(`    Agenda Brussels: ${agendaItems.length} item(s) found`);
          const baseOrigin = 'https://www.agenda.brussels';

          for (const item of agendaItems) {
            if (events.length >= 20) break; // cap to prevent city-wide bloat
            if (!item.title || item.title.length < 5 || !isValidTitle(item.title)) continue;

            const rawDate = parseRawDate(item.dateStr) || parseRawDate(scanTextForDate(item.allText));
            if (!rawDate) continue;
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;

            // Category + emoji: explicit mapping per user spec, then generic classify
            const combined = (item.title + ' ' + item.category + ' ' + item.allText).toLowerCase();
            let cls;
            if (/exhibition|museum|art\b|theater|theatre|galerie|gallery|exposition|dance|ballet|circus|cirque/i.test(combined)) {
              const emoji = /theater|theatre|dance|ballet|performance/i.test(combined) ? '🎭'
                          : /museum|history|histoire/i.test(combined) ? '🏛️' : '🎨';
              cls = { emoji, color: '#E76F51', cat: 'Culture', tags: ['Culture', 'Art'] };
            } else if (/\brun\b|race|padel|swim\b|swimming|fitness|\bsport\b|marathon|trail|yoga|cycling|triathlon|tennis/i.test(combined)) {
              cls = { emoji: '👟', color: '#90E0EF', cat: 'Sports', tags: ['Sports', 'Active'] };
            } else {
              cls = classify(combined);
              if (cls.emoji === DEFAULT_CLASS.emoji) {
                cls = { emoji: '🏛️', color: '#E76F51', cat: 'Culture', tags: ['Culture', 'Brussels'] };
              }
            }

            const venueText = (item.location || 'Brussels').replace(/\n.*/g, '').trim().slice(0, 80);
            const url = item.link.startsWith('http') ? item.link
              : item.link.startsWith('/') ? `${baseOrigin}${item.link}` : '';

            // Generic "Brussels" entries use config centre coords; named venues get
            // lat/lng = 0 so the geocoder in main() resolves the specific address.
            const isGenericVenue = !venueText || venueText.toLowerCase() === 'brussels';
            events.push({
              _rawDate: rawDate, title: item.title,
              venue: venueText || 'Brussels', addr: `${venueText || 'Brussels'}, Belgium`,
              date: relDate, time: config.defaultTime,
              startH: parseInt(config.defaultTime, 10) || 10,
              endH: (parseInt(config.defaultTime, 10) || 10) + 3,
              emoji: cls.emoji, color: cls.color, cat: cls.cat, tags: cls.tags,
              source: config.name, officialEventLink: url,
              desc: item.allText.slice(0, 200) || `${item.title} in Brussels.`,
              neighbourhood: config.neighbourhood,
              lat: isGenericVenue ? config.lat : 0,
              lng: isGenericVenue ? config.lng : 0,
            });
          }
          console.log(`    Agenda Brussels → ${events.length} event(s) parsed`);
        } catch (err) {
          console.log(`    Agenda Brussels scraper error: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 2: HTML — heading + date presence filter ──
      // Requires a candidate element to contain BOTH a heading AND a date signal,
      // so it works regardless of CSS class names.
      if (events.length === 0) {
        const $ = cheerio.load(await page.content());

        // Prefer a scoped container; fall back to body
        const scope = $([
          'main','#content','[role="main"]',
          '.event-list','.event-items','.event-item',        // C12
          '.event-card','.event-cards',                      // La Madeleine / generic
          '.agenda','.programme','.calendar','.events-list',
          '.event-overview','.listing','.schedule',
        ].join(',')).first();
        const root = scope.length ? scope : $('body');
        const scopeDesc = scope.length
          ? (scope.get(0).tagName + (scope.attr('class')||'').slice(0,30))
          : 'body';
        console.log(`    HTML scope: ${scopeDesc}`);

        if (!scope.length) {
          failReason = failReason || 'No agenda/calendar container found — using body';
        }

        // Wide net: any container that has both a heading and a date
        const candidates = root.find([
          'article','.event-card','[class*="event-card"]',
          '.card','[class*="card"]',
          '[class*="event"]','[class*="show"]','[class*="concert"]',
          '[class*="agenda"]','[class*="programme"]','[class*="listing"]',
          '[class*="match"]','[class*="fixture"]','[class*="game"]',
          '[class*="item"]',
          '.node','.views-row',          // Drupal
          '.eventlist-event',            // Squarespace
          '.wp-block-post','.entry',     // WordPress
          '.tribe-event',                // The Events Calendar
          'li',
        ].join(',')).filter((_, el) => {
          const $el  = $(el);
          const text = $el.text().trim();
          if (text.length < 15 || text.length > 1200) return false;
          const hasHeading = $el.find([
            'h1','h2','h3','h4','h5','strong','b',
            '[class*="title"]','[class*="name"]','[class*="artist"]','[class*="heading"]',
          ].join(',')).length > 0;
          if (!hasHeading) return false;
          const hasDateEl  = $el.find('time,[datetime],[class*="date"],[class*="dag"],[class*="when"],[class*="period"]').length > 0;
          const hasDateTxt = hasDateEl || !!scanTextForDate(text);
          return hasDateTxt;
        });

        console.log(`    HTML candidates (heading+date filter): ${candidates.length}`);
        if (candidates.length === 0) {
          failReason = failReason || 'No candidate elements passed heading+date filter';
        } else {
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

          const dtAttr     = $el.find('[datetime]').first().attr('datetime') || $el.find('time').first().attr('datetime') || '';
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
          const desc = clean($el.find('p,[class*="desc"],[class*="intro"],[class*="summary"]').first().text());
          const link = $el.find('a[href]').first().attr('href') || '';
          const url  = link.startsWith('http') ? link : link.startsWith('/') ? `${baseOrigin}${link}` : link;

          const { time, startH, endH } = parseTime(timeText, config.defaultTime);
          const cls = classifyForVenue(title+' '+desc, config);
          const externalVenueHint = (config.id === 'c12' || config.id === 'fuse')
            ? detectExternalVenue(title+' '+desc) : null;

          events.push({ _rawDate:rawDate, title, venue:config.name, addr:config.addr,
            date:relDate, time, startH, endH,
            emoji:cls.emoji, color:cls.color, cat:cls.cat, tags:cls.tags,
            source:config.name, officialEventLink:url,
            desc:desc||`${title} at ${config.name}.`,
            neighbourhood:config.neighbourhood, lat:config.lat, lng:config.lng,
            ...(externalVenueHint ? { externalVenueHint } : {}) });
        });
      }

      await page.close();
    }
  } catch (err) {
    failReason = err.message;
    console.warn(`    ⚠️  ${config.name} threw: ${failReason}`);
  }

  // ── Couleur Café: inject confirmed 2026 festival if scraping returned nothing ──
  // Festival is a single recurring annual event with fixed dates — safe to hardcode.
  if (config.id === 'couleurCafe' && events.length === 0) {
    const festStart = '2026-06-26';
    const festEnd   = '2026-06-28';
    const relDate   = toRelativeDate(festStart, festEnd);
    if (relDate) {
      events.push({
        _rawDate: festStart, _endDate: festEnd,
        title: 'Couleur Café Festival 2026',
        venue: 'Osseghem Park, Atomium',
        addr: 'Ossegempark, 1020 Laeken, Brussels',
        date: relDate, time: '14:00', startH: 14, endH: 26,
        emoji: '🎸', color: '#F4A261', cat: 'Festival',
        tags: ['World Music', 'Hip Hop', 'Festival', 'Open Air'],
        source: 'Couleur Café',
        officialEventLink: 'https://www.couleurcafe.be',
        desc: "Brussels' legendary 3-day world music & hip hop festival at Osseghem Park, in the shadow of the Atomium. 26–28 June 2026.",
        neighbourhood: 'Laeken', lat: 50.8948, lng: 4.3411,
      });
      console.log(`  🎸  Couleur Café: injected confirmed festival entry (${relDate})`);
    }
  }

  // ── Within-venue dedup: strict title+date (catches same event scraped twice in one run) ──
  const seenInScrape = new Set();
  const uniqueEvents = events.filter(ev => {
    const key = ev.title.toLowerCase() + '|' + ev._rawDate;
    if (seenInScrape.has(key)) return false;
    seenInScrape.add(key);
    return true;
  });
  if (uniqueEvents.length < events.length) {
    console.log(`  ✂️  Within-scrape: removed ${events.length - uniqueEvents.length} duplicate(s) for ${config.name}`);
  }

  // ── Mandatory per-site result log ──
  if (uniqueEvents.length > 0) {
    console.log(`\n✅ Site ${config.name}: [Found ${uniqueEvents.length} events]`);
  } else {
    console.log(`\n❌ Site ${config.name}: [Found 0 events] — ${failReason || 'No matching elements with heading+date'}`);
  }

  return uniqueEvents;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Randevu Event Scraper\n');

  let existing = loadScraped();
  console.log(`📂  Loaded ${existing.length} existing scraped events`);
  existing = removeExpired(existing);
  existing = deduplicateExisting(existing);

  // One-time purge: delete events stored with the broken "2026-06-18" placeholder
  // that resulted from the over-aggressive date-parsing fix in an earlier session.
  // These entries are still in the future so removeExpired() won't catch them.
  const BROKEN_DATE = '2026-06-18';
  const prePurge = existing.length;
  existing = existing.filter(e => e._rawDate !== BROKEN_DATE);
  const purged = prePurge - existing.length;
  if (purged) console.log(`🧹  Purged ${purged} event(s) with stale "${BROKEN_DATE}" placeholder date`);

  // Migrate stale schema: add officialEventLink, remove price/ticket/sourceURL
  let migrated = 0;
  existing = existing.map(e => {
    if ('price' in e || 'ticket' in e || 'sourceURL' in e || !('officialEventLink' in e)) {
      const link = e.ticket || e.sourceURL || '';
      const { price: _p, ticket: _t, sourceURL: _s, ...rest } = e;
      migrated++;
      return { ...rest, officialEventLink: link };
    }
    return e;
  });
  if (migrated) console.log(`🔧  Migrated ${migrated} event(s) to new schema (officialEventLink)`);

  // Refresh date labels from _rawDate — prevents stale 'Tonight'/'Ongoing' labels
  let relabelled = 0;
  existing = existing.map(e => {
    if (!e._rawDate) return e;
    const fresh = toRelativeDate(e._rawDate, e._endDate || null);
    if (!fresh) return null;           // past — will be removed below
    if (fresh !== e.date) { relabelled++; return { ...e, date: fresh }; }
    return e;
  }).filter(Boolean);
  if (relabelled) console.log(`📅  Refreshed ${relabelled} stale date label(s)`);

  // Retroactively correct coordinates for Fuse and C12 (no external venue override)
  let coordFixes = 0;
  existing = existing.map(e => {
    if (e.venue?.toLowerCase().includes('fuse') && !e.externalVenueHint &&
        (e.lat !== 50.8365 || e.lng !== 4.3435)) {
      coordFixes++;
      return { ...e, lat: 50.8365, lng: 4.3435, addr: 'Rue Blaes 208, 1000 Brussels' };
    }
    if (e.venue?.toLowerCase() === 'c12' && !e.externalVenueHint &&
        (e.lat !== 50.8462 || e.lng !== 4.3556)) {
      coordFixes++;
      return { ...e, lat: 50.8462, lng: 4.3556, addr: 'Rue du Marché aux Herbes 116, 1000 Brussels' };
    }
    return e;
  });
  if (coordFixes) console.log(`📍  Fixed ${coordFixes} event(s) with wrong coordinates (Fuse/C12)`);

  // Retroactively enforce correct emoji/color/cat for all known venues
  const VENUE_VISUAL_MAP = {
    'ancienne belgique': { emoji: '🎸', color: '#C77DFF', cat: 'Music'     },
    'le botanique':      { emoji: '🎸', color: '#B8E5C0', cat: 'Music'     },
    'fuse':              { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'c12':               { emoji: '💃', color: '#6C63FF', cat: 'Nightlife' },
    'la madeleine':      { emoji: '🎸', color: '#8E7DBE', cat: 'Music'     },
    'bozar':             { emoji: '🏛️', color: '#E76F51', cat: 'Culture'   },
    'agenda brussels':   { emoji: '🏛️', color: '#E76F51', cat: 'Culture'   },
    'couleur café':      { emoji: '🎸', color: '#F4A261', cat: 'Festival'  },
    'couleur cafe':      { emoji: '🎸', color: '#F4A261', cat: 'Festival'  },
  };
  let emojiFixed = 0;
  existing = existing.map(e => {
    const v = (e.venue || '').toLowerCase();
    for (const [key, vis] of Object.entries(VENUE_VISUAL_MAP)) {
      if (v.includes(key) && (e.emoji !== vis.emoji || e.cat !== vis.cat)) {
        emojiFixed++;
        return { ...e, emoji: vis.emoji, color: vis.color, cat: vis.cat };
      }
    }
    return e;
  });
  if (emojiFixed) console.log(`🎨  Fixed ${emojiFixed} event(s) with wrong emoji/cat`);

  const browser = await puppeteer.launch({
    headless: 'new',
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--ignore-certificate-errors'],
  });

  const results = [];
  let raw = [];
  try {
    for (const config of VENUE_CONFIGS) {
      try {
        const venueEvents = await scrapeVenue(browser, config);
        results.push({ name: config.name, emoji: config.emoji, count: venueEvents.length });
        raw = [...raw, ...venueEvents];
      } catch (err) {
        results.push({ name: config.name, emoji: config.emoji, count: 0, err: err.message });
        console.warn(`  ⚠️  Skipping ${config.name}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  // ── Final summary table ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SCRAPE RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of results) {
    const status = r.count > 0 ? '✅' : '❌';
    const detail = r.err ? ` — ${r.err.slice(0, 60)}` : '';
    console.log(`  ${status} ${r.emoji} ${r.name}: [Found ${r.count} events]${detail}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Explicit per-venue log so C12 date fix is verifiable
  for (const r of results) {
    if (r.name === 'C12') console.log(`💃 C12: [${r.count} events added]`);
  }

  console.log(`📡  Processing ${raw.length} scraped candidates…`);

  let idCounter = nextId(existing);
  let added = 0;

  for (const r of raw) {
    if (smartMerge(existing, r)) continue;

    // Smart venue override: external location mentioned in event text takes priority
    if (r.externalVenueHint) {
      process.stdout.write(`  🗺️  External venue "${r.externalVenueHint}"… `);
      const coords = await geocode(r.externalVenueHint);
      r.lat = coords.lat; r.lng = coords.lng; r.addr = r.externalVenueHint;
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`);
      await sleep(GEOCODE_DELAY);
    } else if (r.venue?.toLowerCase().includes('fuse')) {
      r.lat = 50.8365; r.lng = 4.3435;
      r.addr = 'Rue Blaes 208, 1000 Brussels';
    } else if (r.venue?.toLowerCase() === 'c12') {
      r.lat = 50.8462; r.lng = 4.3556;
      r.addr = 'Rue du Marché aux Herbes 116, 1000 Brussels';
    } else if (!r.lat || !r.lng) {
      process.stdout.write(`  📍  Geocoding "${r.venue}"… `);
      const coords = await geocode(r.venue);
      r.lat = coords.lat; r.lng = coords.lng;
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`);
      await sleep(GEOCODE_DELAY);
    }

    existing.push({
      id:idCounter++, cat:r.cat, date:r.date, title:r.title, venue:r.venue, addr:r.addr,
      time:r.time, startH:r.startH, endH:r.endH,
      emoji:r.emoji, color:r.color,
      friends:Math.floor(Math.random()*4), tags:r.tags,
      source:r.source, officialEventLink:r.officialEventLink||'',
      lat:r.lat, lng:r.lng, going:Math.floor(Math.random()*300)+20,
      neighbourhood:r.neighbourhood, desc:r.desc,
      attendees:generateAttendees(), chatSeed:generateChatSeed(), _rawDate:r._rawDate,
    });
    added++;
    console.log(`  ✅  Added: "${r.title}" (${r.date})`);
  }

  // ── Absolute kill-switch: global title+date dedup on the final array ──
  const preFinal = existing.length;
  existing = existing.filter((v, i, a) =>
    a.findIndex(t => t.title === v.title && t.date === v.date) === i
  );
  if (existing.length < preFinal)
    console.log(`🔪  Final dedup removed ${preFinal - existing.length} global duplicate(s)`);

  console.log(`\n📊  +${added} new  |  ${existing.length} total`);
  saveScraped(existing);
  console.log('\n✨  Done! Restart Expo to load the new events.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
