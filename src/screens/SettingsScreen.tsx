import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Switch, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthUser } from './AuthScreen';
import { Theme, C } from '../constants/theme';
import GradBg from '../components/GradBg';
import Tap from '../components/Tap';

interface ProfileData { email: string; phone: string; }

interface Props {
  user: AuthUser | null;
  onBack: () => void;
  profileData: ProfileData;
  onProfileUpdate: (d: ProfileData) => void;
  isDark: boolean;
  onDarkToggle: () => void;
  onSignOut: () => void;
  T: Theme;
}

type FieldKey = 'email' | 'phone' | 'password';

const NOTIF_ITEMS: [string, boolean][] = [
  ['FOMO alerts (friends going)', true],
  ['Last-minute event alerts',    true],
  ['Event reminders (1h before)', false],
  ['New events in my area',       true],
];

export default function SettingsScreen({ user, onBack, profileData, onProfileUpdate, isDark, onDarkToggle, onSignOut, T }: Props) {
  const [fields, setFields] = useState({
    email:    profileData.email || user?.email || 'lea@randevu.app',
    phone:    profileData.phone || '+32 478 12 34 56',
    password: '••••••••',
  });
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [val, setVal]         = useState('');
  const [savedF, setSavedF]   = useState<FieldKey | null>(null);
  const [notifs, setNotifs]   = useState<boolean[]>(NOTIF_ITEMS.map(n => n[1]));

  const startEdit = (k: FieldKey) => { setEditing(k); setVal(k === 'password' ? '' : fields[k]); };
  const doSave = (k: FieldKey) => {
    if (val.trim()) {
      setFields(f => ({ ...f, [k]: k === 'password' ? '••••••••' : val.trim() }));
      if (k !== 'password') onProfileUpdate({ ...profileData, [k]: val.trim() });
    }
    setEditing(null);
    setSavedF(k);
    setTimeout(() => setSavedF(null), 1800);
  };

  const FIELD_CONFIG: { k: FieldKey; label: string; icon: string; type: 'email-address' | 'phone-pad' | 'default' }[] = [
    { k: 'email',    label: 'Email address', icon: '📧', type: 'email-address' },
    { k: 'phone',    label: 'Phone number',  icon: '📱', type: 'phone-pad'     },
    { k: 'password', label: 'Password',      icon: '🔒', type: 'default'       },
  ];

  return (
    <GradBg isDark={T.isDark} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <LinearGradient colors={[C.lav, C.teal]} style={styles.headerGrad}>
          <Tap onPress={onBack}>
            <View style={styles.backBtn}>
              <Text style={styles.backBtnTxt}>← Back</Text>
            </View>
          </Tap>
          <Text style={styles.title}>⚙️ Account Settings</Text>
          <Text style={styles.subtitle}>Manage your Randevu account</Text>
        </LinearGradient>

        <View style={{ padding: 22 }}>
          {/* Account fields */}
          {FIELD_CONFIG.map(f => (
            <View key={f.k} style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
              <View style={styles.fieldRow}>
                <View>
                  <Text style={[styles.fieldLabel, { color: T.sub }]}>{f.icon} {f.label}</Text>
                  <Text style={[styles.fieldVal, { color: T.text }]}>{fields[f.k]}</Text>
                </View>
                <Tap onPress={() => editing === f.k ? doSave(f.k) : startEdit(f.k)}>
                  <View style={[styles.changeBtn, {
                    backgroundColor: editing === f.k ? T.accent : T.pill,
                  }]}>
                    <Text style={{ color: editing === f.k ? C.white : T.accent, fontWeight: '800', fontSize: 12 }}>
                      {editing === f.k ? 'Save ✓' : savedF === f.k ? 'Saved!' : 'Change'}
                    </Text>
                  </View>
                </Tap>
              </View>
              {editing === f.k && (
                <View style={{ marginTop: 4 }}>
                  <TextInput
                    value={val}
                    onChangeText={setVal}
                    placeholder={`New ${f.label.toLowerCase()}`}
                    placeholderTextColor={T.sub}
                    secureTextEntry={f.k === 'password'}
                    keyboardType={f.type}
                    autoCapitalize="none"
                    style={[styles.input, { backgroundColor: T.pill, borderColor: T.accent, color: T.text }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Tap onPress={() => setEditing(null)} style={{ flex: 1 }}>
                      <View style={[styles.actionBtn, { backgroundColor: T.pill }]}>
                        <Text style={{ fontWeight: '800', fontSize: 13, color: T.sub, textAlign: 'center' }}>Cancel</Text>
                      </View>
                    </Tap>
                    <Tap onPress={() => doSave(f.k)} style={{ flex: 1 }}>
                      <View style={[styles.actionBtn, { backgroundColor: T.accent }]}>
                        <Text style={{ fontWeight: '800', fontSize: 13, color: 'white', textAlign: 'center' }}>Save changes</Text>
                      </View>
                    </Tap>
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Notifications */}
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <Text style={[styles.cardTitle, { color: T.text }]}>🔔 Notifications</Text>
            {NOTIF_ITEMS.map(([label], i) => (
              <View key={label} style={[styles.toggleRow, i > 0 && { borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={[styles.toggleLabel, { color: T.text }]}>{label}</Text>
                <Switch
                  value={notifs[i]}
                  onValueChange={v => setNotifs(ns => ns.map((n, idx) => idx === i ? v : n))}
                  trackColor={{ false: T.isDark ? '#444' : '#ddd', true: T.accent }}
                  thumbColor="white"
                />
              </View>
            ))}
          </View>

          {/* Dark mode */}
          <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={[styles.cardTitle, { color: T.text }]}>🌑 Darker Vibe</Text>
                <Text style={[styles.toggleDesc, { color: T.sub }]}>Switch all screens to deep charcoal</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={onDarkToggle}
                trackColor={{ false: T.isDark ? '#444' : '#ddd', true: T.accent }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* Logout / delete */}
          <TouchableOpacity style={styles.logoutBtn} onPress={onSignOut}>
            <Text style={styles.logoutTxt}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: T.sub, fontWeight: '700', fontSize: 13 }}>Delete account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </GradBg>
  );
}

const styles = StyleSheet.create({
  headerGrad:   { paddingTop: 52, paddingHorizontal: 22, paddingBottom: 24 },
  backBtn:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start', marginBottom: 18 },
  backBtnTxt:   { color: 'white', fontWeight: '800', fontSize: 13 },
  title:        { fontSize: 22, fontWeight: '900', color: 'white' },
  subtitle:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card:         { borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  fieldRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel:   { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  fieldVal:     { fontSize: 15, fontWeight: '800' },
  changeBtn:    { borderRadius: 14, paddingHorizontal: 15, paddingVertical: 8 },
  input:        { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontWeight: '600', marginTop: 10 },
  actionBtn:    { borderRadius: 14, paddingVertical: 10 },
  cardTitle:    { fontSize: 14, fontWeight: '900', marginBottom: 12 },
  toggleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  toggleLabel:  { fontSize: 13, fontWeight: '600', flex: 1, paddingRight: 10 },
  toggleDesc:   { fontSize: 12, fontWeight: '600', marginTop: 2 },
  logoutBtn:    { backgroundColor: '#FFE5E8', borderRadius: 22, padding: 16, alignItems: 'center', marginBottom: 10 },
  logoutTxt:    { fontWeight: '900', fontSize: 14, color: '#C0392B' },
});
