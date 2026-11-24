// ─────────────────────────────────────────────────────────────────────────────
// Randevu scraper venue registry
//
// Single source of truth for every scrape target. The engine (eventScraper.js)
// imports this array and routes each entry by `scrapingStrategy` — adding a new
// venue means appending ONE object here and never touching engine code.
//
// Requires Node ≥ 22.18 (native TypeScript type-stripping) — GitHub Actions
// runs Node 24. Keep this file to erasable TS syntax only (no enums).
//
// Strategies:
//   'ra_club'       Resident Advisor club page (ra.co/clubs/<id>).
//                   Parsed from RA's __NEXT_DATA__ GraphQL payload, DOM fallback.
//   'direct_url'    The venue's own website. Full pipeline: JSON-LD →
//                   venue-specific parsers → live-DOM (jsHeavy) → HTML fallback.
//   'portal_filter' A multi-venue portal feed, filtered down:
//                   · agenda.brussels search URLs → per-venue search parser
//                   · ra.co / shotgun.live regional feeds → keyword collection
//                     model (portalKeywords) for roaming open-air series
// ─────────────────────────────────────────────────────────────────────────────

export type ScrapingStrategy = 'ra_club' | 'direct_url' | 'portal_filter';

export interface ScraperVenue {
  id: string;
  name: string;
  scrapingStrategy: ScrapingStrategy;
  targetUrl: string;
  fallbackUrls?: string[];
  masterAddress: string;
  lat: number;            // exact coords — 0,0 means "geocode per event"
  lng: number;
  neighbourhood: string;
  emoji: string;
  color: string;
  cat: string;
  tags: string[];
  defaultTime: string;    // 'HH:MM' fallback when no time found on page
  jsHeavy?: boolean;      // SPA — wait for hydration + live-DOM scrape
  enforceVisuals?: boolean; // lock emoji/color/cat (skip keyword classification)
  extraWait?: number;     // extra settle ms after navigation
  waitForSelector?: string;
  eventSelector?: string;
  linkPattern?: RegExp;   // deep-link slug filter for HTML strategies
  portalKeywords?: string[]; // portal_filter feeds: case-insensitive allowlist.
                             // OMIT on ra.co/shotgun feeds to ingest the FULL
                             // regional agenda (no keyword gate).
  genericPortal?: boolean;   // agenda.brussels searches for PUBLIC events (not a
                             // single venue): each card keeps its own venue/location
                             // from the page and is classified by its own content
}

