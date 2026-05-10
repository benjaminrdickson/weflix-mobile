import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { openTrailer } from '../components/TrailerModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import api from '../services/api';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

function PartnerHeader({ user, partner }) {
  return (
    <View style={styles.partnerHeader}>
      <Avatar user={user} />
      <Text style={styles.heartDivider}>❤</Text>
      <Avatar user={partner} />
    </View>
  );
}

function Avatar({ user }) {
  const [imgError, setImgError] = React.useState(false);
  if (!user) return <View style={styles.avatarPlaceholder} />;
  return (
    <View style={styles.avatarWrapper}>
      {user.image_url && !imgError ? (
        <Image
          source={{ uri: user.image_url, cache: 'reload' }}
          style={styles.avatar}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <Text style={styles.avatarName}>{user.name}</Text>
    </View>
  );
}

function ProviderRow({ label, providers }) {
  if (!providers?.length) return null;
  return (
    <View style={styles.providerRow}>
      <Text style={styles.providerLabel}>{label}:</Text>
      <View style={styles.providerLogos}>
        {providers.map((p) => (
          <View key={p.provider_id} style={styles.providerChip}>
            {p.logo_path ? (
              <Image source={{ uri: `${TMDB_LOGO_BASE}${p.logo_path}` }} style={styles.providerLogo} />
            ) : null}
            <Text style={styles.providerName} numberOfLines={1}>{p.provider_name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FavoriteCard({ item, onRemove }) {

  const hasProviders =
    item.watch_providers?.flatrate?.length ||
    item.watch_providers?.rent?.length ||
    item.watch_providers?.buy?.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {item.poster_path ? (
          <Image source={{ uri: `${TMDB_IMAGE_BASE}${item.poster_path}` }} style={styles.cardPoster} />
        ) : (
          <View style={[styles.cardPoster, styles.posterFallback]} />
        )}
        <View style={styles.cardDetails}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.content_type === 'tv' ? '📺 TV' : '🎬 Movie'}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.genre ? <Text style={styles.cardGenre}>{item.genre}</Text> : null}
          <Text style={styles.cardYear}>{item.release_date?.slice(0, 4)}</Text>
          <Text style={styles.cardOverview} numberOfLines={3}>{item.overview}</Text>
          <TouchableOpacity onPress={() => openTrailer(item.videos)}>
            <Text style={styles.trailerLink}>▶ Trailer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.providersSection}>
        {hasProviders ? (
          <>
            <ProviderRow label="Stream" providers={item.watch_providers?.flatrate} />
            <ProviderRow label="Rent" providers={item.watch_providers?.rent} />
            <ProviderRow label="Buy" providers={item.watch_providers?.buy} />
          </>
        ) : (
          <Text style={styles.noProviders}>Not available for streaming in your region</Text>
        )}
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.favorite_id)}>
        <Text style={styles.removeBtnText}>Remove from Watchlist</Text>
      </TouchableOpacity>
    </View>
  );
}

const FILTERS = ['all', 'movie', 'tv'];

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const region = Localization.getLocales()[0]?.regionCode || 'US';

  const loadData = useCallback(async () => {
    try {
      const username = await AsyncStorage.getItem('username');
      const [userRes, favRes] = await Promise.all([
        api.get(`/users/${username}`),
        api.get('/favorites', { params: { region } }),
      ]);
      setCurrentUser(userRes.data);
      setPartner(userRes.data.relationship?.partner || null);
      setFavorites(favRes.data);
    } catch {
      Alert.alert('Error', 'Could not load favorites');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemove = async (favoriteId) => {
    try {
      await api.delete(`/favorites/${favoriteId}`);
      setFavorites((prev) => prev.filter((f) => f.favorite_id !== favoriteId));
    } catch {
      Alert.alert('Error', 'Could not remove favorite');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const filtered = filter === 'all' ? favorites : favorites.filter((f) => f.content_type === filter);

  return (
    <FlatList
      style={styles.container}
      data={filtered}
      keyExtractor={(item) => String(item.favorite_id)}
      ListHeaderComponent={
        <View>
          <Text style={styles.screenTitle}>Your Watchlist</Text>
          <PartnerHeader user={currentUser} partner={partner} />
          <View style={styles.toggle}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.toggleBtn, filter === f && styles.toggleBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.toggleText, filter === f && styles.toggleTextActive]}>
                  {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : 'Shows'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {filtered.length === 0 && (
            <Text style={styles.emptyText}>
              {favorites.length === 0
                ? 'No shared favorites yet — start swiping together!'
                : `No ${filter === 'movie' ? 'movie' : 'show'} favorites yet`}
            </Text>
          )}
        </View>
      }
      renderItem={({ item }) => <FavoriteCard item={item} onRemove={handleRemove} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#e94560" />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  listContent: { paddingBottom: 32 },
  screenTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 56,
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  heartDivider: { fontSize: 28, color: '#e94560' },
  avatarWrapper: { alignItems: 'center', gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#e94560' },
  avatarFallback: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  avatarName: { color: '#ccc', fontSize: 13 },
  avatarPlaceholder: { width: 64, height: 64 },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#e94560' },
  toggleText: { color: '#888', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16, paddingHorizontal: 32 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  cardTop: { flexDirection: 'row', padding: 12, gap: 12 },
  cardPoster: { width: 90, height: 130, borderRadius: 8 },
  posterFallback: { backgroundColor: '#0f3460' },
  cardDetails: { flex: 1 },
  typeBadge: {
    backgroundColor: '#0f3460',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  typeBadgeText: { color: '#aaa', fontSize: 11 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardGenre: { color: '#e94560', fontSize: 12, marginBottom: 2 },
  cardYear: { color: '#888', fontSize: 12, marginBottom: 6 },
  cardOverview: { color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  trailerLink: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  providersSection: { paddingHorizontal: 12, paddingBottom: 12 },
  providerRow: { marginBottom: 6 },
  providerLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  providerLogos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f3460', borderRadius: 6, padding: 4, gap: 4 },
  providerLogo: { width: 20, height: 20, borderRadius: 4 },
  providerName: { color: '#ccc', fontSize: 11, maxWidth: 80 },
  noProviders: { color: '#555', fontSize: 12, fontStyle: 'italic' },
  removeBtn: {
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    padding: 12,
    alignItems: 'center',
  },
  removeBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
