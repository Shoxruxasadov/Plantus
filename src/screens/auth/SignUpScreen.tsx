import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { signUpWithEmail } from '../../services/supabase';
import { setupGardenNotificationsForUser } from '../../services/notifications';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../hooks';
import { isValidEmail, showAlert } from '../../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setUser, setSession, setUserCollection, notifications } = useAppStore();
  const { theme } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = t('auth.signUp.errorNameRequired');
    } else if (name.trim().length < 2) {
      newErrors.name = t('auth.signUp.errorNameMin');
    }

    if (!email.trim()) {
      newErrors.email = t('auth.signUp.errorEmailRequired');
    } else if (!isValidEmail(email)) {
      newErrors.email = t('auth.signUp.errorEmailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.signUp.errorPasswordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('auth.signUp.errorPasswordMin');
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('auth.signUp.errorConfirm');
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.signUp.errorMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await signUpWithEmail(
        email.trim(),
        password,
        name.trim()
      );

      if (error) {
        showAlert(t('auth.signUp.alertFailed'), error.message);
        return;
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);
        setUserCollection({
          id: data.user.id,
          email: email.trim(),
          name: name.trim(),
          image: null,
        });
        if (notifications) setupGardenNotificationsForUser(data.user.id).catch(() => {});
        navigation.replace('Pro', { isFirstStep: true });
      } else if (data.user && !data.session) {
        navigation.navigate('Success', {
          message: t('auth.signUp.successMessage'),
        });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      showAlert(t('common.error'), t('auth.signUp.alertUnexpected'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color={theme.text} weight="bold" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]}>{t('auth.signUp.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('auth.signUp.subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Input */}
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: errors.name ? theme.error : 'transparent' }, errors.name && styles.inputError]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('auth.signUp.namePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
            {errors.name && <Text style={[styles.errorText, { color: theme.error }]}>{errors.name}</Text>}

            {/* Email Input */}
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: errors.email ? theme.error : 'transparent' }, errors.email && styles.inputError]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('auth.signUp.emailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
            {errors.email && <Text style={[styles.errorText, { color: theme.error }]}>{errors.email}</Text>}

            {/* Password Input */}
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: errors.password ? theme.error : 'transparent' }, errors.password && styles.inputError]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('auth.signUp.passwordPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            {errors.password && <Text style={[styles.errorText, { color: theme.error }]}>{errors.password}</Text>}

            {/* Confirm Password Input */}
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: errors.confirmPassword ? theme.error : 'transparent' }, errors.confirmPassword && styles.inputError]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('auth.signUp.repeatPasswordPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            {errors.confirmPassword && (
              <Text style={[styles.errorText, { color: theme.error }]}>{errors.confirmPassword}</Text>
            )}

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpButton, { backgroundColor: theme.primary }, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.textLight} />
              ) : (
                <Text style={[styles.signUpButtonText, { color: theme.textLight }]}>{t('auth.signUp.submit')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={[styles.termsText, { color: theme.textSecondary }]}>
              {t('auth.signUp.termsPrefix')}{' '}
              <Text
                style={[styles.termsLink, { color: theme.primary }]}
                onPress={() => Linking.openURL('https://plantus.app/terms-of-use/')}
              >
                {t('auth.signUp.termsOfService')}
              </Text>{' '}
              {t('auth.signUp.and')}{'\n'}
              <Text
                style={[styles.termsLink, { color: theme.primary }]}
                onPress={() => Linking.openURL('https://plantus.app/privacy-policy/')}
              >
                {t('auth.signUp.privacyPolicy')}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  titleContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.header,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputWrapper: {
    borderRadius: RADIUS.round,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  inputError: {
  },
  input: {
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    fontSize: FONT_SIZES.lg,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.xl,
  },
  signUpButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  termsContainer: {
    paddingVertical: SPACING.xxl,
  },
  termsText: {
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  termsLink: {
    fontWeight: '600',
  },
});
