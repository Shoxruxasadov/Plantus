import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';
import { FONT_SIZES, SPACING, RADIUS, PLACEHOLDER_IMAGE } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { getLocalizedString, getLocalizedSections } from '../../utils/articleLocale';

type RouteProps = RouteProp<RootStackParamList, 'Article'>;
const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = width * 0.65;

export default function ArticleScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { locale } = useTranslation();
  const [imageExpanded, setImageExpanded] = useState(false);

  const { article } = route.params;
  const articleAny = article as any;
  const imageUri = article.image || PLACEHOLDER_IMAGE;

  const title = getLocalizedString(
    typeof article.title === 'object' ? (article.title as Record<string, string>) : article.title,
    locale
  );
  const description = getLocalizedString(
    typeof article.description === 'object' ? (article.description as Record<string, string>) : article.description,
    locale
  );
  const sections = getLocalizedSections(articleAny.sections, locale);
  const legacyContent = getLocalizedString(
    typeof articleAny.content === 'object' ? articleAny.content : articleAny.content,
    locale
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Rasm fixed: top 0, left 0 — scroll da qimirmaydi */}
      <View style={[styles.imageFixed, { backgroundColor: theme.backgroundTertiary }]}>
        <TouchableOpacity activeOpacity={1} onPress={() => setImageExpanded(true)} style={styles.imageTouch}>
          <Image
            source={{ uri: imageUri }}
            style={styles.articleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* Faqat sheet scroll qiladi */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: IMAGE_HEIGHT }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentWrap, { backgroundColor: theme.background }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>

          <View style={[styles.descriptionCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
          </View>

          {sections.length > 0 &&
            sections.map((sec, idx) => (
              <View
                key={idx}
                style={[styles.contentSection, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{sec.title}</Text>
                <Text style={[styles.contentText, { color: theme.textSecondary }]}>{sec.description}</Text>
              </View>
            ))}

          {sections.length === 0 && legacyContent ? (
            <View style={[styles.contentSection, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.contentText, { color: theme.text }]}>{legacyContent}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Close button fixed on top */}
      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + SPACING.sm }]}
        onPress={() => navigation.goBack()}
      >
        <X size={24} color={theme.textLight} />
      </TouchableOpacity>

      {/* Expand: rasmni bosganda to'liq ekranda */}
      <Modal visible={imageExpanded} transparent animationType="fade" onRequestClose={() => setImageExpanded(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.expandOverlay}
          onPress={() => setImageExpanded(false)}
        >
          <Image source={{ uri: imageUri }} style={styles.expandImage} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.expandClose, { top: insets.top + SPACING.sm }]}
          onPress={() => setImageExpanded(false)}
        >
          <X size={28} color="#fff" weight="bold" />
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width,
    height: IMAGE_HEIGHT,
    zIndex: 0,
  },
  imageTouch: {
    width: '100%',
    height: '100%',
  },
  articleImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    zIndex: 10,
    position: 'absolute',
    left: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  contentWrap: {
    marginTop: -20,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.title,
    fontWeight: 'bold',
    lineHeight: 34,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  descriptionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  description: {
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
  },
  contentSection: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  contentText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
  },
  expandOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandImage: {
    width,
    height: '100%',
  },
  expandClose: {
    position: 'absolute',
    left: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
