import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getPublicProfile, getUserReviews, PublicProfile, UserReview } from '../../apis/community';
import ReportModal from '../../components/ReportModal';

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reportVisible, setReportVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setError('');
    try {
      const [profileResponse, reviewResponse] = await Promise.all([
        getPublicProfile(userId),
        getUserReviews(userId),
      ]);
      setProfile(profileResponse.content);
      setReviews(reviewResponse.content.reviews || []);
      setRatingAverage(Number(reviewResponse.content.average_rating) || 0);
      setRatingCount(Number(reviewResponse.content.review_count) || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadProfile();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#00C9A7" size="large" /></View>;
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'No encontramos este perfil.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); void loadProfile(); }}>
          <Text style={styles.retryText}>Intentar de nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photo = profile.profile_pic_url;
  const products = profile.products || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C9A7" />}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Feather name="arrow-left" size={21} color="#1F2937" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <View style={styles.profileCard}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Feather name="user" size={42} color="#00A98D" /></View>
        )}
        <Text style={styles.name}>{profile.username || 'Usuario ZAS'}</Text>
        {!!profile.city && (
          <View style={styles.cityRow}>
            <Feather name="map-pin" size={15} color="#6B7280" />
            <Text style={styles.cityText}>Ubicado en: {profile.city}</Text>
          </View>
        )}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.completed_trip_count ?? 0}</Text>
            <Text style={styles.statLabel}>Viajes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={styles.ratingLine}>
              <Feather name="star" size={17} color="#00C9A7" />
              <Text style={styles.statValue}>{ratingAverage.toFixed(1)}</Text>
            </View>
            <Text style={styles.statLabel}>{ratingCount} reseñas</Text>
          </View>
        </View>
        {!!profile.vehicle && (
          <View style={styles.vehicleRow}>
            <Feather name="truck" size={16} color="#00A98D" />
            <Text style={styles.vehicleText}>
              {[profile.vehicle.vehicle_type, profile.vehicle.plate].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
        <Feather name="flag" size={15} color="#6B7280" />
        <Text style={styles.reportText}>Reportar este perfil</Text>
      </TouchableOpacity>

      {reviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reseñas recientes</Text>
          {reviews.slice(0, 4).map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{review.reviewer?.username || 'Usuario'}</Text>
                <View style={styles.ratingLine}>
                  <Feather name="star" size={14} color="#00C9A7" />
                  <Text style={styles.reviewRating}>{review.rating}/5</Text>
                </View>
              </View>
              {!!review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              {review.tags?.length > 0 && <Text style={styles.reviewTags}>{review.tags.join(' · ')}</Text>}
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Productos en venta</Text>
        {products.length === 0 ? (
          <Text style={styles.emptyText}>Este usuario aún no tiene productos publicados.</Text>
        ) : (
          <View style={styles.productGrid}>
            {products.map((product) => {
              const imageUrl = product.image_urls?.[0] || product.image_url;
              return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productCard}
                  onPress={() => router.push(`/marketplace/product/${product.id}`)}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productFallback]}>
                      <Feather name="image" size={28} color="#9CA3AF" />
                    </View>
                  )}
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  <Text style={styles.productPrice}>${Number(product.price).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        reportedUserId={profile.id}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  backText: { color: '#1F2937', fontWeight: '600' },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, alignItems: 'center', marginTop: 8, elevation: 2 },
  reportButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  reportText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarFallback: { backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#1F2937', fontSize: 22, fontWeight: '800', marginTop: 14 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  cityText: { color: '#6B7280', fontSize: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  stat: { alignItems: 'center', minWidth: 115 },
  statValue: { color: '#1F2937', fontSize: 19, fontWeight: '800' },
  statLabel: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  statDivider: { width: 1, height: 34, backgroundColor: '#E5E7EB' },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 },
  vehicleText: { color: '#4B5563', fontSize: 13 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  reviewCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { color: '#1F2937', fontWeight: '700' },
  reviewRating: { color: '#374151', fontWeight: '700', fontSize: 13 },
  reviewComment: { color: '#4B5563', lineHeight: 20, marginTop: 8 },
  reviewTags: { color: '#008F79', fontSize: 12, marginTop: 8 },
  emptyText: { color: '#6B7280', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 14 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  productCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, marginBottom: 4 },
  productImage: { width: '100%', height: 130, borderRadius: 10, backgroundColor: '#F3F4F6' },
  productFallback: { alignItems: 'center', justifyContent: 'center' },
  productTitle: { color: '#1F2937', fontWeight: '600', marginTop: 9, minHeight: 38 },
  productPrice: { color: '#00A98D', fontWeight: '800', fontSize: 16, marginTop: 5 },
  errorText: { color: '#B91C1C', textAlign: 'center' },
  retryButton: { backgroundColor: '#00C9A7', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, marginTop: 14 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
