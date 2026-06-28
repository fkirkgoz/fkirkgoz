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

  // ── Gen-Z / underground Brussels venues ──────────────────────────────────────
  // BLACKLIST: AB, Botanique, Fuse, C12, La Madeleine, Bozar already covered above.
  // Coords are hardcoded from the official visitBrussels dataset — geocoder is NEVER called for these.
  {
    id: 'umi',
    name: 'UMI',
    addr: 'Rue du Marché aux Fromages 10, 1000 Brussels',
    lat: 50.8459, lng: 4.3531,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Electronic', 'Underground', 'Art'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://umibrussels.art/events',
      'https://umibrussels.art/agenda',
      'https://umibrussels.art/',
    ],
  },
  {
    id: 'signalClub',
    name: 'Signal Club',
    addr: 'Rue de la Fourche 49, 1000 Brussels',
    lat: 50.8487, lng: 4.3536,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Electronic', 'Underground', 'Dark'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.darkdistortedsignals.com/events',
      'https://www.darkdistortedsignals.com/agenda',
      'https://www.darkdistortedsignals.com/',
    ],
  },
  {
    id: 'budaBxl',
    name: 'BUDA BXL',
    addr: 'Digue du Canal 98A, 1130 Brussels',
    lat: 50.9078, lng: 4.4112,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Laeken',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Club', 'Live Music', 'Nightlife'],
    defaultTime: '22:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.budabxl.be/agenda',
      'https://www.budabxl.be/events',
      'https://www.budabxl.be',
    ],
  },
  {
    id: 'madameMoustache',
    name: 'Madame Moustache',
    addr: 'Quai au Bois à Brûler 5-7, 1000 Brussels',
    lat: 50.8514, lng: 4.3489,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Live Music', 'Club', 'Nightlife'],
    defaultTime: '21:00',
    enforceVisuals: true,
    urls: [
      'https://madamemoustache.be/agenda',
      'https://madamemoustache.be/events',
      'https://madamemoustache.be/',
    ],
  },
  {
    id: 'beursschouwburg',
    name: 'Beursschouwburg',
    addr: 'Rue Auguste Orts 20-28, 1000 Brussels',
    lat: 50.8486, lng: 4.3483,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '🎭', color: '#F4A261', cat: 'Culture',
    tags: ['Alt Culture', 'Indie', 'Arts'],
    defaultTime: '20:00',
    enforceVisuals: true,
    urls: [
      'https://www.beursschouwburg.be/en/agenda',
      'https://www.beursschouwburg.be/fr/agenda',
      'https://www.beursschouwburg.be/nl/agenda',
      'https://www.beursschouwburg.be',
    ],
  },
  {
    id: 'magasin4',
    name: 'Magasin 4',
    addr: "Rue de l'Entrepôt 7, 1020 Brussels",
    lat: 50.8693, lng: 4.3532,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Laeken',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Punk', 'Indie', 'Alternative', 'Live Music'],
    defaultTime: '20:00',
    enforceVisuals: true,
    urls: [
      'https://www.magasin4.be/agenda',
      'https://www.magasin4.be/concerts',
      'https://www.magasin4.be',
    ],
  },
  {
    id: 'laMachine',
    name: 'La Machine',
    addr: 'Place Saint-Géry 2, 1000 Brussels',
    lat: 50.8483, lng: 4.3473,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Underground', 'Club', 'Live Music'],
    defaultTime: '22:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.lamachine.be/agenda',
      'https://www.lamachine.be/events',
      'https://www.lamachine.be',
    ],
  },
  {
    id: 'kanal',
    name: 'KANAL - Centre Pompidou',
    addr: 'Avenue du Port 1, 1000 Brussels',
    lat: 50.8604, lng: 4.3469,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Molenbeek',
    emoji: '🎨', color: '#F4A261', cat: 'Culture',
    tags: ['Art', 'Culture', 'Events'],
    defaultTime: '19:00',
    enforceVisuals: true,
    urls: [
      'https://www.kanal.brussels/en/agenda',
      'https://www.kanal.brussels/fr/agenda',
      'https://www.kanal.brussels',
    ],
  },
  {
    id: 'quai20',
    name: 'Quai 20',
    addr: 'Quai des Usines 20, 1000 Brussels',
    lat: 50.8749, lng: 4.3638,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Laeken',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Nightclub', 'Clubbing', 'Electronic'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://quai20.be/events',
      'https://quai20.be/agenda',
      'https://quai20.be/',
    ],
  },
  {
    id: 'kaaitheater',
    name: 'Kaaitheater',
    addr: 'Square Sainctelette 20, 1000 Brussels',
    lat: 50.8588, lng: 4.3475,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Molenbeek',
    emoji: '🎭', color: '#E76F51', cat: 'Culture',
    tags: ['Performing Arts', 'Experimental', 'Theatre'],
    defaultTime: '20:00',
    enforceVisuals: true,
    urls: [
      'https://www.kaaitheater.be/en/agenda',
      'https://www.kaaitheater.be/nl/agenda',
      'https://www.kaaitheater.be',
    ],
  },

  // ── New unique Gen-Z picks from visitBrussels dataset (not in blacklist) ──────
  {
    id: 'flashClub',
    name: 'Flash Club',
    addr: 'Rue Duquesnoy 18, 1000 Brussels',
    lat: 50.8448, lng: 4.3540,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#FF6B9D', cat: 'Nightlife',
    tags: ['Club', 'Electronic', 'Nightlife'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.flashclub.be/agenda',
      'https://www.flashclub.be/events',
      'https://www.flashclub.be',
    ],
  },
  {
    id: 'birdy',
    name: 'BIRDY Brussels',
    addr: 'Boulevard de Waterloo 38, 1000 Brussels',
    lat: 50.8325, lng: 4.3581,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Louise',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Club', 'Underground', 'Electronic'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.birdybrussels.com/events',
      'https://www.birdybrussels.com/agenda',
      'https://www.birdybrussels.com',
    ],
  },
  {
    id: 'settClub',
    name: 'Sett Club',
    addr: 'Avenue du Port 86c, 1000 Brussels',
    lat: 50.8657, lng: 4.3509,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Molenbeek',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Club', 'Electronic', 'Underground'],
    defaultTime: '23:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://sett.be/agenda',
      'https://sett.be/events',
      'https://sett.be',
    ],
  },
  {
    id: 'kvs',
    name: 'KVS',
    addr: 'Quai aux Pierres de Taille 7, 1000 Brussels',
    lat: 50.8552, lng: 4.3512,   // HARDCODED — visitBrussels dataset
    neighbourhood: 'Centre',
    emoji: '🎭', color: '#E76F51', cat: 'Culture',
    tags: ['Theatre', 'Performing Arts', 'Contemporary'],
    defaultTime: '20:00',
    enforceVisuals: true,
    urls: [
      'https://www.kvs.be/en/agenda',
      'https://www.kvs.be/fr/agenda',
      'https://www.kvs.be',
    ],
  },
  {
    id: 'jeuxDhiver',
    name: "Jeux d'Hiver",
    addr: 'Chemin du Croquet 1, 1000 Brussels',
    lat: 50.8115, lng: 4.3730,   // HARDCODED — visitBrussels dataset (Bois de la Cambre)
    neighbourhood: 'Ixelles',
    emoji: '🌿', color: '#F4A261', cat: 'Nightlife',
    tags: ['Club', 'Open Air', 'Electronic'],
    defaultTime: '22:00',
    jsHeavy: true,
    enforceVisuals: true,
    urls: [
      'https://www.jeuxdhiver.be/agenda',
      'https://www.jeuxdhiver.be/events',
      'https://www.jeuxdhiver.be',
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
            if (events.length >= 30) break; // cap to prevent city-wide bloat
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

      // ── Strategy 1.7: jsHeavy live DOM scrape via page.evaluate() ──
      // For React/Vue SPAs: Cheerio only sees the pre-JS static shell, so CSS selectors
      // find nothing. page.evaluate() runs inside the browser context where JS has already
      // rendered the real DOM, giving us real event cards.
      if (config.jsHeavy && events.length === 0) {
        try {
          console.log(`    Strategy 1.7 (jsHeavy live DOM): waiting for deferred renders…`);
          await sleep(1000);

          const liveCards = await page.evaluate(() => {
            function hasDates(text) {
              return /\d{1,2}[\s\/.\-]\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i.test(text);
            }

            // Try progressively broader selectors; keep the largest matching set
            const SELECTORS = [
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
          });

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

        candidates.each((i, el) => {
          if (i >= 50) return;
          const $el = $(el);

          // Capture heading element explicitly — used for both title and date proximity.
          const headingEl = $el.find([
            'h1','h2','h3','h4','h5','strong',
            '[class*="title"]','[class*="name"]','[class*="artist"]','[class*="heading"]',
          ].join(',')).first();
          const title = clean(headingEl.text());
          if (!isValidTitle(title)) return;

          // ── Date anchoring (strict — no raw text fallback) ──
          // Only accept a date from a structured element (time, [datetime], [class*="date"],
          // etc.) within the card's DOM tree. If none found, discard the event entirely —
          // the raw text scan is gone because it caused cross-card date pairing.
          const headingParent      = headingEl.parent();
          const headingGrandparent = headingParent.parent();
          const dateText =
            findDateIn(headingParent)      ||
            findDateIn(headingGrandparent) ||
            findDateIn($el)                || '';

          if (!dateText) {
            console.log(`    ${config.id}: "${title.slice(0,35)}" — no structured date element, discarded`);
            return;
          }
          console.log(`    ${config.id}: "${title.slice(0,35)}" | date: "${dateText.slice(0,35)}"`);

          const rawDate = parseRawDate(dateText);
          if (!rawDate) { console.log(`      → date not parsed`); return; }
          const relDate = toRelativeDate(rawDate);
          if (!relDate) return;

          const timeText = clean($el.find('[class*="time"],[class*="hour"],[class*="uur"]').first().text());
          const desc     = clean($el.find('p,[class*="desc"],[class*="intro"],[class*="summary"]').first().text());

          // ── Deep-link (strict — no generic first-anchor fallback) ──
          // Tier 1: anchor wrapping or inside the heading element.
          // Tier 2: any <a> with an event-slug path segment.
          // If neither tier yields a link, discard — a homepage URL is not a deep-link.
          const headingAnchor =
            headingEl.find('a').first().attr('href') ||
            headingEl.closest('a').attr('href') ||
            $el.find([
              'h1 a','h2 a','h3 a','h4 a','h5 a',
              '[class*="title"] a','[class*="name"] a','[class*="artist"] a',
            ].join(',')).first().attr('href');
          const slugAnchor = $el.find('a[href]').filter((_, a) =>
            /\/event|\/agenda|\/concert|\/show|\/spectacle|\/programme|\/detail|\/tickets|\/activit/i
              .test($(a).attr('href') || '')
          ).first().attr('href');
          const rawLink = headingAnchor || slugAnchor || '';
          if (!rawLink) { console.log(`      → no event deep-link found, discarded`); return; }
          const url = rawLink.startsWith('http') ? rawLink
            : rawLink.startsWith('/') ? `${baseOrigin}${rawLink}` : '';
          // Reject bare homepage roots (path is empty or just '/')
          const urlPath = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '');
          if (!url || urlPath.length < 5) {
            console.log(`      → homepage URL rejected (no event path), discarded`);
            return;
          }

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
    const v = (e.venue || e.source || '').toLowerCase();
    return !BAD_VENUES.some(b => v.includes(b));
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

      for (let j = 0; j < settled.length; j++) {
        const r = settled[j];
        const config = batch[j];
        if (r.status === 'fulfilled') {
          results.push({ name: config.name, emoji: config.emoji, count: r.value.length });
          raw = [...raw, ...r.value];
        } else {
          results.push({ name: config.name, emoji: config.emoji, count: 0, err: r.reason?.message });
          console.warn(`  ⚠️  ${config.name}: ${r.reason?.message}`);
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
