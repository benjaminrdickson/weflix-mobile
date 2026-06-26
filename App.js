import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { AuthContext } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { OnboardingProvider } from './src/context/OnboardingContext';
import { supabase } from './src/lib/supabase';
import { edgeFn } from './src/lib/edgeFunctions';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

async function registerPushToken() {
  if (!Device.isDevice) return;
  const asked = await AsyncStorage.getItem('push_permission_asked');
  if (asked) return;

  await AsyncStorage.setItem('push_permission_asked', 'true');
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '7d104701-d7ce-41a6-9410-64b001b9e76a',
    });
    await edgeFn.post('push-tokens', { token: tokenData.data, platform: Platform.OS });
  } catch {
    // token registration failure must never break the app
  }
}

function PermissionExplainerModal({ visible, onAllow, onSkip }) {
  if (!visible) return null;
  return (
    <View style={styles.explainerOverlay}>
      <View style={styles.explainerBox}>
        <Text style={styles.explainerTitle}>Stay in the loop</Text>
        <Text style={styles.explainerBody}>
          WeFlix would like to notify you when you and your partner or group match on a title, and when you have new friend or partner requests.
        </Text>
        <TouchableOpacity style={styles.explainerAllow} onPress={onAllow}>
          <Text style={styles.explainerAllowText}>Enable Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.explainerSkip} onPress={onSkip}>
          <Text style={styles.explainerSkipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
    });

    // Listen for auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.getItem('push_permission_asked').then(async (asked) => {
      if (asked) {
        // Already decided — re-register token silently in case it changed
        if (!Device.isDevice) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          try {
            const tokenData = await Notifications.getExpoPushTokenAsync({
              projectId: '7d104701-d7ce-41a6-9410-64b001b9e76a',
            });
            await edgeFn.post('push-tokens', { token: tokenData.data, platform: Platform.OS });
          } catch {}
        }
        return;
      }
      setShowPermissionModal(true);
    });
  }, [session]);

  const handleAllowNotifications = async () => {
    setShowPermissionModal(false);
    await registerPushToken();
  };

  const handleSkipNotifications = async () => {
    setShowPermissionModal(false);
    await AsyncStorage.setItem('push_permission_asked', 'true');
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Still loading initial session
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <AuthContext.Provider value={{ session, user: session?.user ?? null, logout }}>
      <NotificationProvider isAuthenticated={!!session}>
        <OnboardingProvider isAuthenticated={!!session}>
          <NavigationContainer>
            {session ? <MainNavigator /> : <AuthNavigator />}
          </NavigationContainer>
          <PermissionExplainerModal
            visible={showPermissionModal}
            onAllow={handleAllowNotifications}
            onSkip={handleSkipNotifications}
          />
        </OnboardingProvider>
      </NotificationProvider>
    </AuthContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  explainerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  explainerBox: {
    backgroundColor: '#16213e', borderRadius: 20, padding: 28,
    marginHorizontal: 24, borderWidth: 1, borderColor: '#0f3460',
  },
  explainerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  explainerBody: { color: '#ccc', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  explainerAllow: { backgroundColor: '#e94560', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  explainerAllowText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  explainerSkip: { padding: 10, alignItems: 'center' },
  explainerSkipText: { color: '#888', fontSize: 14 },
});

registerRootComponent(App);
