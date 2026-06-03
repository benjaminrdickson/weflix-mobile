import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, Image, Switch,
  StyleSheet, Alert, ActivityIndicator, ScrollView, Linking, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { edgeFn } from '../lib/edgeFunctions';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [foundFriend, setFoundFriend] = useState(null);
  const [searchingFriend, setSearchingFriend] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [notifPermDenied, setNotifPermDenied] = useState(false);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const loadUser = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const username = authUser.user_metadata.username;
      const { data } = await edgeFn.get(`users/${username}`);
      setUser(data);
      setAvatarError(false);
      setForm({ name: data.name, username: data.username, email: data.email });
    } catch {
      Alert.alert('Error', 'Could not load profile');
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const { data } = await edgeFn.get('friendships');
      setFriends(data.friends);
      setPendingRequests(data.pending_requests);
    } catch {}
  }, []);

  const loadNotifPrefs = useCallback(async () => {
    try {
      const { data } = await edgeFn.get('notifications/preferences');
      setNotifPrefs(data);
    } catch {}
    try {
      const asked = await AsyncStorage.getItem('push_permission_asked');
      if (asked) {
        const { status } = await Notifications.getPermissionsAsync();
        setNotifPermDenied(status !== 'granted');
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadFriends();
      loadNotifPrefs();
    }, [loadUser, loadFriends, loadNotifPrefs])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      await edgeFn.patch(`users/${authUser.id}`, form);
      if (form.username !== user.username) {
        await supabase.auth.updateUser({ data: { username: form.username } });
      }
      await loadUser();
      setEditing(false);
    } catch (err) {
      const messages = err.response?.data?.errors?.join('\n') || 'Could not save changes';
      Alert.alert('Error', messages);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;

      setUploadingPhoto(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : 'jpg';
      const contentType = match ? `image/${ext}` : 'image/jpeg';
      const storagePath = `${authUser.id}/avatar.${ext}`;

      const fileRes = await fetch(uri);
      const blob = await fileRes.blob();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, blob, { upsert: true, contentType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(storagePath);

      await edgeFn.patch(`users/${authUser.id}`, { image_url: publicUrl });
      setUser(prev => ({ ...prev, image_url: publicUrl }));
      setAvatarError(false);
    } catch (err) {
      Alert.alert('Error', err?.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSearch = async () => {
    if (!partnerQuery.trim()) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const { data } = await edgeFn.get(`users/${partnerQuery.trim()}`);
      setFoundUser(data);
    } catch {
      Alert.alert('Not found', 'No user found with that username');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!foundUser) return;
    setRelationshipLoading(true);
    try {
      await edgeFn.post('relationships', { recipient_id: foundUser.id });
      Alert.alert('Request sent!', `A relationship request was sent to ${foundUser.username}`);
      setFoundUser(null);
      setPartnerQuery('');
      await loadUser();
    } catch {
      Alert.alert('Error', 'Could not send relationship request');
    } finally {
      setRelationshipLoading(false);
    }
  };

  const acceptRequest = async () => {
    const relId = user.relationship?.id;
    if (!relId) return;
    setRelationshipLoading(true);
    try {
      await edgeFn.patch(`relationships/${relId}`);
      await loadUser();
    } catch {
      Alert.alert('Error', 'Could not accept request');
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleFriendSearch = async () => {
    if (!friendQuery.trim()) return;
    setSearchingFriend(true);
    setFoundFriend(null);
    try {
      const { data } = await edgeFn.get(`users/${friendQuery.trim()}`);
      setFoundFriend(data);
    } catch {
      Alert.alert('Not found', 'No user found with that username');
    } finally {
      setSearchingFriend(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!foundFriend) return;
    setFriendsLoading(true);
    try {
      await edgeFn.post('friendships', { username: foundFriend.username });
      Alert.alert('Request sent!', `Friend request sent to ${foundFriend.username}`);
      setFoundFriend(null);
      setFriendQuery('');
      await loadFriends();
    } catch (err) {
      const message = err.response?.data?.error || 'Could not send friend request';
      Alert.alert('Error', message);
    } finally {
      setFriendsLoading(false);
    }
  };

  const acceptFriendRequest = async (friendshipId) => {
    setFriendsLoading(true);
    try {
      await edgeFn.patch(`friendships/${friendshipId}`);
      await loadFriends();
    } catch {
      Alert.alert('Error', 'Could not accept friend request');
    } finally {
      setFriendsLoading(false);
    }
  };

  const removeFriendship = async (friendshipId) => {
    setFriendsLoading(true);
    try {
      await edgeFn.delete(`friendships/${friendshipId}`);
      await loadFriends();
    } catch {
      Alert.alert('Error', 'Could not remove');
    } finally {
      setFriendsLoading(false);
    }
  };

  const toggleNotifPref = async (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try {
      await edgeFn.patch('notifications/preferences', { [key]: !notifPrefs[key] });
    } catch {
      setNotifPrefs(notifPrefs);
    }
  };

  const endRelationship = () => {
    const relId = user.relationship?.id;
    if (!relId) return;
    Alert.alert('End Relationship', 'Are you sure? This will remove your shared watchlist.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Relationship',
        style: 'destructive',
        onPress: async () => {
          setRelationshipLoading(true);
          try {
            await edgeFn.delete(`relationships/${relId}`);
            await loadUser();
          } catch {
            Alert.alert('Error', 'Could not end relationship');
          } finally {
            setRelationshipLoading(false);
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const rel = user.relationship;
  const isRecipient = rel && !rel.is_sender;
  const isPending = rel && !rel.confirmed;
  const isActive = rel && rel.confirmed;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Profile</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
          {user.image_url && !avatarError ? (
            <Image
              source={{ uri: user.image_url, cache: 'reload' }}
              style={styles.avatar}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.changePhotoOverlay}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.changePhotoText}>📷</Text>}
          </View>
        </TouchableOpacity>
      </View>

      {/* Profile fields */}
      {editing ? (
        <View style={styles.section}>
          {[
            { field: 'name', label: 'Name' },
            { field: 'username', label: 'Username', autoCapitalize: 'none' },
            { field: 'email', label: 'Email', keyboardType: 'email-address', autoCapitalize: 'none' },
          ].map(({ field, label, keyboardType, autoCapitalize }) => (
            <View key={field} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[field]}
                onChangeText={set(field)}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize || 'words'}
                placeholderTextColor="#888"
              />
            </View>
          ))}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => { setEditing(false); setForm({ name: user.name, username: user.username, email: user.email }); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Username" value={`@${user.username}`} />
          <InfoRow label="Email" value={user.email} />
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Relationship section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Partner</Text>

        {relationshipLoading && <ActivityIndicator color="#e94560" style={{ marginVertical: 16 }} />}

        {!rel && !relationshipLoading && (
          <>
            <Text style={styles.noPartnerText}>You have no partner yet. Find them by username:</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Search by username"
                placeholderTextColor="#888"
                value={partnerQuery}
                onChangeText={setPartnerQuery}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Find</Text>}
              </TouchableOpacity>
            </View>
            {foundUser && (
              <View style={styles.foundUser}>
                <Text style={styles.foundUserName}>{foundUser.name} (@{foundUser.username})</Text>
                <TouchableOpacity style={styles.sendRequestBtn} onPress={sendRequest}>
                  <Text style={styles.sendRequestText}>Send Request</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {isPending && !relationshipLoading && (
          <>
            <PartnerCard partner={rel.partner} />
            {isRecipient ? (
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={acceptRequest}>
                  <Text style={styles.saveBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={endRelationship}>
                  <Text style={styles.cancelBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.pendingText}>Request sent — waiting for your partner to accept</Text>
            )}
          </>
        )}

        {isActive && !relationshipLoading && (
          <>
            <PartnerCard partner={rel.partner} />
            <TouchableOpacity style={styles.endBtn} onPress={endRelationship}>
              <Text style={styles.endBtnText}>End Relationship</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Friends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends</Text>

        {friendsLoading && <ActivityIndicator color="#e94560" style={{ marginVertical: 8 }} />}

        {/* Friend search */}
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Add friend by username"
            placeholderTextColor="#888"
            value={friendQuery}
            onChangeText={setFriendQuery}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleFriendSearch} disabled={searchingFriend}>
            {searchingFriend
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.searchBtnText}>Find</Text>}
          </TouchableOpacity>
        </View>

        {foundFriend && (
          <View style={styles.foundUser}>
            <Text style={styles.foundUserName}>{foundFriend.name} (@{foundFriend.username})</Text>
            <TouchableOpacity style={styles.sendRequestBtn} onPress={sendFriendRequest}>
              <Text style={styles.sendRequestText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending incoming requests */}
        {pendingRequests.length > 0 && (
          <>
            <Text style={styles.friendSubtitle}>Pending Requests</Text>
            {pendingRequests.map((req) => (
              <FriendCard key={req.friendship_id} user={req}>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => acceptFriendRequest(req.friendship_id)}>
                    <Text style={styles.saveBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => removeFriendship(req.friendship_id)}>
                    <Text style={styles.cancelBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </FriendCard>
            ))}
          </>
        )}

        {/* Friends list */}
        {friends.length > 0 && (
          <>
            <Text style={styles.friendSubtitle}>Friends</Text>
            {friends.map((friend) => (
              <FriendCard key={friend.friendship_id} user={friend}>
                <TouchableOpacity style={styles.removeFriendBtn} onPress={() => removeFriendship(friend.friendship_id)}>
                  <Text style={styles.removeFriendText}>Remove</Text>
                </TouchableOpacity>
              </FriendCard>
            ))}
          </>
        )}

        {friends.length === 0 && pendingRequests.length === 0 && !friendsLoading && (
          <Text style={styles.noPartnerText}>No friends yet — search by username to add one.</Text>
        )}
      </View>

      {/* Notification permission denied banner */}
      {notifPermDenied && (
        <TouchableOpacity
          style={styles.notifBanner}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.notifBannerText}>
            Enable notifications to know when you get a match!
          </Text>
          <Text style={styles.notifBannerLink}>Open Settings →</Text>
        </TouchableOpacity>
      )}

      {/* Notification preferences */}
      {notifPrefs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          {[
            { key: 'friend_requests',           label: 'Friend requests' },
            { key: 'friend_request_accepted',   label: 'Friend request accepted' },
            { key: 'partner_invitations',       label: 'Partner invitations' },
            { key: 'partner_watchlist_matches', label: 'Partner watchlist matches' },
            { key: 'group_invitations',         label: 'Group invitations' },
            { key: 'group_watchlist_matches',   label: 'Group watchlist matches' },
            ...(user?.is_group_creator ? [{ key: 'group_join_requests', label: 'Group join requests' }] : []),
          ].map(({ key, label }) => (
            <View key={key} style={styles.prefRow}>
              <Text style={styles.prefLabel}>{label}</Text>
              <Switch
                value={!!notifPrefs[key]}
                onValueChange={() => toggleNotifPref(key)}
                trackColor={{ false: '#0f3460', true: '#e94560' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PartnerCard({ partner }) {
  const [imgError, setImgError] = React.useState(false);
  if (!partner) return <Text style={styles.noPartnerText}>No partner info available</Text>;
  return (
    <View style={styles.partnerCard}>
      {partner.image_url && !imgError ? (
        <Image
          source={{ uri: partner.image_url, cache: 'reload' }}
          style={styles.partnerAvatar}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.partnerAvatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{partner.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <View>
        <Text style={styles.partnerName}>{partner.name}</Text>
        <Text style={styles.partnerUsername}>@{partner.username}</Text>
      </View>
    </View>
  );
}

function FriendCard({ user, children }) {
  const [imgError, setImgError] = React.useState(false);
  return (
    <View style={styles.friendCard}>
      <View style={styles.friendCardLeft}>
        {user.image_url && !imgError ? (
          <Image
            source={{ uri: user.image_url, cache: 'reload' }}
            style={styles.friendAvatar}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.friendAvatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View>
          <Text style={styles.partnerName}>{user.name}</Text>
          <Text style={styles.partnerUsername}>@{user.username}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  content: { paddingBottom: 48 },
  screenTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 56,
    marginBottom: 24,
  },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#e94560' },
  avatarFallback: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#e94560',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  changePhotoText: { fontSize: 14 },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  infoLabel: { color: '#888', fontSize: 15 },
  infoValue: { color: '#fff', fontSize: 15, fontWeight: '500' },
  editBtn: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  editBtnText: { color: '#e94560', fontWeight: '600' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: '#888', fontSize: 13, marginBottom: 4 },
  input: {
    backgroundColor: '#0f3460',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtn: { backgroundColor: '#e94560' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { backgroundColor: '#0f3460' },
  cancelBtnText: { color: '#aaa', fontWeight: '600', fontSize: 16 },
  acceptBtn: { backgroundColor: '#2ecc71' },
  noPartnerText: { color: '#888', marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBtn: { backgroundColor: '#e94560', borderRadius: 8, padding: 12, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: 'bold' },
  foundUser: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foundUserName: { color: '#fff', fontSize: 15 },
  sendRequestBtn: { backgroundColor: '#e94560', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  sendRequestText: { color: '#fff', fontWeight: 'bold' },
  pendingText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  partnerAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#e94560' },
  partnerName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  partnerUsername: { color: '#888', fontSize: 13 },
  endBtn: { borderWidth: 1, borderColor: '#e94560', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  endBtnText: { color: '#e94560', fontWeight: '600' },
  logoutBtn: { marginHorizontal: 16, backgroundColor: '#16213e', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e94560' },
  logoutText: { color: '#e94560', fontSize: 16, fontWeight: 'bold' },
  friendSubtitle: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  friendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0f3460' },
  friendCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#e94560' },
  removeFriendBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#555' },
  removeFriendText: { color: '#888', fontSize: 12 },
  notifBanner: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: '#16213e',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e94560',
  },
  notifBannerText: { color: '#ccc', fontSize: 13, marginBottom: 4 },
  notifBannerLink: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  prefLabel: { color: '#ccc', fontSize: 15, flex: 1 },
});
