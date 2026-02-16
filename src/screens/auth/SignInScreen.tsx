import React, { useState } from "react";
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
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, AppleLogo } from "phosphor-react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { RootStackParamList } from "../../types";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { GOOGLE_WEB_CLIENT_ID } from "../../config/auth";
import {
  signInWithEmail,
  getUserData,
  getAIChat,
  supabase,
  usersTable,
  groupsTable,
} from "../../services/supabase";
import { setupGardenNotificationsForUser } from "../../services/notifications";
import { useAppStore } from "../../store/appStore";
import { isValidEmail, showAlert } from "../../utils/helpers";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Google Sign-In – Supabase Google provider bilan bir xil Client ID ishlatiladi
let GoogleSignin: any = null;
try {
  GoogleSignin =
    require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_WEB_CLIENT_ID,
  });
} catch (e) {}

export default function SignInScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    setUser,
    setSession,
    setUserCollection,
    setAssistantChatId,
    setChatCreated,
    notifications,
    darkMode,
  } = useAppStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"apple" | "google" | null>(
    null,
  );
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!isValidEmail(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data, error } = await signInWithEmail(email.trim(), password);

      if (error) {
        showAlert("Sign In Failed", error.message);
        return;
      }

      if (data.user && data.session) {
        setUser(data.user);
        setSession(data.session);

        const { data: userData } = await getUserData(data.user.id);
        if (userData) {
          await setUserCollection({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            image: userData.image ?? null,
          });
          getAIChat(userData.id)
            .then(({ data: chat }) => {
              if (chat) {
                setAssistantChatId(chat.id);
                setChatCreated(true);
              }
            })
            .catch(() => {});
        }

        if (notifications)
          setupGardenNotificationsForUser(data.user.id).catch(() => {});
        navigation.navigate("MainTabs");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      showAlert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePostSignIn = async (
    userId: string,
    userEmail: string,
    name: string,
  ) => {
    const { data: existingUser } = await usersTable()
      .select("*")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      await usersTable().insert({
        id: userId,
        email: userEmail,
        name,
        created_at: new Date().toISOString(),
      });
      await groupsTable().insert({
        name: "General",
        user: userId,
        created_at: new Date().toISOString(),
        deletemode: false,
      });
      await setUserCollection({ id: userId, email: userEmail, name, image: null });
      getAIChat(userId)
        .then(({ data: chat }) => {
          if (chat) {
            setAssistantChatId(chat.id);
            setChatCreated(true);
          }
        })
        .catch(() => {});
    } else {
      await setUserCollection({
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        image: existingUser.image ?? null,
      });
      getAIChat(existingUser.id)
        .then(({ data: chat }) => {
          if (chat) {
            setAssistantChatId(chat.id);
            setChatCreated(true);
          }
        })
        .catch(() => {});
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GoogleSignin) {
      showAlert(
        "Not Available",
        "Google Sign-In requires a development build.",
      );
      return;
    }
    try {
      setSocialLoading("google");
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      if (idToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        if (error) throw error;
        if (data.user) {
          await handlePostSignIn(
            data.user.id,
            userInfo.data?.user.email || data.user.email || "",
            userInfo.data?.user.givenName || "User",
          );
          setUser(data.user);
          setSession(data.session);
          if (notifications)
            setupGardenNotificationsForUser(data.user.id).catch(() => {});
          navigation.navigate("MainTabs");
        }
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      showAlert("Error", "Failed to sign in with Google");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== "ios") return;
    try {
      setSocialLoading("apple");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw error;
        if (data.user) {
          await handlePostSignIn(
            data.user.id,
            credential.email || data.user.email || "",
            credential.fullName?.givenName || "User",
          );
          setUser(data.user);
          setSession(data.session);
          if (notifications)
            setupGardenNotificationsForUser(data.user.id).catch(() => {});
          navigation.navigate("MainTabs");
        }
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        console.error("Apple sign-in error:", error);
        showAlert("Error", "Failed to sign in with Apple");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate("ResetEmail");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              <ArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>
              To continue using our app create account first
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View
              style={[styles.inputWrapper, errors.email && styles.inputError]}
            >
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}

            {/* Password Input */}
            <View
              style={[
                styles.inputWrapper,
                errors.password && styles.inputError,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textLight} />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Continue with Apple - iOS only */}
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={socialLoading !== null}
              >
                {socialLoading === "apple" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Image
                      source={darkMode ? require("../../../assets/apple_black.png") : require("../../../assets/apple_white.png")}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.appleButtonText}>
                      Continue with Apple
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Continue with Google */}
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={socialLoading !== null}
            >
              {socialLoading === "google" ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Image
                    source={require("../../../assets/google.png")}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.socialButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  titleContainer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xxl,
    alignItems: "center",
  },
  title: {
    fontSize: FONT_SIZES.header,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  form: {
    flex: 1,
  },
  inputWrapper: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: SPACING.md,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.xl,
  },
  forgotPassword: {
    alignSelf: "flex-start",
    marginBottom: SPACING.xl,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    fontSize: FONT_SIZES.md,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: RADIUS.round,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  appleButton: {
    backgroundColor: "#000000",
  },
  socialIcon: {
    marginRight: SPACING.md,
  },
  socialButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.text,
  },
  appleButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: SPACING.md,
  },
});
