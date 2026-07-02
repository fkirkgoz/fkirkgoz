import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, C } from '../constants/theme';
import { AuthUser } from './AuthScreen';
import {
  Message, PublicUser,
  getConversation, sendMessage, markConversationRead,
} from '../lib/social';
import Tap from '../components/Tap';

// Real 1-to-1 messaging. Every bubble in this thread is a row in the
// @randevu_messages_v1 store created by an actual user — no seeded content.
// The thread polls the store so a conversation between two accounts on the
// same device updates live.

const POLL_MS = 2500;

interface Props {
  user: AuthUser;
  peer: PublicUser;
  onBack: () => void;
  T: Theme;
}

export default function ChatScreen({ user, peer, onBack, T }: Props) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs]   = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const countRef  = useRef(0);

  const me = user.email.toLowerCase();

  const refresh = useCallback(async () => {
    const conv = await getConversation(me, peer.email);
    if (conv.length !== countRef.current) {
      countRef.current = conv.length;
      setMsgs(conv);
      markConversationRead(me, peer.email).catch(() => {});
    }
  }, [me, peer.email]);

  useEffect(() => {
    refresh();
    markConversationRead(me, peer.email).catch(() => {});
    const iv = setInterval(refresh, POLL_MS);
    return () => clearInterval(iv);
  }, [refresh, me, peer.email]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs.length]);

  const send = async () => {
    const txt = draft.trim();
    if (!txt) return;
    setDraft('');
    await sendMessage(me, peer.email, txt);
    await refresh();
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Header */}
      <LinearGradient colors={[C.lav, C.teal] as [string, string]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerInner}>
          <Tap onPress={onBack}>
            <View style={styles.backBtn}>
              <Text style={styles.backBtnTxt}>‹ Back</Text>
            </View>
          </Tap>
          <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={{ fontWeight: '900', color: 'white', fontSize: 15 }}>
              {(peer.name || '?').trim()[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{peer.name}</Text>
            <Text style={styles.headerSub}>Direct message</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {msgs.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 48 }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>💬</Text>
            <Text style={{ fontWeight: '900', fontSize: 16, color: T.text }}>Say hi to {peer.name}!</Text>
            <Text style={{ fontSize: 13, color: T.sub, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              This is the start of your conversation.
            </Text>
          </View>
        )}
        {msgs.map(m => {
          const isMe = m.sender === me;
          return (
            <View key={m.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
              {!isMe && (
                <View style={[styles.avatar, { backgroundColor: `${C.lav}30` }]}>
                  <Text style={[styles.avatarTxt, { color: C.lav }]}>
                    {(peer.name || '?').trim()[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              <View style={[styles.bubble, isMe ? styles.bubbleMe : { backgroundColor: T.card }]}>
                <Text style={[styles.bubbleText, { color: isMe ? C.white : T.text }]}>{m.text}</Text>
                <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.6)' : T.sub }]}>
                  {fmtTime(m.timestamp)}{isMe && m.readAt ? ' · Read' : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputBar, {
        backgroundColor: T.card, borderTopColor: T.border,
        paddingBottom: Math.max(insets.bottom, 12),
      }]}>
        <View style={[styles.inputWrap, { backgroundColor: T.pill, borderColor: T.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${peer.name}…`}
            placeholderTextColor={T.sub}
            style={[styles.input, { color: T.text }]}
            onSubmitEditing={send}
            returnKeyType="send"
          />
        </View>
        <TouchableOpacity onPress={send} style={[styles.sendBtn, { backgroundColor: draft.trim() ? C.lav : `${C.lav}44` }]}>
          <Text style={{ fontSize: 18 }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header:       { paddingHorizontal: 22, paddingBottom: 14 },
  headerInner:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 50, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  backBtnTxt:   { color: C.white, fontWeight: '800', fontSize: 14 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontWeight: '900', fontSize: 16, color: C.white },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe:     { flexDirection: 'row-reverse' },
  avatar:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: 12, fontWeight: '800' },
  bubble:       { maxWidth: '72%', borderRadius: 18, padding: 12 },
  bubbleMe:     { backgroundColor: C.lav },
  bubbleText:   { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  bubbleTime:   { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  inputBar:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  inputWrap:    { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  input:        { flex: 1, fontSize: 14, fontWeight: '600' },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
