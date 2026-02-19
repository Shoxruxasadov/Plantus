import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../i18n';
import { updateUserData, uploadUserAvatar, removeUserAvatar } from '../../services/supabase';

export default function PersonalScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userCollection, updateUserCollection } = useAppStore();

  const [name, setName] = useState(userCollection.name || '');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const showAvatarActions = () => {
    if (!userCollection?.id || uploadingAvatar) return;
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: t('profile.changePhoto'), onPress: handleChangePhoto },
      { text: t('common.cancel'), style: 'cancel' },
    ];
    if (userCollection.image) {
      options.splice(1, 0, { text: t('profile.removePhoto'), onPress: handleRemovePhoto, style: 'destructive' });
    }
    Alert.alert(t('profile.photo'), undefined, options);
  };

  const handleChangePhoto = async () => {
    if (!userCollection?.id || uploadingAvatar) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profile.permission'), t('profile.photoPermissionMessage'));
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
        Alert.alert(t('common.error'), t('personal.errorUpload'));
        return;
      }
      if (url) await updateUserCollection({ image: url });
    } catch (e) {
      console.error('Avatar upload error:', e);
      Alert.alert(t('common.error'), t('personal.errorUploadShort'));
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
        Alert.alert(t('common.error'), t('personal.errorRemove'));
        return;
      }
      await updateUserCollection({ image: null });
    } catch (e) {
      console.error('Avatar remove error:', e);
      Alert.alert(t('common.error'), t('personal.errorRemove'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('personal.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      await updateUserData(userCollection.id, { name: name.trim() });
      updateUserCollection({ name: name.trim() });
      Alert.alert(t('common.success'), t('personal.success'));
      navigation.goBack();
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert(t('common.error'), t('personal.errorUpdate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{t('personal.edit')}</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <Text style={styles.saveButtonText}>{t('personal.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={showAvatarActions}
          disabled={uploadingAvatar}
          activeOpacity={0.7}
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
                {userCollection.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={[styles.avatarHint, { color: theme.textTertiary }]}>
          {t('personal.photoHint')}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={[styles.inputGroup]}>
          <Text style={[styles.label, { color: theme.text }]}>{t('personal.fullName')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundTertiary, color: theme.text }]}
            value={name}
            onChangeText={setName}
            placeholder={t('personal.namePlaceholder')}
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.text }]}>{t('personal.email')}</Text>
          <View style={[styles.input, styles.inputDisabled, { backgroundColor: theme.backgroundTertiary }]}>
            <Text style={[styles.inputDisabledText, { color: theme.text }]}>
              {userCollection.email || t('personal.noEmail')}
            </Text>
          </View>
          <Text style={[styles.helperText, { color: theme.textTertiary }]}>
            {t('personal.emailCannotChange')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  saveButton: {
    padding: SPACING.sm,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  avatarWrap: {
    alignSelf: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarLoading: {
    backgroundColor: COLORS.primary,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  avatarHint: {
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },
  form: {
    padding: SPACING.xl,
  },
  inputGroup: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
  },
  inputDisabled: {
    backgroundColor: COLORS.backgroundTertiary,
    opacity: 0.6,
  },
  inputDisabledText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  helperText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textTertiary,
    marginTop: SPACING.sm,
  },
});
