import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Envelope, AppleLogo, ArrowLeft } from "phosphor-react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { RootStackParamList } from "../../types";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { useTranslation } from "../../i18n";
import { useTheme } from "../../hooks";
import { GOOGLE_WEB_CLIENT_ID } from "../../config/auth";
import {
  supabase,
  usersTable,
  groupsTable,
  getAIChat,
} from "../../services/supabase";
import { setupGardenNotificationsForUser } from "../../services/notifications";
import { useAppStore } from "../../store/appStore";
import { showAlert } from "../../utils/helpers";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Google Sign-In - only works in development builds, not Expo Go
let GoogleSignin: any = null;
try {
  GoogleSignin =
    require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_WEB_CLIENT_ID,
  });
} catch (e) {
  console.log("Google Sign-In not available (Expo Go)");
}

export default function StartedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const {
    setUser,
    setSession,
    setUserCollection,
    setAssistantChatId,
    setChatCreated,
    notifications,
    darkMode,
  } = useAppStore();
  const [loading, setLoading] = useState<"apple" | "google" | "email" | null>(
    null,
  );

  const handleAppleSignIn = async () => {
    if (Platform.OS !== "ios") return;

    try {
      setLoading("apple");
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
          navigation.replace("Pro", { isFirstStep: true });
        }
      }
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        console.error("Apple sign-in error:", error);
        showAlert(t('common.error'), t('started.alertAppleError'));
      }
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GoogleSignin) {
      showAlert(t('started.alertGoogleNotAvailable'), t('started.alertGoogleNotAvailableMessage'));
      return;
    }

    try {
      setLoading("google");
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
          navigation.replace("Pro", { isFirstStep: true });
        }
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      showAlert(t('common.error'), t('started.alertGoogleError'));
    } finally {
      setLoading(null);
    }
  };

  const handlePostSignIn = async (
    userId: string,
    email: string,
    name: string,
  ) => {
    // Check if user exists
    const { data: existingUser } = await usersTable()
      .select("*")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      // Create new user record
      await usersTable().insert({
        id: userId,
        email,
        name,
        created_at: new Date().toISOString(),
      });

      // Create default "General" space (cannot be deleted)
      await groupsTable().insert({
        name: "General",
        user: userId,
        created_at: new Date().toISOString(),
        deletemode: false,
      });

      await setUserCollection({ id: userId, email, name, image: null });
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

  const handleEmailSignUp = () => {
    navigation.navigate("SignUp");
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.background },
      ]}
    >
      {/* Header: Back + Skip */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
          navigation.replace("Pro", { isFirstStep: true });
        }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.skipText, { color: theme.textSecondary }]}>
            {t('started.skip')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Image
          source={require("../../../assets/plant.png")}
          style={styles.plantImage}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: theme.text }]}>{t('started.signUp')}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('started.subtitle')}
        </Text>
        {/* Buttons */}
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + SPACING.xl }]}
        >
          {/* Continue with Apple - iOS only */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, {backgroundColor: theme.black, borderColor: theme.black}]}
              onPress={handleAppleSignIn}
              disabled={loading !== null}
            >
              {loading === "apple" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Image
                    source={darkMode ? require("../../../assets/apple_black.png") : require("../../../assets/apple_white.png")}
                    style={styles.googleIcon}
                  />
                  <Text style={[styles.appleButtonText, {color: theme.textfieldColor}]}>
                    {t('started.continueApple')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Continue with Google */}
          <TouchableOpacity
            style={[styles.socialButton, styles.outlineButton, {backgroundColor: theme.accent2, borderColor: theme.accent2}]}
            onPress={handleGoogleSignIn}
            disabled={loading !== null}
          >
            {loading === "google" ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <Image
                  source={require("../../../assets/google.png")}
                  style={styles.googleIcon}
                />
                <Text style={[styles.socialButtonText, {color: theme.text}]}>
                  {t('started.continueGoogle')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Continue with Email */}
          <TouchableOpacity
            style={[styles.socialButton, styles.outlineButton, {backgroundColor: theme.accent2, borderColor: theme.accent2}]}
            onPress={handleEmailSignUp}
            disabled={loading !== null}
          >
            {loading === "email" ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <>
                <Envelope
                  size={22}
                  color={theme.text}
                  style={styles.buttonIcon}
                />
                <Text style={[styles.socialButtonText, {color: theme.text}]}>{t('started.continueEmail')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Already have an account */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate("SignIn")}
            disabled={loading !== null}
          >
            <Text style={[styles.loginText, { color: theme.textSecondary }]}>
              {t('started.loginPrompt')}
              <Text style={styles.loginTextBold}>{t('started.logIn')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  skipText: {
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  plantImage: {
    width: 100,
    height: 100,
    objectFit: "contain",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 46,
  },
  footer: {
    width: "100%",
    paddingHorizontal: 16,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    height: 56,
  },
  appleButton: {
    backgroundColor: "#000000",
  },
  outlineButton: {
    backgroundColor: "#f5f6f6",
    borderWidth: 1,
    borderColor: "#f5f6f6",
  },
  buttonIcon: {
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: "#000000",
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
  loginLink: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
  },
  loginText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  loginTextBold: {
    color: COLORS.primary, // brand color
    fontWeight: "600",
  },
});
