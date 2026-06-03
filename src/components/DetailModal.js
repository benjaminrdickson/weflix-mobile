import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, Image, ScrollView,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { edgeFn } from '../lib/edgeFunctions';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export default function DetailModal({ item, genreMap, onLike, onPass, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!item) return;
    setDetail(null);
    setLoading(true);
    edgeFn.get(`browse/${item.id}`, { content_type: item.content_type })
      .then(({ data }) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [item?.id]);

  const trailerKey = (() => {
    const videos = detail?.videos?.results || [];
    const match =
      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
      videos.find(v => v.site === 'YouTube');
    return match?.key || null;
  })();

  const handleTrailer = async () => {
    if (!trailerKey) return;
    setTrailerLoading(true);
    try {
      await WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${trailerKey}`, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        toolbarColor: '#1a1a2e',
      });
    } finally {
      setTrailerLoading(false);
    }
  };

  const handleLike = async () => {
    if (acting) return;
    setActing(true);
    await onLike(item);
    setActing(false);
    onClose();
  };

  const handlePass = async () => {
    if (acting) return;
    setActing(true);
    await onPass(item);
    setActing(false);
    onClose();
  };

  const genres = (item?.genre_ids || [])
    .map(id => genreMap[id])
    .filter(Boolean);

  const year = item?.release_date?.slice(0, 4) || '';

  return (
    <Modal visible={!!item} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {item?.poster_path ? (
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

            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={2}>{item?.title}</Text>
                <Text style={styles.year}>{year}</Text>
              </View>

              <View style={styles.badgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {item?.content_type === 'tv' ? '📺 Show' : '🎬 Movie'}
                  </Text>
                </View>
                {genres.map(g => (
                  <View key={g} style={styles.genreBadge}>
                    <Text style={styles.genreBadgeText}>{g}</Text>
                  </View>
                ))}
              </View>

              {loading ? (
                <ActivityIndicator color="#e94560" style={{ marginVertical: 24 }} />
              ) : (
                <>
                  <Text style={styles.overview}>{detail?.overview || item?.overview || 'No description available.'}</Text>

                  <TouchableOpacity
                    style={[styles.trailerBtn, !trailerKey && styles.trailerBtnDisabled]}
                    onPress={handleTrailer}
                    disabled={!trailerKey || trailerLoading}
                  >
                    {trailerLoading
                      ? <ActivityIndicator color="#e94560" size="small" />
                      : <Text style={[styles.trailerText, !trailerKey && styles.trailerTextDisabled]}>
                          {trailerKey ? '▶  Watch Trailer' : 'No Trailer Available'}
                        </Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={handlePass} disabled={acting}>
              {acting ? <ActivityIndicator color="#aaa" /> : <Text style={styles.passBtnText}>✕  Pass</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={handleLike} disabled={acting}>
              {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.likeBtnText}>❤  Like</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  poster: { width: '100%', height: 300, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  posterFallback: { backgroundColor: '#16213e', justifyContent: 'center', alignItems: 'center' },
  posterFallbackText: { color: '#888', fontSize: 18 },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', flex: 1, marginRight: 8 },
  year: { color: '#888', fontSize: 16, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  typeBadge: { backgroundColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { color: '#aaa', fontSize: 12 },
  genreBadge: { backgroundColor: '#16213e', borderWidth: 1, borderColor: '#0f3460', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  genreBadgeText: { color: '#ccc', fontSize: 12 },
  overview: { color: '#ccc', fontSize: 15, lineHeight: 23, marginBottom: 20 },
  trailerBtn: {
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  trailerBtnDisabled: { borderColor: '#444' },
  trailerText: { color: '#e94560', fontWeight: '600', fontSize: 15 },
  trailerTextDisabled: { color: '#555' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  passBtn: { backgroundColor: '#16213e', borderWidth: 1, borderColor: '#333' },
  passBtnText: { color: '#aaa', fontWeight: '600', fontSize: 16 },
  likeBtn: { backgroundColor: '#e94560' },
  likeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
