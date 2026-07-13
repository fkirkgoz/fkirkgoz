#!/usr/bin/env node
/**
 * Randevu Event Scraper — Brussels venue-specific edition
 *
 * Sources: AB · Botanique · Fuse · C12 · La Madeleine · Bozar · Couleur Café · Agenda Brussels
 *          + Gen-Z: UMI · Signal Club · BUDA BXL · Madame Moustache · Beursschouwburg
 *            Magasin 4 · La Machine · KANAL · Quai 20 · Kaaitheater
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

// ── Venue registry (decoupled) ────────────────────────────────────────────────
// All scrape targets live in src/config/scraperVenues.ts — a typed, append-only
// registry. Adding a venue = adding one object THERE; this engine never changes.
// Node ≥ 22.18 strips the TS types natively on require (GH Actions runs Node 24).
const { SCRAPER_VENUES } = require('./src/config/scraperVenues.ts');

// Adapter: maps a registry entry's declared scrapingStrategy onto the engine's
// internal routing flags. portal_filter targets are routed by portal host:
//   agenda.brussels  → Strategy 1.8 (per-venue search parser)
//   ra.co / shotgun  → Strategy 1.9b (keyword collection stream)
// ra_club            → Strategy 1.9a (__NEXT_DATA__ club-page parser)
// direct_url         → full pipeline (JSON-LD → venue parsers → 1.7 → HTML)
function toEngineConfig(v) {
  const cfg = {
    id: v.id,
    name: v.name,
    addr: v.masterAddress,
    lat: v.lat, lng: v.lng,
    neighbourhood: v.neighbourhood,
    emoji: v.emoji, color: v.color, cat: v.cat, tags: v.tags,
    defaultTime: v.defaultTime,
    urls: [v.targetUrl, ...(v.fallbackUrls || [])],
    ...(v.jsHeavy ? { jsHeavy: true } : {}),
    ...(v.enforceVisuals ? { enforceVisuals: true } : {}),
    ...(v.extraWait ? { extraWait: v.extraWait } : {}),
    ...(v.waitForSelector ? { waitForSelector: v.waitForSelector } : {}),
    ...(v.eventSelector ? { eventSelector: v.eventSelector } : {}),
    ...(v.linkPattern ? { linkPattern: v.linkPattern } : {}),
    ...(v.portalKeywords ? { portalKeywords: v.portalKeywords } : {}),
    ...(v.genericPortal ? { genericPortal: true } : {}),
  };

  switch (v.scrapingStrategy) {
    case 'ra_club':
      cfg.useRaClub = true;
      cfg.jsHeavy = true;
      break;
    case 'portal_filter': {
      let host = '';
      try { host = new URL(v.targetUrl).host; } catch {}
      if (host.includes('agenda.brussels')) {
        cfg.useAgendaBrussels = true;
      } else {
        cfg.useResidentAdvisor = true; // RA + Shotgun regional streams share 1.9b
      }
      cfg.jsHeavy = true;
      break;
    }
    case 'direct_url':
    default:
      break;
  }
  return cfg;
}

const VENUE_CONFIGS = SCRAPER_VENUES.map(toEngineConfig);

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
  { kw:['festival','open air','open-air','outdoor','park'],                    emoji:'🎉', color:'#F4A261', cat:'Festival',     tags:['Festival','Outdoors']    },
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
  { re: /circle\s*park|cercle\s*park/i,            name: 'Circle Park Anderlecht Brussels' },
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
  { re: /brasserie\s+illegaal/i,                  name: 'Brasserie ILLEGAAL Brussels'   },
  { re: /parc\s+astrid.*anderlecht|anderlecht.*parc/i, name: 'Parc Astrid Anderlecht Brussels' },
  // Roaming open-air series → their known 2026 sites
  { re: /piknic\s*electronik|place\s+poelaert/i,   name: 'Place Poelaert Brussels'       },
  { re: /xrds|parc\s+des\s+[ée]tangs/i,            name: 'Parc des Étangs Anderlecht Brussels' },
  { re: /play\s+label|place\s+du\s+congr[èe]s/i,   name: 'Place du Congrès Brussels'     },
  { re: /royal\s+palace|palais\s+royal/i,          name: 'Palais Royal Brussels'         },
  { re: /brussels\s+beach|bruxelles\s+les\s+bains|hangar\s+beach/i, name: 'Quai des Péniches Brussels' },
  { re: /lavall[ée]e/i,                            name: 'LaVallée Molenbeek Brussels'   },
  // Public landmarks for national/municipal events (National Day, park parties…)
  { re: /cinquantenaire|jubelpark/i,               name: 'Parc du Cinquantenaire Brussels' },
  { re: /grand[\s-]?place|grote\s+markt/i,         name: 'Grand-Place Brussels'          },
  { re: /mont\s+des\s+arts|kunstberg/i,            name: 'Mont des Arts Brussels'        },
  { re: /parc\s+royal|parc\s+de\s+bruxelles|warandepark/i, name: 'Parc de Bruxelles Royal Park' },
  { re: /parc\s+du\s+petit\s+sablon|sablon/i,      name: 'Place du Grand Sablon Brussels' },
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
  if (diffDays === 0) return 'Tonight'; // refined to 'Today' by refineDateLabel when startH < 19
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 6 && (dow === 0 || dow === 6)) return 'This Weekend';
  if (diffDays <= 7)  return 'Next Week';
  // "Next Month" covers the window from 8 days out through the end of next calendar month.
  // Events beyond that get a named-month label (e.g. 'July', 'August') so they never
  // get lumped in with genuinely near-term content.
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  if (eDay <= endOfNextMonth) return 'Next Month';
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return MONTH_NAMES[eDay.getMonth()];
}

// Refine 'Tonight' → 'Today' for daytime events (startH < 19).
// Called after the event's startH is determined so toRelativeDate stays date-only.
function refineDateLabel(relDate, startH) {
  if (relDate !== 'Tonight') return relDate;
  return (typeof startH === 'number' && startH < 19) ? 'Today' : 'Tonight';
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
  // If the inferred date is in the past, bump to next year ONLY if that stays
  // within 12 months — otherwise discard (treats genuinely-stale events as expired
  // rather than wrongly pushing "Fri 15 May" to May 2027 when it's May 21, 2026).
  const MS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
  const MF = 'January|February|March|April|May|June|July|August|September|October|November|December';
  m = t.match(new RegExp(`(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*\\s+)?(\\d{1,2})\\s+(${MF}|${MS})(?![a-zA-Z])`, 'i'));
  if (m) {
    const yr = new Date().getFullYear();
    let d = new Date(`${m[2]} ${m[1]}, ${yr}`);
    if (!isNaN(d.getTime())) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (d < today) {
        const next = new Date(`${m[2]} ${m[1]}, ${yr + 1}`);
        const cutoff = new Date(today); cutoff.setFullYear(cutoff.getFullYear() + 1);
        d = next <= cutoff ? next : null; // discard if > 12 months away
      }
      return d ? checked(d) : null;
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

// Category-aware default time — prevents nightlife hours on museums and exhibitions.
// Used as the fallback when no explicit start time is scraped from the page.
function smartDefaultTime(cat) {
  switch (cat) {
    case 'Nightlife':    return { time: '23:00', startH: 23, endH: 26 };
    case 'Music':        return { time: '20:00', startH: 20, endH: 23 };
    case 'Festival':     return { time: '12:00', startH: 12, endH: 22 };
    case 'Culture':
    case 'Arts':         return { time: '11:00', startH: 11, endH: 18 };
    case 'Market':       return { time: '10:00', startH: 10, endH: 17 };
    case 'Sports':
    case 'Wellness':     return { time: '10:00', startH: 10, endH: 13 };
    case 'Food & Drink': return { time: '12:00', startH: 12, endH: 20 };
    default:             return { time: '19:00', startH: 19, endH: 22 };
  }
}

// ── Other helpers ─────────────────────────────────────────────────────────────
function clean(s) { return (s||'').replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Description cleaning module ───────────────────────────────────────────────
// Event descriptions arrive polluted with raw HTML tags, escaped entities
// (often DOUBLE-encoded: '&amp;lt;p&amp;gt;' → '&lt;p&gt;' → '<p>'), literal
// '\n' sequences, and truncation artefacts like '[&hellip;]'. cleanDesc()
// turns all of that into plain readable prose for the app UI.

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', laquo: '«', raquo: '»',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â',
  ccedil: 'ç', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï',
  euml: 'ë', auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß',
  euro: '€', pound: '£', copy: '©', reg: '®', trade: '™',
  bull: '•', middot: '·', deg: '°', sect: '§', para: '¶',
};

function decodeHtmlEntities(s) {
  let out = String(s || '');
  // Iterate until stable — resolves double/triple-encoded entities
  // ('&amp;amp;lt;' needs multiple passes to become '<').
  for (let pass = 0; pass < 4; pass++) {
    const before = out;
    out = out
      // numeric entities: &#8230; and &#x2026;
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
      })
      .replace(/&#(\d+);/g, (_, d) => {
        try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; }
      })
      // named entities
      .replace(/&([a-z]+);/gi, (m, name) => {
        const key = name.toLowerCase();
        return key in HTML_ENTITIES ? HTML_ENTITIES[key] : m;
      });
    if (out === before) break;
  }
  return out;
}

function cleanDesc(s, maxLen = 260) {
  if (!s) return '';
  let out = decodeHtmlEntities(String(s));
  out = out
    .replace(/<br\s*\/?>/gi, ' ')            // line breaks → spaces
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|span|strong|em|b|i|a|img|figure)[^>]*>/gi, ' ')
    .replace(/<[^>]{0,200}>/g, ' ')          // any remaining tags
    .replace(/\\n|\\t|\\r/g, ' ')            // literal escape sequences
    .replace(/\[…\]|\[\.\.\.\]|\(\.\.\.\)/g, '…')  // truncation artefacts
    .replace(/https?:\/\/\S{30,}/g, '')      // unreadably long raw URLs
    .replace(/(?:\s*\.?\s*[⋆·˙•˚°✦✧☆★]+\s*\.?\s*)+/g, ' · ')  // decorative mark runs (with stray dots) → single separator
    .replace(/\b(tickets?|info|link)\s*:\s*(?=[^\w]|·|$)/gi, '')  // orphaned labels after URL removal
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*·\s*){2,}/g, ' · ')
    .trim()
    .replace(/^[·\s]+|[·\s]+$/g, '');
  // Trim to maxLen at a word boundary, never mid-word
  if (out.length > maxLen) {
    out = out.slice(0, maxLen);
    const lastSpace = out.lastIndexOf(' ');
    if (lastSpace > maxLen * 0.6) out = out.slice(0, lastSpace);
    out = out.replace(/[,;:\-–—·.]?$/, '') + '…';
  }
  return out;
}

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

// ── Geocoding ─────────────────────────────────────────────────────────────────
// Landmark overrides: Brussels green spaces & public sites Nominatim geocodes
// badly (it chokes on strings like "Bois de la Cambre : Carrefour des Attelages"
// and lands the pin miles away near Bassin Vergote). Any event whose venue/addr/
// desc matches one of these patterns is anchored DIRECTLY onto exact coords,
// bypassing the text-geocoding API entirely. Order matters — most specific first.
const LANDMARK_OVERRIDES = [
  { re: /bois\s+de\s+la\s+cambre|ter\s+kameren(?:bos)?|carrefour\s+des\s+attelages/i, lat: 50.8122, lng: 4.3802, addr: 'Bois de la Cambre, 1000 Brussels' },
  { re: /cinquantenaire|jubelpark|jubel\s*park/i,                  lat: 50.8417, lng: 4.3889, addr: 'Parc du Cinquantenaire, 1000 Brussels' },
  { re: /brussels\s+park|parc\s+royal|parc\s+de\s+bruxelles|warande\s*park|koninklijk\s+park/i, lat: 50.8444, lng: 4.3633, addr: 'Parc de Bruxelles (Warandepark), 1000 Brussels' },
  { re: /parc\s+d['u]?\s*osseghem|ossegh?em|ossegem/i,             lat: 50.8948, lng: 4.3411, addr: 'Parc dOsseghem, 1020 Laeken' },
  { re: /atomium/i,                                                lat: 50.8949, lng: 4.3415, addr: 'Atomium, 1020 Brussels' },
  { re: /parc\s+du\s+petit\s+sablon|grand\s+sablon|place\s+du\s+(?:grand\s+)?sablon/i, lat: 50.8412, lng: 4.3567, addr: 'Place du Grand Sablon, 1000 Brussels' },
  { re: /mont\s+des\s+arts|kunstberg/i,                            lat: 50.8443, lng: 4.3573, addr: 'Mont des Arts, 1000 Brussels' },
  { re: /place\s+poelaert|poelaert/i,                              lat: 50.8362, lng: 4.3520, addr: 'Place Poelaert, 1000 Brussels' },
  { re: /place\s+du\s+congr[èe]s|congreskolom/i,                   lat: 50.8503, lng: 4.3585, addr: 'Place du Congrès, 1000 Brussels' },
  { re: /grand[\s-]?place|grote\s+markt/i,                         lat: 50.8467, lng: 4.3525, addr: 'Grand-Place, 1000 Brussels' },
  { re: /parc\s+des\s+[ée]tangs|parc\s+astrid|astridpark/i,        lat: 50.8290, lng: 4.3050, addr: 'Parc Astrid / Parc des Étangs, 1070 Anderlecht' },
  { re: /parc\s+de\s+forest|park\s+van\s+vorst|parc\s+duden|dudenpark/i, lat: 50.8155, lng: 4.3330, addr: 'Parc de Forest, 1190 Forest' },
  { re: /parc\s+joseph\s+lema[iî]tre|parc\s+de\s+laeken/i,         lat: 50.8830, lng: 4.3490, addr: 'Parc de Laeken, 1020 Brussels' },
  { re: /tour\s*(?:&|et|and)\s*taxis|thurn\s*(?:&|und)\s*taxis/i,  lat: 50.8676, lng: 4.3427, addr: 'Tour & Taxis, 1000 Brussels' },
];

function landmarkCoords(text) {
  const t = text || '';
  for (const o of LANDMARK_OVERRIDES) if (o.re.test(t)) return o;
  return null;
}

// Only called for events from sources that have no hardcoded lat/lng.
async function geocode(venue) {
  // Landmark short-circuit — never hit the API for a known green space
  const lm = landmarkCoords(venue);
  if (lm) return { lat: lm.lat, lng: lm.lng, landmark: true };

  // Sanitize: drop sub-location suffixes after ':' / '-' / '|' that confuse
  // Nominatim ("Bois de la Cambre : Carrefour des Attelages" → "Bois de la Cambre"),
  // and strip trailing ", Belgium"/", Brussels" the caller re-appends.
  const cleanQuery = String(venue || '')
    .split(/\s*[:|–—]\s*|\s+-\s+/)[0]
    .replace(/,?\s*(brussels|bruxelles|brussel|belgium|belgi[eë])\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const query = cleanQuery.length >= 3 ? cleanQuery : String(venue || '');

  try {
    const q   = encodeURIComponent(`${query}, Brussels, Belgium`);
    const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=be`,
      { headers:{'User-Agent':'Randevu Brussels App (randevu.app)'}, timeout:8000 });
    if (res.data?.length > 0) {
      const lat = parseFloat(res.data[0].lat), lng = parseFloat(res.data[0].lon);
      // Sanity gate: reject results outside the Brussels-Capital region bounding
      // box (roughly 50.76–50.92 N, 4.24–4.48 E). A hit elsewhere in Belgium is
      // a mismatch — fall through to the city-centre fallback instead of pinning
      // the event to another town.
      if (lat >= 50.76 && lat <= 50.92 && lng >= 4.24 && lng <= 4.48) {
        return { lat, lng };
      }
    }
  } catch {}
  // Fallback: Brussels centre (Grand-Place) — deterministic, no random scatter
  // that made events look like they were placed at arbitrary wrong addresses.
  return { lat: 50.8467, lng: 4.3525, fallback: true };
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

    // Block heavy assets — images, fonts, media, and tracking scripts are never
    // needed for DOM text parsing. This cuts page load time by 60-80%.
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      const url   = req.url();
      if (['image', 'media', 'font'].includes(type)) { req.abort(); return; }
      if (/google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|mixpanel|segment\.io|sentry\.io|clarity\.ms|cookielaw|onetrust|quantserve|newrelic|jsdelivr\.net\/npm\/bootstrap/i.test(url)) {
        req.abort(); return;
      }
      req.continue();
    });

    // ── Load page ──
    let loaded = false;
    for (const url of config.urls) {
      try {
        // 'networkidle0' is too slow for SPAs; use 'domcontentloaded' + explicit wait.
        // jsHeavy venues get networkidle2 so React/Vue has time to hydrate.
        const waitMode = config.jsHeavy ? 'networkidle2' : 'domcontentloaded';
        try {
          // 8 s cap — if a venue is this slow it's stalled, not loading
          await page.goto(url, { waitUntil: waitMode, timeout: 8000 });
        } catch (navErr) {
          if (!navErr.message.includes('timeout') && !navErr.message.includes('net::')) throw navErr;
          console.log(`    Navigation timeout/error — using partial content`);
        }

        // Tight wait: asset-blocking means JS renders faster; jsHeavy gets more time.
        const extraWait = config.jsHeavy ? 4000 : 2500;
        await sleep(extraWait);

        // C12 and similar: wait for a specific DOM element to appear
        if (config.waitForSelector) {
          try {
            await page.waitForSelector(config.waitForSelector, { timeout: 8000 });
            console.log(`    ✓ Selector found: ${config.waitForSelector}`);
          } catch {
            failReason = `Selector '${config.waitForSelector}' not found — timeout after 8s`;
            console.log(`    ✗ ${failReason}`);
          }
        }

        // Scroll passes to expose lazy-loaded content
        await page.evaluate(() => window.scrollBy(0, 1200));
        await sleep(800);
        await page.evaluate(() => window.scrollBy(0, 1500));
        await sleep(600);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1200);
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(300);

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
          const cls              = classifyForVenue(title+' '+desc, config);
          const smart            = smartDefaultTime(cls.cat);
          const timeStr          = ev.startDate?.length > 10 ? ev.startDate.slice(11,16) : smart.time;
          const startH           = parseInt(timeStr.split(':')[0], 10) || smart.startH;
          const externalVenueHint = (config.id === 'c12' || config.id === 'fuse')
            ? detectExternalVenue(title+' '+desc+' '+(ev.location?.name||'')) : null;
          events.push({ _rawDate:rawDate, title, venue:config.name, addr:config.addr,
            date:refineDateLabel(relDate, startH), time:timeStr, startH, endH:startH+3,
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
          await sleep(500); // extra render time beyond extraWait
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
              date: refineDateLabel(relDate, parseInt(config.defaultTime, 10) || 20),
              time: config.defaultTime,
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
          await sleep(1500);

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
            if (events.length >= 50) break; // widened cap — more public/city events
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
            const agSmart = smartDefaultTime(cls.cat);
            events.push({
              _rawDate: rawDate, title: item.title,
              venue: venueText || 'Brussels', addr: `${venueText || 'Brussels'}, Belgium`,
              date: refineDateLabel(relDate, agSmart.startH), time: agSmart.time,
              startH: agSmart.startH, endH: agSmart.endH,
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

      // ── Strategy 1.6h: Hangar — dedicated upcoming-events layout parser ──
      // thehangar.be/upcoming-events lists each open air as a layout block with a
      // title, calendar date, background graphic, and ticket/detail link.
      //
      // Runs even when a prior strategy found ≤2 events (their JSON-LD tends to
      // expose only the first upcoming event, which previously short-circuited
      // this parser and produced exactly 1 event).
      //
      // Harvesting is UNION + LEAF-ONLY: every selector's matches are pooled and
      // any wrapper that CONTAINS another candidate is dropped — so one page-level
      // container can never swallow the entire schedule into a single "card".
      // If leaf detection still yields ≤1 block, we split the page by
      // event/ticket anchors instead, one block per anchor.
      if (config.id === 'hangar' && events.length <= 2) {
        try {
          console.log('    Strategy 1.6h (Hangar upcoming-events): waiting for grid render…');

          // ── Explicit DOM-wait: the summer schedule grid is rendered client-side
          // (Elementor). Parsing too early sees only the SSR shell with the first
          // card, so we block until real event cards exist — trying the specific
          // Elementor card class first, then progressively generic containers.
          const HANGAR_WAIT_SELECTORS = [
            '.elementor-post__card',
            '.elementor-post',
            '[class*="event-item"], [class*="event-card"]',
            'article',
          ];
          let gridReady = false;
          for (const sel of HANGAR_WAIT_SELECTORS) {
            try {
              await page.waitForSelector(sel, { timeout: 10000 });
              console.log(`    Hangar grid ready: '${sel}' rendered`);
              gridReady = true;
              break;
            } catch {}
          }
          if (!gridReady) console.log('    Hangar: no card selector appeared in 10s — parsing current DOM anyway');

          // ── Scroll-until-stable: step to the bottom repeatedly until the count
          // of candidate cards stops growing (2 stable rounds, max 15 passes) —
          // triggers every lazy-loaded row on the timeline, not just page 1.
          let prevCards = -1, stableRounds = 0;
          for (let pass = 0; pass < 15 && stableRounds < 2; pass++) {
            const cardCount = await page.evaluate((step) => {
              window.scrollTo(0, (document.body.scrollHeight / 4) * ((step % 4) + 1));
              window.dispatchEvent(new Event('scroll'));
              return document.querySelectorAll(
                '.elementor-post__card, .elementor-post, article, [class*="event-item"], [class*="event-card"]'
              ).length;
            }, pass);
            if (cardCount === prevCards) stableRounds++; else { stableRounds = 0; prevCards = cardCount; }
            await sleep(900);
          }
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1200);
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(400);
          console.log(`    Hangar: grid settled at ${prevCards} card container(s)`);

          const venueEventSel = config.eventSelector || '';
          const hangarCards = await page.evaluate((venueEventSel) => {
            const sels = (venueEventSel ? venueEventSel.split(',').map(s => s.trim()) : [])
              .concat([
                'article', '.elementor-post', '.jet-listing-grid__item',
                '[class*="event-item"]', '[class*="event-card"]', '[class*="EventCard"]',
                '[class*="event"]', '[class*="Event"]', '[class*="card"]',
                'li', '.wp-block-post',
              ]);

            // 1. UNION of all selector matches (not "best selector wins")
            const pool = new Set();
            for (const sel of sels) {
              try {
                document.querySelectorAll(sel).forEach(el => {
                  const t = (el.innerText || '').trim();
                  if (t.length > 8 && t.length < 900 && el.querySelector('a[href]')) pool.add(el);
                });
              } catch {}
            }
            // 2. LEAF-ONLY: drop any candidate that contains another candidate
            let candidates = [...pool];
            candidates = candidates.filter(el =>
              !candidates.some(other => other !== el && el.contains(other))
            );

            // 3. Fallback: split by event/ticket anchors — one block per anchor
            if (candidates.length <= 1) {
              const anchors = [...document.querySelectorAll('a[href]')]
                .filter(a => /event|ticket|shotgun|dice|eventbrite|billet|\/e\//i.test(a.href || ''));
              const blocks = new Set();
              for (const a of anchors) {
                let n = a;
                for (let up = 0; up < 4 && n.parentElement; up++) {
                  n = n.parentElement;
                  const t = (n.innerText || '').trim();
                  if (t.length > 15 && t.length < 900) { blocks.add(n); break; }
                }
              }
              let arr = [...blocks];
              arr = arr.filter(el => !arr.some(o => o !== el && el.contains(o)));
              if (arr.length > candidates.length) candidates = arr;
            }

            // Pull a background-image URL from inline style or a nested <img>
            const bgOf = (el) => {
              const scan = [el, ...el.querySelectorAll('[style*="background"], img')];
              for (const n of scan) {
                const st = n.getAttribute && n.getAttribute('style') || '';
                const m = st.match(/url\((['"]?)(.*?)\1\)/i);
                if (m && m[2]) return m[2];
                if (n.tagName === 'IMG') {
                  const src = n.getAttribute('src') || n.getAttribute('data-src') || '';
                  if (src && !/logo|icon|sprite/i.test(src)) return src;
                }
              }
              return '';
            };

            return candidates.slice(0, 50).map(el => {
              const h = el.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"],[class*="heading"],strong');
              const dateEl = el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="day"],[class*="datum"]');
              const linkA = el.querySelector('a[href*="ticket"],a[href*="/event"],a[href*="shotgun"],a[href*="dice"],a[href*="eventbrite"]')
                         || el.querySelector('a[href]');
              return {
                title:   (h?.innerText || '').replace(/\s+/g, ' ').trim(),
                dateStr: dateEl?.getAttribute('datetime') || (dateEl?.innerText || '').replace(/\s+/g, ' ').trim(),
                image:   bgOf(el),
                link:    linkA?.href || '',
                allText: (el.innerText || '').replace(/\s+/g, ' ').trim(),
              };
            }).filter(c => c.title && c.title.length > 3);
          }, venueEventSel);

          console.log(`    Hangar: ${hangarCards.length} leaf event block(s) found`);
          const baseOriginH = (config.urls[0] || '').match(/^https?:\/\/[^/]+/)?.[0] || 'https://thehangar.be';
          const hangarEvents = [];

          for (const c of hangarCards) {
            if (!isValidTitle(c.title)) { console.log(`    Hangar skip "${c.title.slice(0,30)}" — bad title`); continue; }
            const rawDate = parseRawDate(c.dateStr) || parseRawDate(scanTextForDate(c.allText));
            if (!rawDate) { console.log(`    Hangar skip "${c.title.slice(0,30)}" — no date (raw:"${(c.dateStr||'').slice(0,20)}")`); continue; }
            const relDate = toRelativeDate(rawDate);
            if (!relDate) { console.log(`    Hangar skip "${c.title.slice(0,30)}" — past date ${rawDate}`); continue; }
            const url = c.link.startsWith('http') ? c.link
              : c.link.startsWith('/') ? `${baseOriginH}${c.link}` : '';
            const cls = classifyForVenue(c.title + ' ' + c.allText, config);
            const smart = smartDefaultTime(cls.cat);
            // Location: Hangar events roam — detect landmark, else geocode
            const hint = detectExternalVenue(c.title + ' ' + c.allText);
            hangarEvents.push({
              _rawDate: rawDate, title: c.title,
              venue: hint ? hint.replace(/\s+Brussels$/i, '') : config.name,
              addr: config.addr,
              date: refineDateLabel(relDate, smart.startH), time: smart.time,
              startH: smart.startH, endH: smart.endH,
              emoji: cls.emoji, color: cls.color, cat: cls.cat, tags: cls.tags,
              source: config.name, officialEventLink: url,
              desc: c.allText.slice(0, 260) || `${c.title} by ${config.name}.`,
              neighbourhood: config.neighbourhood,
              lat: 0, lng: 0,   // resolve per event in main()
              ...(c.image ? { image: c.image } : {}),
              ...(hint ? { externalVenueHint: hint } : {}),
            });
          }

          // Replace any thinner earlier capture (e.g. single JSON-LD event)
          if (hangarEvents.length > events.length) {
            events.length = 0;
            events.push(...hangarEvents);
          }
          console.log(`    Hangar → ${events.length} event(s) parsed (full schedule)`);
        } catch (err) {
          console.log(`    Hangar scraper error: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 1.7: jsHeavy live DOM scrape via page.evaluate() ──
      // For React/Vue SPAs: Cheerio only sees the pre-JS static shell, so CSS selectors
      // find nothing. page.evaluate() runs inside the browser context where JS has already
      // rendered the real DOM, giving us real event cards.
      // Skipped for useAgendaBrussels (→ 1.8), useResidentAdvisor (→ 1.9b), useRaClub (→ 1.9a).
      if (config.jsHeavy && !config.useAgendaBrussels && !config.useResidentAdvisor && !config.useRaClub && events.length === 0) {
        try {
          console.log(`    Strategy 1.7 (jsHeavy live DOM): waiting for deferred renders…`);
          await sleep(1000);

          // Pass venue-specific selectors into the browser context
          const venueEventSel = config.eventSelector || '';
          const liveCards = await page.evaluate((venueEventSel) => {
            function hasDates(text) {
              return /\d{1,2}[\s\/.\-]\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i.test(text);
            }

            // Venue-specific selectors first (highest signal), then generic fallbacks
            const venueSelectors = venueEventSel
              ? venueEventSel.split(',').map(s => s.trim()).filter(Boolean)
              : [];
            const SELECTORS = [
              ...venueSelectors,
              '[class*="event"]','[class*="Event"]',
              '[class*="agenda"]','[class*="Agenda"]',
              '[class*="show"]','[class*="Show"]',
              '[class*="concert"]','[class*="Concert"]',
              '[class*="programme"]','[class*="Programme"]',
              '[class*="card"]','[class*="Card"]',
              '[class*="listing"]','[class*="Listing"]',
              '[class*="item"]','[class*="Item"]',
              'article','li',
            ];
            let best = [];
            for (const sel of SELECTORS) {
              try {
                const els = [...document.querySelectorAll(sel)].filter(el => {
                  const t = (el.innerText || '').trim();
                  return t.length > 20 && t.length < 1500;
                });
                if (els.length > best.length) best = els;
              } catch {}
            }

            // Keep only items that have heading AND date signal
            const candidates = best.filter(el => {
              const h = el.querySelector('h1,h2,h3,h4,h5,strong,[class*="title"],[class*="name"]');
              if (!h) return false;
              const t = (el.innerText || '').trim();
              const hasDateEl = !!el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="dag"],[class*="datum"]');
              return hasDateEl || hasDates(t);
            }).slice(0, 50);

            return candidates.map(el => {
              const h = el.querySelector('h1,h2,h3,h4,h5,strong,[class*="title"],[class*="name"]');
              const title = (h?.innerText || '').replace(/\s+/g, ' ').trim();

              const dateEl = el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="dag"],[class*="datum"],[class*="day"],[class*="period"]');
              const dateStr = dateEl?.getAttribute('datetime') || (dateEl?.innerText || '').replace(/\s+/g, ' ').trim() || '';

              const timeEl = el.querySelector('[class*="time"],[class*="hour"],[class*="uur"]');
              const timeText = (timeEl?.innerText || '').replace(/\s+/g, ' ').trim();

              const descEl = el.querySelector('p,[class*="desc"],[class*="intro"],[class*="summary"]');
              const desc = (descEl?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200);

              // Two-tier link: heading anchor → slug anchor. No generic fallback.
              const headingLink = h?.querySelector('a')?.href || h?.closest?.('a')?.href || '';
              const allLinks = [...el.querySelectorAll('a[href]')];
              const slugLink = allLinks.find(a => /\/event|\/agenda|\/concert|\/show|\/spectacle|\/programme|\/detail|\/tickets|\/activit/i.test(a.href || ''));
              const link = headingLink || slugLink?.href || '';

              const allText = (el.innerText || '').replace(/\s+/g, ' ').trim();
              return { title, dateStr, timeText, desc, link, allText };
            });
          }, venueEventSel);

          console.log(`    Strategy 1.7: ${liveCards.length} live card(s) found`);
          const baseOrigin = (config.urls[0] || '').match(/^https?:\/\/[^/]+/)?.[0] || '';

          for (const { title, dateStr, timeText, desc, link, allText } of liveCards) {
            if (!isValidTitle(title)) continue;
            // Strict date: prefer structured element; fall back to text scan only as last resort
            const rawDate = parseRawDate(dateStr) || parseRawDate(scanTextForDate(allText));
            if (!rawDate) { console.log(`    skip "${title.slice(0,30)}" — date not parsed`); continue; }
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;
            // Strict deep-link: reject if no link or link is bare homepage
            if (!link) { console.log(`    skip "${title.slice(0,30)}" — no deep-link`); continue; }
            const url = link.startsWith('http') ? link
              : link.startsWith('/') ? `${baseOrigin}${link}` : '';
            const urlPath17 = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
            if (!url || urlPath17.length < 5) { console.log(`    skip "${title.slice(0,30)}" — homepage URL rejected`); continue; }

            const cls = classifyForVenue(title + ' ' + desc, config);
            const smart = smartDefaultTime(cls.cat);
            const { time: parsedTime, startH, endH } = parseTime(timeText, smart.time);
            const externalVenueHint17 = detectExternalVenue(title + ' ' + desc);

            events.push({
              _rawDate: rawDate, title, venue: config.name, addr: config.addr,
              date: refineDateLabel(relDate, startH), time: parsedTime, startH, endH,
              emoji: cls.emoji, color: cls.color, cat: cls.cat, tags: cls.tags,
              source: config.name, officialEventLink: url,
              desc: desc || `${title} at ${config.name}.`,
              neighbourhood: config.neighbourhood, lat: config.lat, lng: config.lng,
              ...(externalVenueHint17 ? { externalVenueHint: externalVenueHint17 } : {}),
            });
          }
          console.log(`    Strategy 1.7 → ${events.length} valid event(s)`);
        } catch (err) {
          console.log(`    Strategy 1.7 failed: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 1.8: Agenda Brussels venue-specific search ──
      // For venues with useAgendaBrussels: true, the URL is already
      // https://www.agenda.brussels/en/search?q=VENUE_NAME — a pre-filtered results page.
      // We extract event cards from those search results, accepting agenda.brussels
      // deep-links only. Location field is extracted for accurate geocoding.
      if (config.useAgendaBrussels && events.length === 0) {
        try {
          console.log(`    Strategy 1.8 (agenda.brussels search): scanning for "${config.name}"…`);
          await sleep(1500);

          const agItems = await page.evaluate(() => {
            const selectors = [
              '.event-card', '[class*="event-card"]',
              '.event-item', '[class*="event-item"]',
              '[class*="EventCard"]', '[class*="EventItem"]',
              'article', '[class*="card"]', '.item',
            ];
            let best = [];
            for (const sel of selectors) {
              try {
                const els = [...document.querySelectorAll(sel)].filter(el => {
                  const t = (el.innerText || '').trim();
                  return t.length > 20 && t.length < 800;
                });
                if (els.length > best.length) best = els;
              } catch {}
            }
            return best.map(el => {
              const h       = el.querySelector('h1,h2,h3,h4,h5,[class*="title"],[class*="name"]');
              const dateEl  = el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="dag"]');
              const locEl   = el.querySelector('[class*="location"],[class*="venue"],[class*="place"],[class*="lieu"],[class*="address"]');
              const link    = el.querySelector('a[href]')?.href || '';
              return {
                title:    (h?.innerText || '').replace(/\s+/g, ' ').trim(),
                dateStr:  dateEl?.getAttribute('datetime') || (dateEl?.innerText || '').trim(),
                location: (locEl?.innerText || '').replace(/\s+/g, ' ').trim(),
                allText:  (el.innerText || '').replace(/\s+/g, ' ').trim(),
                link,
              };
            }).filter(item => item.title && item.title.length > 3);
          });

          console.log(`    Strategy 1.8: ${agItems.length} card(s) from agenda.brussels`);
          const baseOrigin18 = 'https://www.agenda.brussels';

          for (const item of agItems) {
            if (config.genericPortal && events.length >= 40) break; // bound geocoding load
            if (!isValidTitle(item.title)) continue;
            const rawDate = parseRawDate(item.dateStr) || parseRawDate(scanTextForDate(item.allText));
            if (!rawDate) continue;
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;

            // Accept only agenda.brussels deep-links
            const url18 = item.link.startsWith('http') ? item.link
              : item.link.startsWith('/') ? `${baseOrigin18}${item.link}` : '';
            if (!url18) continue;
            const urlPath18 = url18.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
            if (urlPath18.length < 5) continue;

            const locationField = (item.location || '').trim().replace(/\n.*/g, '').slice(0, 80);

            if (config.genericPortal) {
              // ── Generic public-event collector (open airs, festivals, National
              // Day…): the card's OWN venue/location is the truth — never pin to
              // the portal config. Landmarks (Cinquantenaire, Grand-Place…) are
              // detected for geocoding; classification comes from card content.
              const landmarkHint = detectExternalVenue(`${item.title} ${locationField} ${item.allText}`);
              let clsG = classify(item.title + ' ' + item.allText);
              if (clsG.emoji === DEFAULT_CLASS.emoji) {
                clsG = { emoji: config.emoji, color: config.color, cat: config.cat, tags: config.tags };
              }
              const smartG = smartDefaultTime(clsG.cat);
              const venueG = locationField || (landmarkHint ? landmarkHint.replace(/\s+Brussels$/i, '') : 'Brussels');
              events.push({
                _rawDate: rawDate, title: item.title,
                venue: venueG, addr: `${venueG}, Brussels, Belgium`,
                date: refineDateLabel(relDate, smartG.startH), time: smartG.time,
                startH: smartG.startH, endH: smartG.endH,
                emoji: clsG.emoji, color: clsG.color, cat: clsG.cat, tags: clsG.tags,
                source: 'Agenda Brussels', officialEventLink: url18,
                desc: item.allText.slice(0, 260) || `${item.title} in Brussels.`,
                neighbourhood: 'Various',
                lat: 0, lng: 0,   // always geocode the card's real location
                ...(landmarkHint ? { externalVenueHint: landmarkHint } : {}),
              });
              continue;
            }

            const cls18   = classifyForVenue(item.title + ' ' + item.allText, config);
            const smart18 = smartDefaultTime(cls18.cat);

            // If the card has an explicit location different from the venue's own address,
            // set lat/lng = 0 so main() geocodes the actual event location.
            const useVenueCoords = !locationField ||
              locationField.toLowerCase().includes(config.name.toLowerCase()) ||
              locationField.toLowerCase() === 'brussels';

            events.push({
              _rawDate: rawDate, title: item.title,
              venue: config.name, addr: locationField || config.addr,
              date: refineDateLabel(relDate, smart18.startH), time: smart18.time,
              startH: smart18.startH, endH: smart18.endH,
              emoji: cls18.emoji, color: cls18.color, cat: cls18.cat, tags: cls18.tags,
              source: config.name, officialEventLink: url18,
              desc: item.allText.slice(0, 200) || `${item.title} at ${config.name}.`,
              neighbourhood: config.neighbourhood,
              lat: useVenueCoords ? config.lat : 0,
              lng: useVenueCoords ? config.lng : 0,
              ...(!useVenueCoords && locationField ? { externalVenueHint: locationField } : {}),
            });
          }
          console.log(`    Strategy 1.8 → ${events.length} valid event(s) for "${config.name}"`);
        } catch (err) {
          console.log(`    Strategy 1.8 failed: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 1.9a: Resident Advisor — specific club page ──
      // For venues with useRaClub: true (e.g. Circle Park, RA club ID 189275).
      // All events on a club page belong to this venue — no venue matching needed.
      //
      // RA is a Next.js app: the server response embeds the full GraphQL event
      // payload in <script id="__NEXT_DATA__">. Tier 1 walks that JSON for
      // objects with __typename === 'Event' (fields: title, date/startTime,
      // contentUrl '/events/XXXXXX') — immune to CSS class churn. Tier 2 falls
      // back to RA's DOM: [data-testid="event-listing-card"] cards / h3 titles /
      // a[href^="/events/"] anchors.
      //
      // Strict deep-link: only accepts /events/XXXXXX paths (rejects bare domain).
      // Location sanity: if the card text mentions an external physical location,
      // lat/lng is zeroed so main() geocodes the actual event site.
      if (config.useRaClub && events.length === 0) {
        try {
          console.log(`    Strategy 1.9a (RA club page): scraping ${config.name}…`);
          await sleep(3000);

          const raClubItems = await page.evaluate(() => {
            const results = [];
            const seen = new Set();

            // ── Tier 1: __NEXT_DATA__ GraphQL payload (authoritative) ──
            try {
              const raw = document.getElementById('__NEXT_DATA__')?.textContent;
              if (raw) {
                const walk = (node) => {
                  if (!node || typeof node !== 'object') return;
                  if (Array.isArray(node)) { node.forEach(walk); return; }
                  const url = node.contentUrl || node.contentURL || '';
                  const isEvent = node.__typename === 'Event' ||
                    (typeof url === 'string' && /^\/events\/\d+/.test(url) && node.title);
                  if (isEvent && node.title && !seen.has(url)) {
                    seen.add(url);
                    results.push({
                      title:   String(node.title).trim(),
                      dateStr: node.date || node.startTime || node.startDate || '',
                      allText: [node.title, node.venue?.name, node.promoter?.name].filter(Boolean).join(' '),
                      link:    url ? `https://ra.co${url.split('?')[0]}` : '',
                      fromNextData: true,
                    });
                  }
                  for (const k of Object.keys(node)) walk(node[k]);
                };
                walk(JSON.parse(raw));
              }
            } catch {}
            if (results.length > 0) return results.slice(0, 60);

            // ── Tier 2: RA DOM cards (post-hydration fallback) ──
            const RA_CARD_SELECTORS = [
              '[data-testid="event-listing-card"]',
              '[data-testid*="event"]',
              'ul li:has(a[href^="/events/"])',
              'article', 'li',
            ];
            let best = [];
            for (const sel of RA_CARD_SELECTORS) {
              try {
                const els = [...document.querySelectorAll(sel)].filter(el => {
                  const t = (el.innerText || '').trim();
                  return t.length > 15 && t.length < 600 && el.querySelector('a[href*="/events/"]');
                });
                if (els.length > best.length) best = els;
              } catch {}
            }
            return best.slice(0, 60).map(el => {
              const h = el.querySelector('h3,h2,h4,[data-testid*="title"],strong,[class*="title"],[class*="name"],[class*="heading"]');
              const dateEl = el.querySelector('time,[datetime],[class*="date"],[class*="when"],[class*="day"]');
              const allText = (el.innerText || '').replace(/\s+/g, ' ').trim();
              const link = el.querySelector('a[href*="/events/"]')?.href || '';
              return {
                title:   (h?.innerText || '').replace(/\s+/g, ' ').trim(),
                dateStr: dateEl?.getAttribute('datetime') || (dateEl?.innerText || '').trim(),
                allText, link,
                fromNextData: false,
              };
            }).filter(item => item.title && item.title.length > 3 && item.link);
          });

          const viaData = raClubItems.filter(i => i.fromNextData).length;
          console.log(`    RA club (${config.name}): ${raClubItems.length} card(s) found (${viaData} via __NEXT_DATA__)`);

          for (const item of raClubItems) {
            if (!isValidTitle(item.title)) continue;
            const rawDate = parseRawDate(item.dateStr) || parseRawDate(scanTextForDate(item.allText));
            if (!rawDate) continue;
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;

            // Strict deep-link: path must start with /events/ and be ≥ 10 chars
            const raClubUrl  = item.link.startsWith('http') ? item.link : `https://ra.co${item.link}`;
            const raClubPath = raClubUrl.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
            if (!raClubPath.startsWith('/events/') || raClubPath.length < 10) continue;

            // Location sanity: if card mentions a physical location → geocode it
            const locationHint19a = detectExternalVenue(item.allText);
            const useVenueCoords  = !locationHint19a && config.lat !== 0;

            const cls19a   = classifyForVenue(item.title + ' ' + item.allText, config);
            const smart19a = smartDefaultTime(cls19a.cat);

            events.push({
              _rawDate: rawDate, title: item.title,
              venue: config.name, addr: config.addr,
              date: refineDateLabel(relDate, smart19a.startH), time: smart19a.time,
              startH: smart19a.startH, endH: smart19a.endH,
              emoji: cls19a.emoji, color: cls19a.color, cat: cls19a.cat, tags: cls19a.tags,
              source: 'Resident Advisor', officialEventLink: raClubUrl,
              desc: item.allText.slice(0, 200) || `${item.title} by ${config.name}.`,
              neighbourhood: config.neighbourhood,
              lat: useVenueCoords ? config.lat : 0,
              lng: useVenueCoords ? config.lng : 0,
              ...(locationHint19a ? { externalVenueHint: locationHint19a } : {}),
            });
          }
          console.log(`    RA club → ${events.length} valid event(s) for "${config.name}"`);
        } catch (err) {
          console.log(`    Strategy 1.9a (RA club) failed: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 1.9b: unified regional agenda stream (RA / Shotgun) ──
      // Scrapes the master regional calendar (ra.co/events/be/brussels or
      // shotgun.live Brussels) and captures EVERY structural event row:
      // verified title, correct ISO date, deep-linked /events/XXXXXX path, and
      // the venue name/location metadata attached to the row.
      //
      // Tier 1 walks RA's __NEXT_DATA__ GraphQL payload (Event objects carry
      // venue.name — immune to CSS churn); Tier 2 falls back to DOM rows.
      //
      // Venue names are cross-referenced against (1) our venue registry — known
      // venues like Circle Park reuse their exact coords/identity — and
      // (2) EXTERNAL_VENUE_PATTERNS, so roaming series (Hangar, Piknic
      // Electronik, Play Label…) drop markers at their REAL sites (Atomium,
      // Place Poelaert, Place du Congrès…). Everything else keeps its scraped
      // venue name with lat/lng = 0 → the geocoder resolves it in main().
      //
      // If the registry entry defines portalKeywords they act as a filter gate
      // (Shotgun techno feed); with no keywords the FULL agenda is ingested (RA).
      if (config.useResidentAdvisor && events.length === 0) {
        const KEYWORD_GATE = (config.portalKeywords && config.portalKeywords.length > 0)
          ? new RegExp(config.portalKeywords
              .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?[\s-]+/g, '[\\s-]?'))
              .join('|'), 'i')
          : null; // no gate — capture the whole regional agenda
        const portalOrigin = (config.urls[0] || '').match(/^https?:\/\/[^/]+/)?.[0] || 'https://ra.co';
        const MAX_PORTAL_EVENTS = 120;
        try {
          console.log(`    Strategy 1.9b (regional agenda: ${portalOrigin.replace('https://', '')})${KEYWORD_GATE ? ' [keyword-gated]' : ' [full feed]'}…`);

          // ── Scroll-until-stable lazy-load bypass ──
          // RA/Shotgun load day blocks via IntersectionObserver sentinels near the
          // page bottom. Each pass: step to 90% (lets the sentinel enter the
          // viewport "naturally"), then to the bottom, fire a scroll event, and
          // click any visible "load/show more" button. We stop only after the
          // /events/ anchor count plateaus for 4 consecutive rounds (max 40).
          let prevCount = -1, stable = 0;
          for (let pass = 0; pass < 40 && stable < 4; pass++) {
            const count = await page.evaluate(() => {
              const h = document.body.scrollHeight;
              window.scrollTo(0, Math.floor(h * 0.9));
              window.dispatchEvent(new Event('scroll'));
              window.scrollTo(0, h);
              window.dispatchEvent(new Event('scroll'));
              // Some feeds hide extra days behind an explicit button
              const btn = [...document.querySelectorAll('button, a[role="button"], [class*="loadMore"], [class*="LoadMore"]')]
                .find(b => /load\s*more|show\s*more|more\s*events|voir\s*plus/i.test(b.innerText || ''));
              if (btn) { try { btn.click(); } catch {} }
              return document.querySelectorAll('a[href*="/events/"]').length;
            });
            if (count === prevCount) stable++; else { stable = 0; prevCount = count; }
            await sleep(1100);
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await sleep(400);
          console.log(`    RA scroll settled: ${prevCount} event anchor(s) in DOM`);

          // Venue lookup for cross-referencing row metadata (registry names)
          const VENUE_LOOKUP = {};
          for (const vc of VENUE_CONFIGS) {
            if (!vc.useResidentAdvisor && !vc.useRaClub) {
              VENUE_LOOKUP[vc.name.toLowerCase()] = vc;
            }
          }

          const raItems = await page.evaluate(() => {
            const results = [];
            const seen = new Set();

            // ── Tier 1: __NEXT_DATA__ payload — authoritative venue metadata for
            //    the SSR rows. MERGED with the DOM harvest below (not returned
            //    early), because the payload only holds the first render batch.
            try {
              const rawJson = document.getElementById('__NEXT_DATA__')?.textContent;
              if (rawJson) {
                const walk = (node) => {
                  if (!node || typeof node !== 'object') return;
                  if (Array.isArray(node)) { node.forEach(walk); return; }
                  const url = node.contentUrl || node.contentURL || '';
                  const isEvent = node.__typename === 'Event' ||
                    (typeof url === 'string' && /^\/events\/\d+/.test(url) && node.title);
                  if (isEvent && node.title && url) {
                    const key = url.split('?')[0];
                    if (!seen.has(key)) {
                      seen.add(key);
                      results.push({
                        title:     String(node.title).trim(),
                        dateStr:   node.date || node.startTime || node.startDate || '',
                        venueName: (node.venue && node.venue.name) ? String(node.venue.name).trim() : '',
                        allText:   [node.title, node.venue && node.venue.name].filter(Boolean).join(' '),
                        link:      key,
                        fromNextData: true,
                      });
                    }
                  }
                  for (const k of Object.keys(node)) walk(node[k]);
                };
                walk(JSON.parse(rawJson));
              }
            } catch {}

            // ── Tier 2: DOM harvest with DAY-HEADER date association ──
            // RA groups event cards under sticky day headers ("Fri, 11 Jul") and
            // individual cards often carry no full date of their own. We walk the
            // listing in document order over both day-headers and event anchors,
            // carrying the current day's date forward onto every card beneath it.
            const DATE_TOKEN = /\d{4}-\d{2}-\d{2}|\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+\d{1,2}\s+[a-z]{3,}|\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;
            // One ordered NodeList of BOTH markers: date-ish elements + event anchors.
            const nodes = [...document.querySelectorAll(
              'a[href*="/events/"], time, [datetime], h1, h2, h3, [class*="sticky"], [class*="dayHeader"], [class*="DayHeader"], [class*="date"], [class*="Date"]'
            )];
            let currentDate = '';
            for (const el of nodes) {
              const isEventAnchor = el.tagName === 'A' && /\/events\/\d+/.test(el.getAttribute('href') || '');
              if (!isEventAnchor) {
                // Potential day header — only accept it if its OWN text parses as a
                // real calendar date (card start-times like "23:00" are ignored).
                const dt = el.getAttribute('datetime') || '';
                const txt = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
                const cand = /\d{4}-\d{2}-\d{2}/.test(dt) ? dt : (DATE_TOKEN.test(txt) ? txt : '');
                if (cand) currentDate = cand;
                continue;
              }
              // Event anchor — resolve its card container for title/venue text
              const href = el.getAttribute('href').split('?')[0];
              const key = href.startsWith('http') ? href.replace(/^https?:\/\/[^/]+/, '') : href;
              if (seen.has(key)) continue;
              const card = el.closest('[data-testid], li, article, [class*="event"], [class*="Event"]') || el;
              const h = card.querySelector('h1,h2,h3,h4,h5,strong,[class*="title"],[class*="name"],[class*="heading"]');
              const title = ((h?.innerText || el.innerText || '')).replace(/\s+/g, ' ').trim();
              if (!title || title.length < 3) continue;
              seen.add(key);
              const venueA = card.querySelector('a[href*="/clubs/"]');
              const ownDateEl = card.querySelector('time[datetime],[datetime]');
              results.push({
                title,
                dateStr:   ownDateEl?.getAttribute('datetime') || currentDate || '',
                venueName: (venueA?.innerText || '').replace(/\s+/g, ' ').trim(),
                allText:   (card.innerText || title).replace(/\s+/g, ' ').trim().slice(0, 400),
                link:      key,
                fromNextData: false,
              });
            }
            return results;
          });

          const viaPayload = raItems.filter(i => i.fromNextData).length;
          console.log(`    Regional agenda: ${raItems.length} row(s) captured (${viaPayload} via __NEXT_DATA__, ${raItems.length - viaPayload} via DOM)`);
          let skippedGate = 0, skippedNoDate = 0;

          for (const item of raItems) {
            if (events.length >= MAX_PORTAL_EVENTS) break;

            // Optional keyword gate (Shotgun) — RA full feed passes everything
            if (KEYWORD_GATE && !KEYWORD_GATE.test(item.title) &&
                !KEYWORD_GATE.test(item.venueName) && !KEYWORD_GATE.test(item.allText)) {
              skippedGate++;
              continue;
            }

            if (!isValidTitle(item.title)) continue;
            const rawDate = parseRawDate(item.dateStr) || parseRawDate(scanTextForDate(item.allText));
            if (!rawDate) { skippedNoDate++; continue; }
            const relDate = toRelativeDate(rawDate);
            if (!relDate) continue;

            // Strict deep-link against THIS portal's origin; bare domains rejected
            const raUrl19b  = item.link.startsWith('http') ? item.link
              : item.link ? `${portalOrigin}${item.link}` : '';
            const raPath19b = raUrl19b.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
            if (!raUrl19b || raPath19b.length < 5) continue;

            // ── Cross-reference venue metadata ──
            // 1. Known registry venue → exact coords + identity
            const metaText = `${item.venueName} ${item.title} ${item.allText}`.toLowerCase();
            let matchedVc = null;
            for (const [vname, vc] of Object.entries(VENUE_LOOKUP)) {
              if (vname.length > 2 && metaText.includes(vname)) { matchedVc = vc; break; }
            }
            // 2. Roaming series / landmark → real site via geocoder
            const locationHint19b = detectExternalVenue(`${item.venueName} ${item.title} ${item.allText}`);

            // Classification: real content-based visuals; RA is an electronic
            // music platform, so unclassified rows default to Nightlife.
            let cls = classify(item.title + ' ' + item.venueName);
            if (cls.emoji === DEFAULT_CLASS.emoji) {
              cls = locationHint19b || /open[\s-]?air|festival/i.test(item.title)
                ? { emoji: '🌿', color: '#F4A261', cat: 'Festival', tags: ['Open Air', 'Electronic', 'Festival'] }
                : { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife', tags: ['Electronic', 'Club'] };
            }
            const smart19b = smartDefaultTime(cls.cat);

            const venueName = matchedVc ? matchedVc.name
              : (item.venueName || (locationHint19b ? locationHint19b.replace(/\s+Brussels$/i, '') : 'Brussels'));

            events.push({
              _rawDate: rawDate, title: item.title,
              venue: venueName,
              addr:  matchedVc ? matchedVc.addr : `${venueName}, Brussels, Belgium`,
              date: refineDateLabel(relDate, smart19b.startH), time: smart19b.time,
              startH: smart19b.startH, endH: smart19b.endH,
              emoji: cls.emoji, color: cls.color, cat: cls.cat, tags: cls.tags,
              source: portalOrigin.includes('shotgun') ? 'Shotgun' : 'Resident Advisor',
              officialEventLink: raUrl19b,
              desc: item.allText.slice(0, 260) || `${item.title} at ${venueName}.`,
              neighbourhood: matchedVc ? matchedVc.neighbourhood : 'Various',
              lat: (locationHint19b || !matchedVc) ? 0 : matchedVc.lat,
              lng: (locationHint19b || !matchedVc) ? 0 : matchedVc.lng,
              ...(locationHint19b ? { externalVenueHint: locationHint19b } : {}),
            });
          }
          console.log(`    Regional agenda → ${events.length} event(s) ingested${KEYWORD_GATE ? ` | ${skippedGate} gated out` : ''}${skippedNoDate ? ` | ${skippedNoDate} no-date` : ''}`);
          console.log(`    ✅ ${portalOrigin.replace('https://','')} TOTAL PARSED: ${events.length} event(s) from ${raItems.length} row(s) scraped`);
        } catch (err) {
          console.log(`    Strategy 1.9b (regional agenda) failed: ${err.message.slice(0, 80)}`);
        }
      }

      // ── Strategy 2: HTML — heading + date presence filter ──
      // Requires a candidate element to contain BOTH a heading AND a date signal,
      // so it works regardless of CSS class names.
      if (events.length === 0) {
        const $ = cheerio.load(await page.content());

        // Build scope selector: standard containers + any venue-specific eventSelector
        const venueSpecificSels = config.eventSelector ? config.eventSelector.split(',').map(s => s.trim()) : [];
        const scope = $([
          'main','#content','[role="main"]',
          '.event-list','.event-items','.event-item',        // C12
          '.event-card','.event-cards',                      // La Madeleine / generic
          '.agenda','.programme','.calendar','.events-list',
          '.event-overview','.listing','.schedule',
          ...venueSpecificSels,                              // venue-specific containers
        ].join(',')).first();
        const root = scope.length ? scope : $('body');
        const scopeDesc = scope.length
          ? (scope.get(0).tagName + (scope.attr('class')||'').slice(0,30))
          : 'body';
        console.log(`    HTML scope: ${scopeDesc}`);

        if (!scope.length) {
          failReason = failReason || 'No agenda/calendar container found — using body';
        }

        // Wide net: generic selectors + venue-specific eventSelector containers
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
          ...venueSpecificSels,          // venue-specific event card selectors
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

        const DATE_SELS = [
          'time','[datetime]','[class*="date"]','[class*="when"]',
          '[class*="dag"]','[class*="datum"]','[class*="day"]','[class*="period"]',
        ].join(',');

        // Helper: pull the best date text from a scoped Cheerio set.
        function findDateIn($scope) {
          const dtAttr = $scope.find('[datetime]').first().attr('datetime')
            || $scope.find('time').first().attr('datetime') || '';
          const dtTxt  = clean($scope.find(DATE_SELS).first().text());
          return dtAttr || dtTxt || null;
        }

        // Global slug pattern + venue-specific linkPattern used in deep-link filter below
        const GLOBAL_SLUG_RE = /\/event|\/agenda|\/concert|\/show|\/spectacle|\/programme|\/detail|\/tickets|\/activit|\/productie|\/production|\/voorstelling|\/soiree|\/night|\/party|\/project|\/reservation/i;

        let skipNoDate = 0, skipNoLink = 0, skipHomepage = 0, skipBadTitle = 0;
        candidates.each((i, el) => {
          if (i >= 50) return;
          const $el = $(el);

          // Capture heading element explicitly — used for both title and date proximity.
          const headingEl = $el.find([
            'h1','h2','h3','h4','h5','strong',
            '[class*="title"]','[class*="name"]','[class*="artist"]','[class*="heading"]',
          ].join(',')).first();
          const title = clean(headingEl.text());
          if (!isValidTitle(title)) { skipBadTitle++; return; }

          // ── Date anchoring (strict — no raw text fallback) ──
          const headingParent      = headingEl.parent();
          const headingGrandparent = headingParent.parent();
          const dateText =
            findDateIn(headingParent)      ||
            findDateIn(headingGrandparent) ||
            findDateIn($el)                || '';

          if (!dateText) { skipNoDate++; return; }

          const rawDate = parseRawDate(dateText);
          if (!rawDate) { skipNoDate++; return; }
          const relDate = toRelativeDate(rawDate);
          if (!relDate) { skipNoDate++; return; }

          console.log(`    ${config.id}: "${title.slice(0,35)}" | date: "${dateText.slice(0,30)}" → ${rawDate}`);

          const timeText = clean($el.find('[class*="time"],[class*="hour"],[class*="uur"]').first().text());
          const desc     = clean($el.find('p,[class*="desc"],[class*="intro"],[class*="summary"]').first().text());

          // ── Deep-link (strict — no generic first-anchor fallback) ──
          // Tier 1: anchor wrapping or inside the heading element.
          // Tier 2: slug-keyword anchor (global pattern + venue's linkPattern if set).
          const headingAnchor =
            headingEl.find('a').first().attr('href') ||
            headingEl.closest('a').attr('href') ||
            $el.find([
              'h1 a','h2 a','h3 a','h4 a','h5 a',
              '[class*="title"] a','[class*="name"] a','[class*="artist"] a',
            ].join(',')).first().attr('href');
          const slugAnchor = $el.find('a[href]').filter((_, a) => {
            const href = $(a).attr('href') || '';
            return GLOBAL_SLUG_RE.test(href) || (config.linkPattern && config.linkPattern.test(href));
          }).first().attr('href');
          const rawLink = headingAnchor || slugAnchor || '';
          if (!rawLink) { skipNoLink++; return; }
          const url = rawLink.startsWith('http') ? rawLink
            : rawLink.startsWith('/') ? `${baseOrigin}${rawLink}` : '';
          const urlPath = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
          if (!url || urlPath.length < 5) { skipHomepage++; return; }

          const cls = classifyForVenue(title+' '+desc, config);
          const smart = smartDefaultTime(cls.cat);
          const { time, startH, endH } = parseTime(timeText, smart.time);
          // Detect offsite/outdoor location for ALL venues (not just C12/Fuse)
          const externalVenueHint = detectExternalVenue(title+' '+desc);

          events.push({ _rawDate:rawDate, title, venue:config.name, addr:config.addr,
            date:refineDateLabel(relDate, startH), time, startH, endH,
            emoji:cls.emoji, color:cls.color, cat:cls.cat, tags:cls.tags,
            source:config.name, officialEventLink:url,
            desc:desc||`${title} at ${config.name}.`,
            neighbourhood:config.neighbourhood, lat:config.lat, lng:config.lng,
            ...(externalVenueHint ? { externalVenueHint } : {}) });
        });

        // ── Skip-reason breakdown for debugging strict filter rejections ──
        const totalSkipped = skipNoDate + skipNoLink + skipHomepage + skipBadTitle;
        if (totalSkipped > 0 || events.length === 0) {
          console.log(`    Skipped ${config.name}: ${skipBadTitle} bad-title | ${skipNoDate} no-date-element | ${skipNoLink} no-deep-link | ${skipHomepage} homepage-URL | ${events.length} accepted`);
        }
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

  // Purge events with known bad dates. Three patterns to catch:
  // 1. "YYYY-06-18" in any year — the specific broken placeholder from the bad parse era
  // 2. Any _rawDate with year >= 2027 — year inference overcorrection: when a venue
  //    scrapes "Fri 15 May" after May 15 has passed, the year is bumped to the following
  //    year (2027), which is wrong; these are stale artefacts, never real future events
  // 3. Events with no _rawDate at all are safe to keep (removeExpired handles them)
  const prePurge = existing.length;
  existing = existing.filter(e => {
    if (!e._rawDate) return true;
    const raw = String(e._rawDate);
    if (raw.match(/-06-18$/)) return false;           // June 18 any year
    if (parseInt(raw.slice(0, 4), 10) >= 2027) return false; // 2027+ overcorrection
    return true;
  });
  const purged = prePurge - existing.length;
  if (purged) console.log(`🧹  Purged ${purged} event(s) with bad dates (June-18 placeholder or 2027+ year-inference artefact)`);

  // Purge events from known-bad test venues (visitBrusselsScraper.js test runs).
  // These were never production-quality — wipe them so the Gen-Z venues can start clean.
  const BAD_VENUES = [
    'atelier marcel hastir', 'toots jazz club',
    'théâtre royal des galeries', 'theatre royal des galeries',
    'cloud seven', 'l\'archiduc', 'archiduc',
    'vedovi gallery', 'blast gallery', 'encore',
  ];
  const preVenuePurge = existing.length;
  existing = existing.filter(e => {
    const fields = [e.venue || '', e.source || '', e.addr || '', e.title || '']
      .join(' ').toLowerCase();
    return !BAD_VENUES.some(b => fields.includes(b));
  });
  const purgedVenues = preVenuePurge - existing.length;
  if (purgedVenues) console.log(`🗑️   Purged ${purgedVenues} event(s) from bad test venues`);

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

  // Production-reset migration: strip simulated social fields from all stored
  // events. The app no longer renders fake attendees, chat seeds, or invented
  // friend/going counts — real data only.
  let socialStripped = 0;
  existing = existing.map(e => {
    if ('attendees' in e || 'chatSeed' in e || 'friends' in e || 'going' in e || 'attendeeCount' in e) {
      const { attendees: _a, chatSeed: _c, friends: _f, going: _g, attendeeCount: _ac, ...rest } = e;
      socialStripped++;
      return rest;
    }
    return e;
  });
  if (socialStripped) console.log(`🧼  Stripped simulated social fields from ${socialStripped} event(s)`);

  // Re-clean ALL stored descriptions on every run — fixes historical events that
  // were saved with raw HTML entities ('&lt;p&gt;', '[&hellip;]', literal '\n')
  // before the description cleaning module existed.
  let descsFixed = 0;
  existing = existing.map(e => {
    const cleaned = cleanDesc(e.desc);
    if (cleaned !== e.desc) { descsFixed++; return { ...e, desc: cleaned }; }
    return e;
  });
  if (descsFixed) console.log(`📝  Re-cleaned ${descsFixed} stored description(s) (HTML entities/tags stripped)`);

  // Refresh date labels from _rawDate — prevents stale 'Tonight'/'Ongoing' labels
  let relabelled = 0;
  existing = existing.map(e => {
    if (!e._rawDate) return e;
    const fresh = toRelativeDate(e._rawDate, e._endDate || null);
    if (!fresh) return null;           // past — will be removed below
    const refined = refineDateLabel(fresh, e.startH);
    if (refined !== e.date) { relabelled++; return { ...e, date: refined }; }
    return e;
  }).filter(Boolean);
  if (relabelled) console.log(`📅  Refreshed ${relabelled} stale date label(s)`);

  // Rebrand generic 🌍 festival emoji → vibrant 🎉 (UI branding pass)
  let emojiRebrand = 0;
  existing = existing.map(e => {
    if (e.emoji === '🌍') { emojiRebrand++; return { ...e, emoji: '🎉' }; }
    return e;
  });
  if (emojiRebrand) console.log(`🎉  Rebranded ${emojiRebrand} generic festival emoji(s) → 🎉`);

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

  // Retroactively snap landmark/green-space events onto their exact coords.
  // Fixes historical rows geocoded to random Brussels-centre scatter (e.g.
  // "Bois de la Cambre" events pinned near Bassin Vergote). Runs on every event
  // regardless of source — a venue/addr/desc landmark match always wins.
  let landmarkFixes = 0;
  existing = existing.map(e => {
    const lm = landmarkCoords(`${e.venue || ''} ${e.addr || ''} ${e.desc || ''}`);
    if (lm && (Math.abs((e.lat || 0) - lm.lat) > 0.0005 || Math.abs((e.lng || 0) - lm.lng) > 0.0005)) {
      landmarkFixes++;
      return { ...e, lat: lm.lat, lng: lm.lng, addr: lm.addr };
    }
    return e;
  });
  if (landmarkFixes) console.log(`🌳  Snapped ${landmarkFixes} event(s) onto landmark coordinates`);

  // Retroactively enforce correct emoji/color/cat for all known venues
  const VENUE_VISUAL_MAP = {
    'ancienne belgique': { emoji: '🎸', color: '#C77DFF', cat: 'Music'     },
    'le botanique':      { emoji: '🎸', color: '#B8E5C0', cat: 'Music'     },
    'fuse':              { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'c12':               { emoji: '💃', color: '#6C63FF', cat: 'Nightlife' },
    'la madeleine':      { emoji: '🎸', color: '#8E7DBE', cat: 'Music'     },
    'bozar':             { emoji: '🏛️', color: '#E76F51', cat: 'Culture'   },
    'agenda brussels':   { emoji: '🏛️', color: '#E76F51', cat: 'Culture'   },
    'couleur café':           { emoji: '🎸', color: '#F4A261', cat: 'Festival'  },
    'couleur cafe':           { emoji: '🎸', color: '#F4A261', cat: 'Festival'  },
    // Gen-Z venues
    'umi':                    { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'signal club':            { emoji: '⚡', color: '#6C63FF', cat: 'Nightlife' },
    'buda bxl':               { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'madame moustache':       { emoji: '🎸', color: '#C77DFF', cat: 'Music'     },
    'beursschouwburg':        { emoji: '🎭', color: '#F4A261', cat: 'Culture'   },
    'magasin 4':              { emoji: '🎸', color: '#C77DFF', cat: 'Music'     },
    'la machine':             { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'kanal':                  { emoji: '🎨', color: '#F4A261', cat: 'Culture'   },
    'quai 20':                { emoji: '⚡', color: '#6C63FF', cat: 'Nightlife' },
    'kaaitheater':            { emoji: '🎭', color: '#E76F51', cat: 'Culture'   },
    // New Gen-Z venues (visitBrussels dataset)
    'flash club':             { emoji: '⚡', color: '#FF6B9D', cat: 'Nightlife' },
    'birdy brussels':         { emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife' },
    'sett club':              { emoji: '⚡', color: '#6C63FF', cat: 'Nightlife' },
    'kvs':                    { emoji: '🎭', color: '#E76F51', cat: 'Culture'   },
    "jeux d'hiver":           { emoji: '🌿', color: '#F4A261', cat: 'Nightlife' },
    // Open-air venues
    'circle park':            { emoji: '🌿', color: '#F4A261', cat: 'Festival'  },
    'brasserie illegaal':     { emoji: '🌿', color: '#B8E5C0', cat: 'Festival'  },
    'brussels open air':      { emoji: '🌿', color: '#F4A261', cat: 'Festival'  },
    'lavallée':               { emoji: '🏭', color: '#6C63FF', cat: 'Nightlife' },
    'lavallee':               { emoji: '🏭', color: '#6C63FF', cat: 'Nightlife' },
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

  const CONCURRENCY = 4; // open 4 pages in parallel — safe on GH Actions (7 GB RAM)

  // Hard per-venue timeout: one stalled page can't freeze its whole batch
  async function scrapeVenueWithTimeout(config) {
    return Promise.race([
      scrapeVenue(browser, config),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Venue timed out after 60 s')), 60000)
      ),
    ]);
  }

  const results = [];
  let raw = [];
  try {
    for (let i = 0; i < VENUE_CONFIGS.length; i += CONCURRENCY) {
      const batch = VENUE_CONFIGS.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      const totalBatches = Math.ceil(VENUE_CONFIGS.length / CONCURRENCY);
      console.log(`\n⚡  Batch ${batchNum}/${totalBatches}: ${batch.map(c => c.name).join(' · ')}`);

      const settled = await Promise.allSettled(batch.map(c => scrapeVenueWithTimeout(c)));

      // Graceful fail-catch: a venue that times out or errors (e.g. a promoter
      // domain blocking requests) is logged with its name + reason, dropped
      // cleanly, and the queue advances to the next registry target. One dead
      // site can never halt the run — the batch settles regardless.
      for (let j = 0; j < settled.length; j++) {
        const r = settled[j];
        const config = batch[j];
        if (r.status === 'fulfilled') {
          results.push({ name: config.name, emoji: config.emoji, count: r.value.length });
          raw = [...raw, ...r.value];
        } else {
          const reason = r.reason?.message || 'unknown error';
          results.push({ name: config.name, emoji: config.emoji, count: 0, err: reason });
          console.warn(`  ⚠️  [${config.name}] failed: ${reason} — target dropped, advancing to next registry entry`);
        }
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
    // Single choke point: every incoming description is decoded + stripped here,
    // regardless of which strategy produced it.
    r.desc = cleanDesc(r.desc) || `${r.title} at ${r.venue}.`;

    if (smartMerge(existing, r)) continue;

    // Landmark override FIRST — scan venue + addr + desc for a known green
    // space/public site and anchor directly, before any API geocoding. This is
    // what fixes "Bois de la Cambre : Carrefour des Attelages" being flung to
    // Bassin Vergote: the landmark match wins and the messy sub-location string
    // never reaches Nominatim.
    const landmark = landmarkCoords(`${r.venue || ''} ${r.addr || ''} ${r.externalVenueHint || ''} ${r.desc || ''}`);
    if (landmark) {
      r.lat = landmark.lat; r.lng = landmark.lng; r.addr = landmark.addr;
      console.log(`  🌳  Landmark override: "${r.title.slice(0,34)}" → ${landmark.addr.split(',')[0]} (${r.lat}, ${r.lng})`);
    } else if (r.externalVenueHint) {
      process.stdout.write(`  🗺️  External venue "${r.externalVenueHint}"… `);
      const coords = await geocode(r.externalVenueHint);
      r.lat = coords.lat; r.lng = coords.lng; r.addr = r.externalVenueHint;
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}${coords.fallback ? ' (centre fallback)' : ''}`);
      if (!coords.landmark) await sleep(GEOCODE_DELAY);
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
      console.log(`${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}${coords.fallback ? ' (centre fallback)' : ''}`);
      if (!coords.landmark) await sleep(GEOCODE_DELAY);
    }

    existing.push({
      id:idCounter++, cat:r.cat, date:r.date, title:r.title, venue:r.venue, addr:r.addr,
      time:r.time, startH:r.startH, endH:r.endH,
      emoji:r.emoji, color:r.color, tags:r.tags,
      source:r.source, officialEventLink:r.officialEventLink||'',
      lat:r.lat, lng:r.lng,
      neighbourhood:r.neighbourhood, desc:r.desc,
      _rawDate:r._rawDate,
      ...(r._endDate ? { _endDate: r._endDate } : {}),
      ...(r.status ? { status: r.status } : {}),
      ...(r.image ? { image: r.image } : {}),
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
