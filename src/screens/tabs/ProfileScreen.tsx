import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Linking,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRight, PencilSimple, MapPin, Thermometer, Gear, ShieldCheck, FileText, Star, ChatCircle, SignOut, Sparkle, HeadphonesIcon } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { RootStackParamList } from '../../types';
import { COLORS, DARK_COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { signOut, uploadUserAvatar, removeUserAvatar } from '../../services/supabase';
import { logOutUser } from '../../services/revenueCat';
import { openAppStore, openEmail } from '../../utils/helpers';
import { presentCustomerCenter } from '../../utils/paywall';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItem {
  Icon: React.ComponentType<Record<string, unknown>>;
  title: string;
  value?: string;
  onPress: () => void;
  showArrow?: boolean;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const darkMode = useAppStore((s) => s.darkMode);
  const theme = darkMode ? DARK_COLORS : COLORS;
  const {
    isLoggedIn,
    userCollection,
    isPro,
    notifications,
    setNotifications,
    logout,
    temperature,
    setTemperature,
    updateUserCollection,
    location,
  } = useAppStore();

  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from your profile?',
      [
        { text: 'No, Cancel', style: 'cancel' },
        {
          text: 'Yes, Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
              await logOutUser();
              await logout();
              navigation.navigate('Onboarding');
            } catch (error) {
              console.error('Logout error:', error);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handlePro = () => {
    navigation.navigate('Pro' as never);
  };

  const handleManageSubscription = async () => {
    await presentCustomerCenter();
  };

  const showAvatarActions = () => {
    if (!isLoggedIn || !userCollection?.id) return;
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Change photo', onPress: handleChangePhoto },
      { text: 'Cancel', style: 'cancel' },
    ];
    if (userCollection.image) {
      options.splice(1, 0, { text: 'Remove photo', onPress: handleRemovePhoto, style: 'destructive' });
    }
    Alert.alert('Profile photo', undefined, options);
  };

  const handleChangePhoto = async () => {
    if (!userCollection?.id || uploadingAvatar) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Photo library access is required to change your avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets[0]?.base64) return;
      setUploadingAvatar(true);
      const mime = result.assets[0].mimeType ?? 'image/jpeg';
      const { data: url, error } = await uploadUserAvatar(userCollection.id, result.assets[0].base64, mime);
      if (error) {
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
        return;
      }
      if (url) await updateUserCollection({ image: url });
    } catch (e) {
      console.error('Avatar upload error:', e);
      Alert.alert('Error', 'Failed to upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!userCollection?.id || uploadingAvatar) return;
    try {
      setUploadingAvatar(true);
      const { error } = await removeUserAvatar(userCollection.id);
      if (error) {
        Alert.alert('Error', 'Failed to remove photo.');
        return;
      }
      await updateUserCollection({ image: null });
    } catch (e) {
      console.error('Avatar remove error:', e);
      Alert.alert('Error', 'Failed to remove photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const generalSettings: SettingItem[] = [
    {
      Icon: MapPin,
      title: 'Location',
      value: location?.code ?? '—',
      onPress: () => navigation.navigate('Location'),
      showArrow: true,
    },
    {
      Icon: Thermometer,
      title: 'Temperature Unit',
      value: temperature === 'metric' ? '°C' : '°F',
      onPress: () => {
        Alert.alert('Temperature Unit', 'Choose your preference', [
          { text: 'Celsius (°C)', onPress: () => setTemperature('metric') },
          { text: 'Fahrenheit (°F)', onPress: () => setTemperature('imperial') },
        ]);
      },
      showArrow: true,
    },   
    {
      Icon: Gear,
      title: 'App Settings',
      onPress: () => navigation.navigate('AppSettings'),
      showArrow: true,
    },
  ];

  const otherSettings: SettingItem[] = [
    {
      Icon: ShieldCheck,
      title: 'Privacy policy',
      onPress: () => Linking.openURL('https://plantus.app/privacy-policy/'),
      showArrow: true,
    },
    {
      Icon: FileText,
      title: 'Terms of Use',
      onPress: () => Linking.openURL('https://plantus.app/terms-of-use/'),
      showArrow: true,
    },
    {
      Icon: ChatCircle,
      title: 'Send Feedback',
      onPress: () => openEmail('support@plantus.app', 'Feedback'),
      showArrow: true,
    },
    {
      Icon: HeadphonesIcon,
      title: 'Contact Support',
      onPress: () => openEmail('support@plantus.app', 'Feedback'),
      showArrow: true,
    },
    {
      Icon: Star,
      title: 'Rate us',
      onPress: () => openAppStore(),
      showArrow: true,
    },
  
  ];

  const getItemBorderRadius = (index: number, total: number) => {
    if (total === 1) return { borderRadius: 8 };
    if (index === 0) return { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 };
    if (index === total - 1) return { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 };
    return { borderRadius: 8 };
  };

  const renderSettingItem = (item: SettingItem, index: number, total: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.settingItem,
        { backgroundColor: darkMode ? theme.card : '#ffffff' },
        index < total - 1 && styles.settingItemGap,
        getItemBorderRadius(index, total),
      ]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon]}>
        <item.Icon size={20} color={theme.textSecondary} weight='fill' />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{item.title}</Text>
      </View>
      {item.value && (
        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>{item.value}</Text>
      )}
      {item.showArrow && (
        <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
        {isLoggedIn && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('Personal')}
          >
            <PencilSimple size={22} color={theme.textSecondary} weight='bold' />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.backgroundSecondary }]}
        contentContainerStyle={[
          styles.scrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: darkMode ? theme.card : '#ffffff' }]}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={isLoggedIn ? showAvatarActions : undefined}
            disabled={uploadingAvatar}
            activeOpacity={isLoggedIn ? 0.7 : 1}
          >
            {uploadingAvatar ? (
              <View style={[styles.avatar, styles.avatarLoading]}>
                <ActivityIndicator size="small" color={COLORS.textLight} />
              </View>
            ) : userCollection?.image ? (
              <Image source={{ uri: userCollection.image }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {isLoggedIn ? userCollection.name?.charAt(0)?.toUpperCase() || 'U' : 'A'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {isLoggedIn ? userCollection.name || 'User' : 'Anonym User'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
              {isLoggedIn ? userCollection.email || 'No email' : 'Please login'}
            </Text>
          </View>
          {!isLoggedIn && (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Started')}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PRO Card */}
        {!isPro && (
          <TouchableOpacity
            style={styles.proCard}
            onPress={handlePro}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1FC85C', '#00AFFE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.proGradient}
            >
                 <ImageBackground
              source={require('../../../assets/images/Profile.PRO.png')}
              style={styles.proImageBg}
              imageStyle={styles.proImageStyle}
              >
              <View style={styles.proContent}>
                <Sparkle size={28} color={COLORS.textLight} weight="fill" style={styles.proStar} />
                <View>
                  <Text style={styles.proTitle}>Join a PRO</Text>
                  <Text style={styles.proSubtitle}>
                    Buy subscription and enjoy
                  </Text>
                </View>
              </View>

              </ImageBackground>
                          </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Manage subscription - for Pro users */}
        {isPro && (
          <TouchableOpacity
            style={[
              styles.proCard,
              styles.manageProCard,
              { backgroundColor: darkMode ? theme.card : '#ffffff' },
            ]}
            onPress={handleManageSubscription}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1FC85C', '#00AFFE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.proGradient, styles.manageProGradient]}
            >
              <View style={styles.proContent}>
                <Sparkle size={24} color={COLORS.textLight} weight="fill" style={styles.proStar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.proTitle}>Plantus Pro</Text>
                  <Text style={[styles.proSubtitle, { opacity: 0.9 }]}>
                    Manage your subscription
                  </Text>
                </View>
                <CaretRight size={20} color={COLORS.textLight} weight="bold"/>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>General</Text>
          <View style={styles.settingsGroup}>
            {generalSettings.map((item, index) =>
              renderSettingItem(item, index, generalSettings.length)
            )}
          </View>
        </View>

        {/* Other Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Other</Text>
          <View style={styles.settingsGroup}>
            {otherSettings.map((item, index) =>
              renderSettingItem(item, index, otherSettings.length)
            )}
          </View>
        </View>

        {/* Logout Button */}
        {isLoggedIn && (
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: darkMode ? theme.card : '#ffffff' }]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <SignOut size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={[styles.version, { color: theme.textTertiary }]}>Plantus - App Version v1.0.0</Text>
        <View style={{ height: 95 }}></View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  cardWhite: {
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editButton: {
    position: 'absolute',
    right: SPACING.lg,
    padding: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 24,
    marginBottom: SPACING.md,
  },
  avatarWrap: {
    alignSelf: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarLoading: {
    backgroundColor: COLORS.primary,
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
  },
  loginButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  proCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  proGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proImageBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
    minHeight: 80,
  },
  proImageStyle: {
    borderRadius: 24,
  },
  proContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  proStar: {
    marginRight: 12,
  },
  proTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textLight,
    marginBottom: SPACING.xs,
  },
  proSubtitle: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  manageProCard: {
    marginBottom: SPACING.lg,
  },
  manageProGradient: {
    padding: SPACING.xl,
    minHeight: 72,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    // textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsGroup: {},
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#ffffff',
  },
  settingItemGap: {
    marginBottom: 4,
  },
  settingIcon: {
    // width: 36,
    // height: 36,
    // borderRadius: 18,
    // backgroundColor: 'red',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: 50,
    marginBottom: SPACING.md,
  },
  logoutText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  version: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
