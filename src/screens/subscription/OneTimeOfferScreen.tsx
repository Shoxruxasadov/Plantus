import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackParamList } from '../../types';
import { FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { getOfferings, purchasePackage, checkPremiumStatus } from '../../services/revenueCat';
import { useAppStore } from '../../store/appStore';
import type { PurchasesPackage } from 'react-native-purchases';

/** RevenueCat package identifier for annual discount (Yearly Discount) */
const RC_ANNUAL_DISCOUNT_ID = 'rc_annual_discount';

type RouteProps = RouteProp<RootStackParamList, 'OneTimeOffer'>;

export default function OneTimeOfferScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const setIsPro = useAppStore((s) => s.setIsPro);
  const fromFirstTime = route.params?.fromFirstTime ?? false;
  const [claiming, setClaiming] = useState(false);
  const [priceString, setPriceString] = useState<string>('$19.99');
  const [perWeekString, setPerWeekString] = useState<string>('$0.38/week');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getOfferings();
      if (cancelled) return;
      const packages: PurchasesPackage[] = [];
      if (result.data?.current?.availablePackages?.length) {
        packages.push(...result.data.current.availablePackages);
      }
      if (result.data?.all) {
        Object.values(result.data.all).forEach((offering: any) => {
          if (offering?.availablePackages) packages.push(...offering.availablePackages);
        });
      }
      const pkg = findAnnualDiscountPackage(packages);
      if (pkg?.product) {
        const ps = pkg.product.priceString;
        if (ps) setPriceString(ps);
        if (typeof pkg.product.price === 'number') {
          const perWeek = (pkg.product.price / 52).toFixed(2);
          const symbol = (ps && ps.match(/^[^\d.,]+/)?.[0]?.trim()) || '$';
          setPerWeekString(`${symbol}${perWeek}/week`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const performClose = () => {
    if (fromFirstTime) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      navigation.dispatch(StackActions.pop(2));
    }
  };

  const handleClose = () => {
    Alert.alert(
      t('oneTime.opportunity'),
      t('oneTime.opportunityMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('oneTime.dontNeed'), onPress: performClose },
      ]
    );
  };

  const findAnnualDiscountPackage = (packages: PurchasesPackage[]): PurchasesPackage | null => {
    return (
      packages.find(
        (p) =>
          p.identifier === RC_ANNUAL_DISCOUNT_ID ||
          p.identifier === `$${RC_ANNUAL_DISCOUNT_ID}` ||
          (p.identifier?.includes && p.identifier.includes('annual_discount'))
      ) ??
      packages.find(
        (p) => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual' || p.identifier?.includes?.('annual')
      ) ??
      null
    );
  };

  const handleClaimOffer = async () => {
    setClaiming(true);
    try {
      const result = await getOfferings();
      if (!result.success || !result.data?.current?.availablePackages?.length) {
        const allPkgs: PurchasesPackage[] = [];
        if (result.data?.all) {
          Object.values(result.data.all).forEach((offering: any) => {
            if (offering?.availablePackages) {
              allPkgs.push(...offering.availablePackages);
            }
          });
        }
        if (allPkgs.length === 0) {
          Alert.alert(t('common.error'), t('pro.unavailable'));
          setClaiming(false);
          return;
        }
        const pkg = findAnnualDiscountPackage(allPkgs);
        if (!pkg) {
          Alert.alert(t('common.error'), t('pro.unavailable'));
          setClaiming(false);
          return;
        }
        const purchaseResult = await purchasePackage(pkg);
        if (purchaseResult.success) {
          const statusResult = await checkPremiumStatus();
          if (statusResult.isPro) setIsPro(true);
          if (fromFirstTime) {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            setTimeout(() => navigation.navigate('Pro', { isFirstStep: false }), 150);
          } else {
            navigation.goBack();
          }
        } else if (!purchaseResult.cancelled) {
          const msg =
            purchaseResult.error instanceof Error
              ? purchaseResult.error.message
              : String(purchaseResult.error ?? t('pro.purchaseFailed'));
          Alert.alert(t('pro.purchaseFailed'), msg);
        }
        setClaiming(false);
        return;
      }

      const packages = result.data.current.availablePackages;
      const pkg = findAnnualDiscountPackage(packages);
      if (!pkg) {
        Alert.alert(t('common.error'), t('pro.unavailable'));
        setClaiming(false);
        return;
      }

      const purchaseResult = await purchasePackage(pkg);
      if (purchaseResult.success) {
        const statusResult = await checkPremiumStatus();
        if (statusResult.isPro) setIsPro(true);
        if (fromFirstTime) {
          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          setTimeout(() => navigation.navigate('Pro', { isFirstStep: false }), 150);
        } else {
          navigation.goBack();
        }
      } else if (!purchaseResult.cancelled) {
        const msg =
          purchaseResult.error instanceof Error
            ? purchaseResult.error.message
            : String(purchaseResult.error ?? t('pro.purchaseFailed'));
        Alert.alert(t('pro.purchaseFailed'), msg);
      }
    } catch (e) {
      console.error('Claim offer error:', e);
      Alert.alert(t('common.error'), t('pro.unavailable'));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 24 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
          <X size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{t('oneTime.title')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('oneTime.subtitle')}</Text>

        <View style={styles.couponWrap}>
          <Image
            source={require('../../../assets/Ticket.png')}
            style={styles.ticketImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.expireTitle, { color: theme.text }]}>{t('oneTime.expireSoon')}</Text>
        <Text style={[styles.expireDesc, { color: theme.textSecondary }]}>
          {t('oneTime.expireDesc')}
        </Text>

        <View style={styles.planCardWrap}>
          <LinearGradient
            colors={['#1FC85C', '#00AFFE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.planCardBanner}
          >
            <Text style={styles.badgeText}>{t('oneTime.lowestPrice')}</Text>
            <View style={[styles.planCardInner, { backgroundColor: theme.background }]}>
              <View style={styles.planLeft}>
                <Text style={[styles.planName, { color: theme.text }]}>{t('oneTime.annualPlan')}</Text>
                <Text style={[styles.planDesc, { color: theme.textSecondary }]}>{t('oneTime.monthsIncluded')}</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPrice, { color: theme.text }]}>{priceString}</Text>
                <Text style={[styles.planPerMonth, { color: theme.textSecondary }]}>{perWeekString}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <TouchableOpacity
          style={[styles.claimBtn, { backgroundColor: theme.text }]}
          onPress={handleClaimOffer}
          activeOpacity={0.85}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Text style={[styles.claimBtnText, { color: theme.background }]}>{t('oneTime.claimOffer')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/privacy-policy/')}>
            <Text style={[styles.footerLink, { color: theme.textTertiary }]}>{t('pro.privacyPolicy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/terms-of-use/')}>
            <Text style={[styles.footerLink, { color: theme.textTertiary }]}>{t('pro.termsOfUse')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  couponWrap: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  ticketImage: {
    width: '100%',
    height: 180,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  expireTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  expireDesc: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  planCardWrap: {
    marginBottom: SPACING.xl,
    borderRadius: 16,
    overflow: 'hidden',
  },
  planCardBanner: {
    padding: 2,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  planCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: 14,
  },
  planLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
  },
  planDesc: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  planRight: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  planPerMonth: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  claimBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    height: 60,
    display: 'flex',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  claimBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  footerLink: {
    fontSize: FONT_SIZES.sm,
  },
});
