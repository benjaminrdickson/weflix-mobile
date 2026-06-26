import React, { useCallback, useState, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, Image, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { openTrailer } from '../components/TrailerModal';
import DetailModal from '../components/DetailModal';
import { useOnboarding } from '../context/OnboardingContext';
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

// Compact partner display used in STATE 2 / STATE 3 banners
function PartnerRow({ user }) {
  const [imgError, setImgError] = useState(false);
  if (!user) return null;
  return (
    <View style={styles.partnerRow}>
      {user.image_url && !imgError ? (
        <Image
          source={{ uri: user.image_url, cache: 'reload' }}
          style={styles.partnerRowAvatar}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.partnerRowAvatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
      )}
      <View>
        <Text style={styles.partnerRowUsername}>@{user.username}</Text>
        {user.name ? <Text style={styles.partnerRowName}>{user.name}</Text> : null}
      </View>
    </View>
  );
}

// Search result row — tap anywhere to send an invite
function PartnerUserRow({ user, onPress, disabled }) {
  const [imgError, setImgError] = useState(false);
  return (
    <TouchableOpacity
      style={styles.userRow}
      onPress={() => onPress(user)}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {user.image_url && !imgError ? (
        <Image
          source={{ uri: user.image_url, cache: 'reload' }}
          style={styles.userRowAvatar}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.userRowAvatar, styles.avatarFallback]}>
          <Text style={[styles.avatarInitial, { fontSize: 16 }]}>
            {(user.name || user.username)?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={styles.userRowInfo}>
        <Text style={styles.userRowUsername}>@{user.username}</Text>
        {user.name ? <Text style={styles.userRowName}>{user.name}</Text> : null}
      </View>
      <Text style={styles.inviteLabel}>Invite</Text>
    </TouchableOpacity>
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
    <TouchableOpacity style={styles.card} activeOpacity={0.95} onPress={onPress}>
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
    </TouchableOpacity>
  );
}

const FILTERS = ['all', 'movie', 'tv'];

export default function FavoritesScreen() {
  const { killPartnerNudge } = useOnboarding();

  const [favorites, setFavorites] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const searchTimerRef = useRef(null);

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
      setRelationship(userRes.data.relationship ?? null);
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

  // Same derivation as ProfileScreen lines 322-325
  const rel = relationship;
  const isRecipient = rel && !rel.is_sender;
  const isPending = rel && !rel.confirmed;
  const isActive = rel && rel.confirmed;

  useEffect(() => {
    if (isActive) killPartnerNudge();
  }, [isActive, killPartnerNudge]);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await edgeFn.get('users/search', { q: text.trim() });
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSendInvite = async (user) => {
    setActionLoading(true);
    try {
      await edgeFn.post('relationships', { recipient_id: user.id });
      setSearchQuery('');
      setSearchResults([]);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not send invite';
      Alert.alert('Could not send invite', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvite = () => {
    Alert.alert('Cancel invite', 'Are you sure you want to cancel this invite?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel invite',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await edgeFn.delete(`relationships/${rel.id}`);
            await loadData();
          } catch {
            Alert.alert('Error', 'Could not cancel invite');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleAcceptInvite = async () => {
    setActionLoading(true);
    try {
      await edgeFn.patch(`relationships/${rel.id}`);
      await loadData();
    } catch {
      Alert.alert('Error', 'Could not accept invite');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineInvite = () => {
    Alert.alert('Decline invite', 'Are you sure you want to decline this invite?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await edgeFn.delete(`relationships/${rel.id}`);
            await loadData();
          } catch {
            Alert.alert('Error', 'Could not decline invite');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleUnlink = () => {
    Alert.alert('End partnership', 'This will remove your shared watchlist. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End partnership',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await edgeFn.delete(`relationships/${rel.id}`);
            await loadData();
          } catch {
            Alert.alert('Error', 'Could not end partnership');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

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
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const filtered = filter === 'all' ? favorites : favorites.filter((f) => f.content_type === filter);

  return (
    <View style={styles.container}>
      <FlatList
        data={isActive ? filtered : []}
        keyExtractor={(item) => String(item.favorite_id)}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>Partner Watchlist</Text>

            {/* STATE 1: No relationship — search & invite */}
            {!rel && (
              <View style={styles.stateSection}>
                <Text style={styles.noPartnerText}>Find a partner by username or name</Text>
                <View style={styles.searchInputWrapper}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search..."
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchLoading && (
                    <ActivityIndicator size="small" color="#e94560" style={styles.searchSpinner} />
                  )}
                </View>
                {searchResults.map((u) => (
                  <PartnerUserRow
                    key={u.id}
                    user={u}
                    onPress={handleSendInvite}
                    disabled={actionLoading}
                  />
                ))}
                {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <Text style={styles.noResultsText}>No users found</Text>
                )}
              </View>
            )}

            {/* STATE 2: Invite sent (you are the sender, unconfirmed) */}
            {rel && isPending && !isRecipient && (
              <View style={styles.stateBanner}>
                <PartnerRow user={rel.partner} />
                <Text style={styles.bannerTitle}>Invite sent to @{rel.partner?.username}</Text>
                <Text style={styles.bannerSubtext}>Waiting for them to accept</Text>
                {actionLoading ? (
                  <ActivityIndicator color="#e94560" style={{ marginTop: 16 }} />
                ) : (
                  <TouchableOpacity style={styles.destructiveBtn} onPress={handleCancelInvite}>
                    <Text style={styles.destructiveBtnText}>Cancel invite</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* STATE 3: Invite received (you are the recipient, unconfirmed) */}
            {rel && isPending && isRecipient && (
              <View style={styles.stateBanner}>
                <PartnerRow user={rel.partner} />
                <Text style={styles.bannerTitle}>@{rel.partner?.username} invited you to be partners</Text>
                {actionLoading ? (
                  <ActivityIndicator color="#e94560" style={{ marginTop: 16 }} />
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptInvite}>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.declineBtn} onPress={handleDeclineInvite}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* STATE 4: Confirmed partnership — partner header + watchlist controls */}
            {isActive && (
              <>
                <PartnerHeader user={currentUser} partner={rel.partner} />
                <TouchableOpacity
                  style={styles.unlinkBtn}
                  onPress={handleUnlink}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? <ActivityIndicator color="#e94560" size="small" />
                    : <Text style={styles.unlinkBtnText}>Unlink / End partnership</Text>}
                </TouchableOpacity>
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
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FavoriteCard item={item} onRemove={handleRemove} onPress={() => setSelectedItem(item)} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor="#e94560"
          />
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

  // STATE 1 — search
  stateSection: { marginHorizontal: 16, marginBottom: 24 },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  searchSpinner: { marginLeft: 8 },
  noResultsText: { color: '#555', textAlign: 'center', paddingVertical: 12, fontSize: 14 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#0f3460',
    gap: 12,
  },
  userRowAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#e94560' },
  userRowInfo: { flex: 1 },
  userRowUsername: { color: '#fff', fontSize: 15, fontWeight: '600' },
  userRowName: { color: '#888', fontSize: 13, marginTop: 2 },
  inviteLabel: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  // STATE 2 / 3 — banners
  stateBanner: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
    alignItems: 'center',
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  partnerRowAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#e94560' },
  partnerRowUsername: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  partnerRowName: { color: '#888', fontSize: 13 },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  bannerSubtext: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12, width: '100%' },
  acceptBtn: { flex: 1, backgroundColor: '#2ecc71', borderRadius: 10, padding: 14, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  declineBtn: { flex: 1, backgroundColor: '#0f3460', borderRadius: 10, padding: 14, alignItems: 'center' },
  declineBtnText: { color: '#aaa', fontWeight: '600', fontSize: 16 },
  destructiveBtn: {
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  destructiveBtnText: { color: '#e94560', fontWeight: '600' },

  // STATE 4 — partner header + unlink
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  heartDivider: { fontSize: 28, color: '#e94560' },
  avatarWrapper: { alignItems: 'center', gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#e94560' },
  avatarFallback: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  avatarName: { color: '#ccc', fontSize: 13 },
  avatarPlaceholder: { width: 64, height: 64 },
  unlinkBtn: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  unlinkBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },

  // Filter toggle + watchlist
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#e94560' },
  toggleText: { color: '#888', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  noPartnerText: { color: '#888', textAlign: 'center', marginBottom: 16, fontSize: 15, paddingHorizontal: 16 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16, paddingHorizontal: 32 },

  // FavoriteCard
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
  cardOverview: { color: '#ccc', fontSize: 13, lineHeight: 18, marginBottom: 4 },
  overviewToggle: { color: '#e94560', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  trailerLink: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  providersSection: { paddingHorizontal: 12, paddingBottom: 12 },
  providerRow: { marginBottom: 6 },
  providerLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  providerLogos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    borderRadius: 6,
    padding: 4,
    gap: 4,
  },
  providerLogo: { width: 20, height: 20, borderRadius: 4 },
  providerName: { color: '#ccc', fontSize: 11, maxWidth: 80 },
  noProviders: { color: '#555', fontSize: 12, fontStyle: 'italic' },
  removeBtn: { borderTopWidth: 1, borderTopColor: '#0f3460', padding: 12, alignItems: 'center' },
  removeBtnText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
