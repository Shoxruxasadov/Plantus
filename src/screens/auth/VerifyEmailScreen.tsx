import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTranslation } from '../../i18n';
import { showAlert } from '../../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    setCanResend(false);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      showAlert(t('common.error'), t('auth.verifyEmail.errorRequired'));
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual verification logic
      navigation.navigate('ResetPassword', {});
    } catch (err) {
      console.error('Verify error:', err);
      showAlert(t('common.error'), t('auth.verifyEmail.errorInvalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    if (!canResend) return;
    startCountdown();
    // TODO: Implement resend logic
    showAlert(t('auth.verifyEmail.codeSent'), t('auth.verifyEmail.codeSentMessage'));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color={COLORS.text} weight="bold" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{t('auth.verifyEmail.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.verifyEmail.subtitle')}</Text>

          {/* Code Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={t('auth.verifyEmail.placeholder')}
              placeholderTextColor={COLORS.textSecondary}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoCapitalize="none"
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textLight} />
            ) : (
              <Text style={styles.verifyButtonText}>{t('auth.verifyEmail.verify')}</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendCode}>
                <Text style={styles.resendText}>{t('auth.verifyEmail.resend')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdownText}>
                {t('auth.verifyEmail.resendIn', { seconds: countdown })}
              </Text>
            )}
          </View>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.header,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  inputWrapper: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.round,
    marginBottom: SPACING.md,
  },
  input: {
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  resendText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  countdownText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  countdownNumber: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
