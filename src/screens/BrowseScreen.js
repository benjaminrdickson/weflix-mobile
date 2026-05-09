import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import api from '../services/api';
import { openTrailer } from '../components/TrailerModal';

const CONTENT_TYPES = ['movie', 'tv', 'both'];
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export default function BrowseScreen() {
  const [content, setContent] = useState(null);
  const [contentType, setContentType] = useState('movie');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setContent(null);
    try {
      const { data } = await api.get('/movies/random', { params: { content_type: contentType } });
      setContent(data);
    } catch (err) {
      if (err.response?.status === 404) {
        Alert.alert('All caught up!', 'You have seen everything available right now.');
      } else {
        Alert.alert('Error', 'Could not load content. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [contentType]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleLike = async () => {
    if (!content || acting) return;
    setActing(true);
    try {
      await api.post('/likes', {
        api_movie_id: content.id,
        content_type: content.content_type || contentType,
      });
    } catch {
      // Like failed silently — still move to next card
    } finally {
      setActing(false);
      fetchContent();
    }
  };

  const handlePass = () => {
    if (!acting) fetchContent();
  };

  const trailerKey = (
    content?.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
    content?.videos?.results?.find(v => v.site === 'YouTube')
  )?.key || null;

  const resolvedType = content?.content_type || contentType;

  return (
    <View style={styles.container}>
      {/* Content type toggle */}
      <View style={styles.toggle}>
        {CONTENT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.toggleBtn, contentType === type && styles.toggleBtnActive]}
            onPress={() => setContentType(type)}
          >
            <Text style={[styles.toggleText, contentType === type && styles.toggleTextActive]}>
              {type === 'movie' ? 'Movies' : type === 'tv' ? 'Shows' : 'Both'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      ) : content ? (
        <ScrollView contentContainerStyle={styles.card} showsVerticalScrollIndicator={false}>
          {content.poster_path ? (
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}${content.poster_path}` }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Text style={styles.posterPlaceholderText}>No Image</Text>
            </View>
          )}

          <View style={styles.meta}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {resolvedType === 'tv' ? '📺 TV Show' : '🎬 Movie'}
                </Text>
              </View>
            </View>
            <Text style={styles.title} numberOfLines={2}>{content.title}</Text>
            <Text style={styles.date}>{content.release_date?.slice(0, 4)}</Text>
            <Text style={styles.overview} numberOfLines={5}>{content.overview}</Text>

            <TouchableOpacity style={styles.trailerBtn} onPress={() => openTrailer(trailerKey)}>
              <Text style={styles.trailerText}>▶ Watch Trailer</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={handlePass} disabled={loading || acting}>
          <Text style={styles.actionBtnText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike} disabled={loading || acting}>
          {acting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>❤</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  toggle: {
    flexDirection: 'row',
    margin: 16,
    marginTop: 56,
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
  toggleBtnActive: {
    backgroundColor: '#e94560',
  },
  toggleText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    paddingBottom: 120,
  },
  poster: {
    width: '100%',
    height: 420,
  },
  posterPlaceholder: {
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterPlaceholderText: {
    color: '#888',
    fontSize: 18,
  },
  meta: {
    padding: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#0f3460',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#aaa',
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  overview: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  trailerBtn: {
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
  },
  trailerText: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
  },
  actions: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  passBtn: {
    backgroundColor: '#333',
  },
  likeBtn: {
    backgroundColor: '#e94560',
  },
  actionBtnText: {
    fontSize: 28,
    color: '#fff',
  },
});
