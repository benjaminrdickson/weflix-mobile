import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import BrowseScreen from '../screens/BrowseScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import GroupsNavigator from './GroupsNavigator';
import { useNotifications } from '../context/NotificationContext';

const Tab = createBottomTabNavigator();

function TabIcon({ label, unreadCount }) {
  const emoji = label === 'Browse' ? '🎬'
    : label === 'Partner'        ? '❤️'
    : label === 'Groups'         ? '👥'
    : label === 'Notifications'  ? '🔔'
    : '👤';

  if (label === 'Notifications' && unreadCount > 0) {
    return (
      <View>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      </View>
    );
  }
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
        options={{ tabBarIcon: () => <TabIcon label="Browse" unreadCount={0} /> }}
      />
      <Tab.Screen
        name="Partner"
        component={FavoritesScreen}
        options={{ tabBarIcon: () => <TabIcon label="Partner" unreadCount={0} /> }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsNavigator}
        options={{ tabBarIcon: () => <TabIcon label="Groups" unreadCount={0} /> }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: () => <TabIcon label="Notifications" unreadCount={0} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: () => <TabIcon label="Profile" unreadCount={0} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: '#e94560', borderRadius: 8,
    minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
