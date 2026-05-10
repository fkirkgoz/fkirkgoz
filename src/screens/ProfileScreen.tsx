import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Modal,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthUser } from './AuthScreen';
import { Event } from '../data/events';
import { Avatar, AVATARS } from '../data/avatars';
import { Theme, C } from '../constants/theme';
import GradBg from '../components/GradBg';
import Tap from '../components/Tap';

const BADGES = [
  { emoji: '🌿', label: 'Canal Cleaner', desc: 'Canal Cleanup 2025', color: C.green },
  { emoji: '🍜', label: 'Comm. Chef',    desc: 'Cooking for All',    color: C.pink  },
  { emoji: '🌱', label: 'Green Ranger',  desc: '3 Eco Events',       color: C.teal  },
];
const PERKS = [
  { emoji: '🎛️', label: '10% off FUSE',         desc: 'Valid until 31 May', color: C.lav  },
  { emoji: '🍹', label: 'Free drink at M. Lambic', desc: 'Show at entry',     color: C.teal },
];

interface ProfileData { email: string; phone: string; }

interface Props {
  user: AuthUser | null;
  onSettings: () => void;
  avatar: Avatar | null;
  onAvatarChange: (av: Avatar) => void;
  profileData: ProfileData;
  T: Theme;
  myEvents: Event[];
  onEventPress: (e: Event) => void;
}

