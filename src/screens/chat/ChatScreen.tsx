import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, PaperPlaneRight, XCircle } from 'phosphor-react-native';
import * as ImagePicker from 'expo-image-picker';

import { RootStackParamList } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/appStore';
import { getAIChat, updateAIChat, createAIChat } from '../../services/supabase';
import { sendChatMessage } from '../../services/api';
import { generateId } from '../../utils/helpers';

const OLIVER_IMG = require('../../../assets/images/Oliver.png');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Chat'>;

const { width: SW } = Dimensions.get('window');

// ---- Supabase message format ----
interface SupaMessage {
  message: string;
  whom: 'ai' | 'user';
  created: string;
  photo: string;
  hasPhoto: boolean;
}

const INITIAL_SUGGESTION_KEYS = ['chat.suggestion1', 'chat.suggestion2', 'chat.suggestion3', 'chat.suggestion4', 'chat.suggestion5'] as const;
const CONTEXT_SUGGESTION_KEYS = ['chat.context1', 'chat.context2', 'chat.context3', 'chat.context4'] as const;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
}

export default function ChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userCollection, darkMode, assistantChatId, setAssistantChatId, setChatCreated } = useAppStore();
  const flatListRef = useRef<FlatList>(null);

  const { chatId: routeChatId, plantImage: routePlantImage, plantContextMessage: routePlantContextMessage } = route.params || {};
  const effectiveChatId = routeChatId ?? assistantChatId;
  const [messages, setMessages] = useState<SupaMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // ---- Default from Plant screen: 0-index image + short message ----
  useEffect(() => {
    if (routePlantImage != null) setSelectedImage(routePlantImage);
    if (routePlantContextMessage != null && routePlantContextMessage.trim() !== '') setInputText(routePlantContextMessage.trim());
  }, [routePlantImage, routePlantContextMessage]);

  // ---- Load chat (bitta chat: route yoki store dan id) ----
  useEffect(() => {
    loadChat();
  }, [routeChatId, assistantChatId]);

  useFocusEffect(
    useCallback(() => {
      if (effectiveChatId) loadChat();
    }, [effectiveChatId]),
  );

  const loadChat = async () => {
    if (!userCollection?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getAIChat(userCollection.id);
      if (data) {
        await setAssistantChatId(data.id);
        await setChatCreated(true);
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages as SupaMessage[]);
        } else {
          const greeting: SupaMessage = {
            message: t('chat.greeting'),
            whom: 'ai',
            created: new Date().toISOString(),
            photo: '',
            hasPhoto: false,
          };
          setMessages([greeting]);
          await updateAIChat(data.id, [greeting]);
        }
      } else {
        const { data: newChat, error } = await createAIChat(userCollection.id);
        if (error || !newChat) {
          setLoading(false);
          return;
        }
        await setAssistantChatId(newChat.id);
        await setChatCreated(true);
        const greeting: SupaMessage = {
          message: t('chat.greeting'),
          whom: 'ai',
          created: new Date().toISOString(),
          photo: '',
          hasPhoto: false,
        };
        setMessages([greeting]);
        await updateAIChat(newChat.id, [greeting]);
      }
    } catch (error) {
      console.error('Load chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Scroll to end ----
  const scrollToEnd = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 150);
  };

  // Always open chat with list scrolled to end (after load or on focus)
  useEffect(() => {
    if (!loading && messages.length > 0) scrollToEnd(false);
  }, [loading, messages.length]);

  useFocusEffect(
    useCallback(() => {
      if (!loading && messages.length > 0) scrollToEnd(false);
    }, [loading, messages.length]),
  );

  // ---- Send message ----
  const handleSend = async (text?: string) => {
    const msgText = text || inputText.trim();
    if (!msgText && !selectedImage) return;

    const userMsg: SupaMessage = {
      message: msgText,
      whom: 'user',
      created: new Date().toISOString(),
      photo: selectedImage || '',
      hasPhoto: !!selectedImage,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setSelectedImage(null);
    setSending(true);
    scrollToEnd();

    try {
      // Build history for Gemini
      const history = newMessages.map((m) => ({
        role: m.whom === 'ai' ? ('assistant' as const) : ('user' as const),
        content: m.message,
      }));

      const result = await sendChatMessage(
        history,
        selectedImage ? selectedImage.split(',')[1] : undefined,
      );

      if (result.success && result.data?.message) {
        const aiMsg: SupaMessage = {
          message: result.data.message,
          whom: 'ai',
          created: new Date().toISOString(),
          photo: '',
          hasPhoto: false,
        };
        const updatedMessages = [...newMessages, aiMsg];
        setMessages(updatedMessages);
        if (effectiveChatId) {
          await updateAIChat(effectiveChatId, updatedMessages);
        }
      } else {
        // Error fallback
        const errMsg: SupaMessage = {
          message: t('chat.errorConnecting'),
          whom: 'ai',
          created: new Date().toISOString(),
          photo: '',
          hasPhoto: false,
        };
        const updatedMessages = [...newMessages, errMsg];
        setMessages(updatedMessages);
        if (effectiveChatId) {
          await updateAIChat(effectiveChatId, updatedMessages);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  // ---- Pick image ----
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Pick image error:', error);
    }
  };

  // ---- Is chat empty (only greeting or nothing) ----
  const userMessageCount = messages.filter((m) => m.whom === 'user').length;

  // ---- Render message bubble ----
  const renderMessage = ({ item, index }: { item: SupaMessage; index: number }) => {
    const isUser = item.whom === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAI,
        ]}
      >
        {!isUser && (
          <Image source={OLIVER_IMG} style={[styles.aiAvatar, { backgroundColor: theme.backgroundTertiary }]} resizeMode="cover" />
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          {
            backgroundColor: isUser ? (darkMode ? theme.backgroundTertiary : '#DCF8E8') : (darkMode ? theme.backgroundTertiary : theme.card),
            ...(!isUser && darkMode && { borderWidth: 1, borderColor: theme.borderLight }),
          },
        ]}>
          {item.hasPhoto && item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.msgImage} resizeMode="cover" />
          ) : null}
          <Text style={[styles.msgText, { color: theme.text }]}>
            {item.message}
          </Text>
          <Text style={[styles.msgTime, { color: theme.textSecondary }, isUser && { textAlign: 'right' }]}>
            {formatTime(item.created)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('chat.mrOliver')}</Text>
          <View style={styles.onlineRow}>
            <Text style={[styles.onlineText, { color: theme.primary }]}>{t('chat.alwaysOnline')}</Text>
            <View style={[styles.onlineDot, { backgroundColor: theme.primary }]} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerAvatarBtn}
          onPress={() => navigation.navigate('ChatProfile')}
        >
          <Image source={OLIVER_IMG} style={[styles.headerAvatar, { backgroundColor: theme.backgroundTertiary }]} resizeMode="cover" />
        </TouchableOpacity>
      </View>

      {/* Chat body */}
      <KeyboardAvoidingView
        style={styles.kbView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.textSecondary} />
          </View>
        ) : (
          <View style={[styles.chatBody, { backgroundColor: theme.backgroundSecondary }]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderMessage}
              contentContainerStyle={[
                styles.messageList,
                messages.length === 0 && styles.messageListEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              ListFooterComponent={
                sending ? (
                  <View style={styles.typingWrap}>
                    <Image source={OLIVER_IMG} style={[styles.aiAvatar, { backgroundColor: theme.backgroundTertiary }]} resizeMode="cover" />
                    <View style={[
                      styles.bubble, styles.bubbleAI, styles.typingBubble,
                      { backgroundColor: darkMode ? theme.backgroundTertiary : theme.card },
                      darkMode && { borderWidth: 1, borderColor: theme.borderLight },
                    ]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                        <View style={[styles.dot, { marginHorizontal: 4, backgroundColor: theme.textTertiary }]} />
                        <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />
          </View>
        )}

        {/* Suggestion chips */}
        {!loading && messages.length === 0 && (
          <View style={[styles.suggestionsWrap, { backgroundColor: theme.backgroundSecondary }, selectedImage && styles.suggestionsWrapWithImage]}>
            {INITIAL_SUGGESTION_KEYS.map((key, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionChip, { backgroundColor: theme.card, borderColor: theme.borderLight }]}
                onPress={() => handleSend(t(key))}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestionText, { color: theme.text }]}>{t(key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input bar wrapper (relative for absolute preview) */}
        <View style={styles.inputBarWrapper}>
          {/* Selected image preview – position absolute, layoutda joy olmaydi */}
          {selectedImage && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: selectedImage }} style={styles.previewImg} />
              <TouchableOpacity style={[styles.previewRemove, { backgroundColor: theme.card }]} onPress={() => setSelectedImage(null)}>
                <XCircle size={22} color={COLORS.error} weight="fill" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8, backgroundColor: theme.background, borderTopColor: theme.borderLight }]}>
          <TouchableOpacity style={styles.cameraBtn} onPress={handlePickImage} activeOpacity={0.8}>
            <Camera size={20} color="#fff" weight="fill" />
          </TouchableOpacity>
          <View style={[styles.inputWrap, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              style={[styles.input, { backgroundColor: 'transparent', color: theme.text }]}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              numberOfLines={1}
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputText.trim() && !selectedImage) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={(!inputText.trim() && !selectedImage) || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <PaperPlaneRight size={18} color="#fff" weight="fill" />
            )}
          </TouchableOpacity>
        </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: SPACING.xs },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineText: { fontSize: 12, color: COLORS.primary, marginRight: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  headerAvatarBtn: { padding: SPACING.xs },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8F5E9',
    overflow: 'hidden' as const,
  },

  // Body
  kbView: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatBody: { flex: 1, },
  messageList: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, paddingBottom: 8 },
  messageListEmpty: { flex: 1, justifyContent: 'flex-end' },

  // Message
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E8F5E9',
    marginRight: 8, marginBottom: 0,
    overflow: 'hidden' as const,
  },
  bubble: {
    maxWidth: SW * 0.72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#DCF8E8',
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#F2F3F5',
    borderBottomLeftRadius: 4,
  },
  msgImage: {
    width: SW * 0.55,
    height: SW * 0.4,
    borderRadius: 12,
    marginBottom: 8,
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTextUser: { color: COLORS.text },
  msgTextAI: { color: COLORS.text },
  msgTime: { fontSize: 11, marginTop: 4 },
  msgTimeUser: { color: '#8C9199', textAlign: 'right' },
  msgTimeAI: { color: '#8C9199' },

  // Typing
  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18 },
  typingDots: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ADB1B8' },

  // Suggestions
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 8,
    gap: 8,
  },
  suggestionsWrapWithImage: {
    paddingLeft: SPACING.lg + 72 + 12,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  suggestionText: { fontSize: 13, color: COLORS.text },

  // Input bar wrapper (preview absolute unga nisbatan)
  inputBarWrapper: { position: 'relative' },

  // Image preview – absolute, input bar ustida, layoutda joy egallamaydi
  previewWrap: {
    position: 'absolute',
    left: 12,
    bottom: 100,
    zIndex: 10,
  },
  previewImg: { width: 72, height: 72, borderRadius: 12 },
  previewRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 12 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cameraBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#F2F3F5',
    borderRadius: 22,
    marginHorizontal: 8,
    height: 40,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: COLORS.text,
    height: 40,
    backgroundColor: "transparent",
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
