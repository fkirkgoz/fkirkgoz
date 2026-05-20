import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

export interface AuthUser {
  name: string;
  email: string;
  password: string;
  bio?: string;
  vibes?: string[];
}

// ── User store ─────────────────────────────────────────────────────────────────
// Users are persisted to AsyncStorage so login survives app restarts.
// The mockDB fallback is kept for the current session only (e.g. just-signed-up
// user who hasn't yet been flushed to storage).
const USERS_KEY = '@randevu_users';
const sessionDB: AuthUser[] = [];

async function loadUsers(): Promise<AuthUser[]> {
  try {
    const json = await AsyncStorage.getItem(USERS_KEY);
    const stored: AuthUser[] = json ? JSON.parse(json) : [];
    // Merge in-session signups not yet flushed (edge case: rapid sign-up/log-in)
    for (const u of sessionDB) {
      if (!stored.find(s => s.email.toLowerCase() === u.email.toLowerCase())) {
        stored.push(u);
      }
    }
    return stored;
  } catch {
    return [...sessionDB];
  }
}

async function persistUser(user: AuthUser): Promise<void> {
  sessionDB.push(user);
  try {
    const existing = await loadUsers();
    // Upsert
    const updated = [...existing.filter(u => u.email.toLowerCase() !== user.email.toLowerCase()), user];
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
  } catch {
    // Storage failure is non-fatal; session cache still works for this run.
  }
}

// ── TODO: Email verification (future backend integration) ─────────────────────
// When a real email service is wired up, call sendVerificationEmail(user.email)
// here and block onAuth() until the user confirms their address.
//
// async function sendVerificationEmail(email: string): Promise<void> {
//   await api.post('/auth/verify', { email });
// }
// ─────────────────────────────────────────────────────────────────────────────

const VIBE_OPTIONS = [
  'Techno', 'Jazz', 'Hip-Hop', 'Food & Drink',
  'Outdoors', 'Art', 'Sports', 'Wellness',
  'Nightlife', 'Culture', 'Music', 'Markets',
];

const LEGAL_TEXT = `Privacy Policy & Terms of Service
Last updated: May 2026

1. DATA WE COLLECT
We collect the information you provide when creating an account — including your name, email address, bio, and vibe preferences — as well as your in-app activity such as events joined and friends connected.

2. HOW WE USE YOUR DATA
Your data is used solely to provide the Randevu service: discovering events, connecting with friends, and personalising your Brussels experience. We do not sell or share your data with advertisers.

3. GDPR RIGHTS (EU / EEA USERS)
Under the General Data Protection Regulation, you have the right to:
• Access the personal data we hold about you
• Correct inaccurate data
• Request deletion of your account and data
• Object to processing

To exercise any of these rights, contact: privacy@randevu.app

4. DATA STORAGE & SECURITY
Your profile data is stored locally on your device using AsyncStorage. No passwords are transmitted to external servers. We apply industry-standard security practices to protect your information.

5. USER AGREEMENT
By creating an account you agree to:
• Use Randevu only for lawful purposes
• Treat all community members with respect
• Not post false, misleading, or harmful content
• Be at least 18 years of age

6. COOKIES & TRACKING
Randevu does not use tracking cookies, third-party analytics, or advertising networks.

7. CHANGES TO THIS POLICY
We may update this policy from time to time. Significant changes will be notified in the app.

8. CONTACT
privacy@randevu.app
Randevu · Brussels, Belgium`;

interface Props {
  onAuth: (user: AuthUser) => void;
  T: Theme;
}

type Mode = 'welcome' | 'login' | 'signup';

