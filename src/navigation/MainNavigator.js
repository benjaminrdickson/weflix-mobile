import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import BrowseScreen from '../screens/BrowseScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import GroupsNavigator from './GroupsNavigator';
import { useNotifications } from '../context/NotificationContext';

const Tab = createBottomTabNavigator();

function TabIcon({ label }) {
  const emoji = label === 'Browse' ? '🎬'
    : label === 'Partner'        ? '❤️'
    : label === 'Groups'         ? '👥'
    : label === 'Notifications'  ? '🔔'
    : '👤';
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function MainNavigator() {
  const { unreadCount } = useNotifications();

  return (
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
        options={{ tabBarIcon: () => <TabIcon label="Browse" /> }}
      />
      <Tab.Screen
        name="Partner"
        component={FavoritesScreen}
        options={{ tabBarIcon: () => <TabIcon label="Partner" /> }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsNavigator}
        options={{ tabBarIcon: () => <TabIcon label="Groups" /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: () => <TabIcon label="Notifications" />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: () => <TabIcon label="Profile" /> }}
      />
    </Tab.Navigator>
  );
}
