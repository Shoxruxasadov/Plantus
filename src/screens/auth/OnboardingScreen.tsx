import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useAppStore } from '../../store/appStore';
import { useTranslation } from '../../i18n';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const onboardingSlides = [
  { id: '1', titleKey: 'onboarding.slide1.title' as const, descKey: 'onboarding.slide1.desc' as const, image: require('../../../assets/Image1.png') },
  { id: '2', titleKey: 'onboarding.slide2.title' as const, descKey: 'onboarding.slide2.desc' as const, image: require('../../../assets/Image2.png') },
  { id: '3', titleKey: 'onboarding.slide3.title' as const, descKey: 'onboarding.slide3.desc' as const, image: require('../../../assets/Image3.png') },
];

const DOT_SIZE = 8;
const ACTIVE_DOT_WIDTH = 24;
const DOT_SPACING = 4;

const AnimatedDot = ({ index, scrollX }: { index: number; scrollX: Animated.Value }) => {
  const inputRange = [
    (index - 1) * width,
    index * width,
    (index + 1) * width,
  ];

  const dotWidth = scrollX.interpolate({
    inputRange,
    outputRange: [DOT_SIZE, ACTIVE_DOT_WIDTH, DOT_SIZE],
    extrapolate: 'clamp',
  });

  const dotOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  const dotColor = scrollX.interpolate({
    inputRange,
    outputRange: [COLORS.accent3, COLORS.text, COLORS.accent3],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: dotWidth,
          opacity: dotOpacity,
          backgroundColor: dotColor,
        },
      ]}
    />
  );
};

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setIsFirstStep } = useAppStore();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < onboardingSlides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = () => {
    setIsFirstStep(false);
    navigation.navigate('Started');
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const renderItem = ({ item }: { item: typeof onboardingSlides[0] }) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.image} resizeMode="contain" />
      </View>
      <Text style={styles.title}>{t(item.titleKey)}</Text>
      <Text style={styles.description}>{t(item.descKey)}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          <Text style={styles.skipArrow}> →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={onboardingSlides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      <View style={styles.dotsContainer}>
        {onboardingSlides.map((_, index) => (
          <AnimatedDot key={index} index={index} scrollX={scrollX} />
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#D4E7DA",
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '500',
  },
  skipArrow: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '500',
  },
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  imageContainer: {
    width: width - 32,
    height: height * 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: DOT_SPACING,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
  },
  button: {
    backgroundColor: '#18191C',
    borderRadius: RADIUS.round,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textLight,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
});
