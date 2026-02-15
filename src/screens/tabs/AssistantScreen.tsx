import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../../types';
import { Check } from 'phosphor-react-native';
import { COLORS, DARK_COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { getAIChat, createAIChat } from '../../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ILLUSTRATION_LIGHT = require('../../../assets/images/chat_mroliver.webp');
// Dark mode: use same image, or add chat_mroliver_dark.webp and require it here
const ILLUSTRATION_DARK = require('../../../assets/images/gardenMan.png');

export default function AssistantScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, userCollection, chatCreated, setChatCreated, setAssistantChatId, darkMode } = useAppStore();

  const isDark = darkMode;
  const theme = isDark ? DARK_COLORS : COLORS;

  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && chatCreated && userCollection?.id) {
      checkExistingChat();
    }
  }, [isLoggedIn, chatCreated, userCollection?.id]);

  const checkExistingChat = async () => {
    try {
      const { data } = await getAIChat(userCollection.id);
      if (data) {
        setChatId(data.id);
      }
    } catch (error) {
      console.error('Check chat error:', error);
    }
  };

  const handleStartChat = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Started');
      return;
    }

    setLoading(true);
    try {
      const { data: existingChat } = await getAIChat(userCollection.id);

      if (existingChat) {
        setChatId(existingChat.id);
        await setAssistantChatId(existingChat.id);
        await setChatCreated(true);
        navigation.navigate('Chat', { chatId: existingChat.id });
      } else {
        const { data: newChat, error } = await createAIChat(userCollection.id);
        if (error) {
          console.error('Create chat error:', error);
          return;
        }
        if (newChat) {
          setChatId(newChat.id);
          await setAssistantChatId(newChat.id);
          await setChatCreated(true);
          navigation.navigate('Chat', { chatId: newChat.id });
        }
      }
    } catch (error) {
      console.error('Start chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const illustrationSource = isDark ? ILLUSTRATION_DARK : ILLUSTRATION_LIGHT;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Assistant</Text>
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.backgroundSecondary }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration - light/dark */}
        <Image
          source={illustrationSource}
          style={styles.illustration}
          resizeMode="contain"
        />

        {/* Plant Expert badge */}
        <View style={[styles.badge, isDark && styles.badgeDark]}>
          <Check size={18} color={COLORS.primary} weight="bold" style={styles.badgeIcon} />
          <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>Plant Expert</Text>
        </View>

        {/* Chat with Mr. Oliver */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Chat with Mr. Oliver</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Get expert plant advice tailored to your plant.
        </Text>

        {/* Start Chat Button */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={chatCreated && chatId ? () => navigation.navigate('Chat', { chatId }) : handleStartChat}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textLight} />
          ) : (
            <Text style={styles.startButtonText}>Start Chat</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  illustration: {
    width: '100%',
    height: 280,
    marginBottom: SPACING.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#C8E6C9',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginBottom: SPACING.lg,
  },
  badgeDark: {
    backgroundColor: '#2D4A2E',
  },
  badgeIcon: {
    marginRight: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  badgeTextDark: {
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xxl,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
});
