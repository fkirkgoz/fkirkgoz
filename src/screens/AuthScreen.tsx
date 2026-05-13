import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

export interface AuthUser {
  name: string;
  email: string;
  password: string;
  bio?: string;
  vibes?: string[];
}

const mockDB: AuthUser[] = [];

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

  const signup = () => {
    if (!name.trim())    return setErr('Please enter your name.');
    if (!email.trim())   return setErr('Please enter your email.');
    if (pass.length < 6) return setErr('Password must be at least 6 characters.');
    if (pass !== confirm) return setErr("Passwords don't match.");
    if (!termsAccepted)  return setErr('Please accept the Terms & Conditions to continue.');
    if (mockDB.find(u => u.email.toLowerCase() === email.toLowerCase().trim()))
      return setErr('Account already exists. Please log in.');
    setLoad(true);
    setTimeout(() => {
      const u: AuthUser = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: pass,
        bio: bio.trim() || undefined,
        vibes: vibes.length > 0 ? vibes : undefined,
      };
      mockDB.push(u);
      setLoad(false);
      onAuth(u);
    }, 800);
  };

  const login = () => {
    if (!email.trim() || !pass) return setErr('Please fill in all fields.');
    setLoad(true);
    setTimeout(() => {
      const m = mockDB.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (!m)               { setLoad(false); return setErr('User not found. Please sign up first.'); }
      if (m.password !== pass) { setLoad(false); return setErr('Incorrect credentials. Please try again.'); }
      setLoad(false);
      onAuth(m);
    }, 800);
  };

  if (mode === 'welcome') {
    return (
      <LinearGradient colors={[C.lav, C.teal]} style={styles.welcomeFill}>
        <Text style={styles.welcomeIcon}>🗓️</Text>
        <Text style={styles.brand}>Randevu</Text>
        <Text style={styles.tagline}>Your social event companion{'\n'}for Brussels 🇧🇪</Text>
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
      </LinearGradient>
    );
  }

  const isLogin  = mode === 'login';
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

              {/* Bio */}
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

              {/* Vibe selector */}
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
            <View style={[styles.submitBtn, { backgroundColor: canSubmit ? C.lav : '#C8BBE0' }]}>
              <Text style={styles.submitTxt}>
                {load ? 'One sec…' : isLogin ? 'Log in' : 'Create account'}
              </Text>
            </View>
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
  welcomeFill:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  welcomeIcon:     { fontSize: 72, marginBottom: 4 },
  brand:           { fontSize: 42, fontWeight: '900', color: C.white, letterSpacing: -1.5, marginBottom: 6 },
  tagline:         { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600', textAlign: 'center', marginBottom: 52, lineHeight: 24 },
  ctaWrap:         { width: '100%', marginBottom: 14 },
  ctaPrimary:      { backgroundColor: C.white, borderRadius: 50, padding: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 },
  ctaPrimaryTxt:   { color: C.lav, fontWeight: '900', fontSize: 16 },
  ctaSecondary:    { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 50, padding: 17, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' },
  ctaSecondaryTxt: { color: C.white, fontWeight: '900', fontSize: 16 },
  formContainer:   { padding: 28, paddingTop: 56, paddingBottom: 48 },
  backArrow:       { fontSize: 24, marginBottom: 28 },
  formTitle:       { fontSize: 27, fontWeight: '900', marginBottom: 6 },
  formSub:         { fontSize: 14, fontWeight: '600', marginBottom: 30 },
  input:           { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  fieldLabel:      { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  bioInput:        { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, fontWeight: '600', marginBottom: 18, textAlignVertical: 'top', minHeight: 82 },
  vibeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 22 },
  vibePill:        { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  vibePillTxt:     { fontSize: 13, fontWeight: '700' },
  termsRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 3, flexShrink: 0 },
  checkmark:       { color: 'white', fontSize: 12, fontWeight: '900' },
  termsTextWrap:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  termsBase:       { fontSize: 13, fontWeight: '600', lineHeight: 22 },
  termsLink:       { fontSize: 13, fontWeight: '800', lineHeight: 22, textDecorationLine: 'underline' },
  errBox:          { backgroundColor: '#ffe5e8', borderWidth: 1.5, borderColor: '#f5b8c2', borderRadius: 14, padding: 12, marginBottom: 12 },
  errTxt:          { color: '#C0392B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  submitBtn:       { borderRadius: 50, padding: 17, alignItems: 'center' },
  submitTxt:       { color: C.white, fontWeight: '900', fontSize: 16 },
  switchRow:       { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  legalContainer:  { flex: 1 },
  legalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, borderBottomWidth: 1 },
  legalTitle:      { fontSize: 18, fontWeight: '900' },
  legalClose:      { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  legalBody:       { padding: 22, paddingBottom: 36 },
  legalText:       { fontSize: 13, lineHeight: 24, fontWeight: '500' },
  legalAcceptBtn:  { marginHorizontal: 22, marginBottom: 32, borderRadius: 50, padding: 17, alignItems: 'center' },
});
