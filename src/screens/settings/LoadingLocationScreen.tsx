import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'phosphor-react-native';

import { COLORS, FONT_SIZES, SPACING } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/appStore';
import { fetchLocation as fetchLocationAPI } from '../../services/api';
import { getCurrentLocation } from '../../utils/helpers';
import { findCountryByName } from '../../constants/countries';

export default function LoadingLocationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { setLocation } = useAppStore();

  useEffect(() => {
    detectLocation();
  }, []);

  const goBack = () => navigation.goBack();

  const detectLocation = async () => {
    try {
      const locationResult = await getCurrentLocation();

      if (!locationResult.success) {
        Alert.alert(
          t('location.title'),
          locationResult.error || t('loadingLocation.errorLocation'),
          [{ text: t('loadingLocation.ok'), onPress: goBack }]
        );
        return;
      }

      if (!locationResult.coords) {
        Alert.alert(t('location.title'), t('loadingLocation.errorCoordinates'), [{ text: t('loadingLocation.ok'), onPress: goBack }]);
        return;
      }

      const apiResult = await fetchLocationAPI(
        locationResult.coords.latitude,
        locationResult.coords.longitude
      );

      if (!apiResult.success || !apiResult.data) {
        Alert.alert(
          t('location.title'),
          t('loadingLocation.errorCountry'),
          [{ text: t('loadingLocation.ok'), onPress: goBack }]
        );
        return;
      }

      const countryName = apiResult.data.country || '';
      const matched = findCountryByName(countryName);
      const locationToSet = matched
        ? { ...matched, lat: locationResult.coords.latitude, lon: locationResult.coords.longitude }
        : {
            name: countryName,
            code: apiResult.data.countryCode || '',
            lat: locationResult.coords.latitude,
            lon: locationResult.coords.longitude,
          };
      setLocation(locationToSet);
      goBack();
    } catch (error) {
      console.error('Detect location error:', error);
      Alert.alert(
        t('location.title'),
        t('loadingLocation.errorGeneric'),
        [{ text: t('loadingLocation.ok'), onPress: goBack }]
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MapPin size={44} color={COLORS.primary} />
        </View>
        <ActivityIndicator size="large" color={theme.textSecondary} style={styles.loader} />
        <Text style={[styles.title, { color: theme.text }]}>{t('loadingLocation.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('loadingLocation.subtitle')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  loader: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