export default function AuthScreen({ onAuth, T }: Props) {
  const [mode, setMode]       = useState<Mode>('welcome');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [bio, setBio]         = useState('');
  const [vibes, setVibes]     = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalOpen, setLegalOpen]         = useState(false);
  const [err, setErr]   = useState('');
  const [load, setLoad] = useState(false);

  const clearErr = () => setErr('');

  const toggleVibe = (v: string) => {
    setVibes(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v);
      if (prev.length >= 3) return prev;
      return [...prev, v];
    });
    clearErr();
  };

  const signup = async () => {
    if (!name.trim())     return setErr('Please enter your name.');
    if (!email.trim())    return setErr('Please enter your email.');
    if (!/\S+@\S+\.\S+/.test(email.trim())) return setErr('Please enter a valid email address.');
    if (pass.length < 6)  return setErr('Password must be at least 6 characters.');
    if (pass !== confirm)  return setErr("Passwords don't match.");
    if (!termsAccepted)    return setErr('Please accept the Terms & Conditions to continue.');

    setLoad(true);
    try {
      const users = await loadUsers();
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
        setErr('An account with this email already exists. Please log in.');
        return;
      }

      const u: AuthUser = {
        name:   name.trim(),
        email:  email.toLowerCase().trim(),
        password: pass,
        bio:    bio.trim() || undefined,
        vibes:  vibes.length > 0 ? vibes : undefined,
      };

      await persistUser(u);
      onAuth(u);
    } catch {
      setErr('Something went wrong. Please try again.');
    } finally {
      setLoad(false);
    }
  };

  const login = async () => {
    if (!email.trim() || !pass) return setErr('Please fill in all fields.');
    setLoad(true);
    try {
      const users = await loadUsers();
      const match = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (!match) {
        setErr('No account found. Please sign up first.');
        return;
      }
      if (match.password !== pass) {
        setErr('Incorrect password. Please try again.');
        return;
      }
      onAuth(match);
    } catch {
      setErr('Something went wrong. Please try again.');
    } finally {
      setLoad(false);
    }
  };

  // ── Welcome screen ───────────────────────────────────────────────────────────
  if (mode === 'welcome') {
    return (
      <LinearGradient colors={[C.lavD, C.lav, C.teal]} style={styles.welcomeFill}>
        {/* Decorative blobs */}
        <View style={[styles.blob, { top: 60, right: -30, backgroundColor: 'rgba(255,255,255,0.08)', width: 180, height: 180, borderRadius: 90 }]} />
        <View style={[styles.blob, { bottom: 120, left: -40, backgroundColor: 'rgba(255,255,255,0.06)', width: 220, height: 220, borderRadius: 110 }]} />

        <View style={styles.welcomeCenter}>
          <View style={styles.welcomeIconWrap}>
            <Text style={styles.welcomeIcon}>🗓️</Text>
          </View>
          <Text style={styles.brand}>Randevu</Text>
          <View style={styles.cityBadge}>
            <Text style={styles.cityBadgeTxt}>Brussels · Belgium 🇧🇪</Text>
          </View>
          <Text style={styles.tagline}>Your social event companion{'\n'}for the city</Text>
        </View>

        <View style={styles.welcomeBtns}>
          <Tap onPress={() => setMode('signup')} style={styles.ctaWrap}>
            <View style={styles.ctaPrimary}>
              <Text style={styles.ctaPrimaryTxt}>Create account ✨</Text>
            </View>
          </Tap>
          <Tap onPress={() => setMode('login')} style={styles.ctaWrap}>
            <View style={styles.ctaSecondary}>
              <Text style={styles.ctaSecondaryTxt}>Log in →</Text>
            </View>
          </Tap>
          <Text style={styles.welcomeFooter}>Free · No ads · GDPR compliant</Text>
        </View>
      </LinearGradient>
    );
  }

  // ── Login / Sign-up form ─────────────────────────────────────────────────────
  const isLogin   = mode === 'login';
  const canSubmit = !load && (isLogin || termsAccepted);

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, backgroundColor: T.bg }}
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => { setMode('welcome'); setErr(''); }}>
            <Text style={[styles.backArrow, { color: T.text }]}>←</Text>
          </TouchableOpacity>

          <Text style={[styles.formTitle, { color: T.text }]}>
            {isLogin ? 'Welcome back 👋' : 'Join Randevu ✨'}
          </Text>
          <Text style={[styles.formSub, { color: T.sub }]}>
            {isLogin ? 'Log in to discover Brussels' : "Create your account — it's free"}
          </Text>

          {!isLogin && (
            <TextInput
              placeholder="Full name"
              placeholderTextColor={T.sub}
              value={name}
              onChangeText={v => { setName(v); clearErr(); }}
              style={[styles.input, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
              autoCapitalize="words"
            />
          )}

          <TextInput
            placeholder="Email address"
            placeholderTextColor={T.sub}
            value={email}
            onChangeText={v => { setEmail(v); clearErr(); }}
            style={[styles.input, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor={T.sub}
            value={pass}
            onChangeText={v => { setPass(v); clearErr(); }}
            style={[styles.input, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
            secureTextEntry
          />

          {!isLogin && (
            <>
              <TextInput
                placeholder="Confirm password"
                placeholderTextColor={T.sub}
                value={confirm}
                onChangeText={v => { setConfirm(v); clearErr(); }}
                style={[styles.input, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
                secureTextEntry
              />

              <Text style={[styles.fieldLabel, { color: T.sub }]}>Bio (optional)</Text>
              <TextInput
                placeholder="Tell Brussels who you are… 🎉"
                placeholderTextColor={T.sub}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={[styles.bioInput, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
              />

              <Text style={[styles.fieldLabel, { color: T.sub }]}>
                Your Vibes (pick up to 3)
                {vibes.length > 0 && <Text style={{ color: C.lav }}> · {vibes.length}/3</Text>}
              </Text>
              <View style={styles.vibeGrid}>
                {VIBE_OPTIONS.map(v => {
                  const active = vibes.includes(v);
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => toggleVibe(v)}
                      style={[styles.vibePill, {
                        backgroundColor: active ? C.lav : T.pill,
                        borderColor: active ? C.lav : `${T.accent}25`,
                      }]}
                    >
                      <Text style={[styles.vibePillTxt, { color: active ? 'white' : T.sub }]}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Terms & Conditions */}
              <View style={styles.termsRow}>
                <TouchableOpacity
                  onPress={() => { setTermsAccepted(t => !t); clearErr(); }}
                  style={[styles.checkbox, {
                    borderColor: termsAccepted ? C.lav : '#bbb',
                    backgroundColor: termsAccepted ? C.lav : 'transparent',
                  }]}
                >
                  {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
                <View style={styles.termsTextWrap}>
                  <Text style={[styles.termsBase, { color: T.sub }]}>I accept the </Text>
                  <TouchableOpacity onPress={() => setLegalOpen(true)}>
                    <Text style={[styles.termsLink, { color: C.lav }]}>Terms & Conditions</Text>
                  </TouchableOpacity>
                  <Text style={[styles.termsBase, { color: T.sub }]}> and </Text>
                  <TouchableOpacity onPress={() => setLegalOpen(true)}>
                    <Text style={[styles.termsLink, { color: C.lav }]}>Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {!!err && (
            <View style={styles.errBox}>
              <Text style={styles.errTxt}>{err}</Text>
            </View>
          )}

          <Tap onPress={isLogin ? login : signup} disabled={!canSubmit} style={{ marginTop: 4 }}>
            <LinearGradient
              colors={canSubmit ? [C.lavD, C.lav] : ['#C8BBE0', '#C8BBE0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Text style={styles.submitTxt}>
                {load ? 'One sec…' : isLogin ? 'Log in' : 'Create account'}
              </Text>
            </LinearGradient>
          </Tap>

          {isLogin && (
            <TouchableOpacity style={{ marginTop: 16, alignSelf: 'center' }}>
              <Text style={{ color: C.lav, fontWeight: '700', fontSize: 13 }}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <View style={styles.switchRow}>
            <Text style={{ color: T.sub, fontSize: 13, fontWeight: '600' }}>
              {isLogin ? 'No account? ' : 'Have an account? '}
            </Text>
            <TouchableOpacity onPress={() => { setMode(isLogin ? 'signup' : 'login'); setErr(''); }}>
              <Text style={{ color: C.lav, fontWeight: '800', fontSize: 13 }}>
                {isLogin ? 'Sign up' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Legal / Privacy modal */}
      <Modal visible={legalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.legalContainer, { backgroundColor: T.card }]}>
          <View style={[styles.legalHeader, { borderBottomColor: T.border }]}>
            <Text style={[styles.legalTitle, { color: T.text }]}>📄 Legal</Text>
            <TouchableOpacity onPress={() => setLegalOpen(false)}>
              <View style={[styles.legalClose, { backgroundColor: T.pill }]}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: T.sub }}>Close ✕</Text>
              </View>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.legalBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.legalText, { color: T.text }]}>{LEGAL_TEXT}</Text>
          </ScrollView>
          <TouchableOpacity
            style={[styles.legalAcceptBtn, { backgroundColor: C.lav }]}
            onPress={() => { setTermsAccepted(true); setLegalOpen(false); }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 15 }}>I Accept ✓</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Welcome
  welcomeFill:    { flex: 1, paddingHorizontal: 32 },
  blob:           { position: 'absolute' },
  welcomeCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcomeIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  welcomeIcon:    { fontSize: 44 },
  brand:          { fontSize: 46, fontWeight: '900', color: C.white, letterSpacing: -2, marginBottom: 10 },
  cityBadge:      { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  cityBadgeTxt:   { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  tagline:        { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textAlign: 'center', lineHeight: 24 },
  welcomeBtns:    { paddingBottom: 52, width: '100%' },
  ctaWrap:        { width: '100%', marginBottom: 12 },
  ctaPrimary:     { backgroundColor: C.white, borderRadius: 50, padding: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  ctaPrimaryTxt:  { color: C.lav, fontWeight: '900', fontSize: 16 },
  ctaSecondary:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, padding: 17, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  ctaSecondaryTxt: { color: C.white, fontWeight: '900', fontSize: 16 },
  welcomeFooter:  { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600', marginTop: 10 },

  // Form
  formContainer:  { padding: 28, paddingTop: 56, paddingBottom: 48 },
  backArrow:      { fontSize: 24, marginBottom: 28 },
  formTitle:      { fontSize: 27, fontWeight: '900', marginBottom: 6 },
  formSub:        { fontSize: 14, fontWeight: '600', marginBottom: 30 },
  input:          { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  fieldLabel:     { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  bioInput:       { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, fontWeight: '600', marginBottom: 18, textAlignVertical: 'top', minHeight: 82 },
  vibeGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 22 },
  vibePill:       { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  vibePillTxt:    { fontSize: 13, fontWeight: '700' },
  termsRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 3, flexShrink: 0 },
  checkmark:      { color: 'white', fontSize: 12, fontWeight: '900' },
  termsTextWrap:  { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  termsBase:      { fontSize: 13, fontWeight: '600', lineHeight: 22 },
  termsLink:      { fontSize: 13, fontWeight: '800', lineHeight: 22, textDecorationLine: 'underline' },
  errBox:         { backgroundColor: '#ffe5e8', borderWidth: 1.5, borderColor: '#f5b8c2', borderRadius: 14, padding: 12, marginBottom: 12 },
  errTxt:         { color: '#C0392B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  submitBtn:      { borderRadius: 50, padding: 17, alignItems: 'center' },
  submitTxt:      { color: C.white, fontWeight: '900', fontSize: 16 },
  switchRow:      { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },

  // Legal modal
  legalContainer: { flex: 1 },
  legalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, borderBottomWidth: 1 },
  legalTitle:     { fontSize: 18, fontWeight: '900' },
  legalClose:     { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  legalBody:      { padding: 22, paddingBottom: 36 },
  legalText:      { fontSize: 13, lineHeight: 24, fontWeight: '500' },
  legalAcceptBtn: { marginHorizontal: 22, marginBottom: 32, borderRadius: 50, padding: 17, alignItems: 'center' },
});
