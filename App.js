import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { AuthContext } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    AsyncStorage.getItem('push_permission_asked').then(async (asked) => {
      if (asked) {
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

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a0505' }}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, logout }}>
      <NotificationProvider isAuthenticated={!!session}>
        <NavigationContainer>
          {session ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
        <PermissionExplainerModal
          visible={showPermissionModal}
          onAllow={handleAllowNotifications}
          onSkip={handleSkipNotifications}
        />
      </NotificationProvider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  explainerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  explainerBox: {
    backgroundColor: '#1a0505', borderRadius: 20, padding: 28,
    marginHorizontal: 24, borderWidth: 1, borderColor: '#C9A84C',
  },
  explainerTitle: { color: '#C9A84C', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  explainerBody: { color: '#ddc9a8', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  explainerAllow: { backgroundColor: '#8B1A1A', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#C9A84C' },
  explainerAllowText: { color: '#C9A84C', fontWeight: 'bold', fontSize: 16 },
  explainerSkip: { padding: 10, alignItems: 'center' },
  explainerSkipText: { color: '#8a6a30', fontSize: 14 },
});

registerRootComponent(App);
