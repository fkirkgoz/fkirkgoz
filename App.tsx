import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { makeTheme, Theme, C } from './src/constants/theme';
import { Locale, t } from './src/i18n';
import { Event, EVENTS } from './src/data/events';
import { Avatar } from './src/data/avatars';
import { AuthUser } from './src/screens/AuthScreen';
import { logSessionStart, logEventSaved, isAdminUser } from './src/lib/metrics';
import { PublicUser } from './src/lib/social';

import AuthScreen        from './src/screens/AuthScreen';
import HomeScreen        from './src/screens/HomeScreen';
import MapScreen         from './src/screens/MapScreen';
import NowScreen         from './src/screens/NowScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import AdminScreen       from './src/screens/AdminScreen';
import FriendsScreen     from './src/screens/FriendsScreen';
import ChatScreen        from './src/screens/ChatScreen';

// ── Navigation types ──────────────────────────────────────────────────────────
export type RootStackParamList = {
  Main:     undefined;
  Detail:   { event: Event };
  Settings: undefined;
  Friends:  undefined;
  Chat:     { peer: PublicUser };
  Admin:    undefined;
};

export type TabParamList = {
  Home:    undefined;
  Map:     undefined;
  Now:     undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

const USER_KEY   = '@randevu_user';
const LOCALE_KEY = '@randevu_locale';
// Joined events persist per account so schedules survive restarts and
// feed real save-analytics into the admin metrics store.
const joinedKey = (email: string) => `@randevu_joined:${email.toLowerCase()}`;

// ── Tab bar icon ──────────────────────────────────────────────────────────────
function TabIcon({ name, focused }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    Home: '🏠', Map: '🗺️', Now: '⚡', Profile: '👤',
  };
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{icons[name] ?? '●'}</Text>
    </View>
  );
}

