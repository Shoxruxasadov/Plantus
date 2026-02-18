import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../../types';
import {
  X,
  Plant,
  Calendar,
  Bell,
  Brain,
  BookOpen,
  Check,
  Crown,
} from 'phosphor-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { useTheme } from '../../hooks';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  checkPremiumStatus,
} from '../../services/revenueCat';

const { width: SW } = Dimensions.get('window');
const HERO_HEIGHT = 150;

const FEATURES = [
  { icon: Plant, label: 'Unlimited Plant Identification' },
  { icon: Calendar, label: 'Instant Disease Diagnosis' },
  { icon: Bell, label: 'Personalized Care Plans' },
  { icon: Brain, label: 'Smart Watering Reminders' },
  { icon: BookOpen, label: '50,000+ Plant Encyclopedia' },
];

const PRO_CLOSE_COUNT_KEY = '@plantus_pro_close_count';
const ONE_TIME_OFFER_SHOWN_KEY = '@plantus_onetime_offer_shown';

export default function ProScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Pro'>>();
  const insets = useSafeAreaInsets();
  const { isPro, setIsPro } = useAppStore();
  const { theme, isDark } = useTheme();
  const isFirstStep = route.params?.isFirstStep ?? false;
  const fromScanner = route.params?.fromScanner ?? false;

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState<'weekly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [closeUnlocked, setCloseUnlocked] = useState(false);
  const closeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    const anim = Animated.timing(closeProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setCloseUnlocked(true);
    });
    return () => anim.stop();
  }, [closeProgress]);

  const loadOfferings = async () => {
    try {
      const result = await getOfferings();
      if (result.success && result.data) {
        let allPkgs: PurchasesPackage[] = [];
        const { current, all } = result.data;
        if (current?.availablePackages?.length) {
          allPkgs = [...current.availablePackages];
        }
        if (all) {
          Object.values(all).forEach((offering: any) => {
            if (offering?.availablePackages) {
              offering.availablePackages.forEach((pkg: PurchasesPackage) => {
                if (!allPkgs.find((p) => p.identifier === pkg.identifier)) allPkgs.push(pkg);
              });
            }
          });
        }
        allPkgs.sort((a, b) => {
          const order: Record<string, number> = { ANNUAL: 0, YEARLY: 0, WEEKLY: 1, MONTHLY: 2 };
          return (order[a.packageType] ?? 3) - (order[b.packageType] ?? 3);
        });
        setPackages(allPkgs);
      }
    } catch (e) {
      console.error('Load offerings error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Select a plan', 'Please choose Weekly or Yearly plan, then tap Start.');
      return;
    }
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPackage);
      if (result.success) {
        const statusResult = await checkPremiumStatus();
        setIsPro(statusResult.isPro);
        Alert.alert('Success', 'Thank you for upgrading to Pro!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (result.cancelled) {
        // User closed the sheet – no alert
      } else {
        const msg = result.error instanceof Error ? result.error.message : (result.error ? String(result.error) : 'Please check your connection and try again.');
        Alert.alert('Purchase failed', msg);
      }
    } catch (e) {
      console.error('Purchase error:', e);
      Alert.alert(
        'Error',
        'Subscription is unavailable. Please check your connection or try again later.'
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      const statusResult = await checkPremiumStatus();
      setIsPro(statusResult.isPro);
      if (statusResult.isPro) {
        Alert.alert('Success', 'Your purchases have been restored!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Info', 'No previous purchases found');
      }
    } catch (e) {
      console.error('Restore error:', e);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = async () => {
    if (isPro) {
      navigation.goBack();
      return;
    }
    const shouldOfferOneTime = isFirstStep || fromScanner;
    if (shouldOfferOneTime) {
      try {
        const alreadyShown = await AsyncStorage.getItem(ONE_TIME_OFFER_SHOWN_KEY);
        if (alreadyShown === 'true') {
          if (isFirstStep) {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          } else {
            navigation.goBack();
          }
          return;
        }
        await AsyncStorage.setItem(ONE_TIME_OFFER_SHOWN_KEY, 'true');
        navigation.navigate('OneTimeOffer', { fromFirstTime: isFirstStep });
      } catch {
        navigation.goBack();
      }
      return;
    }
    navigation.goBack();
  };

  if (isPro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <View style={[styles.closeRowAbs, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={24} color={theme.text} weight="bold" />
          </TouchableOpacity>
        </View>
        <View style={[styles.alreadyProWrap, { backgroundColor: theme.background }]}>
          <View style={styles.proBadgeCircle}>
            <Plant size={48} color="#fff" />
          </View>
          <Text style={[styles.alreadyProTitle, { color: theme.text }]}>You're a Pro!</Text>
          <Text style={[styles.alreadyProDesc, { color: theme.textSecondary }]}>
            You already have access to all premium features. Thank you for your support!
          </Text>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={handleClose}>
            <Text style={[styles.doneBtnText, { color: theme.textLight }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Production: subscription_weakly (Weekly), subscription_yearly (Yearly) — RevenueCat $rc_weekly, $rc_annual
  const weeklyPkg = packages.find(
    (p) =>
      p.packageType === 'WEEKLY' ||
      p.identifier === '$rc_weekly' ||
      (p as any).identifier?.includes('weekly') ||
      (p as any).identifier?.includes('weakly')
  );
  const yearlyPkg = packages.find(
    (p) =>
      p.packageType === 'ANNUAL' ||
      p.identifier === '$rc_annual' ||
      p.identifier === 'yearly' ||
      (p as any).identifier?.includes('yearly')
  );

  const selectedPackage = selectedPlanKey === 'yearly' ? (yearlyPkg ?? null) : (weeklyPkg ?? null);

  // Prices from RevenueCat; fallback for display before load / production copy
  const weeklyPrice = weeklyPkg?.product?.priceString ?? '$4.99';
  const yearlyPrice = yearlyPkg?.product?.priceString ?? '$29.99';
  const yearlyPerWeek =
    yearlyPkg?.product?.price != null
      ? (yearlyPkg.product.price / 52).toFixed(2)
      : '0.58';

  const isYearlySelected = selectedPlanKey === 'yearly';
  const isWeeklySelected = selectedPlanKey === 'weekly';

  const CIRCLE_SIZE = 30;
  const CIRCLE_R = 13;
  const circumference = 2 * Math.PI * CIRCLE_R;
  const strokeOffset = closeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.closeRowAbs, { top: insets.top + 8 }]}>
        {!closeUnlocked ? (
          <View style={styles.closeBtn}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={styles.closeProgressSvg}>
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={CIRCLE_R}
                stroke={theme.borderLight}
                strokeWidth={3}
                fill="none"
              />
              <AnimatedCircle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={CIRCLE_R}
                stroke={theme.primary}
                strokeWidth={3}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
              />
            </Svg>
          </View>
        ) : (
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={24} color={theme.text} weight="bold" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Hero: plant photo under status bar (transparent app bar) + Trust image */}
        <View style={[styles.heroWrap, { height: HERO_HEIGHT + insets.top }]}>
          <Image
            source={require('../../../assets/unsplash_LOXYdaej5eo.png')}
            style={[styles.heroBgImage, styles.heroBgImageLayer, { opacity: isDark ? 0.3 : 1 }]}
            resizeMode="cover"
          />
          <View style={styles.heroContent}>
            <LinearGradient
              colors={isDark ? ['rgba(29, 29, 29,0)', 'rgba(29, 29, 29,0.5)', theme.background] : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', '#FFFFFF']}
              locations={[0, 0.5, 1]}
              style={styles.heroGradient}
              pointerEvents="none"
            />
            <View style={[styles.heroOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.88)' }]} />
            <View style={[styles.trustImageWrap, { paddingTop: insets.top }]}>
              <Image
                source={isDark ? require('../../../assets/Trust_darkmode.png') : require('../../../assets/Trust.png')}
                style={styles.trustImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        <View style={[styles.mainBlock, { backgroundColor: theme.background }]}>
          <Text style={[styles.mainTitle, { color: theme.text }]} numberOfLines={2}>Unlock Full Access</Text>

          <View style={styles.featuresWrap}>
            {FEATURES.map(({ icon: Icon, label }) => (
              <View key={label} style={styles.featureRow}>
                <View style={styles.featureIconWrap}>
                  <Icon size={24} color={theme.text} />
                </View>
                <Text style={[styles.featureLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 24 }} />
          ) : (
          <View style={styles.plansWrap}>
            <View style={[styles.yearlyPlanWrap, { backgroundColor: isYearlySelected ? theme.primary : theme.accentLight }]}>
              <View style={styles.planBanner}>
                <Text style={styles.planBannerText} numberOfLines={1}>
                2,847 plant lovers joined today
                </Text>
                <View style={[styles.planBannerSaveBadge, { backgroundColor: isYearlySelected ? theme.primaryDark : theme.accentDark }]}>
                  <Text style={styles.planBannerSaveText}>SAVE 88%</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.planCard,
                  { backgroundColor: theme.card, borderColor: theme.accentLight },
                  isYearlySelected && { ...styles.planCardSelected, backgroundColor: isDark ? theme.backgroundSecondary : theme.accent, borderColor: theme.primary },
                ]}
                onPress={() => setSelectedPlanKey('yearly')}
                activeOpacity={0.85}
              >
                <View style={[styles.radioOuter, { borderColor: theme.borderLight }, isYearlySelected && styles.radioSelected]}>
                  {isYearlySelected && <Check size={14} color="#fff" weight="bold" />}
                </View>
                <View style={styles.planLeft}>
                  <Text style={[styles.planName, { color: theme.text }]}>Yearly</Text>
                  <Text style={[styles.planDesc, { color: theme.textSecondary }]}>
                    USD {yearlyPrice}/year
                  </Text>
                </View>
                <View style={styles.planRight}>
                  <Text style={[styles.planPriceRight, { color: theme.text }]}>${yearlyPerWeek}/week</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.planCard,
                { backgroundColor: theme.card, borderColor: theme.borderLight },
                isWeeklySelected && { ...styles.planCardSelected, backgroundColor: isDark ? theme.backgroundSecondary : theme.accent, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedPlanKey('weekly')}
              activeOpacity={0.85}
            >
              <View style={[styles.radioOuter, { borderColor: theme.borderLight }, isWeeklySelected && styles.radioSelected]}>
                {isWeeklySelected && <Check size={14} color="#fff" weight="bold" />}
              </View>
              <View style={styles.planLeft}>
                <Text style={[styles.planName, { color: theme.text }]}>Weekly</Text>
                <Text style={[styles.planDesc, { color: theme.textSecondary }]}>
                  3-day trial
                </Text>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPriceRight, { color: theme.text }]}>{weeklyPrice}/week</Text>
              </View>
            </TouchableOpacity>
          </View>
          )}
        </View>

        {/* CTA — pill shape, gradient (theme green) */}
        <TouchableOpacity
          style={[styles.ctaBtnWrap, purchasing && { opacity: 0.7 }]}
          onPress={handlePurchase}
          disabled={purchasing || !selectedPackage}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[theme.gradientStart ?? theme.primary, theme.gradientEnd ?? theme.primaryLight ?? theme.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaBtn}
          >
            {purchasing ? (
              <ActivityIndicator color={theme.textLight} />
            ) : (
              <Text style={[styles.ctaBtnText, { color: theme.textLight }]}>
                {selectedPlanKey === 'weekly' ? 'Start 3-day trial' : 'Subscription'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/privacy-policy/')}>
            <Text style={[styles.footerLinkText, { color: theme.textSecondary }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRestore} disabled={restoring}>
            {restoring ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <Text style={[styles.footerLinkText, { color: theme.textSecondary }]}>Restore</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/terms-of-use/')}>
            <Text style={[styles.footerLinkText, { color: theme.textSecondary }]}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeRowAbs: {
    position: 'absolute',
    left: SPACING.lg,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeProgressSvg: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroWrap: {
    height: HERO_HEIGHT,
    width: SW,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBgImage: {
    // flex: 1,
    width: '100%',
    maxHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBgImageLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    zIndex: 1,
  },
  trustImageWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  trustImage: {
    width: SW * 0.7,
    maxWidth: 280,
    height: 90,
    zIndex: 1,
  },
  mainBlock: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: SPACING.xl,
    backgroundColor: '#fff',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  featuresWrap: {
    gap: SPACING.sm,
    flexShrink: 0,
    marginBottom: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  plansWrap: {
    gap: SPACING.md,
    flexShrink: 0,
    marginTop: SPACING.lg,
  },
  yearlyPlanWrap: {
    gap: 0,
    borderRadius: 16,
  },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingTop: 6,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  planBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textLight,
  },
  planBannerSaveBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.lg,
  },
  planBannerSaveText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    // borderWidth: 1,
    // borderColor: COLORS.borderLight,
    position: 'relative',
    minHeight: 76,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  planCardSelected: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  bestBadge: {
    position: 'absolute',
    top: -10,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    gap: 6,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  bestBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  saveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  planLeft: {
    flex: 1,
    marginLeft: SPACING.lg,
    justifyContent: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  planDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  planRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  planPriceRight: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  ctaBtnWrap: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    flexShrink: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaBtn: {
    minHeight: 54,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    flexShrink: 0,
  },
  footerLinkText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  alreadyProWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  proBadgeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  alreadyProTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  alreadyProDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: RADIUS.round,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
