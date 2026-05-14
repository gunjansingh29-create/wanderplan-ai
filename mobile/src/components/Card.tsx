import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {Colors, Radii, Shadows, Spacing} from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  padding?: number;
}

export default function Card({
  children,
  style,
  elevation = 'sm',
  padding = Spacing.md,
}: CardProps) {
  const shadowStyle = elevation === 'none' ? {} : Shadows[elevation];

  return (
    <View
      style={[
        styles.card,
        shadowStyle,
        {padding},
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
