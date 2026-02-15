import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trash, CaretRight, XCircle, CheckCircle } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';

const OLIVER_IMG = require('../../../assets/images/Oliver.png');
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useAppStore } from '../../store/appStore';
import { clearAIChat, deleteAIChat } from '../../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { userCollection, setChatCreated, setAssistantChatId } = useAppStore();

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all chat history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAIChat(userCollection.id);
              Alert.alert('Success', 'Chat history cleared');
              navigation.goBack();
            } catch (error) {
              console.error('Clear chat error:', error);
              Alert.alert('Error', 'Failed to clear chat history');
            }
          },
        },
      ],
    );
  };

  const handleDeleteChat = () => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAIChat(userCollection.id);
              await setAssistantChatId(null);
              await setChatCreated(false);
              navigation.goBack();
              navigation.goBack();
            } catch (error) {
              console.error('Delete chat error:', error);
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Chat Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <Image source={OLIVER_IMG} style={[styles.avatar, { backgroundColor: theme.backgroundTertiary }]} resizeMode="cover" />
          <Text style={[styles.name, { color: theme.text }]}>Mr. Oliver</Text>
          <Text style={[styles.role, { color: theme.primary }]}>AI Botanist</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            Your personal plant expert, available 24/7 to help with plant care,
            identification, and diagnosis.
          </Text>
        </View>

        {/* Actions */}
        <View style={[styles.actionsCard, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={[styles.actionItem, { borderBottomColor: theme.borderLight }]} onPress={handleClearChat}>
            <View style={[styles.actionIcon, { backgroundColor: theme.backgroundTertiary }]}>
              <Trash size={20} color="#F59E0B" />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Clear Chat History</Text>
              <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>Remove all messages but keep the chat</Text>
            </View>
            <CaretRight size={20} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, styles.actionItemLast]} onPress={handleDeleteChat}>
            <View style={[styles.actionIcon, { backgroundColor: theme.backgroundTertiary }]}>
              <XCircle size={20} color={COLORS.error} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: COLORS.error }]}>Delete Chat</Text>
              <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>Permanently delete this chat</Text>
            </View>
            <CaretRight size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.tipsTitle, { color: theme.text }]}>Tips for Better Results</Text>
          {[
            'Be specific with your questions',
            'Include photos for identification',
            'Describe symptoms in detail',
            "Mention your plant's location",
          ].map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <CheckCircle size={18} color={theme.primary} weight="fill" />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backButton: { padding: SPACING.sm },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 60 },
  profileCard: {
    backgroundColor: COLORS.backgroundSecondary, borderRadius: RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center',
  },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#E8F5E9',
    marginBottom: SPACING.lg,
    overflow: 'hidden' as const,
  },
  name: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', color: COLORS.text },
  role: { fontSize: FONT_SIZES.md, color: COLORS.primary, marginTop: SPACING.xs },
  description: {
    fontSize: FONT_SIZES.md, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginTop: SPACING.md,
  },
  actionsCard: {
    backgroundColor: COLORS.backgroundSecondary, borderRadius: RADIUS.lg, marginTop: SPACING.lg,
  },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  actionItemLast: { borderBottomWidth: 0 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  actionContent: { flex: 1, marginLeft: SPACING.md },
  actionTitle: { fontSize: FONT_SIZES.md, fontWeight: '500', color: COLORS.text },
  actionSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  tipsCard: {
    backgroundColor: COLORS.backgroundSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg,
  },
  tipsTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.md },
  tipItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  tipText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginLeft: SPACING.sm },
});
