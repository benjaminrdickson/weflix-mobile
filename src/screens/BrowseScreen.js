import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, Alert,
  ScrollView,
} from 'react-native';
import api from '../services/api';
import DetailModal from '../components/DetailModal';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const CONTENT_TYPES = [
  { key: 'movie', label: 'Movies' },
  { key: 'tv',    label: 'Shows'  },
  { key: 'both',  label: 'Both'   },
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

  const activeRequest = useRef(null);

  // Fetch genre list whenever content type changes
  useEffect(() => {
    api.get('/genres', { params: { content_type: contentType } })
      .then(({ data }) => {
        setGenres(data);
        const map = {};
        data.forEach(g => { map[g.id] = g.name; });
        setGenreMap(map);
        setSelectedGenre(null);
      })
      .catch(() => {});
  }, [contentType]);

  // Reset and reload when filters change
  useEffect(() => {
    loadPage(1, true);
  }, [contentType, selectedGenre, submittedQuery]);

  const loadPage = useCallback(async (targetPage, reset = false) => {
    const requestId = Date.now();
    activeRequest.current = requestId;

    if (reset) {
      setLoadingFirst(true);
      setExhausted(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data } = await api.get('/browse', {
        params: {
          content_type: contentType,
          page: targetPage,
          genre_id: selectedGenre || undefined,
          query: submittedQuery || undefined,
        },
      });

      if (activeRequest.current !== requestId) return;

      const incoming = data.results || [];
      if (reset) {
        setItems(incoming);
        setPage(1);
      } else {
        setItems(prev => [...prev, ...incoming]);
      }
      if (incoming.length === 0) setExhausted(true);
    } catch {
      if (activeRequest.current !== requestId) return;
      Alert.alert('Error', 'Could not load content. Please try again.');
    } finally {
      if (activeRequest.current === requestId) {
        setLoadingFirst(false);
        setLoadingMore(false);
      }
    }
  }, [contentType, selectedGenre, submittedQuery]);

  const handleEndReached = () => {
    if (loadingMore || loadingFirst || exhausted) return;
    const next = page + 1;
    setPage(next);
    loadPage(next);
  };

  const removeItem = (id, type) => {
    setItems(prev => prev.filter(i => !(i.id === id && i.content_type === type)));
  };

  const handleLike = async (item) => {
    try {
      await api.post('/likes', { api_movie_id: item.id, content_type: item.content_type });
    } catch {
      // fail silently
    }
    removeItem(item.id, item.content_type);
  };

  const handlePass = async (item) => {
    try {
      await api.post('/passes', { api_movie_id: item.id, content_type: item.content_type });
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

      {/* Content type toggle */}
      <View style={styles.toggle}>
        {CONTENT_TYPES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.toggleBtn, contentType === key && styles.toggleBtnActive]}
            onPress={() => setContentType(key)}
          >
            <Text style={[styles.toggleText, contentType === key && styles.toggleTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Genre chips */}
      {genres.length > 0 && (
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
    marginBottom: 8,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#e94560' },
  toggleText: { color: '#888', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#fff' },
  genreScroll: { maxHeight: 40, marginBottom: 8 },
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
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  poster: { width: '100%', height: 220 },
  posterFallback: { backgroundColor: '#0f3460', justifyContent: 'center', alignItems: 'center' },
  posterFallbackText: { color: '#888', fontSize: 16 },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardYear: { color: '#888', fontSize: 14, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  typeBadge: { backgroundColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 12 },
  genreBadge: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#ccc', fontSize: 12 },
  overview: { color: '#999', fontSize: 14, lineHeight: 20, marginBottom: 14 },
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
});
