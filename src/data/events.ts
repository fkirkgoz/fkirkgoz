import scrapedRaw from './scraped_events.json';

export interface Attendee {
  n: string;
  c: string;
  isFriend: boolean;
}

export const FRIEND_PROFILES: Record<string, { bio: string; vibes: string[] }> = {
  'Zoë':   { bio: 'techno lover & yoga teacher 🌿 Brussels born and raised', vibes: ['Techno', 'Wellness', 'Late Nights'] },
  'Kaan':  { bio: 'architecture student by day, raver by night 🏗️', vibes: ['Techno', 'Art', 'Sports'] },
  'Léa':   { bio: 'always up for yoga, picnics & hidden coffee spots ☕', vibes: ['Wellness', 'Outdoors', 'Food'] },
  'Iris':  { bio: 'art curator & weekend market fanatic 🖼️', vibes: ['Art', 'Culture', 'Markets'] },
  'Nora':  { bio: 'pilates teacher & dog rescuer 🐾 based in Etterbeek', vibes: ['Fitness', 'Animals', 'Wellness'] },
  'Hugo':  { bio: 'football + food + friends = perfect weekend ⚽', vibes: ['Sports', 'Food & Drink', 'Culture'] },
  'Axel':  { bio: 'live music addict & padel rookie 🎾 Anderlecht local', vibes: ['Nightlife', 'Sports', 'Music'] },
  'Ali':   { bio: 'eco activist & community organiser 🌿 Molenbeek', vibes: ['Eco', 'Community', 'Outdoors'] },
  'Kai':   { bio: 'techno head 🖤 Berlin × Brussels', vibes: ['Techno', 'Art', 'Nightlife'] },
  'Fleur': { bio: 'vintage lover & padel enthusiast 🎾 Laeken based', vibes: ['Vintage', 'Sports', 'Markets'] },
  'Sophie':{ bio: 'museum nerd & marathon runner 🏛️ Brussels forever', vibes: ['Culture', 'Running', 'Art'] },
  'Nico':  { bio: 'padel coach & nature lover — always outdoors', vibes: ['Sports', 'Outdoors', 'Fitness'] },
  'Pierre':{ bio: 'artist & art history PhD student 🎨 La Bellone regular', vibes: ['Art', 'Culture', 'Music'] },
  'Claire':{ bio: 'wine sommelier & jazz lover 🍷 Sablon obsessed', vibes: ['Food & Drink', 'Music', 'Culture'] },
  'Leila': { bio: 'photographer & night wanderer 📸 Grand Place at midnight', vibes: ['Art', 'Culture', 'Nightlife'] },
  'Tom':   { bio: 'football fan & gallery hopper ⚽🖼️', vibes: ['Sports', 'Art', 'Culture'] },
};

export interface ChatMessage {
  user: string;
  text: string;
  time: string;
  isMe?: boolean;
}

export interface Event {
  id: number;
  cat: string;
  date: string;
  title: string;
  venue: string;
  addr: string;
  time: string;
  startH: number;
  endH: number;
  emoji: string;
  color: string;
  friends: number;
  tags: string[];
  source: string;
  officialEventLink: string;
  lat: number;
  lng: number;
  going: number;
  neighbourhood: string;
  desc: string;
  attendees: Attendee[];
  chatSeed: ChatMessage[];
  attendeeCount?: number;
  status?: string;
  _rawDate?: string;
}

export const EVENTS: Event[] = scrapedRaw as unknown as Event[];

export const CATS  = ['All', 'Nightlife', 'Music', 'Culture', 'Festival', 'Arts', 'Sports', 'Wellness', 'Food & Drink', 'Market', 'Volunteering'];
export const DATES = ['All', 'Tonight', 'Tomorrow', 'This Weekend', 'Next Week'];