export default function ProfileScreen({ user, onSettings, avatar, onAvatarChange, profileData, T, myEvents, onEventPress }: Props) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("always down for a hidden gem 💎 techno + yoga + good food ✨ Brussels-based");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPage, setPickerPage] = useState(0);

  const pageAvatars = AVATARS.slice(pickerPage * 6, pickerPage * 6 + 6);
  const totalPages  = Math.ceil(AVATARS.length / 6);

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <LinearGradient colors={[C.lav, C.teal]} style={styles.headerGrad}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Tap onPress={onSettings}>
              <View style={styles.settingsBtn}>
                <Text style={styles.settingsBtnTxt}>⚙️ Settings</Text>
              </View>
            </Tap>
          </View>
        </LinearGradient>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={(avatar?.bg ?? [C.pink, C.lav]) as [string, string]}
              style={styles.avatar}
            >
              <Text style={styles.avatarEmoji}>{avatar?.emoji ?? '🧑'}</Text>
            </LinearGradient>
            <TouchableOpacity style={styles.cameraBtn} onPress={() => setPickerOpen(true)}>
              <Text style={{ fontSize: 14 }}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name / stats */}
        <View style={{ alignItems: 'center', paddingHorizontal: 22, marginTop: 4 }}>
          <Text style={[styles.name, { color: T.text }]}>{user?.name ?? 'Léa Van den Berg'}</Text>
          <Text style={[styles.emailTxt, { color: T.sub }]}>{profileData.email || user?.email ?? 'lea@randevu.app'} · Brussels</Text>
          {!!profileData.phone && <Text style={[styles.emailTxt, { color: T.sub }]}>{profileData.phone}</Text>}
          <View style={styles.statsRow}>
            {[['24','Events'],['8','Friends'],['3','Badges']].map(([v, l]) => (
              <View key={l} style={{ alignItems: 'center' }}>
                <Text style={[styles.statVal, { color: T.accent }]}>{v}</Text>
                <Text style={[styles.statLabel, { color: T.sub }]}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bio */}
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border, marginHorizontal: 22, marginTop: 18 }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardLabel, { color: T.sub }]}>BIO</Text>
            <Tap onPress={() => setEditing(e => !e)}>
              <View style={[styles.editBtn, { backgroundColor: T.pill }]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: T.accent }}>{editing ? 'Save ✓' : 'Edit ✏️'}</Text>
              </View>
            </Tap>
          </View>
          {editing ? (
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              style={[styles.bioInput, { backgroundColor: T.pill, borderColor: T.accent, color: T.text }]}
            />
          ) : (
            <Text style={[styles.bioText, { color: T.text }]}>{bio}</Text>
          )}
        </View>

        {/* My Schedule */}
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border, marginHorizontal: 22, marginTop: 14 }]}>
          <View style={[styles.cardHeader, { marginBottom: 12 }]}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>📅 My Schedule</Text>
            <View style={[styles.countBadge, { backgroundColor: T.accent }]}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{myEvents.length} events</Text>
            </View>
          </View>
          {myEvents.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>📭</Text>
              <Text style={[styles.emptyText, { color: T.sub }]}>No events yet — tap "I'm Going!" on any event</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {myEvents.map(ev => (
                <Tap key={ev.id} onPress={() => onEventPress(ev)}>
                  <View style={[styles.scheduleCard, { backgroundColor: T.cardAlt, borderColor: T.border }]}>
                    <View style={[styles.scheduleBar, { backgroundColor: ev.color }]} />
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 22, marginBottom: 5 }}>{ev.emoji}</Text>
                      <Text style={[styles.scheduleName, { color: T.text }]} numberOfLines={2}>
                        {ev.title.length > 18 ? ev.title.slice(0, 17) + '…' : ev.title}
                      </Text>
                      <Text style={{ fontSize: 10, color: T.sub, fontWeight: '700' }}>{ev.date}</Text>
                      <Text style={{ fontSize: 10, color: T.sub }}>{ev.time}</Text>
                      <View style={styles.goingBadge}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: C.dark }}>✓ Going</Text>
                      </View>
                    </View>
                  </View>
                </Tap>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Badges */}
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border, marginHorizontal: 22, marginTop: 14 }]}>
          <View style={[styles.cardHeader, { marginBottom: 12 }]}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>🏅 Meaningful Impact</Text>
            <View style={[styles.countBadge, { backgroundColor: T.accent }]}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>3 Vouchers</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {BADGES.map(b => (
              <View key={b.label} style={[styles.badgeCard, { backgroundColor: `${b.color}44`, borderColor: b.color }]}>
                <Text style={{ fontSize: 24 }}>{b.emoji}</Text>
                <Text style={[styles.badgeLabel, { color: T.text }]}>{b.label}</Text>
                <Text style={[styles.badgeDesc, { color: T.sub }]}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Perks */}
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border, marginHorizontal: 22, marginTop: 14 }]}>
          <Text style={[styles.sectionTitle, { color: T.text, marginBottom: 12 }]}>🎁 My Perks</Text>
          {PERKS.map(p => (
            <View key={p.label} style={[styles.perkRow, { backgroundColor: `${p.color}1E`, borderColor: p.color }]}>
              <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.perkLabel, { color: T.text }]}>{p.label}</Text>
                <Text style={[styles.perkDesc, { color: T.sub }]}>{p.desc}</Text>
              </View>
              <View style={[styles.useBtn, { backgroundColor: p.color }]}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>Use</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Avatar picker modal */}
      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.pickerContainer, { backgroundColor: T.card }]}>
          <Text style={[styles.pickerTitle, { color: T.text }]}>Choose your avatar</Text>
          <Text style={[styles.pickerSub, { color: T.sub }]}>{AVATARS.length} avatar styles — tap to select ✨</Text>
          <View style={styles.pickerGrid}>
            {pageAvatars.map(av => (
              <Tap key={av.id} onPress={() => { onAvatarChange(av); setPickerOpen(false); }} style={{ width: '30%' }}>
                <LinearGradient colors={av.bg as [string, string]} style={[styles.pickerItem, { borderColor: avatar?.id === av.id ? T.accent : 'transparent' }]}>
                  <Text style={{ fontSize: 34, marginBottom: 4 }}>{av.emoji ?? '🧑'}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: 'white', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{av.label}</Text>
                </LinearGradient>
              </Tap>
            ))}
          </View>
          {/* Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Tap key={i} onPress={() => setPickerPage(i)}>
                <View style={[styles.dot, { width: pickerPage === i ? 20 : 8, backgroundColor: pickerPage === i ? T.accent : T.border }]} />
              </Tap>
            ))}
          </View>
          <Tap onPress={() => setPickerOpen(false)}>
            <View style={[styles.cancelBtn, { backgroundColor: T.pill }]}>
              <Text style={{ fontWeight: '800', fontSize: 15, color: T.sub }}>Cancel</Text>
            </View>
          </Tap>
        </View>
      </Modal>
    </GradBg>
  );
}

const styles = StyleSheet.create({
  headerGrad:   { paddingTop: 52, paddingHorizontal: 22, paddingBottom: 68 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '900', color: 'white' },
  settingsBtn:  { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  settingsBtnTxt: { color: 'white', fontWeight: '800', fontSize: 13 },
  avatarWrap:   { alignItems: 'center', marginTop: -50, zIndex: 10 },
  avatarContainer: { position: 'relative' },
  avatar:       { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'white' },
  avatarEmoji:  { fontSize: 44 },
  cameraBtn:    { position: 'absolute', bottom: 2, right: 2, backgroundColor: C.teal, borderRadius: 15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'white' },
  name:         { fontSize: 22, fontWeight: '900' },
  emailTxt:     { fontSize: 13, marginTop: 2 },
  statsRow:     { flexDirection: 'row', gap: 28, marginTop: 14 },
  statVal:      { fontSize: 20, fontWeight: '900' },
  statLabel:    { fontSize: 11, fontWeight: '700' },
  card:         { borderRadius: 22, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel:    { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  editBtn:      { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  bioInput:     { borderWidth: 1.5, borderRadius: 14, padding: 10, fontSize: 14, fontWeight: '600', textAlignVertical: 'top', marginTop: 8 },
  bioText:      { fontSize: 14, fontWeight: '600', lineHeight: 24, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900' },
  countBadge:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  emptyText:    { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scheduleCard: { width: 140, borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  scheduleBar:  { height: 4 },
  scheduleName: { fontSize: 12, fontWeight: '900', lineHeight: 16, marginBottom: 3 },
  goingBadge:   { marginTop: 6, backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeCard:    { flex: 1, borderRadius: 18, padding: 12, alignItems: 'center', borderWidth: 1.5 },
  badgeLabel:   { fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  badgeDesc:    { fontSize: 10, marginTop: 2, textAlign: 'center' },
  perkRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', marginBottom: 10 },
  perkLabel:    { fontSize: 13, fontWeight: '800' },
  perkDesc:     { fontSize: 11 },
  useBtn:       { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  pickerContainer: { flex: 1, padding: 24 },
  pickerTitle:  { fontWeight: '900', fontSize: 18, marginBottom: 4 },
  pickerSub:    { fontSize: 13, fontWeight: '600', marginBottom: 18 },
  pickerGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  pickerItem:   { borderRadius: 18, padding: 14, alignItems: 'center', borderWidth: 3 },
  dotsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  dot:          { height: 8, borderRadius: 4 },
  cancelBtn:    { borderRadius: 20, padding: 14, alignItems: 'center' },
});
