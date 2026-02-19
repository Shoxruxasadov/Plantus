import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';

import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../i18n';
import { supportTable } from '../../services/supabase';

export default function SupportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userCollection } = useAppStore();

  const emojiOptions = [
    { emoji: '🙂', label: t('support.good') },
    { emoji: '🙁', label: t('support.bad') },
    { emoji: '😇', label: t('support.great') },
    { emoji: '😐', label: t('support.neutral') },
    { emoji: '😡', label: t('support.angry') },
  ];

  const [selectedEmoji, setSelectedEmoji] = useState(2); // default: 😇
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(t('support.error'), t('support.pleaseShare'));
      return;
    }

    setLoading(true);
    try {
      await supportTable().insert({
        user: userCollection.id,
        email: userCollection.email,
        subject: `Feedback: ${emojiOptions[selectedEmoji].label}`,
        message: message.trim(),
        created_at: new Date().toISOString(),
      });

      Alert.alert(
        t('support.thankYou'),
        t('support.success'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Submit feedback error:', error);
      Alert.alert(t('support.error'), t('support.errorSend'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={COLORS.text} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('support.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question */}
          <Text style={styles.question}>{t('support.question')}</Text>

          {/* Emoji Selector */}
          <View style={styles.emojiRow}>
            {emojiOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.emojiButton,
                  selectedEmoji === index && styles.emojiButtonSelected,
                ]}
                onPress={() => setSelectedEmoji(index)}
              >
                <Text style={styles.emoji}>{option.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textArea}
              value={message}
              onChangeText={setMessage}
              placeholder={t('support.placeholder')}
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Done Button */}
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + SPACING.md }]}>
          <TouchableOpacity
            style={[styles.doneButton, loading && styles.doneButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textLight} />
            ) : (
              <Text style={styles.doneButtonText}>{t('support.done')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  backButton: {
    padding: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  question: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  emojiButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButtonSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  emoji: {
    fontSize: 28,
  },
  inputContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  textArea: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 120,
    padding: SPACING.sm,
  },
  bottomArea: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
  },
  doneButtonDisabled: {
    opacity: 0.7,
  },
  doneButtonText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.textLight,
  },
});
