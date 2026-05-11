/**
 * DashboardScreen – My Trips
 *
 * Lists the user's trips with add / browse actions.
 * Mirrors wanderplan-dashboard.jsx and wanderplan-homepage.jsx trip cards.
 */
import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {Colors, Radii, Shadows, Spacing, Typography} from '../constants/theme';
import TripCard from '../components/TripCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {listTrips, Trip} from '../services/api';

// Demo trips shown when the backend is not reachable
const DEMO_TRIPS: Trip[] = [
  {
    id: 'demo-1',
    title: 'Tokyo Cherry Blossom',
    destination: 'Tokyo, Japan',
    startDate: 'Apr 1 2025',
    endDate: 'Apr 14 2025',
    status: 'planning',
    coverPhoto:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80',
    budgetTotal: 3800,
    groupSize: 2,
  },
  {
    id: 'demo-2',
    title: 'Amalfi Coast Road Trip',
    destination: 'Amalfi, Italy',
    startDate: 'Jun 10 2025',
    endDate: 'Jun 22 2025',
    status: 'confirmed',
    coverPhoto:
      'https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&q=80',
    budgetTotal: 5200,
    groupSize: 4,
  },
  {
    id: 'demo-3',
    title: 'New Zealand Adventure',
    destination: 'South Island, NZ',
    startDate: 'Dec 2024',
    status: 'completed',
    coverPhoto:
      'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=600&q=80',
    budgetTotal: 6400,
    groupSize: 3,
  },
];

interface DashboardScreenProps {
  onNewTrip: () => void;
  userName?: string;
}

export default function DashboardScreen({
  onNewTrip,
  userName,
}: DashboardScreenProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      const fetched = await listTrips();
      setTrips(fetched.length > 0 ? fetched : DEMO_TRIPS);
    } catch {
      setTrips(DEMO_TRIPS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTrips();
  }, [loadTrips]);

  if (loading) {
    return <LoadingSpinner message="Loading your trips…" />;
  }

  const greeting = userName ? `Hey, ${userName.split(' ')[0]} 👋` : 'Hey 👋';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <FlatList
        data={trips}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.greeting}>{greeting}</Text>
                <Text style={styles.subtitle}>
                  {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={onNewTrip}
                activeOpacity={0.8}>
                <Text style={styles.addBtnText}>+ New trip</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard
                label="Upcoming"
                value={
                  trips.filter(t => t.status !== 'completed').length
                }
                color={Colors.primary}
              />
              <StatCard
                label="Completed"
                value={trips.filter(t => t.status === 'completed').length}
                color={Colors.success}
              />
              <StatCard
                label="Countries"
                value={
                  new Set(
                    trips.map(t => t.destination.split(',').pop()?.trim()),
                  ).size
                }
                color={Colors.accent}
              />
            </View>

            <Text style={styles.sectionTitle}>Your Trips</Text>
          </View>
        }
        renderItem={({item}) => (
          <TripCard
            trip={item}
            onPress={() =>
              Alert.alert(item.title, `Destination: ${item.destination}`)
            }
            style={styles.tripCard}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyBody}>
              Tap "New trip" to plan your first adventure with AI.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[statStyles.card, {borderTopColor: color}]}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderTopWidth: 3,
    ...Shadows.sm,
  },
  value: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  label: {
    fontSize: Typography.xs,
    color: Colors.text2,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.bg},
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  greeting: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.text2,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
  },
  addBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  tripCard: {
    marginHorizontal: 0,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: {fontSize: 56, marginBottom: Spacing.md},
  emptyTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontSize: Typography.sm,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
});
