import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
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

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const loadUser = useCallback(async () => {
    try {
      const username = await AsyncStorage.getItem('username');
      const { data } = await api.get(`/users/${username}`);
      setUser(data);
      setAvatarError(false);
      setForm({ name: data.name, username: data.username, email: data.email });
    } catch {
      Alert.alert('Error', 'Could not load profile');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('user_id');
      await api.patch(`/users/${userId}`, form);
      if (form.username !== user.username) {
        await AsyncStorage.setItem('username', form.username);
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
      const userId = await AsyncStorage.getItem('user_id');
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('profile_picture', { uri, name: filename, type });

      const { data } = await api.post(`/users/${userId}/profile_picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(prev => ({ ...prev, image_url: data.image_url }));
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
      const { data } = await api.get(`/users/${partnerQuery.trim()}`);
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
      await api.post('/relationships', { recipient_id: foundUser.id });
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
      await api.patch(`/relationships/${relId}`, { confirmed: true });
      await loadUser();
    } catch {
      Alert.alert('Error', 'Could not accept request');
    } finally {
      setRelationshipLoading(false);
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
            await api.delete(`/relationships/${relId}`);
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
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setEditing(false)}>
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
});
