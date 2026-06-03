import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { edgeFn } from '../lib/edgeFunctions';
import { useNotifications } from '../context/NotificationContext';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const TYPE_ICON = {
  friend_request:              '👋',
  friend_request_accepted:     '🤝',
  partner_invitation:          '💌',
  partner_invitation_approved: '❤️',
  partner_watchlist_match:     '🎬',
  group_invitation:            '👥',
  group_invitation_approved:   '✅',
  group_watchlist_match:       '🎉',
  group_join_request:          '📋',
};

const TAPPABLE_TYPES = ['partner_watchlist_match', 'group_watchlist_match', 'group_join_request'];

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState({});
  const { refreshUnread } = useNotifications();

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await edgeFn.get('notifications');
      setNotifications(data);
      setResponses({});
      await edgeFn.patch('notifications/mark_all_read');
      await Notifications.setBadgeCountAsync(0);
      refreshUnread();
    } catch {
      Alert.alert('Error', 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await edgeFn.delete('notifications/clear_all');
            setNotifications([]);
            await Notifications.setBadgeCountAsync(0);
            refreshUnread();
          } catch {
            Alert.alert('Error', 'Could not clear notifications');
          }
        },
      },
    ]);
  };

  const handleNotificationPress = (item) => {
    if (!TAPPABLE_TYPES.includes(item.notification_type)) return;
    if (item.context === 'partner') {
      navigation.navigate('Partner');
    } else if (item.context?.startsWith('group_')) {
      const groupId = parseInt(item.context.replace('group_', ''), 10);
      navigation.navigate('Groups', { screen: 'GroupDetail', params: { groupId } });
    }
  };

  const handleGroupInviteResponse = async (item, inviteContext, accepted) => {
    try {
      await edgeFn.patch(
        `group-invitations/${inviteContext.group_id}/${inviteContext.invitation_id}`,
        { accepted }
      );
      setResponses(prev => ({ ...prev, [item.id]: accepted ? 'accepted' : 'declined' }));
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not respond to invite';
      Alert.alert('Error', msg);
    }
  };

  const renderItem = ({ item }) => {
    const tappable = TAPPABLE_TYPES.includes(item.notification_type);
    const isGroupInvite = item.notification_type === 'group_invitation';

    let inviteContext = null;
    if (isGroupInvite && item.context) {
      try { inviteContext = JSON.parse(item.context); } catch {}
    }

    const hasActions = inviteContext?.group_id && inviteContext?.invitation_id && !responses[item.id];
    const response = responses[item.id];

    return (
      <TouchableOpacity
        style={[styles.item, item.read && !hasActions && styles.itemRead, tappable && styles.itemTappable]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={tappable ? 0.75 : 1}
      >
        <Text style={styles.itemIcon}>{TYPE_ICON[item.notification_type] || '🔔'}</Text>
        <View style={styles.itemBody}>
          <Text style={[styles.itemMessage, item.read && !hasActions && styles.itemMessageRead]}>
            {item.message}
          </Text>
          <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
          {hasActions && (
            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleGroupInviteResponse(item, inviteContext, true)}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => handleGroupInviteResponse(item, inviteContext, false)}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
          {response && (
            <Text style={[styles.responseText, response === 'accepted' ? styles.responseAccepted : styles.responseDeclined]}>
              {response === 'accepted' ? 'You accepted this invite' : 'You declined this invite'}
            </Text>
          )}
        </View>
        <View style={styles.itemRight}>
          {!item.read && <View style={styles.unreadDot} />}
          {tappable && <Text style={styles.chevron}>›</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearBtn}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 56,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  screenTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  clearBtn: { color: '#e94560', fontSize: 14, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 12,
  },
  itemRead: { opacity: 0.6 },
  itemIcon: { fontSize: 24, width: 32, textAlign: 'center', marginTop: 2 },
  itemBody: { flex: 1 },
  itemMessage: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 4, lineHeight: 19 },
  itemMessageRead: { fontWeight: '400' },
  itemTime: { color: '#888', fontSize: 12 },
  itemTappable: { borderColor: '#1a3a5c' },
  itemRight: { alignItems: 'center', gap: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e94560' },
  chevron: { color: '#555', fontSize: 20 },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  declineBtn: { backgroundColor: '#0f3460', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  declineBtnText: { color: '#aaa', fontWeight: '600', fontSize: 13 },
  responseText: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  responseAccepted: { color: '#4caf50' },
  responseDeclined: { color: '#888' },
});