// ── Topic searches (diversity) ───────────────────────────────────────────────
interface TopicSearch {
  id: string; name: string; q: string; alt?: string;
  emoji: string; color: string; cat: string; tags: string[]; defaultTime: string;
}
const TOPIC_SEARCHES: TopicSearch[] = [
  // Wellness
  { id: 'topicYoga',       name: 'Brussels Yoga',        q: 'yoga',        alt: 'yoga+gratuit', emoji: '🧘', color: '#A6D6D6', cat: 'Wellness', tags: ['Yoga', 'Wellness', 'Lowkey'],            defaultTime: '10:00' },
  { id: 'topicPilates',    name: 'Brussels Pilates',     q: 'pilates',     alt: 'wellness',     emoji: '🤸', color: '#A6D6D6', cat: 'Wellness', tags: ['Pilates', 'Wellness', 'Lowkey'],         defaultTime: '10:00' },
  { id: 'topicMeditation', name: 'Brussels Mindfulness', q: 'meditation',  alt: 'mindfulness',  emoji: '🌿', color: '#A6D6D6', cat: 'Wellness', tags: ['Meditation', 'Wellness', 'Lowkey'],      defaultTime: '19:00' },
  // Volunteering / meaningful
  { id: 'topicVolunteer',  name: 'Brussels Volunteering', q: 'volunteer',  alt: 'benevole',     emoji: '🤝', color: '#F7CFD8', cat: 'Volunteering', tags: ['Volunteering', 'Meaningful', 'Community'], defaultTime: '10:00' },
  { id: 'topicCleanup',    name: 'Brussels Clean-ups',    q: 'clean+up',   alt: 'nettoyage',    emoji: '🧹', color: '#F7CFD8', cat: 'Volunteering', tags: ['Clean-up', 'Meaningful', 'Community'],    defaultTime: '10:00' },
  // Markets
  { id: 'topicMarkets',    name: 'Brussels Markets',      q: 'market',     alt: 'marche',       emoji: '🛍️', color: '#F4C87A', cat: 'Market', tags: ['Market', 'Outdoors'],                       defaultTime: '10:00' },
  { id: 'topicXmas',       name: 'Brussels Christmas',    q: 'christmas+market', alt: 'winter+wonders', emoji: '🎄', color: '#F4C87A', cat: 'Market', tags: ['Christmas', 'Market', 'Instagrammable'], defaultTime: '12:00' },
  { id: 'topicVintage',    name: 'Brussels Vintage',      q: 'brocante',   alt: 'vintage',      emoji: '👗', color: '#F4C87A', cat: 'Market', tags: ['Vintage', 'Market', 'Hidden Gem'],           defaultTime: '09:00' },
  // Food & drink / workshops
  { id: 'topicCooking',    name: 'Brussels Cooking',      q: 'cooking',    alt: 'atelier+cuisine', emoji: '🍳', color: '#F4C87A', cat: 'Food & Drink', tags: ['Cooking', 'Workshop', 'Social'], defaultTime: '18:30' },
  { id: 'topicTasting',    name: 'Brussels Tastings',     q: 'tasting',    alt: 'degustation',  emoji: '🍷', color: '#F4C87A', cat: 'Food & Drink', tags: ['Tasting', 'Social'],                defaultTime: '19:00' },
  { id: 'topicWorkshop',   name: 'Brussels Workshops',    q: 'workshop',   alt: 'atelier',      emoji: '🎨', color: '#F4A261', cat: 'Culture', tags: ['Workshop', 'Creative', 'Social'],           defaultTime: '14:00' },
  // Sports
  { id: 'topicPadel',      name: 'Brussels Padel',        q: 'padel',      alt: 'tennis',       emoji: '🎾', color: '#90E0EF', cat: 'Sports', tags: ['Padel', 'Sports', 'Active'],                 defaultTime: '18:00' },
  { id: 'topicRunning',    name: 'Brussels Running',      q: 'running',    alt: 'course+a+pied', emoji: '🏃', color: '#90E0EF', cat: 'Sports', tags: ['Running', 'Sports', 'Active'],              defaultTime: '09:00' },
  { id: 'topicClimbing',   name: 'Brussels Climbing',     q: 'climbing',   alt: 'escalade',     emoji: '🧗', color: '#90E0EF', cat: 'Sports', tags: ['Climbing', 'Sports', 'Active'],              defaultTime: '18:00' },
  // Arts / entertainment
  { id: 'topicCinema',     name: 'Brussels Cinema',       q: 'cinema',     alt: 'film',         emoji: '🎬', color: '#6C63FF', cat: 'Arts', tags: ['Cinema', 'Film', 'Lowkey'],                    defaultTime: '20:00' },
  { id: 'topicComedy',     name: 'Brussels Comedy',       q: 'comedy',     alt: 'stand-up',     emoji: '🎭', color: '#E76F51', cat: 'Arts', tags: ['Comedy', 'Stand-up', 'Social'],               defaultTime: '20:30' },
  { id: 'topicDance',      name: 'Brussels Dance',        q: 'dance',      alt: 'danse',        emoji: '💃', color: '#F7CFD8', cat: 'Arts', tags: ['Dance', 'Performance'],                       defaultTime: '20:00' },
  // Free / budget
  { id: 'topicFreeExpo',   name: 'Brussels Free Exhibitions', q: 'free+exhibition', alt: 'exposition+gratuite', emoji: '🖼️', color: '#F4A261', cat: 'Culture', tags: ['Free', 'Exhibition', 'Budget Friendly'], defaultTime: '11:00' },
  { id: 'topicFree',       name: 'Brussels Free Events',  q: 'free+entry', alt: 'gratuit',      emoji: '🎟️', color: '#A6D6D6', cat: 'Culture', tags: ['Free', 'Budget Friendly'],                   defaultTime: '14:00' },
  // Family / community
  { id: 'topicFamily',     name: 'Brussels Family',       q: 'family',     alt: 'enfants',      emoji: '👨‍👩‍👧', color: '#F7CFD8', cat: 'Culture', tags: ['Family', 'Daytime'],                  defaultTime: '14:00' },
];

