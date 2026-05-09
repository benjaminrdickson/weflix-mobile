import React, { useState, useEffect, createContext, useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';

export const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('jwt').then((token) => {
      setUserToken(token);
      setIsLoading(false);
    });
  }, []);

  const login = async (token, userId, username) => {
    await AsyncStorage.multiSet([
      ['jwt', token],
      ['user_id', String(userId)],
      ['username', username],
    ]);
    setUserToken(token);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['jwt', 'user_id', 'username']);
    setUserToken(null);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ userToken, login, logout }}>
      <NavigationContainer>
        {userToken ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
