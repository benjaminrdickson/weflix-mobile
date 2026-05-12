import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import BrowseScreen from '../screens/BrowseScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import GroupsNavigator from './GroupsNavigator';

const Tab = createBottomTabNavigator();

const tabIcon = (label) => ({ focused }) => (
  <Text style={{ fontSize: 20 }}>
    {label === 'Browse' ? '🎬' : label === 'Partner' ? '❤️' : label === 'Groups' ? '👥' : '👤'}
  </Text>
);

export default function MainNavigator() {
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
        options={{ tabBarIcon: tabIcon('Browse') }}
      />
      <Tab.Screen
        name="Partner"
        component={FavoritesScreen}
        options={{ tabBarIcon: tabIcon('Partner') }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsNavigator}
        options={{ tabBarIcon: tabIcon('Groups') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('Profile') }}
      />
    </Tab.Navigator>
  );
}
