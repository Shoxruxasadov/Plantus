import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';
import { FONT_SIZES, SPACING, RADIUS, PLACEHOLDER_IMAGE } from '../../utils/theme';
import { useTheme } from '../../hooks';

type RouteProps = RouteProp<RootStackParamList, 'Article'>;
const { width } = Dimensions.get('window');

export default function ArticleScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const { article } = route.params;

  // Parse multilingual fields
  const getTitle = () => {
    if (typeof article.title === 'object') {
      return (article.title as any)?.english || (article.title as any)?.en || Object.values(article.title)[0];
    }
    return article.title;
  };

  const getDescription = () => {
    if (typeof article.description === 'object') {
      return (article.description as any)?.english || (article.description as any)?.en || Object.values(article.description as any)[0];
    }
    return article.description;
  };

  const getContent = () => {
    if (typeof article.content === 'object') {
      return (article.content as any)?.english || (article.content as any)?.en || Object.values(article.content as any)[0];
    }
    return article.content;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Full-width image with X button overlay */}
      <View style={[styles.imageContainer, { backgroundColor: theme.backgroundTertiary }]}>
        <Image
          source={{ uri: article.image || PLACEHOLDER_IMAGE }}
          style={styles.articleImage}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + SPACING.sm }]}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color={theme.textLight} />
        </TouchableOpacity>
      </View>

      {/* Content in card-like section */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>{getTitle()}</Text>

        {/* Description */}
        <View style={[styles.descriptionCard, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{getDescription()}</Text>
        </View>

        {/* Content sections */}
        {getContent() && (
          <View style={[styles.contentSection, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.contentText, { color: theme.text }]}>{getContent()}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    width,
    height: width * 0.65,
  },
  articleImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
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
    marginTop: -20,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
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
  },
  contentText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
  },
});
