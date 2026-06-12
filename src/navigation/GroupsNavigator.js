import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

const Stack = createNativeStackNavigator();

export default function GroupsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="GroupsList" component={GroupsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ headerShown: true, title: '', headerBackTitle: 'Groups', headerStyle: { backgroundColor: '#1a0505' }, headerTintColor: '#C9A84C' }}
      />
    </Stack.Navigator>
  );
}
