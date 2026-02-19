import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Linking,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowSquareOut, Check } from 'phosphor-react-native';

import { COLORS, DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore, SUPPORTED_LANGUAGES } from '../../store/appStore';
import { useTranslation } from '../../i18n';
import { cancelAllNotifications } from '../../services/notifications';
import type { Language } from '../../types';

const getItemBorderRadius = (index: number, total: number) => {
  if (total === 1) return { borderRadius: 8 };
  if (index === 0) return { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 };
  if (index === total - 1) return { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 };
  return { borderRadius: 8 };
};

export default function AppSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    notifications,
    setNotifications,
    vibration,
    setVibration,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
  } = useAppStore();

  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const theme = darkMode ? DARK_COLORS : COLORS;

  const handleLanguageIconPress = () => {
    if (Platform.OS === 'ios') {
      Linking.openSettings();
    } else {
      setLanguageSheetVisible(true);
    }
  };

  const handleSelectLanguage = (lang: Language) => {
    setLanguage(lang);
    setLanguageSheetVisible(false);
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
    { type: 'switch' as const, labelKey: 'appSettings.notifications', value: notifications, onValueChange: handleNotificationsChange },
    { type: 'switch' as const, labelKey: 'appSettings.vibration', value: vibration, onValueChange: setVibration },
    { type: 'switch' as const, labelKey: 'appSettings.darkMode', value: darkMode, onValueChange: setDarkMode },
    { type: 'language' as const, labelKey: 'appSettings.language', value: language },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{t('appSettings.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Settings List */}
      <View style={styles.settingsList}>
        {settingsRows.map((item, index) => (
          item.type === 'switch' ? (
            <View
              key={item.labelKey}
              style={[
                styles.settingRow,
                { backgroundColor: theme.card },
                index < settingsRows.length - 1 && styles.settingRowGap,
                getItemBorderRadius(index, settingsRows.length),
              ]}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>{t(item.labelKey)}</Text>
              <Switch
                value={item.value}
                onValueChange={item.onValueChange}
                {...switchProps}
              />
            </View>
          ) : item.type === 'language' ? (
            <View
              key={item.labelKey}
              style={[
                styles.settingRow,
                styles.settingRowLanguage,
                { backgroundColor: theme.card },
                index < settingsRows.length - 1 && styles.settingRowGap,
                getItemBorderRadius(index, settingsRows.length),
              ]}
            >
              <Text style={[styles.settingLabel, { color: theme.text }]}>{t(item.labelKey)}</Text>
              <View style={styles.settingValue}>
                <Text style={[styles.settingValueText, { color: theme.textSecondary }]}>{item.value}</Text>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={handleLanguageIconPress}
                  style={styles.settingsIconWrap}
                >
                  <ArrowSquareOut size={22} color={theme.textSecondary} weight="regular" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        ))}
      </View>

      {/* Android: Language selection bottom sheet */}
      {Platform.OS === 'android' && (
        <Modal
          visible={languageSheetVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLanguageSheetVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setLanguageSheetVisible(false)}>
            <View style={styles.sheetOverlay} />
          </TouchableWithoutFeedback>
          <View style={[styles.sheetContainer, { backgroundColor: theme.background }]} pointerEvents="box-none">
            <View style={[styles.sheetHandle, { backgroundColor: theme.borderLight }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('appSettings.language')}</Text>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.sheetRow, { borderBottomColor: theme.borderLight }]}
                    onPress={() => handleSelectLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sheetRowText, { color: isSelected ? theme.primary : theme.text }, isSelected && styles.sheetRowTextActive]}>{lang}</Text>
                    {isSelected && <Check size={22} color={theme.primary} weight="bold" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}
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
  settingRowLanguage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingValueText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  settingsIconWrap: {
    padding: SPACING.xs,
  },
  // Android language sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  sheetScroll: {
    maxHeight: 320,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
  },
  sheetRowText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
  },
  sheetRowTextActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
});