function topicEntry(t: TopicSearch): ScraperVenue {
  const base = 'https://www.agenda.brussels/en/search?q=';
  return {
    id: t.id,
    name: t.name,
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: base + t.q,
    fallbackUrls: t.alt ? [base + t.alt] : [],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: t.emoji, color: t.color, cat: t.cat, tags: t.tags,
    defaultTime: t.defaultTime,
    jsHeavy: true, enforceVisuals: true,
  };
}

export const SCRAPER_VENUES: ScraperVenue[] = [
  // ══ Core Brussels venues — own websites ══════════════════════════════════
  {
    id: 'ab',
    name: 'Ancienne Belgique',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://www.abconcerts.be/en/agenda',
    fallbackUrls: ['https://abconcerts.be/en/agenda'],
    masterAddress: 'Boulevard Anspach 110, 1000 Brussels',
    lat: 50.8483, lng: 4.3512,
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Concert', 'Live Music'],
    defaultTime: '20:00',
    extraWait: 5000,
    enforceVisuals: true,
  },
  {
    id: 'botanique',
    name: 'Le Botanique',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://botanique.be/en/agenda',
    fallbackUrls: [
      'https://botanique.be/en',
      'https://botanique.be/en/activities',
      'https://www.botanique.be/en',
      'https://botanique.be/fr/agenda',
    ],
    masterAddress: 'Rue Royale 236, 1210 Brussels',
    lat: 50.8554, lng: 4.3664,
    neighbourhood: 'Saint-Josse',
    emoji: '🎸', color: '#B8E5C0', cat: 'Music',
    tags: ['Concert', 'Indie', 'Alternative'],
    defaultTime: '20:00',
    extraWait: 7000,
    enforceVisuals: true,
  },
  {
    id: 'fuse',
    name: 'Fuse',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://fuse.be',
    fallbackUrls: ['https://www.fuse.be', 'https://fuse.be/agenda', 'https://www.fuse.be/agenda', 'https://fuse.be/en'],
    masterAddress: 'Rue Blaes 208, 1000 Brussels',
    lat: 50.8365, lng: 4.3435,
    neighbourhood: 'Marolles',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Techno', 'Electronic', 'Nightlife'],
    defaultTime: '23:00',
    extraWait: 9000,
    jsHeavy: true,
    enforceVisuals: true,
  },
  {
    id: 'c12',
    name: 'C12',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://agenda.paylogic.com/3b4e4443dd994952aaa213113e5d01a9',
    fallbackUrls: ['https://c12space.com/agenda/', 'https://c12space.com/agenda', 'https://www.c12space.com/agenda', 'https://c12space.com'],
    masterAddress: 'Rue du Marché aux Herbes 116, 1000 Brussels',
    lat: 50.8462, lng: 4.3556,
    neighbourhood: 'Centre',
    emoji: '💃', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Electronic', 'Art', 'Nightlife'],
    defaultTime: '22:00',
    extraWait: 9000,
    jsHeavy: true,
    enforceVisuals: true,
    waitForSelector: '.event-list,.event-item,.event,.agenda,[class*="event"]',
  },
  {
    id: 'laMadeleine',
    name: 'La Madeleine',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://la-madeleine.be/en/agenda',
    fallbackUrls: [
      'https://www.la-madeleine.be/en/agenda',
      'https://la-madeleine.be/agenda/',
      'https://www.la-madeleine.be/agenda/',
      'https://la-madeleine.be/agenda',
      'https://www.la-madeleine.be',
    ],
    masterAddress: 'Rue de la Madeleine 51, 1000 Brussels',
    lat: 50.8459, lng: 4.3562,
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#8E7DBE', cat: 'Music',
    tags: ['Concert', 'Live Music'],
    defaultTime: '20:00',
    extraWait: 7000,
    enforceVisuals: true,
  },
  {
    id: 'bozar',
    name: 'Bozar',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://www.bozar.be/en/calendar',
    fallbackUrls: ['https://www.bozar.be/en', 'https://bozar.be/en/calendar'],
    masterAddress: 'Rue Ravenstein 23, 1000 Brussels',
    lat: 50.8445, lng: 4.3609,
    neighbourhood: 'Centre',
    emoji: '🏛️', color: '#E76F51', cat: 'Culture',
    tags: ['Classical', 'Culture', 'Arts'],
    defaultTime: '20:00',
    extraWait: 5000,
  },
  {
    id: 'agendaBrussels',
    name: 'Agenda Brussels',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://www.agenda.brussels/en',
    fallbackUrls: ['https://agenda.brussels/en', 'https://www.agenda.brussels/en/agenda', 'https://www.agenda.brussels/en/events'],
    masterAddress: 'Brussels, Belgium',
    lat: 50.8503, lng: 4.3517,
    neighbourhood: 'Centre',
    emoji: '🏛️', color: '#E76F51', cat: 'Culture',
    tags: ['Culture', 'Brussels'],
    defaultTime: '10:00',
    extraWait: 5000,
    // No enforceVisuals — each event classified by its own content
  },
  {
    id: 'couleurCafe',
    name: 'Couleur Café',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://www.couleurcafe.be',
    fallbackUrls: ['https://couleurcafe.be', 'https://www.couleurcafe.be/programme', 'https://couleurcafe.be/programme'],
    masterAddress: 'Ossegempark, 1020 Laeken',
    lat: 50.8948, lng: 4.3411,
    neighbourhood: 'Laeken',
    emoji: '🎸', color: '#F4A261', cat: 'Festival',
    tags: ['World Music', 'Hip Hop', 'Festival'],
    defaultTime: '14:00',
    extraWait: 6000,
    enforceVisuals: true,
  },

  // ══ Open-air & industrial electronic hubs ════════════════════════════════
  {
    id: 'circleparkRa',
    name: 'Circle Park',
    scrapingStrategy: 'ra_club',
    targetUrl: 'https://ra.co/clubs/189275',
    masterAddress: 'Rue de Liverpool 2, 1070 Anderlecht, Brussels',
    lat: 50.8348, lng: 4.3010,
    neighbourhood: 'Anderlecht',
    emoji: '🌿', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Electronic', 'Day Party', 'Festival'],
    defaultTime: '14:00',
    jsHeavy: true, enforceVisuals: true,
    extraWait: 8000,
  },
  {
    id: 'lavallee',
    name: 'LaVallée',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://lavallee.brussels/events/',
    fallbackUrls: ['https://lavallee.brussels/events', 'https://lavallee.brussels/agenda', 'https://lavallee.brussels'],
    masterAddress: 'Rue Adolphe Lavallée 39, 1080 Molenbeek, Brussels',
    lat: 50.8568, lng: 4.3390,
    neighbourhood: 'Molenbeek',
    emoji: '🏭', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Open Air', 'Industrial', 'Electronic', 'Art'],
    defaultTime: '15:00',
    jsHeavy: true, enforceVisuals: true,
    linkPattern: /\/event\/|\/events\/|\/agenda\//i,
  },
  {
    id: 'brasserieIllegaal',
    name: 'Brasserie ILLEGAAL',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://brasserie-illegaal.com/all-events/list/',
    fallbackUrls: [
      'https://www.brasserie-illegaal.com/all-events/list/',
      'https://brasserie-illegaal.com/all-events/',
      'https://brasserie-illegaal.com',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 50.8503, lng: 4.3517,
    neighbourhood: 'Various',
    emoji: '🌿', color: '#B8E5C0', cat: 'Festival',
    tags: ['Open Air', 'Electronic', 'Day Party', 'Festival'],
    defaultTime: '14:00',
    jsHeavy: true, enforceVisuals: true,
    waitForSelector: '.tribe-events-list, article.type-tribe_events, .tribe-event, .tribe-events, [class*="tribe"]',
    eventSelector: 'article.type-tribe_events, .tribe-event, [class*="tribe-events-list-event"], article',
    linkPattern: /\/event\/|\/events\/|\/tribe_events\//i,
  },
  {
    // Hangar — direct scrape of their upcoming-events page (Strategy 1.6h in the
    // engine handles this venue's specific layout). Hangar's open airs roam
    // (Atomium, Beach, Royal Palace) so location resolves per event via the
    // landmark overrides / geocoder — hence lat/lng 0.
    id: 'hangar',
    name: 'Hangar',
    scrapingStrategy: 'direct_url',
    targetUrl: 'https://thehangar.be/upcoming-events/',
    fallbackUrls: [
      'https://thehangar.be/upcoming-events',
      'https://www.thehangar.be/upcoming-events/',
      'https://thehangar.be/events/',
      'https://thehangar.be',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎉', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Electronic', 'Festival', 'Day Party'],
    defaultTime: '14:00',
    jsHeavy: true, enforceVisuals: true,
    waitForSelector: '.elementor-post__card, .elementor-post, [class*="event"], article, [class*="card"]',
    eventSelector: '.elementor-post__card, .elementor-post, article, [class*="event-item"], [class*="event-card"], [class*="EventCard"], li[class*="event"]',
    linkPattern: /\/event\/|\/events\/|\/tickets?\/|\/e\/|shotgun|dice\.fm|ticket/i,
  },

  // ══ Regional portal feeds — collection model ═════════════════════════════
  // RA master regional agenda: NO portalKeywords = the FULL feed is ingested,
  // every structural row (title / date / /events/XXXXXX deep-link / venue
  // metadata). Known venues (Circle Park…) match the registry; roaming series
  // (Hangar, Piknic Electronik, Play Label…) resolve to their real sites
  // (Atomium, Place Poelaert, Place du Congrès…) via the engine's
  // external-venue detector + geocoder — never the promoter's admin address.
  {
    id: 'raBrusselsPortal',
    name: 'Resident Advisor Brussels',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://ra.co/events/be/brussels',
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Electronic', 'Club', 'Brussels'],
    defaultTime: '23:00',
    jsHeavy: true,
    extraWait: 8000,
    // no portalKeywords → unified full-agenda capture
  },
  {
    id: 'shotgunBrussels',
    name: 'Shotgun Brussels',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://shotgun.live/en/cities/brussels/techno',
    fallbackUrls: ['https://shotgun.live/en/cities/brussels'],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🌿', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Electronic', 'Festival'],
    defaultTime: '14:00',
    jsHeavy: true,
    extraWait: 8000,
    portalKeywords: [
      'open air', 'open-air', 'openair', 'festival', 'day party', 'day-party',
      'rooftop', 'garden session', 'day-to-night',
      'hangar', 'piknic electronik', 'piknic',
      'xrds', 'fuse open air',
      'play label',
    ],
  },

  // ══ Public open-airs & national events — agenda.brussels wide net ════════
  // genericPortal: each result card keeps ITS OWN venue/location from the page
  // (Cinquantenaire Park, Grand-Place, Bois de la Cambre…) and is classified by
  // its own content — these are NOT tied to any single venue. Catches major
  // city events: National Day (July 21) concerts, drone shows & fireworks,
  // municipal open-airs, park parties, free public festivals.
  {
    id: 'agendaOpenAir',
    name: 'Brussels Open Air',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=open+air',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=openluchtfestival',
      'https://www.agenda.brussels/en/search?q=plein+air',
      'https://www.agenda.brussels/en/search?q=park',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🌿', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Festival', 'Brussels'],
    defaultTime: '14:00',
    jsHeavy: true,
  },
  {
    id: 'agendaFestivals',
    name: 'Brussels Festivals',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=festival',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=concert+gratuit',
      'https://www.agenda.brussels/en/search?q=free+concert',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎉', color: '#F4A261', cat: 'Festival',
    tags: ['Festival', 'Music', 'Brussels'],
    defaultTime: '14:00',
    jsHeavy: true,
  },
  // ── Belgian National Day (July 21) — one entry per distinct query ──────────
  // The engine loads the first URL that renders and STOPS, so fallbackUrls are
  // only tried on failure. To actually collect from several searches we give
  // each query its own registry entry — all genericPortal, so each card keeps
  // its own venue/location (Cinquantenaire, Parc de Bruxelles, Mont des Arts…),
  // resolved by the landmark overrides in the engine.
  {
    id: 'agendaNationalDay',
    name: 'Belgian National Day',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=national+day',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=21+july',
      'https://www.agenda.brussels/en/search?q=f%C3%AAte+nationale',
      'https://www.agenda.brussels/en/search?q=21+juillet',
      'https://www.agenda.brussels/en/search?q=nationale+feestdag',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎆', color: '#F4A261', cat: 'Festival',
    tags: ['National Day', 'Festival', 'Free', 'Brussels'],
    defaultTime: '12:00',
    jsHeavy: true,
  },
  {
    id: 'agenda21Juillet',
    name: '21 Juillet Celebrations',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=21+juillet',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=f%C3%AAte+nationale',
      'https://www.agenda.brussels/en/search?q=nationale+feestdag',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎆', color: '#F4A261', cat: 'Festival',
    tags: ['National Day', 'Festival', 'Free', 'Brussels'],
    defaultTime: '12:00',
    jsHeavy: true,
  },
  {
    id: 'agendaCinquantenaire',
    name: 'Cinquantenaire Events',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=Cinquantenaire',
    fallbackUrls: ['https://www.agenda.brussels/en/search?q=Jubelpark'],
    masterAddress: 'Parc du Cinquantenaire, 1000 Brussels',
    lat: 50.8417, lng: 4.3889,
    neighbourhood: 'Etterbeek',
    emoji: '🎆', color: '#F4A261', cat: 'Festival',
    tags: ['National Day', 'Open Air', 'Free', 'Brussels'],
    defaultTime: '12:00',
    jsHeavy: true,
  },
  {
    id: 'agendaFireworks',
    name: 'Brussels Fireworks & Shows',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=fireworks',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=feu+d%27artifice',
      'https://www.agenda.brussels/en/search?q=drone+show',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎆', color: '#F4A261', cat: 'Festival',
    tags: ['Fireworks', 'National Day', 'Free', 'Brussels'],
    defaultTime: '22:00',
    jsHeavy: true,
  },
  {
    id: 'agendaParkParties',
    name: 'Brussels Park Events',
    scrapingStrategy: 'portal_filter',
    genericPortal: true,
    targetUrl: 'https://www.agenda.brussels/en/search?q=bal+national',
    fallbackUrls: [
      'https://www.agenda.brussels/en/search?q=f%C3%AAte+au+parc',
      'https://www.agenda.brussels/en/search?q=parc+concert',
    ],
    masterAddress: 'Brussels, Belgium',
    lat: 0, lng: 0,
    neighbourhood: 'Various',
    emoji: '🎉', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Festival', 'Free', 'Brussels'],
    defaultTime: '14:00',
    jsHeavy: true,
  },

  // ══ Gen-Z venues — collected via agenda.brussels per-venue search ════════
  {
    id: 'umi',
    name: 'UMI',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=UMI',
    fallbackUrls: ['https://agenda.brussels/en/search?q=UMI'],
    masterAddress: 'Rue du Marché aux Fromages 10, 1000 Brussels',
    lat: 50.8459, lng: 4.3531,
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Electronic', 'Underground', 'Art'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'signalClub',
    name: 'Signal Club',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Signal+Club',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Signal+Club'],
    masterAddress: 'Rue de la Fourche 49, 1000 Brussels',
    lat: 50.8487, lng: 4.3536,
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Electronic', 'Underground', 'Dark'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'budaBxl',
    name: 'BUDA BXL',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=BUDA+BXL',
    fallbackUrls: ['https://www.agenda.brussels/en/search?q=BUDA', 'https://agenda.brussels/en/search?q=BUDA+BXL'],
    masterAddress: 'Digue du Canal 98A, 1130 Brussels',
    lat: 50.9078, lng: 4.4112,
    neighbourhood: 'Laeken',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Club', 'Live Music', 'Nightlife'],
    defaultTime: '22:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'madameMoustache',
    name: 'Madame Moustache',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Madame+Moustache',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Madame+Moustache'],
    masterAddress: 'Quai au Bois à Brûler 5-7, 1000 Brussels',
    lat: 50.8514, lng: 4.3489,
    neighbourhood: 'Centre',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Live Music', 'Club', 'Nightlife'],
    defaultTime: '21:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'beursschouwburg',
    name: 'Beursschouwburg',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Beursschouwburg',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Beursschouwburg'],
    masterAddress: 'Rue Auguste Orts 20-28, 1000 Brussels',
    lat: 50.8486, lng: 4.3483,
    neighbourhood: 'Centre',
    emoji: '🎭', color: '#F4A261', cat: 'Culture',
    tags: ['Alt Culture', 'Indie', 'Arts'],
    defaultTime: '20:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'magasin4',
    name: 'Magasin 4',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Magasin+4',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Magasin+4'],
    masterAddress: "Rue de l'Entrepôt 7, 1020 Brussels",
    lat: 50.8693, lng: 4.3532,
    neighbourhood: 'Laeken',
    emoji: '🎸', color: '#C77DFF', cat: 'Music',
    tags: ['Punk', 'Indie', 'Alternative', 'Live Music'],
    defaultTime: '20:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'laMachine',
    name: 'La Machine',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=La+Machine',
    fallbackUrls: ['https://agenda.brussels/en/search?q=La+Machine'],
    masterAddress: 'Place Saint-Géry 2, 1000 Brussels',
    lat: 50.8483, lng: 4.3473,
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Underground', 'Club', 'Live Music'],
    defaultTime: '22:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'kanal',
    name: 'KANAL',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=KANAL',
    fallbackUrls: ['https://agenda.brussels/en/search?q=KANAL'],
    masterAddress: 'Avenue du Port 1, 1000 Brussels',
    lat: 50.8604, lng: 4.3469,
    neighbourhood: 'Molenbeek',
    emoji: '🎨', color: '#F4A261', cat: 'Culture',
    tags: ['Art', 'Culture', 'Events'],
    defaultTime: '19:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'quai20',
    name: 'Quai 20',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Quai+20',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Quai+20'],
    masterAddress: 'Quai des Usines 20, 1000 Brussels',
    lat: 50.8749, lng: 4.3638,
    neighbourhood: 'Laeken',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Nightclub', 'Clubbing', 'Electronic'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'kaaitheater',
    name: 'Kaaitheater',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Kaaitheater',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Kaaitheater'],
    masterAddress: 'Square Sainctelette 20, 1000 Brussels',
    lat: 50.8588, lng: 4.3475,
    neighbourhood: 'Molenbeek',
    emoji: '🎭', color: '#E76F51', cat: 'Culture',
    tags: ['Performing Arts', 'Experimental', 'Theatre'],
    defaultTime: '20:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'flashClub',
    name: 'Flash Club',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Flash+Club',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Flash+Club'],
    masterAddress: 'Rue Duquesnoy 18, 1000 Brussels',
    lat: 50.8448, lng: 4.3540,
    neighbourhood: 'Centre',
    emoji: '⚡', color: '#FF6B9D', cat: 'Nightlife',
    tags: ['Club', 'Electronic', 'Nightlife'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'birdy',
    name: 'BIRDY Brussels',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=BIRDY+Brussels',
    fallbackUrls: ['https://www.agenda.brussels/en/search?q=BIRDY', 'https://agenda.brussels/en/search?q=BIRDY+Brussels'],
    masterAddress: 'Boulevard de Waterloo 38, 1000 Brussels',
    lat: 50.8325, lng: 4.3581,
    neighbourhood: 'Louise',
    emoji: '⚡', color: '#7B2FBE', cat: 'Nightlife',
    tags: ['Club', 'Underground', 'Electronic'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'settClub',
    name: 'Sett Club',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Sett+Club',
    fallbackUrls: ['https://www.agenda.brussels/en/search?q=Sett', 'https://agenda.brussels/en/search?q=Sett+Club'],
    masterAddress: 'Avenue du Port 86c, 1000 Brussels',
    lat: 50.8657, lng: 4.3509,
    neighbourhood: 'Molenbeek',
    emoji: '⚡', color: '#6C63FF', cat: 'Nightlife',
    tags: ['Club', 'Electronic', 'Underground'],
    defaultTime: '23:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'kvs',
    name: 'KVS',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=KVS',
    fallbackUrls: ['https://agenda.brussels/en/search?q=KVS'],
    masterAddress: 'Quai aux Pierres de Taille 7, 1000 Brussels',
    lat: 50.8552, lng: 4.3512,
    neighbourhood: 'Centre',
    emoji: '🎭', color: '#E76F51', cat: 'Culture',
    tags: ['Theatre', 'Performing Arts', 'Contemporary'],
    defaultTime: '20:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'jeuxDhiver',
    name: "Jeux d'Hiver",
    scrapingStrategy: 'portal_filter',
    targetUrl: "https://www.agenda.brussels/en/search?q=Jeux+d%27Hiver",
    fallbackUrls: ['https://www.agenda.brussels/en/search?q=Jeux+Hiver', "https://agenda.brussels/en/search?q=Jeux+d%27Hiver"],
    masterAddress: 'Chemin du Croquet 1, 1000 Brussels',
    lat: 50.8115, lng: 4.3730,
    neighbourhood: 'Ixelles',
    emoji: '🌿', color: '#F4A261', cat: 'Nightlife',
    tags: ['Club', 'Open Air', 'Electronic'],
    defaultTime: '22:00',
    jsHeavy: true, enforceVisuals: true,
  },
  {
    id: 'circlepark',
    name: 'Circle Park',
    scrapingStrategy: 'portal_filter',
    targetUrl: 'https://www.agenda.brussels/en/search?q=Circle+Park',
    fallbackUrls: ['https://agenda.brussels/en/search?q=Circle+Park', 'https://www.agenda.brussels/en/search?q=Circle+Park+Anderlecht'],
    masterAddress: 'Rue de Liverpool 2, 1070 Anderlecht, Brussels',
    lat: 50.8348, lng: 4.3010,
    neighbourhood: 'Anderlecht',
    emoji: '🌿', color: '#F4A261', cat: 'Festival',
    tags: ['Open Air', 'Electronic', 'Day Party', 'Festival'],
    defaultTime: '14:00',
    jsHeavy: true, enforceVisuals: true,
  },

  // ══ Topic searches — agenda.brussels, one entry per query ═══════════════
  // Adds the categories the club/venue list lacks (wellness, volunteering,
  // markets, food, sports, cinema, comedy, free). Same proven mechanism as the
  // open-air entries above: genericPortal, each card keeps its own venue and
  // location; the query decides the category (enforceVisuals).
  ...TOPIC_SEARCHES.map(topicEntry),
];
