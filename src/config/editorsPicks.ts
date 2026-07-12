// ─────────────────────────────────────────────────────────────────────────────
// Editor's Picks — curated Brussels lifestyle guide (cafés & restaurants).
//
// A hand-picked local layer shown on the Map screen's "Editor's Picks" tab,
// separate from the scraped event pins. These are hardcoded, not scraped —
// each entry is an editorial recommendation with a Google Maps link.
//
// Adding a pick = appending one object. `link` opens in Google Maps.
// ─────────────────────────────────────────────────────────────────────────────

export type PickCategory = 'Cafe' | 'Restaurant';

export interface EditorsPick {
  id: string;
  name: string;
  category: PickCategory;
  lat: number;
  lng: number;
  link: string;              // Google Maps share link
  emoji: string;             // marker glyph
  color: string;             // marker colour
  blurb?: string;            // short editorial note
  neighbourhood?: string;
}

// Category → marker identity (kept in one place for the map legend + pins)
export const PICK_STYLE: Record<PickCategory, { emoji: string; color: string; label: string }> = {
  Cafe:       { emoji: '☕', color: '#C08457', label: 'Cafés' },
  Restaurant: { emoji: '🍽️', color: '#E76F51', label: 'Restaurants' },
};

export const EDITORS_PICKS: EditorsPick[] = [
  // ── Cafés ──
  {
    id: 'moody',
    name: 'Moody Brussels',
    category: 'Cafe',
    lat: 50.8422, lng: 4.3732,
    link: 'https://maps.app.goo.gl/HDCv3Ps524QW3FQdA',
    emoji: '☕', color: '#C08457',
    blurb: 'Cosy specialty-coffee spot with a warm, moody interior.',
    neighbourhood: 'Ixelles',
  },
  {
    id: 'tipi',
    name: 'Tipi la Guinguette',
    category: 'Cafe',
    lat: 50.8120, lng: 4.3912,
    link: 'https://maps.app.goo.gl/vkA4DhnXBX7D1Y879',
    emoji: '☕', color: '#C08457',
    blurb: 'Open-air guinguette café — drinks and chill by the greenery.',
    neighbourhood: 'Ixelles',
  },

  // ── Restaurants ──
  {
    id: 'ouzerie',
    name: 'Ouzerie Mezedopolio',
    category: 'Restaurant',
    lat: 50.8190, lng: 4.3840,
    link: 'https://maps.app.goo.gl/xNHVbaqKSDCLeFQ17',
    emoji: '🍽️', color: '#E76F51',
    blurb: 'Greek mezze & ouzo — small plates done right.',
    neighbourhood: 'Ixelles',
  },
  {
    id: 'minao',
    name: 'Minaô Schaerbeek',
    category: 'Restaurant',
    lat: 50.8495, lng: 4.3942,
    link: 'https://maps.app.goo.gl/nbUdd8aAGgPHhpEp9',
    emoji: '🍽️', color: '#E76F51',
    blurb: 'Japanese comfort food in Schaerbeek.',
    neighbourhood: 'Schaerbeek',
  },
];