// ── Tab navigator ─────────────────────────────────────────────────────────────
function TabNavigator({
  T, myEvents, onEventPress, onSettings, onOpenFriends,
  user, avatar, onAvatarChange, profileData, onProfileUpdate, onUserUpdate, locale,
}: {
  T: Theme;
  myEvents: Event[];
  onEventPress: (e: Event) => void;
  onSettings: () => void;
  onOpenFriends: () => void;
  user: AuthUser | null;
  avatar: Avatar | null;
  onAvatarChange: (av: Avatar) => void;
  profileData: { email: string; phone: string };
  onProfileUpdate: (d: { email: string; phone: string }) => void;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  locale: Locale;
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
      <Tab.Screen name="Home" options={{ tabBarLabel: t('tab.home', locale) }}>
        {() => (
          <HomeScreen
            onEventPress={onEventPress}
            T={T}
            myEvents={myEvents}
            locale={locale}
            user={user}
            onOpenFriends={onOpenFriends}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Map" options={{ tabBarLabel: t('tab.map', locale) }}>
        {() => <MapScreen onEventPress={onEventPress} T={T} />}
      </Tab.Screen>
      <Tab.Screen name="Now" options={{ tabBarLabel: t('tab.now', locale) }}>
        {() => <NowScreen onEventPress={onEventPress} T={T} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ tabBarLabel: t('tab.profile', locale) }}>
        {() => (
          <ProfileScreen
            user={user}
            onSettings={onSettings}
            onOpenFriends={onOpenFriends}
            avatar={avatar}
            onAvatarChange={onAvatarChange}
            profileData={profileData}
            T={T}
            myEvents={myEvents}
            onEventPress={onEventPress}
            onUserUpdate={onUserUpdate}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,         setUser]         = useState<AuthUser | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [avatar,       setAvatar]       = useState<Avatar | null>(null);
  const [profileData,  setProfileData]  = useState({ email: '', phone: '' });
  const [isDark,       setIsDark]       = useState(false);
  const [locale,       setLocale]       = useState<Locale>('en');
  const [joinedEvents, setJoinedEvents] = useState<number[]>([]);

  const T        = useMemo(() => makeTheme(isDark), [isDark]);
  const myEvents = useMemo(() => EVENTS.filter(e => joinedEvents.includes(e.id)), [joinedEvents]);

  // Load persisted user + locale on first launch; restoring a session counts
  // as a session start for the metrics log.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(LOCALE_KEY),
    ]).then(async ([userJson, localeStr]) => {
      if (localeStr) setLocale(localeStr as Locale);
      if (userJson) {
        const restored: AuthUser = JSON.parse(userJson);
        setUser(restored);
        setProfileData(p => ({ ...p, email: restored.email }));
        logSessionStart(restored.email).catch(() => {});
        const joinedJson = await AsyncStorage.getItem(joinedKey(restored.email)).catch(() => null);
        if (joinedJson) setJoinedEvents(JSON.parse(joinedJson));
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const handleAuth = useCallback((u: AuthUser) => {
    setUser(u);
    setProfileData(p => ({ ...p, email: u.email }));
    AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
    logSessionStart(u.email).catch(() => {});
    AsyncStorage.getItem(joinedKey(u.email))
      .then(json => setJoinedEvents(json ? JSON.parse(json) : []))
      .catch(() => setJoinedEvents([]));
  }, []);

  const handleSignOut = useCallback(() => {
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
    setUser(null);
    setJoinedEvents([]);
  }, []);

  const handleLocaleChange = useCallback((l: Locale) => {
    setLocale(l);
    AsyncStorage.setItem(LOCALE_KEY, l).catch(() => {});
  }, []);

  const handleUserUpdate = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const handleJoin = useCallback((ev: Event) => {
    setJoinedEvents(prev => {
      const joining = !prev.includes(ev.id);
      const next = joining ? [...prev, ev.id] : prev.filter(id => id !== ev.id);
      if (user) {
        AsyncStorage.setItem(joinedKey(user.email), JSON.stringify(next)).catch(() => {});
      }
      if (joining) logEventSaved(ev.id, ev.title, ev.venue).catch(() => {});
      return next;
    });
  }, [user]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F7' }}>
          <ActivityIndicator size="large" color={C.lav} />
        </View>
      </SafeAreaProvider>
    );
  }

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
                onOpenFriends={() => navigation.navigate('Friends')}
                user={user}
                avatar={avatar}
                onAvatarChange={setAvatar}
                profileData={profileData}
                onProfileUpdate={setProfileData}
                onUserUpdate={handleUserUpdate}
                locale={locale}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Detail">
            {({ route, navigation }) => (
              <EventDetailScreen
                event={route.params.event}
                onBack={() => navigation.goBack()}
                onJoin={handleJoin}
                joined={joinedEvents.includes(route.params.event.id)}
                T={T}
                onEventPress={ev => navigation.push('Detail', { event: ev })}
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
                onSignOut={handleSignOut}
                locale={locale}
                onLocaleChange={handleLocaleChange}
                isAdmin={isAdminUser(user)}
                onOpenAdmin={() => navigation.navigate('Admin')}
                T={T}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Friends">
            {({ navigation }) => (
              <FriendsScreen
                user={user}
                onBack={() => navigation.goBack()}
                onOpenChat={peer => navigation.navigate('Chat', { peer })}
                T={T}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Chat">
            {({ route, navigation }) => (
              <ChatScreen
                user={user}
                peer={route.params.peer}
                onBack={() => navigation.goBack()}
                T={T}
              />
            )}
          </Stack.Screen>

          {/* RBAC: the Admin route exists ONLY for the hardcoded administrator
              profile — for every other account it is never registered, so it is
              unreachable and invisible by construction. */}
          {isAdminUser(user) && (
            <Stack.Screen name="Admin">
              {({ navigation }) => (
                <AdminScreen onBack={() => navigation.goBack()} user={user} T={T} />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
