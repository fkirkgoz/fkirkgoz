// ─────────────────────────────────────────────────────────────────────────────
// Editor's Picks — curated Brussels lifestyle guide (cafés & restaurants).
//
// A hand-picked local layer shown on the Map screen's "Editor's Picks" tab,
// separate from the scraped event pins. These are hardcoded, not scraped.
//
// Tapping a pin opens an IN-APP info card (name, price range, score, see-more
// details) — users are never bounced straight out to Google Maps; the maps
// link is only used by the explicit "Open in Google Maps" action inside the
// expanded card.
//
// Adding a pick = appending one object.
// ─────────────────────────────────────────────────────────────────────────────

export type PickCategory = 'Cafe' | 'Restaurant';
export type PriceRange = '€' | '€€' | '€€€';

export interface EditorsPick {
  id: string;
  name: string;
  category: PickCategory;
  address: string;           // verified street address
  lat: number;
  lng: number;
  link: string;              // Google Maps share link (used by the in-card CTA only)
  emoji: string;             // marker glyph
  color: string;             // marker colour
  priceRange: PriceRange;    // € / €€ / €€€
  score: number;             // editorial score out of 10
  blurb: string;             // short editorial note (shown behind "See more")
  neighbourhood: string;
}

// Category → marker identity (kept in one place for the map legend + pins)
export const PICK_STYLE: Record<PickCategory, { emoji: string; color: string; label: string }> = {
  Cafe:       { emoji: '☕', color: '#C08457', label: 'Cafés' },
  Restaurant: { emoji: '🍽️', color: '#E76F51', label: 'Restaurants' },
};

// Coordinates below are EXACT verified pin positions — never re-derive them
// from the address text or a geocoder; the map renders lat/lng verbatim.
export const EDITORS_PICKS: EditorsPick[] = [
  // ── Cafés ──
  {
    id: 'moody',
    name: 'Moody Brussels',
    category: 'Cafe',
    address: 'Rue de la Victoire 122, 1060 Saint-Gilles',
    lat: 50.8298, lng: 4.3462,
    link: 'https://maps.app.goo.gl/HDCv3Ps524QW3FQdA',
    emoji: '☕', color: '#C08457',
    priceRange: '€€',
    score: 9.1,
    blurb: 'Cosy specialty-coffee spot with a warm, moody interior — great flat whites and homemade cakes.',
    neighbourhood: 'Saint-Gilles',
  },
  {
    id: 'tipi',
    name: 'Tipi la Guinguette',
    category: 'Cafe',
    address: 'Parc des Étangs, Boulevard de la Commande, 1070 Anderlecht',
    lat: 50.8288, lng: 4.2954,
    link: 'https://maps.app.goo.gl/vkA4DhnXBX7D1Y879',
    emoji: '☕', color: '#C08457',
    priceRange: '€',
    score: 8.8,
    blurb: 'Open-air guinguette café in the Parc des Étangs — drinks and sunset hangs surrounded by greenery.',
    neighbourhood: 'Anderlecht',
  },

  // ── Restaurants ──
  {
    id: 'ouzerie',
    name: 'Ouzerie Mezedopolio',
    category: 'Restaurant',
    address: "Chaussée d'Ixelles 235, 1050 Ixelles",
    lat: 50.8284, lng: 4.3687,
    link: 'https://maps.app.goo.gl/xNHVbaqKSDCLeFQ17',
    emoji: '🍽️', color: '#E76F51',
    priceRange: '€€',
    score: 9.3,
    blurb: 'Greek mezze & ouzo — small plates done right, lively evenings.',
    neighbourhood: 'Ixelles',
  },
  {
    id: 'minao',
    name: 'Minaô',
    category: 'Restaurant',
    address: "Rue de l'Avenir 20, 1030 Schaerbeek",
    lat: 50.8631, lng: 4.3813,
    link: 'https://maps.app.goo.gl/nbUdd8aAGgPHhpEp9',
    emoji: '🍽️', color: '#E76F51',
    priceRange: '€€',
    score: 9.0,
    blurb: 'Vibrant neighbourhood kitchen in Schaerbeek — fresh, generous plates.',
    neighbourhood: 'Schaerbeek',
  },
];
