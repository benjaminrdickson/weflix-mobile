import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, Alert,
  ScrollView, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { edgeFn } from '../lib/edgeFunctions';
import DetailModal from '../components/DetailModal';
import TicketCard from '../components/TicketCard';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const TMDB_LOGO_BASE  = 'https://image.tmdb.org/t/p/original';
const CONTENT_TYPES = [
  { key: 'movie', label: 'Movies' },
  { key: 'tv',    label: 'Shows'  },
  { key: 'both',  label: 'Both'   },
];
const PLATFORMS = [
  { id: 8,   label: 'Netflix' },
  { id: 9,   label: 'Prime' },
  { id: 337, label: 'Disney+' },
  { id: 1899, label: 'Max' },
  { id: 15,  label: 'Hulu' },
  { id: 350, label: 'Apple TV+' },
  { id: 386, label: 'Peacock' },
  { id: 531, label: 'Paramount+' },
  { id: 73,  label: 'Tubi' },
  { id: 283, label: 'Crunchyroll' },
];

export default function BrowseScreen() {
  const [contentType, setContentType] = useState('movie');
  const [genres, setGenres]           = useState([]);
  const [genreMap, setGenreMap]       = useState({});
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [query, setQuery]             = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const [items, setItems]             = useState([]);
  const [page, setPage]               = useState(1);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted]     = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);

  const [groups, setGroups]           = useState([]);
  const [browseContext, setBrowseContext] = useState('partner');
  const [contextPickerVisible, setContextPickerVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerLogos, setProviderLogos] = useState({});

  const activeRequest = useRef(null);
  const loadingRef = useRef(false);
  const hasInitialized = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    const region = Localization.getLocales()[0]?.regionCode || 'US';
    edgeFn.get('browse/providers', { region })
      .then(({ data }) => setProviderLogos(data))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      edgeFn.get('groups').then(({ data }) => setGroups(data)).catch(() => {});
      setSelectedProvider(null);
    }, [])
  );

  useEffect(() => {
    edgeFn.get('genres', { content_type: contentType })
      .then(({ data }) => {
        setGenres(data);
        const map = {};
        data.forEach(g => { map[g.id] = g.name; });
        setGenreMap(map);
      })
      .catch(() => {});
  }, [contentType]);

  useEffect(() => {
    AsyncStorage.getItem('browse_last_page_partner').then(saved => {
      const startPage = saved ? parseInt(saved, 10) : 1;
      loadPage(startPage, true);
      hasInitialized.current = true;
    });
  }, []);

  useEffect(() => {
    if (!hasInitialized.current) return;
    loadPage(1, true);
  }, [contentType, selectedGenre, submittedQuery, browseContext, selectedProvider]);

  const loadPage = useCallback(async (targetPage, reset = false) => {
    const requestId = Date.now();
    activeRequest.current = requestId;
    loadingRef.current = true;

    if (reset) {
      setLoadingFirst(true);
      setExhausted(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data } = await edgeFn.get('browse', {
        content_type:      contentType,
        page:              targetPage,
        genre_id:          selectedGenre || undefined,
        query:             submittedQuery || undefined,
        context:           browseContext,
        watch_provider_id: (!submittedQuery && selectedProvider) ? selectedProvider : undefined,
        region:            Localization.getLocales()[0]?.regionCode || 'US',
      });

      if (activeRequest.current !== requestId) return;

      const incoming = data.results || [];
      if (reset) {
        setItems(incoming);
        setPage(targetPage);
      } else {
        setItems(prev => [...prev, ...incoming]);
      }
      if (incoming.length === 0) setExhausted(true);
      if (incoming.length > 0) AsyncStorage.setItem(`browse_last_page_${browseContext}`, String(targetPage));
    } catch {
      if (activeRequest.current !== requestId) return;
      if (!isMounted.current) return;
      Alert.alert('Error', 'Could not load content. Please try again.');
    } finally {
      if (activeRequest.current === requestId) {
        setLoadingFirst(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    }
  }, [contentType, selectedGenre, submittedQuery, browseContext, selectedProvider]);

  const handleEndReached = () => {
    if (loadingRef.current || loadingFirst || exhausted) return;
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  const removeItem = (id, type) => {
    setItems(prev => prev.filter(i => !(i.id === id && i.content_type === type)));
  };

  const handleLike = async (item) => {
    try {
      if (browseContext === 'partner') {
        await edgeFn.post('likes', { api_movie_id: item.id, content_type: item.content_type });
      } else {
        await edgeFn.post(`group-likes/${browseContext}`, { api_movie_id: item.id, content_type: item.content_type });
      }
    } catch {
      // fail silently
    }
    removeItem(item.id, item.content_type);
  };

  const handlePass = async (item) => {
    try {
      await edgeFn.post('passes', { api_movie_id: item.id, content_type: item.content_type });
    } catch {
      // fail silently
    }
    removeItem(item.id, item.content_type);
  };

  const renderCard = ({ item }) => {
    const year = item.release_date?.slice(0, 4) || '';
    const genreLabels = (item.genre_ids || []).slice(0, 3).map(id => genreMap[id]).filter(Boolean);

    return (
      <TouchableOpacity activeOpacity={0.92} onPress={() => setSelectedItem(item)} style={{ marginBottom: 12 }}>
        <TicketCard posterWidth={100} style={{ flexDirection: 'row', minHeight: 155 }}>
          {item.poster_path ? (
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}${item.poster_path}` }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterFallbackText}>No Image</Text>
            </View>
          )}

          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardYear}>{year}</Text>
            </View>

            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {item.content_type === 'tv' ? '📺' : '🎬'}
                </Text>
              </View>
              {genreLabels.map(g => (
                <View key={g} style={styles.genreBadge}>
                  <Text style={styles.genreBadgeText}>{g}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.overview} numberOfLines={2}>{item.overview}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.passBtn} onPress={() => handlePass(item)}>
                <Text style={styles.passBtnText}>✕  Pass</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.likeBtn} onPress={() => handleLike(item)}>
                <Text style={styles.likeBtnText}>❤  Like</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TicketCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies & shows..."
          placeholderTextColor="#8a6a30"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSubmittedQuery(query.trim())}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {submittedQuery ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setQuery(''); setSubmittedQuery(''); }}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Context selector */}
      {(() => {
        const contextLabel = browseContext === 'partner'
          ? 'Partner'
          : groups.find(g => String(g.id) === browseContext)?.name || 'Group';
        return (
          <TouchableOpacity style={styles.contextPill} onPress={() => setContextPickerVisible(true)}>
            <Text style={styles.contextPillLabel}>Browsing for: </Text>
            <Text style={styles.contextPillValue}>{contextLabel} ▾</Text>
          </TouchableOpacity>
        );
      })()}

      {/* Content type toggle */}
      <View style={styles.toggle}>
        {CONTENT_TYPES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.toggleBtn, contentType === key && styles.toggleBtnActive]}
            onPress={() => { setSelectedGenre(null); setContentType(key); }}
          >
            <Text style={[styles.toggleText, contentType === key && styles.toggleTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Platform filter */}
      <Text style={styles.sectionLabel}>Streaming On</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.platformScroll}
        contentContainerStyle={styles.platformScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.platformAllBtn,
            !selectedProvider && styles.platformIconBtnActive,
            !!submittedQuery && { opacity: 0.25 },
          ]}
          onPress={() => setSelectedProvider(null)}
          disabled={!!submittedQuery}
          activeOpacity={0.7}
        >
          <Text style={[styles.platformAllText, !selectedProvider && styles.platformAllTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        {PLATFORMS.map(p => {
          const isSelected = selectedProvider === p.id;
          const isOtherSelected = selectedProvider !== null && !isSelected;
          const logoPath = providerLogos[p.id];
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.platformIconBtn,
                isSelected && styles.platformIconBtnActive,
                isOtherSelected && { opacity: 0.5 },
                !!submittedQuery && { opacity: 0.25 },
              ]}
              onPress={() => {
                if (isSelected) {
                  setSelectedProvider(null);
                } else {
                  setSelectedProvider(p.id);
                  setSelectedGenre(null);
                }
              }}
              disabled={!!submittedQuery}
              activeOpacity={0.7}
            >
              {logoPath ? (
                <Image
                  source={{ uri: `${TMDB_LOGO_BASE}${logoPath}` }}
                  style={styles.platformIconImg}
                />
              ) : (
                <View style={styles.platformFallbackView}>
                  <Text style={styles.platformFallbackText} numberOfLines={2}>{p.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {!!submittedQuery && (
        <Text style={styles.platformSearchNotice}>Platform filter unavailable during search</Text>
      )}

      {/* Genre chips */}
      {genres.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Genre</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.genreScroll}
            contentContainerStyle={styles.genreScrollContent}
          >
            <TouchableOpacity
              style={[styles.genreChip, !selectedGenre && styles.genreChipActive]}
              onPress={() => setSelectedGenre(null)}
            >
              <Text style={[styles.genreChipText, !selectedGenre && styles.genreChipTextActive]}>All</Text>
            </TouchableOpacity>
            {genres.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.genreChip, selectedGenre === g.id && styles.genreChipActive]}
                onPress={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)}
              >
                <Text style={[styles.genreChipText, selectedGenre === g.id && styles.genreChipTextActive]}>
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* List */}
      {loadingFirst ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => `${item.content_type}-${item.id}`}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color="#C9A84C" style={{ marginVertical: 24 }} />
              : exhausted && items.length > 0
                ? <Text style={styles.exhaustedText}>You've seen everything!</Text>
                : null
          }
        />
      )}

      <DetailModal
        item={selectedItem}
        genreMap={genreMap}
        onLike={handleLike}
        onPass={handlePass}
        onClose={() => setSelectedItem(null)}
      />

      <Modal visible={contextPickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.contextModalOverlay} activeOpacity={1} onPress={() => setContextPickerVisible(false)}>
          <View style={styles.contextModalBox}>
            <Text style={styles.contextModalTitle}>Browse for...</Text>
            <TouchableOpacity
              style={[styles.contextOption, browseContext === 'partner' && styles.contextOptionActive]}
              onPress={() => { setBrowseContext('partner'); setContextPickerVisible(false); }}
            >
              <Text style={[styles.contextOptionText, browseContext === 'partner' && styles.contextOptionTextActive]}>
                ❤️  Partner
              </Text>
            </TouchableOpacity>
            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.contextOption, browseContext === String(g.id) && styles.contextOptionActive]}
                onPress={() => { setBrowseContext(String(g.id)); setContextPickerVisible(false); }}
              >
                <Text style={[styles.contextOptionText, browseContext === String(g.id) && styles.contextOptionTextActive]}>
                  👥  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a0505' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 56,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#8B2A2A',
    color: '#ddc9a8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  clearBtn: {
    backgroundColor: '#8B2A2A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  clearBtnText: { color: '#8a6a30', fontSize: 14 },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1a0505',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#4a1a1a' },
  toggleBtnActive: { backgroundColor: '#8B1A1A', borderColor: '#C9A84C' },
  toggleText: { color: '#7a4030', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#C9A84C' },
  platformScroll: { height: 88, marginBottom: 8 },
  platformScrollContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  platformAllBtn: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    backgroundColor: '#8B2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformAllText: { color: '#8a6a30', fontSize: 22, fontWeight: '700' },
  platformAllTextActive: { color: '#C9A84C' },
  platformIconBtn: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    overflow: 'hidden',
  },
  platformIconBtnActive: { borderColor: '#C9A84C' },
  platformIconImg: { width: '100%', height: '100%' },
  platformFallbackView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8B2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  platformFallbackText: { color: '#8a6a30', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  platformSearchNotice: { color: '#5a2a2a', fontSize: 11, paddingHorizontal: 16, marginBottom: 6, fontStyle: 'italic' },
  sectionLabel: {
    color: '#C9A84C',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  genreScroll: { height: 52, marginBottom: 12 },
  genreScrollContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#8B2A2A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  genreChipActive: { backgroundColor: '#8B1A1A', borderColor: '#C9A84C' },
  genreChipText: { color: '#C9A84C', fontSize: 13, fontWeight: '500' },
  genreChipTextActive: { color: '#C9A84C' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  poster: { width: 100, alignSelf: 'stretch' },
  posterFallback: { backgroundColor: '#5a1a1a', justifyContent: 'center', alignItems: 'center' },
  posterFallbackText: { color: '#8a6a30', fontSize: 13 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { color: '#C9A84C', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 6 },
  cardYear: { color: '#8a6a30', fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  typeBadge: { backgroundColor: '#5a2a2a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12 },
  genreBadge: { backgroundColor: '#8B2A2A', borderWidth: 1, borderColor: '#C9A84C', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#ddc9a8', fontSize: 12 },
  overview: { color: '#ddc9a8', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardActions: { flexDirection: 'row', gap: 10 },
  passBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#1a0505', borderWidth: 1, borderColor: '#5a2a2a',
  },
  passBtnText: { color: '#8a6a30', fontWeight: '600' },
  likeBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#8B1A1A', borderWidth: 1, borderColor: '#C9A84C',
  },
  likeBtnText: { color: '#C9A84C', fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#8a6a30', fontSize: 16 },
  exhaustedText: { color: '#5a2a2a', textAlign: 'center', paddingVertical: 16, fontSize: 14 },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#8B2A2A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  contextPillLabel: { color: '#8a6a30', fontSize: 13 },
  contextPillValue: { color: '#C9A84C', fontSize: 13, fontWeight: '600' },
  contextModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  contextModalBox: { backgroundColor: '#1a0505', borderRadius: 16, padding: 20, width: '80%', borderWidth: 1, borderColor: '#C9A84C' },
  contextModalTitle: { color: '#8a6a30', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  contextOption: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  contextOptionActive: { backgroundColor: '#8B1A1A' },
  contextOptionText: { color: '#ddc9a8', fontSize: 16 },
  contextOptionTextActive: { color: '#C9A84C', fontWeight: 'bold' },
});
