import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { openTrailer } from '../components/TrailerModal';
import DetailModal from '../components/DetailModal';
import TicketCard from '../components/TicketCard';
import * as Localization from 'expo-localization';
import { edgeFn } from '../lib/edgeFunctions';
import { supabase } from '../lib/supabase';

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

function FavoriteCard({ item, onRemove, onPress }) {
  const [expanded, setExpanded] = useState(false);

  const hasProviders =
    item.watch_providers?.flatrate?.length ||
    item.watch_providers?.rent?.length ||
    item.watch_providers?.buy?.length;

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
      <TicketCard posterWidth={90} style={{ marginHorizontal: 16, marginBottom: 20 }}>
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
            <Text style={styles.cardOverview} numberOfLines={expanded ? undefined : 3}>{item.overview}</Text>
            {item.overview?.length > 0 && (
              <TouchableOpacity onPress={() => setExpanded(e => !e)}>
                <Text style={styles.overviewToggle}>{expanded ? 'less' : 'more'}</Text>
              </TouchableOpacity>
            )}
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
      </TicketCard>
    </TouchableOpacity>
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
  const [selectedItem, setSelectedItem] = useState(null);

  const region = Localization.getLocales()[0]?.regionCode || 'US';

  const loadData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const username = authUser.user_metadata.username;
      const [userRes, favRes] = await Promise.all([
        edgeFn.get(`users/${username}`),
        edgeFn.get('favorites', { region }),
      ]);
      setCurrentUser(userRes.data);
      setPartner(userRes.data.relationship?.partner || null);
      setFavorites(favRes.data);
    } catch {
      Alert.alert('Error', 'Could not load watchlist');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRemove = async (favoriteId) => {
    try {
      await edgeFn.delete(`favorites/${favoriteId}`);
      setFavorites((prev) => prev.filter((f) => f.favorite_id !== favoriteId));
    } catch {
      Alert.alert('Error', 'Could not remove favorite');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C9A84C" />
      </View>
    );
  }

  const filtered = filter === 'all' ? favorites : favorites.filter((f) => f.content_type === filter);

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.favorite_id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>Partner Watchlist</Text>
            {partner ? (
              <PartnerHeader user={currentUser} partner={partner} />
            ) : (
              <Text style={styles.noPartnerText}>
                Connect with a partner to start a shared watchlist
              </Text>
            )}
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
                  ? 'No titles in your partner watchlist yet — start swiping together!'
                  : `No ${filter === 'movie' ? 'movie' : 'show'} titles yet`}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => <FavoriteCard item={item} onRemove={handleRemove} onPress={() => setSelectedItem(item)} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#C9A84C" />
        }
      />
      <DetailModal
        item={selectedItem}
        genreMap={{}}
        mode="partner"
        onRemove={async (item) => {
          await edgeFn.delete(`favorites/${item.favorite_id}`);
          setFavorites(prev => prev.filter(f => f.favorite_id !== item.favorite_id));
        }}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0505' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a0505' },
  listContent: { paddingBottom: 32 },
  screenTitle: {
    color: '#C9A84C',
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
  heartDivider: { fontSize: 28, color: '#C9A84C' },
  avatarWrapper: { alignItems: 'center', gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#C9A84C' },
  avatarFallback: { backgroundColor: '#5a2a2a', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#ddc9a8', fontSize: 24, fontWeight: 'bold' },
  avatarName: { color: '#ddc9a8', fontSize: 13 },
  avatarPlaceholder: { width: 64, height: 64 },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a0505',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a1a1a',
  },
  toggleBtnActive: { backgroundColor: '#8B1A1A', borderColor: '#C9A84C' },
  toggleText: { color: '#7a4030', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#C9A84C' },
  noPartnerText: { color: '#8a6a30', textAlign: 'center', marginTop: 8, marginBottom: 24, fontSize: 15, paddingHorizontal: 32 },
  emptyText: { color: '#8a6a30', textAlign: 'center', marginTop: 40, fontSize: 16, paddingHorizontal: 32 },
  cardTop: { flexDirection: 'row', padding: 12, gap: 12 },
  cardPoster: { width: 90, height: 130, borderRadius: 8 },
  posterFallback: { backgroundColor: '#5a1a1a' },
  cardDetails: { flex: 1 },
  typeBadge: {
    backgroundColor: '#5a2a2a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  typeBadgeText: { color: '#8a6a30', fontSize: 11 },
  cardTitle: { color: '#C9A84C', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cardGenre: { color: '#C9A84C', fontSize: 12, marginBottom: 2 },
  cardYear: { color: '#8a6a30', fontSize: 12, marginBottom: 6 },
  cardOverview: { color: '#ddc9a8', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  overviewToggle: { color: '#C9A84C', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  trailerLink: { color: '#C9A84C', fontSize: 13, fontWeight: '600' },
  providersSection: { paddingHorizontal: 12, paddingBottom: 12 },
  providerRow: { marginBottom: 6 },
  providerLabel: { color: '#8a6a30', fontSize: 12, marginBottom: 4 },
  providerLogos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5a2a2a', borderRadius: 6, padding: 4, gap: 4 },
  providerLogo: { width: 20, height: 20, borderRadius: 4 },
  providerName: { color: '#ddc9a8', fontSize: 11, maxWidth: 80 },
  noProviders: { color: '#5a2a2a', fontSize: 12, fontStyle: 'italic' },
  removeBtn: {
    borderTopWidth: 1,
    borderTopColor: '#C9A84C',
    padding: 12,
    alignItems: 'center',
  },
  removeBtnText: { color: '#C9A84C', fontSize: 14, fontWeight: '600' },
});
