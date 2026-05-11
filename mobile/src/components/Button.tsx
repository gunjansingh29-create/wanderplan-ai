import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {Colors, Radii, Typography, Spacing} from '../constants/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const sizeMap: Record<Size, {paddingVertical: number; fontSize: number}> = {
  sm: {paddingVertical: 8, fontSize: Typography.sm},
  md: {paddingVertical: 13, fontSize: Typography.base},
  lg: {paddingVertical: 16, fontSize: Typography.md},
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const sz = sizeMap[size];

  const containerStyle: ViewStyle = {
    paddingVertical: sz.paddingVertical,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    opacity: disabled || loading ? 0.55 : 1,
    alignSelf: fullWidth ? 'stretch' : 'center',
    ...(variant === 'primary' && {
      backgroundColor: Colors.primary,
    }),
    ...(variant === 'secondary' && {
      backgroundColor: Colors.secondary,
    }),
    ...(variant === 'outline' && {
      backgroundColor: Colors.transparent,
      borderWidth: 1.5,
      borderColor: Colors.primary,
    }),
    ...(variant === 'ghost' && {
      backgroundColor: Colors.transparent,
    }),
  };

  const labelColor =
    variant === 'outline'
      ? Colors.primary
      : variant === 'ghost'
      ? Colors.primary
      : Colors.white;

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            {fontSize: sz.fontSize, color: labelColor},
            textStyle,
          ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
