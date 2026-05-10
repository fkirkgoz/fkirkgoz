import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

interface TapProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export default function Tap({ children, onPress, style, disabled = false }: TapProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        { opacity: pressed && !disabled ? 0.72 : 1, transform: [{ scale: pressed && !disabled ? 0.96 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
