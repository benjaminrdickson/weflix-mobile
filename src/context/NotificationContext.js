import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../services/api';

const NotificationContext = createContext({ unreadCount: 0, refreshUnread: () => {} });

export function NotificationProvider({ children, userToken }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      const count = data.filter(n => !n.read).length;
      setUnreadCount(count);
      await Notifications.setBadgeCountAsync(count);
    } catch {
      // fail silently — unread count is non-critical
    }
  }, []);

  // Refresh when user logs in or on initial load if already logged in, then poll every 30s
  useEffect(() => {
    if (!userToken) return;
    refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => clearInterval(interval);
  }, [userToken, refreshUnread]);

  // Refresh when app comes back to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userToken) refreshUnread();
    });
    return () => subscription.remove();
  }, [userToken, refreshUnread]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
