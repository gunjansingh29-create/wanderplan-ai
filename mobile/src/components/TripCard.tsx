import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {Colors, Radii, Shadows, Spacing, Typography} from '../constants/theme';
import {Trip} from '../services/api';

const STATUS_COLOR: Record<Trip['status'], string> = {
  planning: Colors.warning,
  confirmed: Colors.primary,
  completed: Colors.success,
};

const STATUS_LABEL: Record<Trip['status'], string> = {
  planning: 'Planning',
  confirmed: 'Confirmed',
  completed: 'Completed',
};

const PLACEHOLDER_PHOTO =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&q=80';

interface TripCardProps {
  trip: Trip;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function TripCard({trip, onPress, style}: TripCardProps) {
  const statusColor = STATUS_COLOR[trip.status];

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.88}>
      <Image
        source={{uri: trip.coverPhoto ?? PLACEHOLDER_PHOTO}}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Status pill */}
      <View style={[styles.statusPill, {backgroundColor: statusColor + '22'}]}>
        <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
        <Text style={[styles.statusText, {color: statusColor}]}>
          {STATUS_LABEL[trip.status]}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={styles.destination} numberOfLines={1}>
          📍 {trip.destination}
        </Text>

        <View style={styles.meta}>
          {trip.startDate && (
            <Text style={styles.metaText}>
              🗓 {trip.startDate}
              {trip.endDate ? ` → ${trip.endDate}` : ''}
            </Text>
          )}
          {trip.groupSize !== undefined && trip.groupSize > 1 && (
            <Text style={styles.metaText}>👥 {trip.groupSize} travellers</Text>
          )}
          {trip.budgetTotal !== undefined && (
            <Text style={styles.metaText}>
              💵 ${trip.budgetTotal.toLocaleString()}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.md,
    marginBottom: Spacing.md,
  },
  image: {
    width: '100%',
    height: 150,
  },
  statusPill: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: Typography.xs,
    fontWeight: '600',
  },
  body: {
    padding: Spacing.md,
  },
  title: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  destination: {
    fontSize: Typography.sm,
    color: Colors.text2,
    marginBottom: Spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    fontSize: Typography.xs,
    color: Colors.text3,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
});
