import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Animated, Dimensions, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrowseScreen from '../screens/BrowseScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import GroupsNavigator from './GroupsNavigator';
import { useNotifications } from '../context/NotificationContext';
import { useOnboarding } from '../context/OnboardingContext';

const Tab = createBottomTabNavigator();

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_TABS     = 5;
const TAB_HEIGHT   = 49;
const PARTNER_IDX  = 1;
const GROUPS_IDX   = 2;

function TabIcon({ label, pulseKey }) {
  const scale  = useRef(new Animated.Value(1)).current;
  const prevKey = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === prevKey.current) return;
    prevKey.current = pulseKey;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.45, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.45, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.45, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.00, duration: 110, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, scale]);

  const emoji = label === 'Browse'        ? '🎬'
    : label === 'Partner'                 ? '❤️'
    : label === 'Groups'                  ? '👥'
    : label === 'Notifications'           ? '🔔'
    : '👤';

  return (
    <Animated.Text style={{ fontSize: 20, transform: [{ scale }] }}>
      {emoji}
    </Animated.Text>
  );
}

function NudgeBubble({ text, tabIndex, extraBottom = 0 }) {
  const insets    = useSafeAreaInsets();
  const tabWidth  = SCREEN_WIDTH / NUM_TABS;
  const centerX   = tabWidth * tabIndex + tabWidth / 2;
  const bubbleW   = 148;
  const left      = Math.max(8, Math.min(SCREEN_WIDTH - bubbleW - 8, centerX - bubbleW / 2));
  const arrowLeft = Math.max(4, Math.min(bubbleW - 16, centerX - left - 5));

  return (
    <View
      pointerEvents="none"
      style={[styles.bubble, { bottom: TAB_HEIGHT + insets.bottom + 10 + extraBottom, left }]}
    >
      <Text style={styles.bubbleText}>{text}</Text>
      <View style={[styles.bubbleArrow, { left: arrowLeft }]} />
    </View>
  );
}

export default function MainNavigator() {
  const { unreadCount }              = useNotifications();
  const { partnerNudge, groupNudge } = useOnboarding();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#16213e', borderTopColor: '#0f3460' },
          tabBarActiveTintColor: '#e94560',
          tabBarInactiveTintColor: '#888',
        }}
      >
        <Tab.Screen
          name="Browse"
          component={BrowseScreen}
          options={{ tabBarIcon: () => <TabIcon label="Browse" pulseKey={0} /> }}
        />
        <Tab.Screen
          name="Partner"
          component={FavoritesScreen}
          options={{
            tabBarIcon: () => <TabIcon label="Partner" pulseKey={partnerNudge.pulseKey} />,
          }}
        />
        <Tab.Screen
          name="Groups"
          component={GroupsNavigator}
          options={{
            tabBarIcon: () => <TabIcon label="Groups" pulseKey={groupNudge.pulseKey} />,
          }}
        />
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            tabBarIcon: () => <TabIcon label="Notifications" pulseKey={0} />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarIcon: () => <TabIcon label="Profile" pulseKey={0} /> }}
        />
      </Tab.Navigator>

      {partnerNudge.bubbleText ? (
        <NudgeBubble text={partnerNudge.bubbleText} tabIndex={PARTNER_IDX} />
      ) : null}
      {groupNudge.bubbleText ? (
        <NudgeBubble text={groupNudge.bubbleText} tabIndex={GROUPS_IDX} extraBottom={24} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: 148,
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    zIndex: 999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bubbleArrow: {
    position: 'absolute',
    bottom: -5,
    width: 10,
    height: 10,
    backgroundColor: '#e94560',
    transform: [{ rotate: '45deg' }],
  },
});
