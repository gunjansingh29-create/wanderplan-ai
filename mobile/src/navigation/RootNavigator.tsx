/**
 * RootNavigator – top-level navigation for WanderPlan AI iOS
 *
 * Handles auth gating: shows AuthScreen when the user is not signed in,
 * then switches to the main bottom-tab navigator.
 */
import React, {useState, useEffect, useCallback} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text, StyleSheet} from 'react-native';

import {Colors, Typography} from '../constants/theme';
import {getSession, getProfile} from '../services/api';

import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TripPlannerScreen from '../screens/TripPlannerScreen';
import BucketListScreen from '../screens/BucketListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoadingSpinner from '../components/LoadingSpinner';

// ---------------------------------------------------------------------------
// Navigator types
// ---------------------------------------------------------------------------

export type MainTabParamList = {
  Dashboard: undefined;
  Plan: undefined;
  BucketList: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ---------------------------------------------------------------------------
// Tab icon renderer (emoji-based for zero native dependency)
// ---------------------------------------------------------------------------

function TabIcon({emoji, focused}: {emoji: string; focused: boolean}) {
  return (
    <Text style={[tabStyles.icon, focused && tabStyles.iconFocused]}>
      {emoji}
    </Text>
  );
}

const tabStyles = StyleSheet.create({
  icon: {fontSize: 22, opacity: 0.55},
  iconFocused: {opacity: 1},
});

// ---------------------------------------------------------------------------
// Main bottom-tab navigator
// ---------------------------------------------------------------------------

interface MainTabsProps {
  userName?: string;
  onSignOut: () => void;
  onNewTrip: () => void;
}

function MainTabs({userName, onSignOut, onNewTrip}: MainTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {backgroundColor: Colors.bg},
        headerTitleStyle: {
          fontSize: Typography.md,
          fontWeight: '700',
          color: Colors.text,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text3,
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}>
      <Tab.Screen
        name="Dashboard"
        options={{
          title: 'My Trips',
          tabBarLabel: 'Trips',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="🗺" focused={focused} />
          ),
        }}>
        {() => (
          <DashboardScreen onNewTrip={onNewTrip} userName={userName} />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Plan"
        component={TripPlannerScreen}
        options={{
          title: 'Plan a Trip',
          tabBarLabel: 'Plan',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="✈️" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="BucketList"
        component={BucketListScreen}
        options={{
          title: 'Bucket List',
          tabBarLabel: 'Bucket List',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="🌍" focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({focused}) => (
            <TabIcon emoji="👤" focused={focused} />
          ),
        }}>
        {() => <ProfileScreen onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root navigator with auth gate
// ---------------------------------------------------------------------------

export default function RootNavigator() {
  const [authState, setAuthState] = useState<
    'loading' | 'unauthenticated' | 'authenticated'
  >('loading');
  const [userName, setUserName] = useState<string | undefined>();

  const checkAuth = useCallback(async () => {
    const session = await getSession();
    if (session?.email) {
      const profile = await getProfile(session.email);
      setUserName(profile?.name);
      setAuthState('authenticated');
    } else {
      setAuthState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleAuthenticated = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  const handleSignOut = useCallback(() => {
    setUserName(undefined);
    setAuthState('unauthenticated');
  }, []);

  // Placeholder for navigating to the Plan tab programmatically
  const handleNewTrip = useCallback(() => {
    // In a real app: navigationRef.current?.navigate('Plan')
  }, []);

  if (authState === 'loading') {
    return <LoadingSpinner message="Loading WanderPlan…" />;
  }

  if (authState === 'unauthenticated') {
    return (
      <NavigationContainer>
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <MainTabs
        userName={userName}
        onSignOut={handleSignOut}
        onNewTrip={handleNewTrip}
      />
    </NavigationContainer>
  );
}
