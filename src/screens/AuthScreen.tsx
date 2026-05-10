import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

export interface AuthUser {
  name: string;
  email: string;
  password: string;
}

const mockDB: AuthUser[] = [];

interface Props {
  onAuth: (user: AuthUser) => void;
  T: Theme;
}

type Mode = 'welcome' | 'login' | 'signup';

export default function AuthScreen({ onAuth, T }: Props) {
  const [mode, setMode]   = useState<Mode>('welcome');
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr]     = useState('');
  const [load, setLoad]   = useState(false);

  const clearErr = () => setErr('');

  const signup = () => {
    if (!name.trim())    return setErr('Please enter your name.');
    if (!email.trim())   return setErr('Please enter your email.');
    if (pass.length < 6) return setErr('Password must be at least 6 characters.');
    if (pass !== confirm) return setErr("Passwords don't match.");
    if (mockDB.find(u => u.email.toLowerCase() === email.toLowerCase().trim()))
      return setErr('Account already exists. Please log in.');
    setLoad(true);
    setTimeout(() => {
      const u: AuthUser = { name: name.trim(), email: email.toLowerCase().trim(), password: pass };
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

  const isLogin = mode === 'login';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => { setMode('welcome'); setErr(''); }}>
          <Text style={[styles.backArrow, { color: T.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.formTitle, { color: T.text }]}>{isLogin ? 'Welcome back 👋' : 'Join Randevu ✨'}</Text>
        <Text style={[styles.formSub, { color: T.sub }]}>{isLogin ? 'Log in to discover Brussels' : 'Create your account — it\'s free'}</Text>

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
          <TextInput
            placeholder="Confirm password"
            placeholderTextColor={T.sub}
            value={confirm}
            onChangeText={v => { setConfirm(v); clearErr(); }}
            style={[styles.input, { backgroundColor: T.input, color: T.text, borderColor: `${T.accent}35` }]}
            secureTextEntry
          />
        )}

        {!!err && (
          <View style={styles.errBox}>
            <Text style={styles.errTxt}>{err}</Text>
          </View>
        )}

        <Tap onPress={isLogin ? login : signup} disabled={load} style={{ marginTop: 4 }}>
          <View style={[styles.submitBtn, { backgroundColor: load ? '#b8a8d8' : C.lav }]}>
            <Text style={styles.submitTxt}>{load ? 'One sec…' : isLogin ? 'Log in' : 'Create account'}</Text>
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
  formContainer:   { padding: 28, paddingTop: 56 },
  backArrow:       { fontSize: 24, marginBottom: 28 },
  formTitle:       { fontSize: 27, fontWeight: '900', marginBottom: 6 },
  formSub:         { fontSize: 14, fontWeight: '600', marginBottom: 30 },
  input:           { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  errBox:          { backgroundColor: '#ffe5e8', borderWidth: 1.5, borderColor: '#f5b8c2', borderRadius: 14, padding: 12, marginBottom: 12 },
  errTxt:          { color: '#C0392B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  submitBtn:       { borderRadius: 50, padding: 17, alignItems: 'center' },
  submitTxt:       { color: C.white, fontWeight: '900', fontSize: 16 },
  switchRow:       { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
});
