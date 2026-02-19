import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';

import { COLORS, DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTranslation } from '../../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GOOD_SIZE = Math.min(SCREEN_WIDTH - SPACING.xl * 2, 240);
const BAD_SIZE = (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.lg * 2) / 3;

const goodImage = require('../../../assets/images/plant_tip1.png');
const badImages = [
  require('../../../assets/images/plant_tip2.png'),
  require('../../../assets/images/plant_tip3.png'),
  require('../../../assets/images/plant_tip4.png'),
];
const BAD_LABEL_KEYS = ['infoScanner.badMulti', 'infoScanner.badClose', 'infoScanner.badFar'] as const;

export default function InfoScannerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => {};
    }, [])
  );

  return (
    <View style={[styles.container, {paddingTop: insets.top, backgroundColor: DARK_COLORS.background }]}>
      <View
        style={styles.scrollView}
      >
        <Text style={styles.mainTitle}>{t('infoScanner.title')}</Text>
        <Text style={styles.subtitle}>
          {t('infoScanner.subtitle')}
        </Text>

        <View style={styles.goodWrap}>
          <Image source={goodImage} style={styles.goodImage} resizeMode="contain" />
        </View>

        <View style={styles.badRow}>
          {badImages.map((img, index) => (
            <View key={index} style={styles.badItem}>
              <Image source={img} style={styles.badImage} resizeMode="contain" />
              <Text style={styles.badLabel}>{t(BAD_LABEL_KEYS[index])}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.doneButtonText}>{t('infoScanner.done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: DARK_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
    lineHeight: 22,
  },
  goodWrap: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  goodImage: {
    width: GOOD_SIZE,
    height: GOOD_SIZE,
  },
  badRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xxl,
  },
  badItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  badImage: {
    width: BAD_SIZE,
    height: BAD_SIZE,
    marginBottom: SPACING.sm,
  },
  badLabel: {
    fontSize: FONT_SIZES.sm,
    color: DARK_COLORS.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  doneButton: {
    backgroundColor: DARK_COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
