import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootStackParamList } from '../../types';
import { FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';

type RouteProps = RouteProp<RootStackParamList, 'OneTimeOffer'>;

export default function OneTimeOfferScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const fromFirstTime = route.params?.fromFirstTime ?? false;

  const performClose = () => {
    if (fromFirstTime) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      navigation.dispatch(StackActions.pop(2));
    }
  };

  const handleClose = () => {
    Alert.alert(
      'One-time opportunity',
      "This opportunity won't be available again. Take advantage of it.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: "I don't need it", onPress: performClose },
      ]
    );
  };

  const handleClaimOffer = () => {
    if (fromFirstTime) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      setTimeout(() => navigation.navigate('Pro', { isFirstStep: false }), 150);
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: 24, backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
          <X size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>ONE TIME OFFER</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>You will never see this again</Text>

        <View style={styles.couponWrap}>
          <Image
            source={require('../../../assets/Ticket.png')}
            style={styles.ticketImage}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.expireTitle, { color: theme.text }]}>This offer will expire soon</Text>
        <Text style={[styles.expireDesc, { color: theme.textSecondary }]}>
          Once you close your one-time-offer, it's gone! Save 50% with an yearly plan.
        </Text>

        <View style={styles.planCardWrap}>
          <LinearGradient
            colors={['#1FC85C', '#00AFFE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.planCardBanner}
          >
            <Text style={styles.badgeText}>LOWEST PRICE EVER</Text>
            <View style={[styles.planCardInner, { backgroundColor: theme.background }]}>
              <View style={styles.planLeft}>
                <Text style={[styles.planName, { color: theme.text }]}>Annual Plan</Text>
                <Text style={[styles.planDesc, { color: theme.textSecondary }]}>12 months included</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.planPrice, { color: theme.text }]}>$19.99</Text>
                <Text style={[styles.planPerMonth, { color: theme.textSecondary }]}>$1.32/month</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <TouchableOpacity style={[styles.claimBtn, { backgroundColor: theme.text }]} onPress={handleClaimOffer} activeOpacity={0.85}>
          <Text style={[styles.claimBtnText, { color: theme.background }]}>Claim Offer</Text>
        </TouchableOpacity>

        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/privacy-policy/')}>
            <Text style={[styles.footerLink, { color: theme.textTertiary }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://plantus.app/terms-of-use/')}>
            <Text style={[styles.footerLink, { color: theme.textTertiary }]}>Terms Of Use</Text>
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
