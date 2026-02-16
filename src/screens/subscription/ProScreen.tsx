import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/theme';

// import { useState, useEffect } from 'react';
// import { Text, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Linking } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import { X, Leaf, Check, CaretLeft, CaretRight, Crown } from 'phosphor-react-native';
// import { PurchasesPackage } from 'react-native-purchases';
// import { COLORS } from '../../utils/theme';
// import { useTheme } from '../../hooks';
// import { useAppStore } from '../../store/appStore';
// import { getOfferings, purchasePackage, restorePurchases, checkPremiumStatus } from '../../services/revenueCat';
// import BeforeAfterSlider from '../../components/BeforeAfterSlider';
// const { width: SW } = Dimensions.get('window');
// const BEFORE_IMG = require('../../../assets/images/before_plantus.png');
// const AFTER_IMG = require('../../../assets/images/after_plantus.png');

export default function ProScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]} />
  );

  // --- commented out (Pro page logic) ---
  // const navigation = useNavigation();
  // const { theme } = useTheme();
  // const { setIsPro, isPro } = useAppStore();
  // const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  // const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  // const [loading, setLoading] = useState(true);
  // const [purchasing, setPurchasing] = useState(false);
  // const [restoring, setRestoring] = useState(false);
  // useEffect(() => { loadOfferings(); }, []);

  /*
  const loadOfferings = async () => {
    try {
      const result = await getOfferings();
      if (result.success && result.data) {
        let allPkgs: PurchasesPackage[] = [];
        const offerings = result.data;
        if (offerings.current?.availablePackages?.length) {
          allPkgs = [...offerings.current.availablePackages];
        }
        if (offerings.all) {
          Object.values(offerings.all).forEach((offering: any) => {
            if (offering?.availablePackages) {
              offering.availablePackages.forEach((pkg: PurchasesPackage) => {
                if (!allPkgs.find((p) => p.identifier === pkg.identifier)) allPkgs.push(pkg);
              });
            }
          });
        }
        allPkgs.sort((a, b) => {
          const order: Record<string, number> = { ANNUAL: 0, MONTHLY: 1 };
          return (order[a.packageType] ?? 2) - (order[b.packageType] ?? 2);
        });
        setPackages(allPkgs);
        const annual = allPkgs.find((p) => p.packageType === 'ANNUAL');
        setSelectedPackage(annual || allPkgs[0] || null);
      }
    } catch (error) {
      console.error('Load offerings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) { Alert.alert('Error', 'Please select a plan'); return; }
    setPurchasing(true);
    try {
      const result = await purchasePackage(selectedPackage);
      if (result.success) {
        const statusResult = await checkPremiumStatus();
        setIsPro(statusResult.isPro);
        Alert.alert('Success', 'Thank you for upgrading to Pro!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (!result.cancelled) {
        Alert.alert('Error', 'Purchase failed. Please try again.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'An error occurred during purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        const statusResult = await checkPremiumStatus();
        setIsPro(statusResult.isPro);
        if (statusResult.isPro) {
          Alert.alert('Success', 'Your purchases have been restored!', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert('Info', 'No previous purchases found');
        }
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => navigation.goBack();
  const isMonthly = selectedPackage?.packageType === 'MONTHLY';

  if (isPro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.closeRowAbs, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={28} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.alreadyProWrap}>
          <View style={styles.proBadgeCircle}>
            <Leaf size={48} color="#fff" />
          </View>
          <Text style={styles.alreadyProTitle}>You're a Pro!</Text>
          <Text style={styles.alreadyProDesc}>
            You already have access to all premium features. Thank you for your support!
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const SLIDER_PAD = 12;
  const sliderW = SW - SLIDER_PAD * 2;
  const sliderH = sliderW * 0.75;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <View style={[styles.closeRowAbs, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <X size={28} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Unlock Full Access</Text>
      <View style={styles.sliderWrap}>
        <BeforeAfterSlider
          beforeImage={BEFORE_IMG}
          afterImage={AFTER_IMG}
          width={sliderW}
          height={sliderH}
          dividerColor="#fff"
          dividerWidth={3}
          handleWidth={48}
          handleHeight={48}
          handleBorderRadius={24}
          handleColor="#fff"
          initialPosition={0.5}
          enableLoop
          loopDuration={2500}
          edgeDelay={1000}
          renderHandle={() => (
            <View style={styles.handleInner}>
              <CaretLeft size={14} color="#333" weight="bold" />
              <CaretRight size={14} color="#333" weight="bold" />
            </View>
          )}
        />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.textSecondary} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.plansWrap}>
          {packages.map((pkg) => {
            const selected = selectedPackage?.identifier === pkg.identifier;
            const annual = pkg.packageType === 'ANNUAL';
            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[styles.planCard, selected && styles.planCardSelected]}
                onPress={() => setSelectedPackage(pkg)}
                activeOpacity={0.8}
              >
                {annual && (
                  <View style={styles.bestBadge}>
                    <Crown size={12} color="#B8860B" weight="fill" />
                    <Text style={styles.bestBadgeText}>Best value</Text>
                  </View>
                )}
                <View style={styles.planLeft}>
                  <Text style={styles.planName}>
                    {annual ? 'YEARLY PLAN' : '3 DAYS FREE TRIAL'}
                  </Text>
                  <Text style={styles.planDesc}>
                    {annual
                      ? `${pkg.product.priceString}/year (US$${(pkg.product.price / 52).toFixed(2)}/week)`
                      : `3 days free trial, then ${pkg.product.priceString}/month`}
                  </Text>
                </View>
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <Check size={16} color="#fff" weight="bold" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <View style={{ flex: 1 }} />
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.paymentInfo}>
          <Check size={20} color={COLORS.text} weight="bold" />
          <Text style={styles.paymentText}>
            {isMonthly ? 'No Payment Due Now' : `You'll be charged today ${selectedPackage?.product.priceString ?? ''}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.ctaBtn, purchasing && { opacity: 0.7 }]}
          onPress={handlePurchase}
          disabled={purchasing || !selectedPackage}
          activeOpacity={0.85}
        >
          {purchasing ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.ctaBtnText}>{isMonthly ? 'Try for $0.00' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.bottomLinks}>
          <TouchableOpacity onPress={handleRestore}>
            {restoring ? <ActivityIndicator size="small" color={COLORS.textSecondary} /> : <Text style={styles.linkText}>Restore</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/privacy-policy/')}>
            <Text style={styles.linkText}>Privacy policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.linkText}>Restore</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
  */
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  closeRowAbs: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,245,246,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sliderWrap: {
    marginBottom: 16,
    paddingVertical: 12,
  },
  handleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plansWrap: {
    paddingHorizontal: 20,
    gap: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E7E8EA',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: COLORS.primary,
  },
  bestBadge: {
    position: 'absolute',
    top: -12,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8DC',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  bestBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B8860B',
  },
  planLeft: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  planDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D3D5D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioOuterSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  ctaBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 17,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#fff',
  },
  bottomLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkText: {
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
    fontWeight: 'bold',
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
    borderRadius: 999,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
