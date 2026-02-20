import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  Sun,
  Plant,
  MagnifyingGlass,
  PlusCircle,
  Bell,
  User,
  CrownSimple,
} from "phosphor-react-native";

const CARD_IDENTIFY = require("../../../assets/images/Card.Identify.png");
const CARD_DIAGNOSE = require("../../../assets/images/Card.Diagnose.png");

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTICLE_CARD_HEIGHT = SCREEN_WIDTH / 2;

import { RootStackParamList, Article } from "../../types";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { useTheme } from "../../hooks";
import { useAppStore } from "../../store/appStore";
import { useTranslation } from "../../i18n";
import { fetchWeather } from "../../services/api";
import { getArticles } from "../../services/supabase";
import { getCurrentLocation, formatTemperature } from "../../utils/helpers";
import { getLocalizedString } from "../../utils/articleLocale";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const {
    weather,
    setWeather,
    city,
    setCity,
    temperature,
    isLoggedIn,
    isPro,
    darkMode,
    assistantChatId,
  } = useAppStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const locationResult = await getCurrentLocation();
      if (locationResult.success && locationResult.coords) {
        // Always fetch in Celsius; formatTemperature converts for display when unit is imperial
        const weatherResult = await fetchWeather(
          locationResult.coords.latitude,
          locationResult.coords.longitude,
          "metric",
        );
        if (weatherResult.success && weatherResult.data) {
          const cityName = weatherResult.data.location;
          setWeather({
            temp: weatherResult.data.temp,
            location: cityName,
          });
          setCity(cityName);
        }
      }

      const { data: articlesData } = await getArticles();
      if (articlesData) {
        // Draft maqolalarni home page’da ko‘rsatmaymiz
        const published = articlesData.filter(
          (a: Article) => (a as any).status !== "draft",
        );
        setArticles(published);
      }
    } catch (error) {
      console.error("Load data error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleIdentify = () => {
    navigation.navigate("Scanner", { initialMode: "identify" });
  };

  const handleDiagnose = () => {
    navigation.navigate("Scanner", { initialMode: "diagnose" });
  };

  const handleChat = () => {
    if (!isPro) {
      navigation.navigate("Pro", { fromAssistant: true });
      return;
    }
    if (!isLoggedIn) {
      navigation.navigate("Started");
      return;
    }
    navigation.navigate(
      "Chat",
      assistantChatId ? { chatId: assistantChatId } : {},
    );
  };

  const handleReminders = () => {
    if (!isLoggedIn) {
      navigation.navigate("Started");
      return;
    }
    navigation.navigate("Reminders");
  };

  const handleArticle = (article: Article) => {
    navigation.navigate("Article", { article });
  };

  const handlePro = () => {
    navigation.navigate('Pro' as never);
  };

  const getArticleTitle = (article: Article) =>
    getLocalizedString(
      typeof article.title === "object" ? (article.title as Record<string, string>) : article.title,
      locale
    );

  const getArticleDescription = (article: Article) =>
    getLocalizedString(
      typeof article.description === "object"
        ? (article.description as Record<string, string>)
        : article.description,
      locale
    );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary },
      ]}
    >
      {/* Header - Weather & PRO */}
      <View
        style={[styles.header, { backgroundColor: theme.backgroundSecondary }]}
      >
        <View style={styles.weatherContainer}>
          <Sun size={28} color="#4CAF50" />
          <View style={styles.weatherTextContainer}>
            <Text style={[styles.weatherTemp, { color: theme.text }]}>
              {formatTemperature(weather.temp, temperature)}
            </Text>
            <Text
              style={[styles.weatherLocation, { color: theme.textSecondary }]}
            >
              {city || weather.location}
            </Text>
          </View>
        </View>

        {!isPro && (
          <TouchableOpacity style={styles.proButton} onPress={handlePro}>
            <CrownSimple size={18} color="#FFFFFF" weight="fill" />
            <Text style={styles.proButtonText}>{t('home.pro')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={[
          styles.scrollView,
          { backgroundColor: theme.backgroundSecondary },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: theme.backgroundSecondary },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar */}
        {/* <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: theme.background }]}
          activeOpacity={0.7}
          onPress={() => setSearchVisible(true)}
        >
          <MagnifyingGlass size={20} color={theme.textSecondary} />
          <Text style={[styles.searchPlaceholder, { color: theme.textTertiary }]}>Search plant by name</Text>
        </TouchableOpacity> */}
        <View style={{ height: 12 }}></View>

        {/* Scanning Tools */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('home.sectionScanning')}
        </Text>
        <View style={styles.scanningTools}>
          <TouchableOpacity
            style={[styles.scanCard, { backgroundColor: theme.background }]}
            onPress={handleIdentify}
            activeOpacity={0.9}
          >
            <View style={styles.scanCardTextBlock}>
              <Text style={[styles.scanCardTitle, { color: theme.text }]}>
                {t('home.identify')}
              </Text>
              <Text
                style={[
                  styles.scanCardDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {t('home.identifyDesc')}
              </Text>
            </View>
            <Image
              source={CARD_IDENTIFY}
              style={styles.scanCardCornerImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scanCard, { backgroundColor: theme.background }]}
            onPress={handleDiagnose}
            activeOpacity={0.9}
          >
            <View style={styles.scanCardTextBlock}>
              <Text style={[styles.scanCardTitle, { color: theme.text }]}>
                {t('home.diagnose')}
              </Text>
              <Text
                style={[
                  styles.scanCardDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {t('home.diagnoseDesc')}
              </Text>
            </View>
            <Image
              source={CARD_DIAGNOSE}
              style={styles.scanCardCornerImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>

        {/* Extra Tools */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('home.sectionExtra')}
        </Text>
        <View style={styles.extraToolsRow}>
          <TouchableOpacity
            style={[
              styles.extraToolCard,
              { backgroundColor: theme.background },
            ]}
            onPress={handleChat}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.extraToolIconWrap,
                {
                  backgroundColor: darkMode
                    ? theme.backgroundTertiary
                    : "#E8F5E9",
                },
              ]}
            >
              <User size={22} color={theme.primary} weight="regular" />
            </View>
            <Text style={[styles.extraToolTitle, { color: theme.text }]}>
              {t('home.plantExpert')}
            </Text>
            <Text
              style={[styles.extraToolSubtitle, { color: theme.textSecondary }]}
            >
              {t('home.askOliver')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.extraToolCard,
              { backgroundColor: theme.background },
            ]}
            onPress={handleReminders}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.extraToolIconWrap,
                {
                  backgroundColor: darkMode
                    ? theme.backgroundTertiary
                    : "#E8F5E9",
                },
              ]}
            >
              <Bell size={22} color={theme.primary} weight="regular" />
            </View>
            <Text style={[styles.extraToolTitle, { color: theme.text }]}>
              {t('home.careReminder')}
            </Text>
            <Text
              style={[styles.extraToolSubtitle, { color: theme.textSecondary }]}
            >
              {t('home.setPlan')}
            </Text>
          </TouchableOpacity>
          {/* Light Meter: hozir Coming soon dialog; keyinroq yoqish uchun onPress ni navigation.navigate("LightMeter" as never) qiling */}
          <TouchableOpacity
            style={[
              styles.extraToolCard,
              { backgroundColor: theme.background },
            ]}
            onPress={() => Alert.alert(t('home.comingSoon'), '', [{ text: t('common.ok') }])}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.extraToolIconWrap,
                {
                  backgroundColor: darkMode
                    ? theme.backgroundTertiary
                    : "#E8F5E9",
                },
              ]}
            >
              <Sun size={22} color={theme.primary} weight="regular" />
            </View>
            <Text style={[styles.extraToolTitle, { color: theme.text }]}>
              {t('home.lightMeter')}
            </Text>
            <Text
              style={[styles.extraToolSubtitle, { color: theme.textSecondary }]}
            >
              {t('home.checkLight')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Articles for you */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('home.sectionArticles')}
        </Text>

        {loading ? (
          <ActivityIndicator
            color={theme.textSecondary}
            style={styles.loader}
          />
        ) : (
          <View style={styles.articlesGrid}>
            {articles.slice(0, 4).map((article) => (
              <TouchableOpacity
                key={article.id}
                style={styles.articleCard}
                onPress={() => handleArticle(article)}
                activeOpacity={0.9}
              >
                <View style={styles.articleCardInner}>
                  <Image
                    source={{ uri: article.image }}
                    style={styles.articleImage}
                    resizeMode="cover"
                  />
                  <View style={styles.articleTitleBlock}>
                    <BlurView intensity={50} tint="dark" style={styles.articleTitleBlockBg} />
                    <View style={styles.articleTitleBlockOverlay} />
                    <Text style={styles.articleTitle} numberOfLines={2}>
                      {getArticleTitle(article)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 80 }}></View>
      </ScrollView>

      {/* Search Plant Modal */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setSearchVisible(false);
          setSearchQuery("");
        }}
      >
        <View style={styles.searchModalOverlay}>
          <View
            style={[
              styles.searchModalSheet,
              { backgroundColor: theme.background },
            ]}
          >
            <View
              style={[
                styles.searchModalHandle,
                { backgroundColor: theme.border },
              ]}
            />
            <Text style={[styles.searchModalTitle, { color: theme.text }]}>
              {t('home.searchByName')}
            </Text>
            <View
              style={[
                styles.searchModalInput,
                { backgroundColor: theme.backgroundSecondary },
                searchQuery.length > 0 && styles.searchModalInputActive,
              ]}
            >
              <MagnifyingGlass size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchModalTextInput, { color: theme.text }]}
                placeholder={t('home.searchTitle')}
                placeholderTextColor={theme.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            {searchQuery.length === 0 ? (
              <View style={styles.searchEmptyState}>
                <MagnifyingGlass size={48} color={theme.textTertiary} />
                <Text
                  style={[
                    styles.searchEmptyText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t('home.searchEmpty')}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.searchResults}
                showsVerticalScrollIndicator={false}
              >
                {/* Static sample plants filtered by search */}
                {[
                  { name: "Monstera", scientific: "Monstera deliciosa" },
                  { name: "Snake Plant", scientific: "Dracaena trifasciata" },
                  { name: "Peace Lily", scientific: "Spathiphyllum wallisii" },
                  { name: "Fiddle Leaf Fig", scientific: "Ficus lyrata" },
                  {
                    name: "Chinese Money Plant",
                    scientific: "Pilea peperomioides",
                  },
                  { name: "Rubber Plant", scientific: "Ficus elastica" },
                  { name: "Pothos", scientific: "Epipremnum aureum" },
                  { name: "Aloe Vera", scientific: "Aloe barbadensis" },
                ]
                  .filter((p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
                  )
                  .map((plant, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.searchResultRow,
                        { borderBottomColor: theme.borderLight },
                      ]}
                    >
                      <View
                        style={[
                          styles.searchResultImage,
                          { backgroundColor: theme.backgroundTertiary },
                        ]}
                      >
                        <Plant size={24} color={COLORS.primary} />
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text
                          style={[
                            styles.searchResultName,
                            { color: theme.text },
                          ]}
                        >
                          {plant.name}
                        </Text>
                        <Text
                          style={[
                            styles.searchResultScientific,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {plant.scientific}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.searchResultAddBtn}>
                        <PlusCircle size={28} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  weatherContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherTextContainer: {
    marginLeft: SPACING.sm,
  },
  weatherTemp: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "700",
    color: COLORS.text,
  },
  weatherLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  proButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    gap: 6,
  },
  proButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 32,
    backgroundColor: COLORS.backgroundSecondary,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
  },
  searchPlaceholder: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginLeft: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  scanningTools: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  scanCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    height: 210,
    paddingTop: SPACING.lg,
    paddingLeft: SPACING.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  scanCardTextBlock: {
    alignSelf: "flex-start",
  },
  scanCardTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.text,
  },
  scanCardDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scanCardCornerImage: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  extraToolsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  extraToolCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
    minHeight: 110,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  extraToolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  extraToolTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  extraToolSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  loader: {
    marginTop: SPACING.xl,
  },
  articlesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  articleCard: {
    width: "47%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.backgroundTertiary,
  },
  articleCardInner: {
    height: ARTICLE_CARD_HEIGHT,
    position: "relative",
  },
  articleImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.backgroundTertiary,
  },
  articleTitleBlock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    justifyContent: "flex-end",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  articleTitleBlockBg: {
    ...StyleSheet.absoluteFillObject,
  },
  articleTitleBlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  articleDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  // Search Modal
  searchModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  searchModalSheet: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    marginTop: 60,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingTop: SPACING.md,
  },
  searchModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: SPACING.lg,
  },
  searchModalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  searchModalInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: SPACING.sm,
  },
  searchModalInputActive: {
    borderColor: COLORS.primary,
  },
  searchModalTextInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xxxl,
  },
  searchEmptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.md,
    lineHeight: 22,
  },
  searchResults: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  searchResultImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  searchResultName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    color: COLORS.text,
  },
  searchResultScientific: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  searchResultAddBtn: {
    padding: SPACING.xs,
  },
  searchResultsText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});
