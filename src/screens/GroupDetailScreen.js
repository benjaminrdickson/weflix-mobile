import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, Image, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import * as Localization from 'expo-localization';
import api from '../services/api';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

function MemberAvatar({ user, size = 44 }) {
  const [imgError, setImgError] = useState(false);
  const r = size / 2;
  return (
    <View style={[styles.memberAvatarWrap, { width: size + 8, alignItems: 'center' }]}>
      {user.image_url && !imgError ? (
        <Image
          source={{ uri: user.image_url, cache: 'reload' }}
          style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: '#e94560' }}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={{ width: size, height: size, borderRadius: r, backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e94560' }}>
          <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 'bold' }}>
            {user.name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <Text style={styles.memberName} numberOfLines={1}>{user.name}</Text>
    </View>
  );
}

function WatchlistCard({ item, onRemove }) {
  const hasProviders = item.watch_providers?.flatrate?.length || item.watch_providers?.rent?.length || item.watch_providers?.buy?.length;

  return (
    <View style={styles.watchCard}>
      <View style={styles.watchCardTop}>
        {item.poster_path ? (
          <Image source={{ uri: `${TMDB_IMAGE_BASE}${item.poster_path}` }} style={styles.watchPoster} />
        ) : (
          <View style={[styles.watchPoster, styles.posterFallback]} />
        )}
        <View style={styles.watchInfo}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.content_type === 'tv' ? '📺 TV' : '🎬 Movie'}</Text>
          </View>
          <Text style={styles.watchTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.watchYear}>{item.release_date?.slice(0, 4)}</Text>
          <Text style={styles.watchOverview} numberOfLines={2}>{item.overview}</Text>
        </View>
      </View>
      {hasProviders ? (
        <View style={styles.providersRow}>
          {(item.watch_providers?.flatrate || []).slice(0, 4).map(p => (
            <View key={p.provider_id} style={styles.providerChip}>
              {p.logo_path ? <Image source={{ uri: `${TMDB_LOGO_BASE}${p.logo_path}` }} style={styles.providerLogo} /> : null}
              <Text style={styles.providerName} numberOfLines={1}>{p.provider_name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noProviders}>Not available for streaming in your region</Text>
      )}
      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.watchlist_item_id)}>
        <Text style={styles.removeBtnText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GroupDetailScreen({ route, navigation }) {
  const { groupId } = route.params;
  const region = Localization.getLocales()[0]?.regionCode || 'US';

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [inviting, setInviting] = useState(null);

  const loadGroup = useCallback(async () => {
    try {
      const { data } = await api.get(`/groups/${groupId}`, { params: { region } });
      setGroup(data);
      navigation.setOptions({ title: data.name });
    } catch {
      Alert.alert('Error', 'Could not load group');
    } finally {
      setLoading(false);
    }
  }, [groupId, region]);

  useFocusEffect(
    useCallback(() => {
      loadGroup();
    }, [loadGroup])
  );

  const handleRename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    setRenaming(true);
    try {
      await api.patch(`/groups/${groupId}`, { name });
      setGroup(prev => ({ ...prev, name }));
      navigation.setOptions({ title: name });
      setRenameVisible(false);
    } catch (err) {
      const msg = err.response?.data?.errors?.join('\n') || 'Could not rename group';
      Alert.alert('Error', msg);
    } finally {
      setRenaming(false);
    }
  };

  const openInvite = async () => {
    setInviteVisible(true);
    setLoadingFriends(true);
    try {
      const { data } = await api.get('/friendships');
      const memberIds = new Set((group?.members || []).map(m => m.id));
      setFriends(data.friends.filter(f => !memberIds.has(f.id)));
    } catch {
      Alert.alert('Error', 'Could not load friends');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleInvite = async (friend) => {
    setInviting(friend.id);
    try {
      await api.post(`/groups/${groupId}/invitations`, { invitee_id: friend.id });
      Alert.alert('Invited!', `${friend.name} has been invited to the group.`);
      setInviteVisible(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not send invitation';
      Alert.alert('Error', msg);
    } finally {
      setInviting(null);
    }
  };

  const handleInvitationResponse = async (invitationId, approved) => {
    try {
      await api.patch(`/groups/${groupId}/invitations/${invitationId}`, { approved });
      await loadGroup();
    } catch {
      Alert.alert('Error', 'Could not update invitation');
    }
  };

  const handleRemoveWatchlistItem = async (watchlistItemId) => {
    try {
      await api.delete(`/groups/${groupId}/watchlist/${watchlistItemId}`);
      setGroup(prev => ({
        ...prev,
        watchlist: prev.watchlist.filter(w => w.watchlist_item_id !== watchlistItemId),
      }));
    } catch {
      Alert.alert('Error', 'Could not remove item');
    }
  };

  if (loading || !group) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Group name + rename */}
      <View style={styles.titleRow}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.is_creator && (
          <TouchableOpacity onPress={() => { setRenameValue(group.name); setRenameVisible(true); }}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersRow}>
          {group.members.map(m => <MemberAvatar key={m.id} user={m} />)}
        </ScrollView>
        <TouchableOpacity style={styles.inviteBtn} onPress={openInvite}>
          <Text style={styles.inviteBtnText}>+ Invite a Friend</Text>
        </TouchableOpacity>
      </View>

      {/* Pending invitations (creator only) */}
      {group.is_creator && group.pending_invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {group.pending_invitations.map(inv => (
            <View key={inv.invitation_id} style={styles.invitationRow}>
              <Text style={styles.inviteeName}>{inv.invitee.name} <Text style={styles.inviteeUsername}>@{inv.invitee.username}</Text></Text>
              <View style={styles.inviteActions}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleInvitationResponse(inv.invitation_id, true)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleInvitationResponse(inv.invitation_id, false)}>
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Watchlist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Group Watchlist</Text>
        {group.watchlist.length === 0 ? (
          <Text style={styles.emptyText}>
            No titles yet — like the same titles as your group members to add them here!
          </Text>
        ) : (
          group.watchlist.map(item => (
            <WatchlistCard key={item.watchlist_item_id} item={item} onRemove={handleRemoveWatchlistItem} />
          ))
        )}
      </View>

      {/* Rename modal */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Group</Text>
            <TextInput
              style={styles.modalInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleRename}
              placeholderTextColor="#888"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => setRenameVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalConfirmBtn]} onPress={handleRename} disabled={renaming}>
                {renaming ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite modal */}
      <Modal visible={inviteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>Invite a Friend</Text>
            {loadingFriends ? (
              <ActivityIndicator color="#e94560" style={{ marginVertical: 24 }} />
            ) : friends.length === 0 ? (
              <Text style={styles.emptyText}>No friends available to invite.</Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={f => String(f.id)}
                renderItem={({ item: f }) => (
                  <View style={styles.friendRow}>
                    <View>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Text style={styles.friendUsername}>@{f.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalConfirmBtn, { flex: 0, paddingHorizontal: 16 }]}
                      onPress={() => handleInvite(f)}
                      disabled={inviting === f.id}
                    >
                      {inviting === f.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.modalConfirmText}>Invite</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn, { marginTop: 12 }]} onPress={() => setInviteVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, marginBottom: 8 },
  groupName: { color: '#fff', fontSize: 22, fontWeight: 'bold', flex: 1 },
  editLink: { color: '#e94560', fontSize: 15, fontWeight: '600', marginLeft: 12 },
  section: { backgroundColor: '#16213e', borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: '#0f3460' },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  membersRow: { gap: 8, paddingBottom: 4 },
  memberAvatarWrap: { marginRight: 4 },
  memberName: { color: '#888', fontSize: 11, marginTop: 4, textAlign: 'center', maxWidth: 52 },
  inviteBtn: { marginTop: 12, borderWidth: 1, borderColor: '#e94560', borderRadius: 10, padding: 10, alignItems: 'center' },
  inviteBtnText: { color: '#e94560', fontWeight: '600', fontSize: 14 },
  invitationRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  inviteeName: { color: '#fff', fontSize: 15, marginBottom: 8 },
  inviteeUsername: { color: '#888', fontSize: 13 },
  inviteActions: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: '#2ecc71', borderRadius: 8, padding: 10, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: '#0f3460', borderRadius: 8, padding: 10, alignItems: 'center' },
  rejectBtnText: { color: '#aaa', fontWeight: '600' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  watchCard: { backgroundColor: '#1a1a2e', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#0f3460', overflow: 'hidden' },
  watchCardTop: { flexDirection: 'row', padding: 10, gap: 10 },
  watchPoster: { width: 80, height: 115, borderRadius: 8 },
  posterFallback: { backgroundColor: '#0f3460' },
  watchInfo: { flex: 1 },
  typeBadge: { backgroundColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  typeBadgeText: { color: '#aaa', fontSize: 11 },
  watchTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  watchYear: { color: '#888', fontSize: 12, marginBottom: 4 },
  watchOverview: { color: '#999', fontSize: 12, lineHeight: 17 },
  providersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 8 },
  providerChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f3460', borderRadius: 6, padding: 4, gap: 4 },
  providerLogo: { width: 18, height: 18, borderRadius: 3 },
  providerName: { color: '#ccc', fontSize: 11, maxWidth: 80 },
  noProviders: { color: '#555', fontSize: 12, fontStyle: 'italic', paddingHorizontal: 10, paddingBottom: 8 },
  removeBtn: { borderTopWidth: 1, borderTopColor: '#0f3460', padding: 10, alignItems: 'center' },
  removeBtnText: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, width: '85%', borderWidth: 1, borderColor: '#0f3460' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInput: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: '#0f3460' },
  modalCancelText: { color: '#aaa', fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: '#e94560' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
  friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  friendName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  friendUsername: { color: '#888', fontSize: 13 },
});
