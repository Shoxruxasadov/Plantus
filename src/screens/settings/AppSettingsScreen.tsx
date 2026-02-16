import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, CheckCircle } from 'phosphor-react-native';

import { COLORS, DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { cancelAllNotifications } from '../../services/notifications';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
];

const getItemBorderRadius = (index: number, total: number) => {
  if (total === 1) return { borderRadius: 8 };
  if (index === 0) return { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 };
  if (index === total - 1) return { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 };
  return { borderRadius: 8 };
};

export default function AppSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    setNotifications,
    vibration,
    setVibration,
    darkMode,
    setDarkMode,
  } = useAppStore();

  const theme = darkMode ? DARK_COLORS : COLORS;

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  useEffect(() => {
    if (!languageModalVisible) return;
    overlayOpacity.setValue(0);
    sheetTranslateY.setValue(Dimensions.get('window').height);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [languageModalVisible]);

  const closeLanguageModal = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: Dimensions.get('window').height,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setLanguageModalVisible(false);
        callback?.();
      }
    });
  };

  const getSelectedLanguageName = () => {
    return languages.find((l) => l.code === selectedLanguage)?.name || 'English';
  };

  const handleSelectLanguage = (code: string) => {
    setSelectedLanguage(code);
    closeLanguageModal();
  };

  // iOS: native system Switch (no custom colors). Android: optional track/thumb for visibility.
  const switchProps = Platform.OS === 'ios'
    ? {}
    : {
        trackColor: { false: theme.borderLight, true: COLORS.primary },
        thumbColor: '#FFFFFF',
      };

  const handleNotificationsChange = (value: boolean) => {
    setNotifications(value);
    if (!value) cancelAllNotifications();
  };

  const settingsRows = [
    { type: 'switch' as const, label: 'Notifications', value: notifications, onValueChange: handleNotificationsChange },
    { type: 'switch' as const, label: 'Vibration', value: vibration, onValueChange: setVibration },
    { type: 'switch' as const, label: 'Dark mode', value: darkMode, onValueChange: setDarkMode },
    { type: 'link' as const, label: 'Language', onPress: () => setLanguageModalVisible(true), value: getSelectedLanguageName() },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>App Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Settings List */}
      <View style={styles.settingsList}>
        {settingsRows.map((item, index) => (
          item.type === 'switch' ? (
            <View
              key={item.label}
              style={[
                styles.settingRow,
                { backgroundColor: theme.card },
                index < settingsRows.length - 1 && styles.settingRowGap,
                getItemBorderRadius(index, settingsRows.length),
              ]}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>{item.label}</Text>
              <Switch
                value={item.value}
                onValueChange={item.onValueChange}
                {...switchProps}
              />
            </View>
          ) : (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.settingRow,
                { backgroundColor: theme.card },
                index < settingsRows.length - 1 && styles.settingRowGap,
                getItemBorderRadius(index, settingsRows.length),
              ]}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>{item.label}</Text>
              <View style={styles.settingValue}>
                <Text style={[styles.settingValueText, { color: theme.textSecondary }]}>{item.value}</Text>
                <CaretRight size={18} color={theme.textTertiary} />
              </View>
            </TouchableOpacity>
          )
        ))}
      </View>

      {/* Language Modal: orqa fon fade, sheet pastdan yuqoriga slide */}
      <Modal
        visible={languageModalVisible}
        animationType="none"
        transparent
        onRequestClose={() => closeLanguageModal()}
      >
        <View style={styles.modalOverlayTouch}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => closeLanguageModal()}
          >
            <Animated.View
              style={[styles.modalOverlay, { opacity: overlayOpacity }]}
              pointerEvents="none"
            />
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.languageSheet,
              { backgroundColor: theme.background, transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={[styles.languageHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.languageTitle, { color: theme.text }]}>Language</Text>

            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.languageRow, { borderBottomColor: theme.borderLight }]}
                  onPress={() => handleSelectLanguage(item.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.languageFlag}>{item.flag}</Text>
                  <Text style={[styles.languageName, { color: theme.text }]}>{item.name}</Text>
                  {selectedLanguage === item.code ? (
                    <CheckCircle size={24} color={COLORS.primary} weight="fill" />
                  ) : (
                    <View style={[styles.languageRadio, { borderColor: theme.borderLight }]} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.languageList}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  settingsList: {
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  settingRowGap: {
    marginBottom: 4,
  },
  settingLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  settingValueText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  // Language Modal
  modalOverlayTouch: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  languageSheet: {
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingTop: SPACING.md,
    maxHeight: '70%',
  },
  languageHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  languageTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  languageList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  languageFlag: {
    fontSize: 28,
    marginRight: SPACING.lg,
  },
  languageName: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.text,
  },
  languageRadio: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    marginRight: 2,
  },
});
