import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Event, ChatMessage } from '../data/events';
import { Theme, C } from '../constants/theme';
import Tap from '../components/Tap';

const AVATAR_COLORS: Record<string, string> = {
  Mathis: C.lav, Clara: C.pink, Lukas: C.teal, Zoë: C.green,
};

interface Props {
  event: Event;
  onBack: () => void;
  T: Theme;
}

export default function ChatScreen({ event: e, onBack, T }: Props) {
  const friendNames = new Set(
    (e.attendees ?? []).filter(a => a.isFriend).map(a => a.n),
  );
  const friendSeed = (e.chatSeed ?? []).filter(m => m.isMe || friendNames.has(m.user));
  const [msgs, setMsgs]   = useState<ChatMessage[]>(friendSeed);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs]);

  const send = () => {
    const txt = draft.trim();
    if (!txt) return;
    const now = new Date();
    setMsgs(m => [...m, {
      user: 'You', text: txt, isMe: true,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    }]);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Header */}
      <LinearGradient colors={[C.lav, C.teal]} style={styles.header}>
        <View style={styles.headerInner}>
          <Tap onPress={onBack}>
            <View style={styles.backBtn}>
              <Text style={styles.backBtnTxt}>‹ Back</Text>
            </View>
          </Tap>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{e.emoji} {e.title}</Text>
            <Text style={styles.headerSub}>👫 Friends chat · {friendNames.size} friends going</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Friends-only banner */}
      <View style={[styles.friendsBanner, { backgroundColor: `${C.lav}18`, borderColor: `${C.lav}40` }]}>
        <Text style={{ fontSize: 14 }}>🔒</Text>
        <Text style={[styles.friendsBannerTxt, { color: C.lav }]}>
          Friends-only · only people you know who are attending can see this chat
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {msgs.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 48 }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>👫</Text>
            <Text style={{ fontWeight: '900', fontSize: 16, color: T.text }}>No friends here yet</Text>
            <Text style={{ fontSize: 13, color: T.sub, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              Be the first — invite a friend to this event and start the conversation!
            </Text>
          </View>
        )}
        {msgs.map((m, i) => {
          const acColor = AVATAR_COLORS[m.user] ?? '#FAD7A0';
          return (
            <View key={i} style={[styles.msgRow, m.isMe && styles.msgRowMe]}>
              {!m.isMe && (
                <View style={[styles.avatar, { backgroundColor: acColor }]}>
                  <Text style={styles.avatarTxt}>{m.user[0]}</Text>
                </View>
              )}
              <View style={[styles.bubble, m.isMe ? styles.bubbleMe : { backgroundColor: T.card }]}>
                {!m.isMe && <Text style={styles.bubbleSender}>{m.user}</Text>}
                <Text style={[styles.bubbleText, { color: m.isMe ? C.white : T.text }]}>{m.text}</Text>
                <Text style={[styles.bubbleTime, { color: m.isMe ? 'rgba(255,255,255,0.6)' : T.sub }]}>{m.time}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: T.card, borderTopColor: T.border }]}>
        <View style={[styles.inputWrap, { backgroundColor: T.pill, borderColor: T.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the group…"
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
  header:       { paddingTop: 52, paddingHorizontal: 22, paddingBottom: 18 },
  headerInner:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:      { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 50, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  backBtnTxt:   { color: C.white, fontWeight: '800', fontSize: 14 },
  headerTitle:  { fontWeight: '900', fontSize: 16, color: C.white },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe:     { flexDirection: 'row-reverse' },
  avatar:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: 12, fontWeight: '800', color: C.dark },
  bubble:       { maxWidth: '72%' },
  bubbleMe:     { backgroundColor: C.lav, borderRadius: 18, padding: 12 },
  bubbleSender: { fontSize: 11, fontWeight: '800', color: C.lav, marginBottom: 3 },
  bubbleText:   { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  bubbleTime:   { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  friendsBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  friendsBannerTxt: { fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  inputBar:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, borderTopWidth: 1 },
  inputWrap:    { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  input:        { flex: 1, fontSize: 14, fontWeight: '600' },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
