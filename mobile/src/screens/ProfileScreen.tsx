/**
 * ProfileScreen – User profile & settings
 *
 * Mirrors the profile / settings panel in wanderplan-homepage.jsx.
 */
import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  SafeAreaView,
} from 'react-native';
import {Colors, Radii, Shadows, Spacing, Typography} from '../constants/theme';
import {signOut, getSession, getProfile} from '../services/api';

interface ProfileScreenProps {
  onSignOut: () => void;
}

interface SettingRow {
  label: string;
  description?: string;
  type: 'toggle' | 'action' | 'info';
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
}

export default function ProfileScreen({onSignOut}: ProfileScreenProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Traveller');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [offlineEnabled, setOfflineEnabled] = useState(false);

  const load = useCallback(async () => {
    const session = await getSession();
    if (session?.email) {
      setEmail(session.email);
      const profile = await getProfile(session.email);
      if (profile?.name) setName(profile.name);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function initials(n: string) {
    return n
      .split(' ')
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          onSignOut();
        },
      },
    ]);
  }

  const settingSections: Array<{title: string; rows: SettingRow[]}> = [
    {
      title: 'Notifications',
      rows: [
        {
          label: 'Push notifications',
          description: 'Trip reminders and AI suggestions',
          type: 'toggle',
          value: pushEnabled,
          onToggle: v => setPushEnabled(v),
        },
      ],
    },
    {
      title: 'Data & Offline',
      rows: [
        {
          label: 'Offline mode',
          description: 'Cache trips for offline access',
          type: 'toggle',
          value: offlineEnabled,
          onToggle: v => setOfflineEnabled(v),
        },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          label: 'Privacy policy',
          type: 'action',
          onPress: () =>
            Alert.alert('Privacy', 'Opens privacy policy in browser.'),
        },
        {
          label: 'Terms of service',
          type: 'action',
          onPress: () =>
            Alert.alert('Terms', 'Opens terms of service in browser.'),
        },
        {
          label: 'Sign out',
          type: 'action',
          destructive: true,
          onPress: handleSignOut,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatItem label="Trips" value="5" />
          <StatItem label="Countries" value="12" />
          <StatItem label="Days" value="87" />
        </View>

        {/* Settings sections */}
        {settingSections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, idx) => (
                <React.Fragment key={row.label}>
                  <SettingItem row={row} />
                  {idx < section.rows.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* App version */}
        <Text style={styles.version}>WanderPlan AI iOS v1.0.0 (beta)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({label, value}: {label: string; value: string}) {
  return (
    <View style={statStyles.item}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function SettingItem({row}: {row: SettingRow}) {
  return (
    <TouchableOpacity
      style={rowStyles.row}
      onPress={row.type === 'action' ? row.onPress : undefined}
      disabled={row.type === 'toggle'}
      activeOpacity={0.7}>
      <View style={rowStyles.textBlock}>
        <Text
          style={[
            rowStyles.label,
            row.destructive && {color: Colors.error},
          ]}>
          {row.label}
        </Text>
        {row.description ? (
          <Text style={rowStyles.description}>{row.description}</Text>
        ) : null}
      </View>
      {row.type === 'toggle' && row.onToggle && (
        <Switch
          value={row.value}
          onValueChange={row.onToggle}
          trackColor={{true: Colors.primary, false: Colors.border}}
          thumbColor={Colors.white}
        />
      )}
      {row.type === 'action' && (
        <Text style={[rowStyles.chevron, row.destructive && {color: Colors.error}]}>›</Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.bg},
  scroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  avatarText: {
    color: Colors.white,
    fontSize: Typography.xl,
    fontWeight: '800',
  },
  name: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  email: {
    fontSize: Typography.sm,
    color: Colors.text2,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  section: {marginBottom: Spacing.lg},
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },
  version: {
    fontSize: Typography.xs,
    color: Colors.text3,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});

const statStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
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

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  textBlock: {flex: 1},
  label: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: '500',
  },
  description: {
    fontSize: Typography.xs,
    color: Colors.text3,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: Colors.text3,
    marginLeft: Spacing.sm,
  },
});
