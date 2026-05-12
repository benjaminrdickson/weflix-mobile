import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import api from '../services/api';

export default function GroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createVisible, setCreateVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data);
    } catch {
      Alert.alert('Error', 'Could not load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/groups', { name });
      setGroups(prev => [data, ...prev]);
      setCreateVisible(false);
      setNewGroupName('');
    } catch (err) {
      const msg = err.response?.data?.errors?.join('\n') || 'Could not create group';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const renderGroup = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.groupCardLeft}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMeta}>
          {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
          {item.matched_count > 0 ? `  ·  ${item.matched_count} matched` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Groups</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setCreateVisible(true)}>
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={item => String(item.id)}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No groups yet — create one to get started!</Text>
            </View>
          }
        />
      )}

      <Modal visible={createVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Group name"
              placeholderTextColor="#888"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => { setCreateVisible(false); setNewGroupName(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirmBtn]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalConfirmText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  screenTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  createBtn: { backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  groupCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupCardLeft: { flex: 1 },
  groupName: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  groupMeta: { color: '#888', fontSize: 13 },
  chevron: { color: '#555', fontSize: 22, marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 24, width: '82%', borderWidth: 1, borderColor: '#0f3460' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInput: { backgroundColor: '#0f3460', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: '#0f3460' },
  modalCancelText: { color: '#aaa', fontWeight: '600' },
  modalConfirmBtn: { backgroundColor: '#e94560' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
});
