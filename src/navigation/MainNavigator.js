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
        tabBarStyle: { backgroundColor: '#1a0505', borderTopColor: '#4a1a1a' },
        tabBarActiveTintColor: '#C9A84C',
        tabBarInactiveTintColor: '#5a2a2a',
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
