export const C = {
  pink:  '#F7CFD8',
  cream: '#F4F8D3',
  teal:  '#A6D6D6',
  lav:   '#8E7DBE',
  white: '#FFFFFF',
  dark:  '#22202E',
  mid:   '#7A7490',
  green: '#B8E5C0',
  pinkD: '#D4889A',
  tealD: '#5AADB0',
  lavD:  '#6554A0',
} as const;

export interface Theme {
  isDark:  boolean;
  bg:      string;
  card:    string;
  cardAlt: string;
  border:  string;
  text:    string;
  sub:     string;
  input:   string;
  pill:    string;
  pillTxt: string;
  navBg:   string;
  navBord: string;
  accent:  string;
}

export function makeTheme(isDark: boolean): Theme {
  return {
    isDark,
    bg:      isDark ? '#1A1A1A' : '#F8F9FA',
    card:    isDark ? '#2D2D2D' : C.white,
    cardAlt: isDark ? '#252525' : '#F0F2F5',
    border:  isDark ? '#3D3D3D' : 'rgba(142,125,190,0.14)',
    text:    isDark ? '#FFFFFF' : C.dark,
    sub:     isDark ? '#999999' : C.mid,
    input:   isDark ? '#2D2D2D' : C.white,
    pill:    isDark ? '#383838' : C.cream,
    pillTxt: isDark ? '#cccccc' : C.lav,
    navBg:   isDark ? '#1A1A1A' : C.cream,
    navBord: isDark ? '#2D2D2D' : `${C.lav}22`,
    accent:  C.lav,
  };
}
