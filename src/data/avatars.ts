import { C } from '../constants/theme';

export interface Avatar {
  id: number;
  emoji?: string;
  imgUrl?: string;
  label: string;
  bg: string[];
}

export const AVATARS: Avatar[] = [
  { id:1,  emoji:'🧑‍🎤', label:'Alt Kid',       bg:[C.lav,  C.pinkD] },
  { id:2,  emoji:'🧕',   label:'City Girl',     bg:[C.teal, C.lavD]  },
  { id:3,  emoji:'🧔',   label:'Techno Guy',    bg:['#2A2A4A','#6554A0'] },
  { id:4,  emoji:'👩‍🎨',  label:'Art Babe',      bg:[C.pink, C.teal]  },
  { id:5,  emoji:'🧑‍💻',  label:'Nerd Mode',     bg:[C.green, C.teal] },
  { id:6,  emoji:'🧑‍🍳',  label:'Foodie',        bg:['#FAD7A0', C.pinkD] },
  { id:7,  emoji:'🎧',   label:'DJ Vibes',      bg:['#1A1A2E', C.lav]},
  { id:8,  emoji:'🌸',   label:'Soft Gal',      bg:[C.pink, '#F9E4F0'] },
  { id:9,  emoji:'🤘',   label:'Rock Star',     bg:['#2D1B4E','#D4889A'] },
  { id:10, emoji:'🧖‍♀️',  label:'Wellness Babe', bg:[C.teal, C.green] },
  { id:11, emoji:'🎭',   label:'Theatre Kid',   bg:['#4A1942', C.lav] },
  { id:12, emoji:'⚽',   label:'Sports Guy',    bg:['#2E4A2E','#4CAF80'] },
  { id:13, emoji:'🌙',   label:'Night Owl',     bg:['#1A1A3E', C.lavD] },
];
