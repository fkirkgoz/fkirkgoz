import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradBgProps {
  isDark: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GradBg({ isDark, children, style }: GradBgProps) {
  const colors: [string, string, string] = isDark
    ? ['#1A1A2E', '#1A1A1A', '#0D0D0D']
    : ['#F8F9FA', '#EEF0F8', '#E9ECEF'];

  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={[styles.fill, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
