import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, Alert,
  ScrollView, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { edgeFn } from '../lib/edgeFunctions';
import DetailModal from '../components/DetailModal';
import { useOnboarding } from '../context/OnboardingContext';

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
  const navigation = useNavigation();
  const {
    introSeen,
    shouldShowPrompt,
    markIntroSeen,
    markPromptSeen,
    markSkipper,
    notifyCardAction,
  } = useOnboarding();

  // Local visibility state for the connect prompt overlay.
  // Initialized false; flips to true once when shouldShowPrompt fires.
  const [promptVisible, setPromptVisible] = useState(false);
  const promptInitRef = useRef(false);

  useEffect(() => {
    if (shouldShowPrompt && !promptInitRef.current) {
      promptInitRef.current = true;
      setPromptVisible(true);
      markPromptSeen(); // persist immediately so it never re-fires
    }
  }, [shouldShowPrompt, markPromptSeen]);

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

  // Fetch provider logos once on mount
  useEffect(() => {
    const region = Localization.getLocales()[0]?.regionCode || 'US';
    edgeFn.get('browse/providers', { region })
      .then(({ data }) => setProviderLogos(data))
      .catch(() => {});
  }, []);

  // Load groups list on focus; reset platform filter
  useFocusEffect(
    useCallback(() => {
      edgeFn.get('groups').then(({ data }) => setGroups(data)).catch(() => {});
      setSelectedProvider(null);
    }, [])
  );

  // Fetch genre list whenever content type changes
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

  // On mount: resume from last saved page
  useEffect(() => {
    AsyncStorage.getItem('browse_last_page_partner').then(saved => {
      const startPage = saved ? parseInt(saved, 10) : 1;
      loadPage(startPage, true);
      hasInitialized.current = true;
    });
  }, []);

  // On filter changes: reset to page 1
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
    const ctx = browseContext === 'partner' ? 'partner' : 'group';
    notifyCardAction('like', ctx);
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
    notifyCardAction('pass', browseContext === 'partner' ? 'partner' : 'group');
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
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => setSelectedItem(item)}>
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
          placeholderTextColor="#666"
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
        {/* "All" tile */}
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

        {/* Platform icon tiles */}
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
          <ActivityIndicator size="large" color="#e94560" />
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
              ? <ActivityIndicator color="#e94560" style={{ marginVertical: 24 }} />
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

      {/* Intro line — shown once before first swipe */}
      {!introSeen && (
        <View style={styles.introOverlay}>
          <View style={styles.introBox}>
            <Text style={styles.introText}>
              A watchlist is created when your partner or friend likes the same movie or show as you.
            </Text>
            <TouchableOpacity style={styles.introBtn} onPress={markIntroSeen} activeOpacity={0.85}>
              <Text style={styles.introBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Connect prompt — fires at 5 likes or 20 swipes, dismisses only on Skip */}
      {promptVisible && (
        <View style={styles.promptOverlay}>
          <View style={styles.promptBox}>
            <View style={styles.promptChip}>
              <Text style={styles.promptChipText}>Start matching</Text>
            </View>
            <Text style={styles.promptTitle}>Who are you watching with?</Text>
            <Text style={styles.promptSubtext}>
              Your picks become matches the moment someone you invite likes them too.
            </Text>
            <View style={styles.promptCards}>
              <TouchableOpacity
                style={styles.promptCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Partner')}
              >
                <Text style={styles.promptCardTitle}>Invite your partner</Text>
                <Text style={styles.promptCardSub}>Match one-on-one</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Groups')}
              >
                <Text style={styles.promptCardTitle}>Start a group</Text>
                <Text style={styles.promptCardSub}>Match with friends</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.promptSkip}
              onPress={() => { setPromptVisible(false); markSkipper(); }}
            >
              <Text style={styles.promptSkipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
  container: { flex: 1, backgroundColor: '#1a1a2e' },
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
    backgroundColor: '#16213e',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  clearBtn: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  clearBtnText: { color: '#aaa', fontSize: 14 },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#e94560' },
  toggleText: { color: '#888', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  platformScroll: { height: 88, marginBottom: 8 },
  platformScrollContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  platformAllBtn: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0f3460',
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformAllText: { color: '#888', fontSize: 22, fontWeight: '700' },
  platformAllTextActive: { color: '#e94560' },
  platformIconBtn: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  platformIconBtnActive: { borderColor: '#e94560' },
  platformIconImg: { width: '100%', height: '100%' },
  platformFallbackView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  platformFallbackText: { color: '#aaa', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  platformSearchNotice: { color: '#555', fontSize: 11, paddingHorizontal: 16, marginBottom: 6, fontStyle: 'italic' },
  sectionLabel: {
    color: '#aaa',
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
    backgroundColor: '#16213e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  genreChipActive: { backgroundColor: '#e94560', borderColor: '#e94560' },
  genreChipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  genreChipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f3460',
    flexDirection: 'row',
    minHeight: 155,
  },
  poster: { width: 100, alignSelf: 'stretch' },
  posterFallback: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  posterFallbackText: { color: '#888', fontSize: 13 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 6 },
  cardYear: { color: '#888', fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  typeBadge: { backgroundColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12 },
  genreBadge: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#ccc', fontSize: 12 },
  overview: { color: '#999', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  cardActions: { flexDirection: 'row', gap: 10 },
  passBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333',
  },
  passBtnText: { color: '#aaa', fontWeight: '600' },
  likeBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#e94560',
  },
  likeBtnText: { color: '#fff', fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 16 },
  exhaustedText: { color: '#555', textAlign: 'center', paddingVertical: 16, fontSize: 14 },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#16213e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  contextPillLabel: { color: '#888', fontSize: 13 },
  contextPillValue: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  // Intro overlay
  introOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 52, 96, 0.96)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 50,
  },
  introBox: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    marginHorizontal: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#0f3460',
    alignItems: 'center',
  },
  introText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  introBtn: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  introBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Connect prompt overlay
  promptOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10, 15, 30, 0.97)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 50,
  },
  promptBox: {
    width: '88%',
    backgroundColor: '#16213e',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#0f3460',
    alignItems: 'center',
  },
  promptChip: {
    backgroundColor: '#0f3460',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    marginBottom: 18,
  },
  promptChipText: { color: '#e94560', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  promptTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  promptSubtext: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  promptCards: { width: '100%', gap: 12, marginBottom: 24 },
  promptCard: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1a4080',
    alignItems: 'center',
  },
  promptCardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  promptCardSub:   { color: '#888', fontSize: 13 },
  promptSkip:      { paddingVertical: 8, paddingHorizontal: 20 },
  promptSkipText:  { color: '#555', fontSize: 14 },

  contextModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  contextModalBox: { backgroundColor: '#16213e', borderRadius: 16, padding: 20, width: '80%', borderWidth: 1, borderColor: '#0f3460' },
  contextModalTitle: { color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  contextOption: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  contextOptionActive: { backgroundColor: '#e94560' },
  contextOptionText: { color: '#ccc', fontSize: 16 },
  contextOptionTextActive: { color: '#fff', fontWeight: 'bold' },
});
