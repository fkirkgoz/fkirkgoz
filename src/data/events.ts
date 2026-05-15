import { C } from '../constants/theme';
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
  price: string;
  emoji: string;
  color: string;
  friends: number;
  tags: string[];
  source: string;
  sourceURL?: string;
  lat: number;
  lng: number;
  going: number;
  neighbourhood: string;
  ticket?: string;
  desc: string;
  attendees: Attendee[];
  chatSeed: ChatMessage[];
  attendeeCount?: number;
}

const BASE_EVENTS: Event[] = [
  // TODAY
  { id:1, cat:'Nightlife', date:'Today', title:'Techno Night — RA Curation', venue:'Fuse Club', addr:'Rue Blaes 208, 1000 Bruxelles', time:'23:00–06:00', startH:23, endH:30, price:'€14', emoji:'🎛️', color:C.lav, friends:3, tags:['Techno','Nightlife'], source:'RA', lat:50.8451, lng:4.3506, going:214, neighbourhood:'Marolles', ticket:'https://ra.co', desc:'Resident Advisor curated techno night at Fuse — Brussels\' most iconic club. Hand-picked lineup of European underground acts. Dress code enforced.', attendees:[{n:'Zoë',c:C.pink,isFriend:true},{n:'Kaan',c:C.teal,isFriend:true},{n:'Maya',c:C.lav,isFriend:false},{n:'Luc',c:C.green,isFriend:false}], chatSeed:[{user:'Mathis',text:'Anyone in the queue? 🙌',time:'22:41'},{user:'Clara',text:'Warm-up set is 🔥',time:'22:58'},{user:'Lukas',text:'Meeting by cloakroom in 20',time:'23:04'}] },
  { id:2, cat:'Wellness', date:'Today', title:'Free Yoga · Cinquantenaire', venue:'Parc du Cinquantenaire', addr:'Av. de la Renaissance, 1000 Bruxelles', time:'09:00–10:30', startH:9, endH:10.5, price:'Free', emoji:'🧘', color:C.teal, friends:1, tags:['Wellness','Outdoors'], source:'Randevu', lat:50.8401, lng:4.3901, going:38, neighbourhood:'Euro Quarter', desc:'Gentle vinyasa flow under the iconic triumphal arch. All levels welcome.', attendees:[{n:'Léa',c:C.teal,isFriend:true},{n:'Ines',c:C.pink,isFriend:false},{n:'Badr',c:C.lav,isFriend:false}], chatSeed:[{user:'Clara',text:'Usual spot near the fountain? 🌿',time:'08:42'},{user:'Lukas',text:'Yes! Same as last week 🧘',time:'08:51'}] },
  { id:20, cat:'Sports', date:'Today', title:'Union SG vs Anderlecht', venue:'Lotto Park Fan Zone', addr:'Av. Théo Verbeeck 2, 1070 Anderlecht', time:'20:45–22:30', startH:20.75, endH:22.5, price:'Free', emoji:'⚽', color:'#E8D5A3', friends:7, tags:['Football','Sports'], source:'URBSFA', lat:50.8340, lng:4.3020, going:8200, neighbourhood:'Anderlecht', desc:'Watch the Brussels Pro League derby live on the big screen at the fan zone. Free entry, food & drinks available. Wear your colours!', attendees:[{n:'Axel',c:'#E8D5A3',isFriend:true},{n:'Tom',c:C.teal,isFriend:true},{n:'Kai',c:C.lav,isFriend:false},{n:'Dina',c:C.pink,isFriend:false}], chatSeed:[{user:'Mathis',text:'ELECTRIC atmosphere here ⚡',time:'20:00'},{user:'Clara',text:'Anyone at gate C? Extra tickets 🎟️',time:'20:15'}] },
  // TOMORROW
  { id:3, cat:'Art', date:'Tomorrow', title:'Exhibition: Brussels Culture', venue:'Halles Saint-Géry', addr:'Place Saint-Géry 1, 1000 Bruxelles', time:'11:00–19:00', startH:11, endH:19, price:'Free', emoji:'🖼️', color:C.cream, friends:2, tags:['Art','Exhibition'], source:'Visit.Brussels', lat:50.8487, lng:4.3464, going:156, neighbourhood:'Centre', desc:'Contemporary Brussels culture inside the 19th-century iron hall. 20 local artists showcase photography, painting and digital art.', attendees:[{n:'Iris',c:'#C8B8E8',isFriend:true},{n:'Tom',c:C.cream,isFriend:false},{n:'Vera',c:C.teal,isFriend:false},{n:'Rafa',c:C.pink,isFriend:false}], chatSeed:[{user:'Clara',text:'Photography section is incredible 🎨',time:'11:24'},{user:'Lukas',text:'Anyone doing the guided tour at 14:00?',time:'12:05'}] },
  { id:4, cat:'Wellness', date:'Tomorrow', title:'Pilates with Puppies 🐾', venue:'Studio Bloom, Etterbeek', addr:'Rue des Deux Églises 30, 1040 Etterbeek', time:'11:00–12:00', startH:11, endH:12, price:'€18', emoji:'🐾', color:C.pink, friends:5, tags:['Fitness','Animals'], source:'Randevu', lat:50.8384, lng:4.3786, going:12, neighbourhood:'Etterbeek', ticket:'https://studiobloom.be', desc:'Real puppies. Partner with an adorable rescue dog for a 60-min pilates class.', attendees:[{n:'Nora',c:C.pink,isFriend:true},{n:'Theo',c:C.teal,isFriend:false},{n:'Jade',c:C.lav,isFriend:false}], chatSeed:[{user:'Zoë',text:'We each get our own puppy 🥺',time:'10:00'},{user:'Clara',text:'Yes!! Golden retriever last time 😭💕',time:'10:08'}] },
  { id:21, cat:'Sports', date:'Tomorrow', title:'Padel Open — Tour & Taxis', venue:'Tour & Taxis Sports Hub', addr:'Avenue du Port 86c, 1000 Bruxelles', time:'09:00–18:00', startH:9, endH:18, price:'€12', emoji:'🎾', color:C.green, friends:4, tags:['Padel','Sports'], source:'Brussels.be', lat:50.8665, lng:4.3554, going:134, neighbourhood:'Laeken', ticket:'https://padelbrussels.be', desc:'Brussels Padel Open at Tour & Taxis. Watch the finals or book a glass court for your own match. Beginner sessions at 09:00 and 11:00.', attendees:[{n:'Nico',c:C.green,isFriend:true},{n:'Fleur',c:C.pink,isFriend:false},{n:'Rafa',c:C.lav,isFriend:false}], chatSeed:[{user:'Clara',text:'Anyone tried padel before?',time:'10:05'},{user:'Mathis',text:'Instantly addictive — warning 😅',time:'10:20'}] },
  // THIS WEEKEND
  { id:5, cat:'Culture', date:'This Weekend', title:'Grand Place Light Show', venue:'Grand Place', addr:'Grand Place, 1000 Bruxelles', time:'21:00–23:00', startH:21, endH:23, price:'Free', emoji:'✨', color:'#FAD7A0', friends:4, tags:['Culture','Outdoors'], source:'Brussels.be', lat:50.8467, lng:4.3525, going:430, neighbourhood:'Centre', desc:'UNESCO Grand Place transforms after dark with spectacular projection mapping. Free for all. Best viewed from the square centre.', attendees:[{n:'Hugo',c:'#FAD7A0',isFriend:true},{n:'Leila',c:C.teal,isFriend:true},{n:'Sam',c:C.pink,isFriend:false},{n:'Anya',c:C.lav,isFriend:false}], chatSeed:[{user:'Clara',text:'Getting there at 20:30 🏛️',time:'19:55'},{user:'Mathis',text:'Town Hall colours last week were insane',time:'20:10'}] },
  { id:6, cat:'Food & Drink', date:'This Weekend', title:'Wine Tasting at Sablon', venue:'Place du Grand Sablon', addr:'Place du Grand Sablon 12, 1000 Bruxelles', time:'17:00–20:00', startH:17, endH:20, price:'€25', emoji:'🍷', color:C.pink, friends:2, tags:['Food & Drink','Social'], source:'Visit.Brussels', lat:50.8446, lng:4.3540, going:89, neighbourhood:'Sablon', ticket:'https://sablon-wine.be', desc:'Natural wines and jazz vibes on Brussels\' most elegant square. 8 biodynamic bottles paired with local cheese.', attendees:[{n:'Claire',c:C.pink,isFriend:true},{n:'Hugo',c:'#FAD7A0',isFriend:false},{n:'Leila',c:C.teal,isFriend:false}], chatSeed:[{user:'Clara',text:'Georgian orange wine was extraordinary 🍊',time:'16:50'},{user:'Mathis',text:'Natural wine is a vibe 🍷',time:'17:02'}] },
  { id:7, cat:'Nightlife', date:'This Weekend', title:'Bar Night · Jardin Hospice', venue:"Jardin de l'Hospice Pachéco", addr:'Rue du Grand Hospice 7, 1000 Bruxelles', time:'20:00–02:00', startH:20, endH:26, price:'€5', emoji:'🪩', color:C.lav, friends:8, tags:['Nightlife','Bar'], source:'The Guide BXL', lat:50.8562, lng:4.3529, going:188, neighbourhood:'Centre', ticket:'https://hospicenights.be', desc:'Hospice courtyard becomes Brussels\' most atmospheric open-air bar. DJs play deep house and disco under the stars.', attendees:[{n:'Axel',c:C.lav,isFriend:true},{n:'Mia',c:C.pink,isFriend:false},{n:'Sam',c:C.teal,isFriend:false},{n:'Yara',c:C.green,isFriend:false}], chatSeed:[{user:'Lukas',text:'Pre-drinking at Le Cirio at 19:00 🍸',time:'18:42'},{user:'Clara',text:'Joining!! Le Cirio is iconic 💯',time:'18:50'}] },
  { id:8, cat:'Art', date:'This Weekend', title:'Art Exhibit · La Bellone', venue:'La Bellone, Dansaert', addr:'Rue de Flandre 46, 1000 Bruxelles', time:'14:00–20:00', startH:14, endH:20, price:'Free', emoji:'🎭', color:C.cream, friends:1, tags:['Art','Culture'], source:'Visit.Brussels', lat:50.8510, lng:4.3449, going:72, neighbourhood:'Dansaert', desc:'La Bellone opens its baroque Dansaert courtyard for a multi-discipline exhibition. Free entry, weekend only.', attendees:[{n:'Pierre',c:C.lav,isFriend:true},{n:'Sofia',c:C.pink,isFriend:false}], chatSeed:[{user:'Clara',text:'The courtyard alone is worth it 😍',time:'14:20'},{user:'Mathis',text:'Brussels hidden gems hit different',time:'15:00'}] },
  // NEXT WEEK
  { id:9, cat:'Nightlife', date:'Next Week', title:'Electronic Night at Fuse', venue:'Fuse Club, Ixelles', addr:'Rue Blaes 208, 1000 Bruxelles', time:'22:00–07:00', startH:22, endH:31, price:'€18', emoji:'⚡', color:C.lav, friends:6, tags:['Techno','Nightlife'], source:'RA', lat:50.8455, lng:4.3512, going:411, neighbourhood:'Marolles', ticket:'https://fuse.eu', desc:'Extended Electronic Night featuring Interstellar Funk. B2B sets until 7am. Legendary sound system.', attendees:[{n:'Kai',c:C.lav,isFriend:true},{n:'Anya',c:C.pink,isFriend:false},{n:'Seb',c:C.teal,isFriend:false},{n:'Mia',c:C.green,isFriend:false}], chatSeed:[{user:'Mathis',text:'Interstellar Funk 😭 I\'ve been waiting months!',time:'Mon 10:00'},{user:'Clara',text:'Tickets going FAST!!',time:'Mon 10:18'}] },
  { id:10, cat:'Market', date:'Next Week', title:'Vintage Market · Halles St-Géry', venue:'Halles Saint-Géry', addr:'Place Saint-Géry 1, 1000 Bruxelles', time:'10:00–18:00', startH:10, endH:18, price:'Free', emoji:'🛍️', color:C.cream, friends:2, tags:['Market','Vintage'], source:'Visit.Brussels', lat:50.8490, lng:4.3468, going:156, neighbourhood:'Centre', desc:'Brussels monthly curated vintage fair. 60+ stalls: rare vinyl, deadstock clothing, antique ceramics.', attendees:[{n:'Fleur',c:C.cream,isFriend:true},{n:'Rafa',c:C.teal,isFriend:false},{n:'Lou',c:C.pink,isFriend:false}], chatSeed:[{user:'Clara',text:'Found a vintage Levi\'s for €12 last month 🙏',time:'Tue 09:45'},{user:'Mathis',text:'Vinyl stall in back left is the best',time:'Tue 10:00'}] },
  { id:11, cat:'Volunteering', date:'Next Week', title:'Canal Cleanup Volunteer Day', venue:'Canal de Bruxelles', addr:'Quai des Charbonnages, 1080 Molenbeek', time:'10:00–14:00', startH:10, endH:14, price:'Free', emoji:'🌿', color:C.green, friends:7, tags:['Eco','Community'], source:'Brussels.be', lat:50.8554, lng:4.3389, going:67, neighbourhood:'Molenbeek', desc:'Join 50+ Brusselaires to clean the canal. Gloves provided. Earn a Randevu Voucher. Closes with a free picnic.', attendees:[{n:'Ali',c:C.green,isFriend:true},{n:'Dina',c:C.teal,isFriend:false},{n:'Max',c:C.pink,isFriend:false},{n:'Soraya',c:C.lav,isFriend:false}], chatSeed:[{user:'Lukas',text:'Last time we filled 40 bags! 💪',time:'Wed 09:30'},{user:'Clara',text:'Bringing extra gloves 🧤',time:'Wed 09:45'}] },
  // FEATURED
  { id:30, cat:'Culture', date:'This Weekend', title:'Museum Night Fever', venue:'50+ Brussels Museums', addr:'Various locations, 1000 Bruxelles', time:'19:00–01:00', startH:19, endH:25, price:'€16', emoji:'🏛️', color:'#D5C5F0', friends:6, tags:['Culture','Museums'], source:'Visit.Brussels', sourceURL:'https://www.visit.brussels/museumnightfever', lat:50.8464, lng:4.3530, going:18000, neighbourhood:'City-wide', ticket:'https://www.visit.brussels/museumnightfever', desc:'One magical night, 50+ Brussels museums throw open their doors until 1am. Live music, DJ sets, immersive performances and art installations.', attendees:[{n:'Sophie',c:'#D5C5F0',isFriend:true},{n:'Remi',c:C.teal,isFriend:false},{n:'Jade',c:C.pink,isFriend:false},{n:'Luc',c:C.lav,isFriend:false}], chatSeed:[{user:'Clara',text:'Which museum first? I\'m starting at Magritte 🖼️',time:'18:50'},{user:'Mathis',text:'Bozar has a DJ set until midnight 🎵',time:'19:10'}] },
  { id:31, cat:'Music', date:'This Weekend', title:'Les Nuits Botanique', venue:'Le Botanique', addr:'Rue Royale 236, 1210 Saint-Josse', time:'20:00–00:00', startH:20, endH:24, price:'€25', emoji:'🎵', color:'#B8E5C0', friends:4, tags:['Music','Festival'], source:'Botanique', sourceURL:'https://botanique.be/nuits', lat:50.8587, lng:4.3634, going:2800, neighbourhood:'Saint-Josse', ticket:'https://botanique.be/nuits', desc:'The legendary Brussels music festival returns. 10 days, 80 artists across 5 stages inside the stunning 19th-century greenhouse complex.', attendees:[{n:'Zoë',c:C.green,isFriend:true},{n:'Kaan',c:'#B8E5C0',isFriend:false},{n:'Maya',c:C.pink,isFriend:false}], chatSeed:[{user:'Mathis',text:'Line-up this year is 🔥 who\'s headlining your night?',time:'19:45'},{user:'Clara',text:'Starting in the greenhouse stage, absolute magic',time:'20:05'}] },
  { id:33, cat:'Nightlife', date:'Next Week', title:'Hangar Open Air', venue:'Hangar', addr:'Place des Abattoirs 1, 1000 Bruxelles', time:'22:00–07:00', startH:22, endH:31, price:'€40', emoji:'🔊', color:'#2A1F3D', friends:5, tags:['Techno','Open Air'], source:'Hangar', sourceURL:'https://hangar.be', lat:50.8430, lng:4.3370, going:3500, neighbourhood:'Anderlecht', ticket:'https://hangar.be', desc:'Brussels\' most acclaimed open-air techno experience returns for summer. Three outdoor stages, world-class sound system.', attendees:[{n:'Kai',c:'#2A1F3D',isFriend:true},{n:'Anya',c:C.lav,isFriend:false},{n:'Seb',c:C.pink,isFriend:false}], chatSeed:[{user:'Mathis',text:'Hangar lineup dropped 😱 who\'s coming?',time:'Fri 18:00'},{user:'Clara',text:'Already got tickets the second they went on sale 🖤',time:'Fri 18:30'}] },
  { id:34, cat:'Sports', date:'Next Week', title:'Brussels 20km', venue:'Parc du Cinquantenaire', addr:'Avenue de la Renaissance, 1000 Bruxelles', time:'10:00–14:00', startH:10, endH:14, price:'€28', emoji:'🏃', color:'#FFE0CC', friends:8, tags:['Running','Sports'], source:'Brussels20km', sourceURL:'https://www.20kmbruxelles.be', lat:50.8397, lng:4.3907, going:40000, neighbourhood:'Euro Quarter', ticket:'https://www.20kmbruxelles.be', desc:'One of Europe\'s most iconic city races: 40,000 runners take on 20km through Brussels\' most beautiful avenues.', attendees:[{n:'Sophie',c:'#FFE0CC',isFriend:true},{n:'Remi',c:C.teal,isFriend:false},{n:'Hugo',c:C.pink,isFriend:false}], chatSeed:[{user:'Mathis',text:'Who\'s aiming sub-90? Training has been solid 🏃',time:'Tue 07:30'},{user:'Clara',text:'Just happy to finish tbh 😅 first 20km!',time:'Tue 08:00'}] },

  // NEW REAL-WORLD BRUSSELS EVENTS
  { id:35, cat:'Music', date:'Next Week', title:'Couleur Café Festival', venue:'Ossegempark', addr:'Ossegempark, 1020 Laeken', time:'14:00–00:00', startH:14, endH:24, price:'€45', emoji:'🌍', color:'#F4A261', friends:5, tags:['World Music','Hip Hop','Festival'], source:'Couleur Café', sourceURL:'https://www.couleurcafe.be', lat:50.8948, lng:4.3411, going:4200, neighbourhood:'Laeken', ticket:'https://www.couleurcafe.be', desc:"Brussels' legendary 3-day world music & hip hop festival returns to the stunning Ossegempark, in the shadow of the Atomium. Afrobeats, reggae, hip hop, and live art across multiple stages.", attendees:[{n:'Zoë',c:'#F4C87A',isFriend:true},{n:'Axel',c:'#E8D5A3',isFriend:true},{n:'Rafa',c:'#F4A261',isFriend:false},{n:'Yara',c:C.teal,isFriend:false},{n:'Dina',c:C.pink,isFriend:false}], chatSeed:[{user:'Clara',text:'Couleur Café lineup this year is INSANE 🌍',time:'Mon 10:00'},{user:'Mathis',text:'Front row for the afrobeats stage 🎤',time:'Mon 10:20'},{user:'Zoë',text:'Meeting at Atomium Metro at 13:30?',time:'Mon 11:00'}] },
  { id:36, cat:'Music', date:'Tomorrow', title:'AB Concert Night', venue:'Ancienne Belgique', addr:'Anspachlaan 110, 1000 Bruxelles', time:'20:00–23:30', startH:20, endH:23.5, price:'€22', emoji:'🎸', color:'#C77DFF', friends:3, tags:['Indie Rock','Live Music'], source:'AB', sourceURL:'https://www.abconcerts.be', lat:50.8483, lng:4.3512, going:780, neighbourhood:'Centre', ticket:'https://www.abconcerts.be', desc:"One of Europe's most beloved intimate venues. Iconic indie rock line-up in the legendary AB main hall — known for its world-class acoustics and electric atmosphere.", attendees:[{n:'Pierre',c:C.lav,isFriend:true},{n:'Leila',c:C.teal,isFriend:true},{n:'Mia',c:C.pink,isFriend:false},{n:'Sam',c:'#C77DFF',isFriend:false}], chatSeed:[{user:'Clara',text:'AB is the best venue in Europe, fight me 🎸',time:'18:30'},{user:'Mathis',text:'Doors open at 19:00 — getting there early',time:'18:45'},{user:'Pierre',text:'Saved us spots near the soundboard 🙌',time:'19:05'}] },
  { id:37, cat:'Food & Drink', date:'This Weekend', title:'Wolf Food Market', venue:'Wolf', addr:'Rue du Fossé aux Loups 50, 1000 Bruxelles', time:'11:00–20:00', startH:11, endH:20, price:'Free', emoji:'🍕', color:'#F4C87A', friends:2, tags:['Street Food','Social','Market'], source:'Wolf', lat:50.8498, lng:4.3541, going:650, neighbourhood:'Centre', desc:"Brussels' coolest indoor food market inside the iconic Wolf building. 20+ local vendors, craft beers, natural wines, and a live DJ every weekend. Free entry.", attendees:[{n:'Claire',c:C.pink,isFriend:true},{n:'Hugo',c:'#FAD7A0',isFriend:true},{n:'Tom',c:C.cream,isFriend:false},{n:'Vera',c:'#F4C87A',isFriend:false}], chatSeed:[{user:'Clara',text:'The Korean BBQ stall is back this week 🙏',time:'Sat 11:15'},{user:'Mathis',text:'Wolf on a sunny Saturday = perfection',time:'Sat 11:30'},{user:'Claire',text:'Grabbing the corner table — come find me 🍷',time:'Sat 12:00'}] },
  { id:38, cat:'Culture', date:'This Weekend', title:'Place Noord Open Air', venue:'Place du Nord', addr:'Place du Nord, 1000 Bruxelles', time:'16:00–23:00', startH:16, endH:23, price:'Free', emoji:'☀️', color:'#90E0EF', friends:6, tags:['Community','DJ Sets','Open Air'], source:'Randevu', lat:50.8601, lng:4.3592, going:420, neighbourhood:'Schaerbeek', desc:'Summer vibes at Place du Nord as the neighbourhood transforms into a free open-air terrace. Local DJs, food trucks, and the most vibrant, diverse crowd in Brussels.', attendees:[{n:'Kai',c:C.lav,isFriend:true},{n:'Sophie',c:'#D5C5F0',isFriend:true},{n:'Ali',c:C.green,isFriend:true},{n:'Mia',c:C.pink,isFriend:false},{n:'Sam',c:'#90E0EF',isFriend:false}], chatSeed:[{user:'Clara',text:'Place Noord is such a hidden gem ☀️',time:'Sat 15:45'},{user:'Mathis',text:'Best free DJ nights in Brussels hands down',time:'Sat 16:00'},{user:'Kai',text:'See you at the food truck area 🌮',time:'Sat 16:20'}] },
];

export const EVENTS: Event[] = [...BASE_EVENTS, ...(scrapedRaw as unknown as Event[])];

export const CATS  = ['All','Nightlife','Sports','Music','Art','Wellness','Culture','Food & Drink','Market','Volunteering'];
export const DATES = ['All','Today','Tomorrow','This Weekend','Next Week'];

export const MAP_PINS = [
  { event: EVENTS[0], area: 'Marolles' },
  { event: EVENTS[2], area: 'Anderlecht' },
  { event: EVENTS[6], area: 'Grand Hospice' },
  { event: EVENTS[7], area: 'Dansaert' },
  { event: EVENTS[4], area: 'Grand-Place' },
  { event: EVENTS[5], area: 'Sablon' },
];
