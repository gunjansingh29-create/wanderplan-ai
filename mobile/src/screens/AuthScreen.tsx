/**
 * AuthScreen – Sign in / Sign up
 *
 * Matches the authentication flow in wanderplan-homepage.jsx:
 * local-first credential storage with optional backend sync.
 */
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import {Colors, Radii, Spacing, Typography} from '../constants/theme';
import Button from '../components/Button';
import {signIn, signUp} from '../services/api';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

type Mode = 'signin' | 'signup';

export default function AuthScreen({onAuthenticated}: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function handleSubmit() {
    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        'Weak password',
        'Password must be at least 6 characters long.',
      );
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim());
      }
      onAuthenticated();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">

          {/* Logo / hero */}
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Text style={styles.logoIcon}>✈️</Text>
            </View>
            <Text style={styles.logoText}>WanderPlan AI</Text>
            <Text style={styles.tagline}>
              Plan smarter trips with your AI travel companion
            </Text>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabs}>
            {(['signin', 'signup'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, mode === m && styles.tabActive]}
                onPress={() => setMode(m)}>
                <Text
                  style={[
                    styles.tabLabel,
                    mode === m && styles.tabLabelActive,
                  ]}>
                  {m === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Jane Smith"
                  placeholderTextColor={Colors.text3}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.text3}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 6 characters"
                placeholderTextColor={Colors.text3}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Button
              label={mode === 'signin' ? 'Sign In' : 'Create Account'}
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          {/* Footer */}
          <Text style={styles.footerNote}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.bg},
  flex: {flex: 1},
  scroll: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: {fontSize: 34},
  logoText: {
    fontSize: Typography.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  tagline: {
    fontSize: Typography.sm,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radii.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontSize: Typography.sm,
    fontWeight: '500',
    color: Colors.text2,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: Colors.text,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  field: {gap: 6},
  label: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.base,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  footerNote: {
    fontSize: Typography.xs,
    color: Colors.text3,
    textAlign: 'center',
    lineHeight: 18,
  },
});
