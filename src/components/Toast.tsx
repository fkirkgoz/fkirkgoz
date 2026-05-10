import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../constants/theme';

interface ToastProps {
  msg: string;
  position?: 'top' | 'bottom';
}

export default function Toast({ msg, position = 'bottom' }: ToastProps) {
  return (
    <Text style={[styles.toast, position === 'top' ? styles.top : styles.bottom]}>
      {msg}
    </Text>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: C.dark,
    color: C.cream,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: '700',
    zIndex: 600,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
  top:    { top: 80 },
  bottom: { bottom: 100 },
});
