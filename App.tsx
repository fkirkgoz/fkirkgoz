import React, { useState, useMemo, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeTheme, Theme, C } from './src/constants/theme';
import { Event, EVENTS } from './src/data/events';
import { Avatar } from './src/data/avatars';
import { AuthUser } from './src/screens/AuthScreen';

import AuthScreen  from './src/screens/AuthScreen';
import HomeScreen  from './src/screens/HomeScreen';
import MapScreen   from './src/screens/MapScreen';
import NowScreen   from './src/screens/NowScreen';
import ProfileScreen   from './src/screens/ProfileScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import ChatScreen      from './src/screens/ChatScreen';
import SettingsScreen  from './src/screens/SettingsScreen';

// ── Navigation types ──────────────────────────────────────────────────────────
export type RootStackParamList = {
  Main:     undefined;
  Detail:   { event: Event };
  Chat:     { event: Event };
  Settings: undefined;
};

export type TabParamList = {
  Home:    undefined;
  Map:     undefined;
  Now:     undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

// ── Tab bar icon SVG paths (inline, no asset needed) ─────────────────────────
function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    Home:    '🏠', Map: '🗺️', Now: '⚡', Profile: '👤',
  };
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{icons[name] ?? '●'}</Text>
    </View>
  );
}

// ── Tab navigator ─────────────────────────────────────────────────────────────
function TabNavigator({
  T, myEvents, onEventPress, onSettings,
  user, avatar, onAvatarChange, profileData, onProfileUpdate,
}: {
  T: Theme;
  myEvents: Event[];
  onEventPress: (e: Event) => void;
  onSettings: () => void;
  user: AuthUser | null;
  avatar: Avatar | null;
  onAvatarChange: (av: Avatar) => void;
  profileData: { email: string; phone: string };
  onProfileUpdate: (d: { email: string; phone: string }) => void;
}) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.sub,
        tabBarStyle: {
          backgroundColor: T.isDark ? '#1A1A1A' : '#FDFDFD',
          borderTopColor: T.isDark ? '#2D2D2D' : '#E5E5EA',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 68,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
        tabBarIcon: ({ focused, color }) => <TabIcon name={route.name} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home">
        {() => <HomeScreen onEventPress={onEventPress} T={T} myEvents={myEvents} />}
      </Tab.Screen>
      <Tab.Screen name="Map">
        {() => <MapScreen onEventPress={onEventPress} T={T} />}
      </Tab.Screen>
      <Tab.Screen name="Now" options={{ tabBarLabel: 'NOW ⚡' }}>
        {() => <NowScreen onEventPress={onEventPress} T={T} />}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <ProfileScreen
            user={user}
            onSettings={onSettings}
            avatar={avatar}
            onAvatarChange={onAvatarChange}
            profileData={profileData}
            T={T}
            myEvents={myEvents}
            onEventPress={onEventPress}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [avatar,       setAvatar]       = useState<Avatar | null>(null);
  const [profileData,  setProfileData]  = useState({ email: '', phone: '' });
  const [isDark,       setIsDark]       = useState(false);
  const [joinedEvents, setJoinedEvents] = useState<number[]>([]);

  const T = useMemo(() => makeTheme(isDark), [isDark]);
  const myEvents = useMemo(() => EVENTS.filter(e => joinedEvents.includes(e.id)), [joinedEvents]);

  const handleAuth = useCallback((u: AuthUser) => {
    setUser(u);
    setProfileData(p => ({ ...p, email: u.email }));
  }, []);

  const handleJoin = useCallback((ev: Event) => {
    setJoinedEvents(p => p.includes(ev.id) ? p.filter(id => id !== ev.id) : [...p, ev.id]);
  }, []);

  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AuthScreen onAuth={handleAuth} T={T} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="Main">
            {({ navigation }) => (
              <TabNavigator
                T={T}
                myEvents={myEvents}
                onEventPress={ev => navigation.navigate('Detail', { event: ev })}
                onSettings={() => navigation.navigate('Settings')}
                user={user}
                avatar={avatar}
                onAvatarChange={setAvatar}
                profileData={profileData}
                onProfileUpdate={setProfileData}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Detail">
            {({ route, navigation }) => (
              <EventDetailScreen
                event={route.params.event}
                onBack={() => navigation.goBack()}
                onOpenChat={() => navigation.navigate('Chat', { event: route.params.event })}
                onJoin={handleJoin}
                joined={joinedEvents.includes(route.params.event.id)}
                T={T}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Chat">
            {({ route, navigation }) => (
              <ChatScreen
                event={route.params.event}
                onBack={() => navigation.goBack()}
                T={T}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Settings">
            {({ navigation }) => (
              <SettingsScreen
                user={user}
                onBack={() => navigation.goBack()}
                profileData={profileData}
                onProfileUpdate={setProfileData}
                isDark={isDark}
                onDarkToggle={() => setIsDark(d => !d)}
                T={T}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({});
