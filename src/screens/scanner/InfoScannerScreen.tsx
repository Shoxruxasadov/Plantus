import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Leaf,
  Sun,
  ArrowsOut,
  Camera,
  MagnifyingGlass,
  Palette,
  Bug,
  Stack,
  FirstAid,
  Lightbulb,
} from 'phosphor-react-native';

import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';

interface TipItem {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
}

const identifyTips: TipItem[] = [
  {
    icon: Sun,
    title: 'Good Lighting',
    description: 'Take photos in bright, natural light for best results',
  },
  {
    icon: Leaf,
    title: 'Focus on Leaves',
    description: 'Include clear shots of leaves, flowers, or fruits',
  },
  {
    icon: ArrowsOut,
    title: 'Fill the Frame',
    description: 'Get close enough to show plant details clearly',
  },
  {
    icon: Camera,
    title: 'Multiple Angles',
    description: 'Try different angles if first attempt fails',
  },
];

const diagnoseTips: TipItem[] = [
  {
    icon: MagnifyingGlass,
    title: 'Focus on Problems',
    description: 'Capture the affected areas clearly',
  },
  {
    icon: Palette,
    title: 'Show Discoloration',
    description: 'Include any spots, yellowing, or browning',
  },
  {
    icon: Bug,
    title: 'Check for Pests',
    description: 'Look under leaves for insects or eggs',
  },
  {
    icon: Stack,
    title: 'Overall View',
    description: 'Include a photo of the whole plant too',
  },
];

export default function InfoScannerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const sectionIdentifyBg = isDark ? 'rgba(31, 200, 92, 0.2)' : '#E8F5E9';
  const sectionDiagnoseBg = isDark ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0';
  const proTipCardBg = isDark ? theme.backgroundSecondary : '#FFFDE7';
  const proTipBorder = isDark ? theme.border : '#FFF59D';
  const proTipTitleColor = isDark ? '#FFC107' : '#F57F17';
  const proTipTextColor = isDark ? theme.textSecondary : '#5D4037';

  const renderTip = (tip: TipItem, index: number) => {
    const IconComponent = tip.icon;
    return (
      <View key={index} style={styles.tipItem}>
        <View style={[styles.tipIcon, { backgroundColor: theme.backgroundSecondary}]}>
          <IconComponent size={22} color={COLORS.primary} />
        </View>
        <View style={styles.tipContent}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</Text>
          <Text style={[styles.tipDescription, { color: theme.textSecondary }]}>{tip.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Scanning Tips</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Identify Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: sectionIdentifyBg }]}>
              <Leaf size={22} color={COLORS.primary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Plant Identification</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Tips for identifying unknown plants
              </Text>
            </View>
          </View>
          <View style={[styles.tipsContainer, { backgroundColor: theme.card }]}>
            {identifyTips.map((tip, index) => renderTip(tip, index))}
          </View>
        </View>

        {/* Diagnose Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: sectionDiagnoseBg }]}>
              <FirstAid size={22} color="#FF9800" />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Disease Diagnosis</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Tips for diagnosing plant issues
              </Text>
            </View>
          </View>
          <View style={[styles.tipsContainer, { backgroundColor: theme.card }]}>
            {diagnoseTips.map((tip, index) => renderTip(tip, index))}
          </View>
        </View>

        {/* Pro Tip */}
        <View style={[styles.proTipCard, { backgroundColor: proTipCardBg, borderColor: proTipBorder }]}>
          <View style={styles.proTipHeader}>
            <Lightbulb size={22} color="#FFC107" />
            <Text style={[styles.proTipTitle, { color: proTipTitleColor }]}>Pro Tip</Text>
          </View>
          <Text style={[styles.proTipText, { color: proTipTextColor }]}>
            For the most accurate results, take photos during daylight hours and
            avoid using flash when possible. Natural lighting helps our AI
            identify plant features more accurately.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  tipsContainer: {
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  tipDescription: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  proTipCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  proTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  proTipTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  proTipText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
});
