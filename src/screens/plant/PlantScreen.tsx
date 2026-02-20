import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Modal,
  FlatList,
  Animated,
  PanResponder,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, CaretRight, Sparkle, Bug, Timer, FolderOpen } from 'phosphor-react-native';

import { RootStackParamList, Group } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS, PLACEHOLDER_IMAGE } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/appStore';
import { addPlantToGarden, addPlantToGroup, deleteGardenPlant, removePlantFromGroup, getGroups, findGardenPlantByName, getGardenPlantById } from '../../services/supabase';
import { scheduleCareplanNotificationsForPlant } from '../../services/notifications';
import { showConfirmAlert } from '../../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Plant'>;

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = 300;
const COLLAPSED_Y = IMAGE_HEIGHT - 20;
const EXPANDED_Y = 0;

const REVIEW_PROMPT_LAST_SHOWN_KEY = '@plantus_review_prompt_last_shown';
const REVIEW_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const APP_STORE_REVIEW_URL_IOS = 'https://apps.apple.com/app/id6759219129?action=write-review';
const PLAY_STORE_REVIEW_URL_ANDROID = 'https://play.google.com/store/apps/details?id=com.webnum.plantus';

// ---- JSON helpers ----
function safeParse(val: any) {
  if (!val) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val;
}

const OVERVIEW_ICONS: { [key: string]: any } = {
  WateringNeeds: require('../../../assets/images/Overview_Watering.png'),
  Fertilizing: require('../../../assets/images/Overview_Fertilizing.png'),
  LightRequirement: require('../../../assets/images/Light_Requirement.png'),
  Humidity: require('../../../assets/images/Humidity.png'),
  TemperatureRange: require('../../../assets/images/Temperature_Range.png'),
  SoilType: require('../../../assets/images/Soil_Type.png'),
  PotDrainage: require('../../../assets/images/PotDrainage.png'),
  PruningNeeds: require('../../../assets/images/Pruning_Needs.png'),
};

const OVERVIEW_KEYS: { key: string; labelKey: string }[] = [
  { key: 'WateringNeeds', labelKey: 'plant.wateringNeeds' },
  { key: 'Fertilizing', labelKey: 'plant.fertilizing' },
  { key: 'LightRequirement', labelKey: 'plant.lightRequirement' },
  { key: 'Humidity', labelKey: 'plant.humidity' },
  { key: 'TemperatureRange', labelKey: 'plant.temperatureRange' },
  { key: 'SoilType', labelKey: 'plant.soilType' },
  { key: 'PotDrainage', labelKey: 'plant.potDrainage' },
  { key: 'PruningNeeds', labelKey: 'plant.pruningNeeds' },
];

const CARE_ICONS: { [key: string]: any } = {
  Watering: require('../../../assets/images/Careplan1.png'),
  Fertilize: require('../../../assets/images/Careplan2.png'),
  Repotting: require('../../../assets/images/Careplan3.png'),
  Pruning: require('../../../assets/images/Careplan4.png'),
  Humidity: require('../../../assets/images/Careplan5.png'),
  Soilcheck: require('../../../assets/images/Careplan6.png'),
};

const CARE_KEYS: { key: string; labelKey: string }[] = [
  { key: 'Watering', labelKey: 'garden.careWatering' },
  { key: 'Fertilize', labelKey: 'garden.careFertilize' },
  { key: 'Repotting', labelKey: 'garden.careRepotting' },
  { key: 'Pruning', labelKey: 'garden.carePruning' },
  { key: 'Humidity', labelKey: 'garden.careHumidity' },
  { key: 'Soilcheck', labelKey: 'garden.careSoilCheck' },
];

function formatRepeat(item: any): string {
  if (!item) return '';
  const r = item.Repeat || item.repeat;
  const c = item.CustomRepeat || item.customRepeat;
  if (r === 'Everyday') return 'Every day';
  if (r === 'Everyweek') return 'Every week';
  if (c) {
    const v = c.Value || c.value || 1;
    const t = c.Type || c.type || 'day';
    return `Every ${v} ${t}${v > 1 ? 's' : ''}`;
  }
  return r || '';
}

function formatTime(item: any): string {
  if (!item) return '';
  const t = item.Time || item.time;
  if (!t) return '';
  const d = new Date(t);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatJournalTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export default function PlantScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { userCollection, isLoggedIn, isPro, notifications } = useAppStore();

  const { plantId, isGarden, snap } = route.params || {};
  const [plant, setPlant] = useState<any>(snap || null);
  const [loading, setLoading] = useState(!snap && !!plantId);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [saving, setSaving] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<any>(null);
  const [selectedOverview, setSelectedOverview] = useState<{ key: string; labelKey: string; item: any } | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageGalleryVisible, setImageGalleryVisible] = useState(false);
  const galleryListRef = useRef<FlatList>(null);

  // Sheet slide-up animations
  // Sheet slide + overlay fade animations
  const diseaseSheetY = useRef(new Animated.Value(600)).current;
  const diseaseOverlay = useRef(new Animated.Value(0)).current;
  const overviewSheetY = useRef(new Animated.Value(600)).current;
  const overviewOverlay = useRef(new Animated.Value(0)).current;
  const groupSheetY = useRef(new Animated.Value(400)).current;
  const groupOverlay = useRef(new Animated.Value(0)).current;
  const imageScrollX = useRef(new Animated.Value(0)).current;

  // ---- Sheet: 2 snap positions (Yandex Taxi style) ----
  const sheetY = useRef(new Animated.Value(COLLAPSED_Y)).current;
  const expandProgress = useRef(new Animated.Value(0)).current; // 0=collapsed, 1=expanded
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);

  // Close button cross-fade (driven by sheetY — native driver compatible: opacity only)
  const closeBtnImageOpacity = sheetY.interpolate({
    inputRange: [EXPANDED_Y, COLLAPSED_Y],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const closeBtnStickyOpacity = sheetY.interpolate({
    inputRange: [EXPANDED_Y, COLLAPSED_Y],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Safe area spacer & handle (driven by expandProgress — JS driver for height)
  const spacerHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, insets.top + 8],
  });
  const handleOpacity = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const handleAnimHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  const handlePadding = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  // Garden check
  const [gardenPlant, setGardenPlant] = useState<any>(null);
  const [checkedGarden, setCheckedGarden] = useState(false);

  // Group selection
  const [groupSelectVisible, setGroupSelectVisible] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);

  // Snackbar for reminder setup failure
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  useEffect(() => {
    if (!snackVisible) return;
    const t = setTimeout(() => setSnackVisible(false), 4000);
    return () => clearTimeout(t);
  }, [snackVisible]);

  // Refs
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<{ [key: string]: number }>({});
  const contentScrollYRef = useRef(0);
  const ignoreScrollSyncRef = useRef(false);

  // Parse data
  const overview = safeParse(plant?.overview);
  const careplan = safeParse(plant?.careplan);
  const customcareplan = safeParse(plant?.customcareplan);
  const diseases: any[] = safeParse(plant?.disease) || [];
  const journals: any[] = safeParse(plant?.journals) || [];
  const journalList = useMemo(
    () => [...journals].sort((a, b) => (b.Time ?? b.time ?? 0) - (a.Time ?? a.time ?? 0)),
    [journals]
  );
  const images: string[] = plant?.images || [];
  const labels: string[] = plant?.labels || [];
  const activeCareplan = customcareplan || careplan;
  const confidence = plant?.confidence;

  // Fetch plant by ID when snap is not provided (e.g. navigating from My Garden)
  useEffect(() => {
    if (!snap && plantId) {
      setLoading(true);
      getGardenPlantById(plantId)
        .then(({ data }) => {
          if (data) setPlant(data);
        })
        .finally(() => setLoading(false));
    }
  }, [plantId, snap]);

  useEffect(() => {
    if (!isGarden && plant && isLoggedIn && userCollection.id) {
      findGardenPlantByName(userCollection.id, plant.name)
        .then(({ data }) => { setGardenPlant(data); setCheckedGarden(true); })
        .catch(() => setCheckedGarden(true));
    } else {
      setCheckedGarden(true);
    }
  }, [plant]);

  // Slide-up + overlay fade animations for bottom sheets
  useEffect(() => {
    if (selectedDisease) {
      diseaseSheetY.setValue(600);
      diseaseOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(diseaseOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(diseaseSheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [selectedDisease]);

  useEffect(() => {
    if (selectedOverview) {
      overviewSheetY.setValue(600);
      overviewOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(overviewOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(overviewSheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [selectedOverview]);

  useEffect(() => {
    if (groupSelectVisible) {
      groupSheetY.setValue(400);
      groupOverlay.setValue(0);
      Animated.parallel([
        Animated.timing(groupOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(groupSheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [groupSelectVisible]);

  useEffect(() => {
    if (imageGalleryVisible && galleryListRef.current) {
      const timer = setTimeout(() => {
        galleryListRef.current?.scrollToOffset({ offset: imageIndex * width, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [imageGalleryVisible]);

  // Close handlers — slide sheet down + fade overlay, then dismiss
  const closeDiseaseSheet = () => {
    Animated.parallel([
      Animated.timing(diseaseOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(diseaseSheetY, { toValue: 600, duration: 250, useNativeDriver: true }),
    ]).start(() => setSelectedDisease(null));
  };
  const closeOverviewSheet = () => {
    Animated.parallel([
      Animated.timing(overviewOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(overviewSheetY, { toValue: 600, duration: 250, useNativeDriver: true }),
    ]).start(() => setSelectedOverview(null));
  };
  const closeGroupSheet = () => {
    Animated.parallel([
      Animated.timing(groupOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(groupSheetY, { toValue: 400, duration: 250, useNativeDriver: true }),
    ]).start(() => setGroupSelectVisible(false));
  };

  // ---- Expand / Collapse ----
  const doExpand = (onDone?: () => void) => {
    isExpandedRef.current = true;
    setIsExpanded(true);
    Animated.spring(sheetY, { toValue: EXPANDED_Y, useNativeDriver: true, tension: 65, friction: 11 }).start(() => onDone?.());
    Animated.timing(expandProgress, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  };

  const doCollapse = () => {
    isExpandedRef.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(sheetY, { toValue: COLLAPSED_Y, useNativeDriver: true, tension: 65, friction: 11 }).start();
    Animated.timing(expandProgress, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => setIsExpanded(false));
  };

  // PanResponder on sheet header for swipe up/down (collapse only when content scroll is at top)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5 && Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -50 && !isExpandedRef.current) {
          doExpand();
        } else if (gs.dy > 50 && isExpandedRef.current && contentScrollYRef.current <= 0) {
          doCollapse();
        }
      },
    })
  ).current;

  // Pull-down-to-collapse only when content is at top; re-enable scroll-based tab sync when scroll ends
  const handleContentScrollEndDrag = useCallback((e: any) => {
    ignoreScrollSyncRef.current = false;
    if (!isExpandedRef.current) return;
    const y = e.nativeEvent.contentOffset.y;
    if (y > 0) return; // Don't collapse if user has scrolled down
    const vy = e.nativeEvent.velocity?.y ?? 0;
    if (y <= -30 || (y <= 0 && vy < -1.5)) {
      doCollapse();
    }
  }, []);

  const tryShowReviewDialog = useCallback((onDismiss: () => void) => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REVIEW_PROMPT_LAST_SHOWN_KEY);
        const lastShown = raw ? parseInt(raw, 10) : 0;
        const now = Date.now();
        if (now - lastShown < REVIEW_PROMPT_COOLDOWN_MS && lastShown > 0) {
          onDismiss();
          return;
        }
        Alert.alert(
          t('plant.reviewTitle'),
          t('plant.reviewMessage'),
          [
            { text: t('plant.reviewCancel'), style: 'cancel', onPress: onDismiss },
            {
              text: t('plant.reviewSubmit'),
              onPress: () => {
                const url = Platform.OS === 'ios' ? APP_STORE_REVIEW_URL_IOS : PLAY_STORE_REVIEW_URL_ANDROID;
                Linking.openURL(url).catch(() => {});
                AsyncStorage.setItem(REVIEW_PROMPT_LAST_SHOWN_KEY, String(Date.now()));
                onDismiss();
              },
            },
          ]
        );
        await AsyncStorage.setItem(REVIEW_PROMPT_LAST_SHOWN_KEY, String(now));
      } catch {
        onDismiss();
      }
    })();
  }, [t]);

  const handleClose = () => tryShowReviewDialog(() => navigation.goBack());

  // Tab press — expand first if collapsed; disable scroll-based tab sync until scroll ends
  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    ignoreScrollSyncRef.current = true;
    const goToSection = () => {
      const y = sectionPositions.current[tab];
      if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
    };
    if (!isExpandedRef.current) {
      doExpand(goToSection);
    } else {
      goToSection();
    }
  };

  const onSectionLayout = (tab: string) => (e: any) => {
    sectionPositions.current[tab] = e.nativeEvent.layout.y;
  };

  // Sync active tab with visible section on scroll; keep scroll Y for collapse guard
  const SCROLL_TAB_THRESHOLD = 100;
  const handleContentScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    contentScrollYRef.current = y;
    if (!isExpandedRef.current) return;
    if (ignoreScrollSyncRef.current) return; // User tapped a tab — don't override selection until scroll ends
    const positions = sectionPositions.current;
    const tabs = ['overview', 'care', 'diseases', 'journal'] as const;
    let next: string = 'overview';
    for (const tab of tabs) {
      if (positions[tab] != null && positions[tab] <= y + SCROLL_TAB_THRESHOLD) next = tab;
    }
    setActiveTab((prev) => (prev === next ? prev : next));
  }, []);

  // ---- Garden actions ----
  const handleAddToGarden = async () => {
    if (!isLoggedIn) { navigation.navigate('Started'); return; }
    if (!plant) return;
    try {
      const { data: groups } = await getGroups(userCollection.id);
      if (groups && groups.length > 0) {
        setAvailableGroups(groups as Group[]);
        setGroupSelectVisible(true);
      } else {
        await saveToGarden(undefined);
      }
    } catch { await saveToGarden(undefined); }
  };

  const saveToGarden = async (groupId?: string) => {
    if (!plant) return;
    if (!userCollection?.id) {
      Alert.alert(t('common.error'), t('plant.signInToAdd'));
      return;
    }
    setSaving(true);
    setGroupSelectVisible(false);
    try {
      const cpStr = typeof plant.careplan === 'string' ? plant.careplan : JSON.stringify(plant.careplan ?? {});
      // disease & journals are json[] in DB – must be real arrays, not a single object or string
      let diseaseArr: any[] = [];
      if (plant.disease != null) {
        if (Array.isArray(plant.disease)) diseaseArr = plant.disease;
        else if (typeof plant.disease === 'string') {
          try { diseaseArr = JSON.parse(plant.disease); if (!Array.isArray(diseaseArr)) diseaseArr = [diseaseArr]; } catch { diseaseArr = []; }
        } else diseaseArr = [plant.disease];
      }
      const journalsArr = Array.isArray(plant.journals) ? plant.journals : [];
      // garden table: no 'group' column; disease/journals are json[]
      const payload: Record<string, any> = {
        name: plant.name ?? '',
        description: plant.description ?? null,
        images: plant.images ?? [],
        labels: plant.labels ?? [],
        overview: typeof plant.overview === 'string' ? plant.overview : JSON.stringify(plant.overview ?? {}),
        careplan: cpStr,
        customcareplan: cpStr,
        disease: diseaseArr,
        journals: journalsArr,
        user: userCollection.id,
      };
      const result = await addPlantToGarden(payload);

      if (result.error) {
        console.error('[Plant] addPlantToGarden error:', result.error);
        Alert.alert(t('common.error'), result.error.message || t('plant.errorAdd'));
        return;
      }

      if (result.data) {
        const gardenId = String(result.data.id);
        const cp = safeParse(cpStr);
        if (cp && notifications) {
          const notifResult = await scheduleCareplanNotificationsForPlant(plant.name ?? 'Plant', gardenId, cp).catch(() => ({ ok: false, error: t('plant.remindersNotSet') }));
          if (notifResult && !notifResult.ok) {
            setSnackMessage(notifResult.error ?? t('plant.remindersNotSet'));
            setSnackVisible(true);
          }
        }
        // Add new plant to selected group's plant_id array
        if (groupId) {
          const group = availableGroups.find((g) => g.id === groupId);
          const currentIds = (group?.plant_id ?? []).map((id) => (typeof id === 'number' ? id : String(id)));
          const newId = result.data.id;
          const { error: groupErr } = await addPlantToGroup(groupId, newId, currentIds);
          if (groupErr) console.warn('[Plant] addPlantToGroup failed:', groupErr);
        }
        // UI yangilansin – qayta "Add to Garden" ko‘rinmasin, "See your Garden" chiqsin
        setGardenPlant(result.data);
      }

      Alert.alert(t('plant.success'), t('plant.addedToGarden'), [
        { text: t('plant.viewGarden'), onPress: () => navigation.navigate('MyGarden') },
        { text: t('plant.ok') },
      ]);
    } catch (e) {
      console.error('[Plant] saveToGarden error:', e);
      Alert.alert(t('common.error'), t('plant.errorAdd'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirmAlert(t('plant.deleteConfirmTitle'), t('plant.deleteConfirmMessage'), async () => {
      if (!plantId || !userCollection?.id) return;
      try {
        const idStr = String(plantId);
        const { data: groups } = await getGroups(userCollection.id);
        const groupsWithPlant = (groups || []).filter(
          (g: any) => g.plant_id && g.plant_id.some((id: any) => String(id) === idStr)
        );
        for (const group of groupsWithPlant) {
          await removePlantFromGroup(group.id, plantId, group.plant_id ?? []);
        }
        await deleteGardenPlant(idStr);
        navigation.goBack();
      } catch { Alert.alert(t('common.error'), t('plant.errorDelete')); }
    });
  };

  const handleSeeGarden = () => {
    const doNavigate = () => {
      if (gardenPlant) {
        setPlant(gardenPlant);
        navigation.setParams({ plantId: gardenPlant.id, isGarden: true, snap: gardenPlant });
      } else {
        navigation.navigate('MyGarden');
      }
    };
    tryShowReviewDialog(doNavigate);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={COLORS.textSecondary} />
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
        <Text style={styles.errorText}>Plant not found</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={handleClose}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderBottomButton = () => {
    if (isGarden) {
      return (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Plant</Text>
        </TouchableOpacity>
      );
    }
    if (checkedGarden && gardenPlant) {
      return (
        <TouchableOpacity style={styles.seeGardenBtn} onPress={handleSeeGarden}>
          <Text style={styles.seeGardenBtnText}>{t('plant.seeGarden')}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.addBtn, saving && styles.btnDisabled]}
        onPress={handleAddToGarden}
        disabled={saving}
      >
        <Text style={styles.addBtnText}>{saving ? t('plant.adding') : t('plant.addToMyGarden')}</Text>
      </TouchableOpacity>
    );
  };

  // ======================== RENDER ========================
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      {/* Background Image */}
      <View style={styles.imageArea}>
        <Animated.FlatList
          data={images.length > 0 ? images : [PLACEHOLDER_IMAGE]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={images.length > 1}
          keyExtractor={(_: any, i: number) => String(i)}
          onMomentumScrollEnd={(e: any) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: imageScrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          renderItem={({ item }: any) => (
            <TouchableOpacity
              style={{ width, height: IMAGE_HEIGHT }}
              onPress={() => setImageGalleryVisible(true)}
              activeOpacity={1}
            >
              <Image
                source={typeof item === 'string' ? { uri: item } : item}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => {
              const dotWidth = imageScrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [8, 20, 8],
                extrapolate: 'clamp',
              });
              const dotOpacity = imageScrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.4, 1, 0.4],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={i}
                  style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: '#fff' }]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Full-screen image gallery modal (tap image to expand, swipe to browse) */}
      <Modal
        visible={imageGalleryVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setImageGalleryVisible(false)}
      >
        <View style={styles.galleryOverlay}>
          <View style={[styles.galleryCloseWrap, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={[styles.galleryCloseBtn, { backgroundColor: theme.card }]}
              onPress={() => setImageGalleryVisible(false)}
            >
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            ref={galleryListRef}
            data={images.length > 0 ? images : [PLACEHOLDER_IMAGE]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_: any, i: number) => String(i)}
            initialScrollIndex={imageIndex}
            getItemLayout={(_: any, index: number) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={(e: any) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }: any) => (
              <View style={styles.galleryItem}>
                <Image
                  source={typeof item === 'string' ? { uri: item } : item}
                  style={styles.galleryImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />
          {images.length > 1 && (
            <View style={[styles.galleryCounter, { bottom: insets.bottom + 24 }]}>
              <Text style={styles.galleryCounterText}>
                {imageIndex + 1} / {images.length > 0 ? images.length : 1}
              </Text>
            </View>
          )}
        </View>
      </Modal>

      {/* ---- Animated Sheet ---- */}
      <Animated.View {...panResponder.panHandlers} style={[styles.sheet, { transform: [{ translateY: sheetY }], backgroundColor: theme.backgroundSecondary }]}>
        {/* Safe area spacer (grows when expanded) */}
        <Animated.View style={{ height: spacerHeight }} />

        {/* Handle line (6px, fades when expanded) */}
        <Animated.View style={[styles.handleWrap, { opacity: handleOpacity, paddingVertical: handlePadding }]}>
          <Animated.View style={[styles.headerHandle, { height: handleAnimHeight, backgroundColor: theme.borderLight }]} />
        </Animated.View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={[styles.plantName, { color: theme.text }]}>{plant.name}</Text>
          {plant.description ? <Text style={[styles.plantScientific, { color: theme.textSecondary }]}>{plant.description}</Text> : null}
          {confidence ? (
            <View style={styles.confidenceRow}>
              <CheckCircle size={18} color={theme.primary} weight="fill" />
              <Text style={[styles.confidenceText, { color: theme.primary }]}>{confidence}% confidence</Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
            {(['overview', 'care', 'diseases', 'journal'] as string[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabBtn,
                  { backgroundColor: theme.backgroundTertiary },
                  activeTab === tab && { backgroundColor: isDark ? '#FFFFFF' : '#18191C' },
                ]}
                onPress={() => handleTabPress(tab)}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: theme.textSecondary },
                    activeTab === tab && { color: isDark ? '#18191C' : '#FFFFFF' },
                  ]}
                >
                  {tab === 'overview' ? t('plant.overview') : tab === 'care' ? t('plant.care') : tab === 'diseases' ? t('plant.diseasesTab') : t('plant.journal')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content (scrollable only when expanded) */}
        <ScrollView
          ref={scrollRef}
          scrollEnabled={isExpanded}
          style={styles.contentScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleContentScroll}
          onScrollEndDrag={handleContentScrollEndDrag}
          onMomentumScrollEnd={() => { ignoreScrollSyncRef.current = false; }}
          scrollEventThrottle={16}
          bounces
        >
          <View style={[styles.contentArea, { backgroundColor: theme.backgroundSecondary }]}>
            {/* Help card */}
            <TouchableOpacity
              style={[styles.helpCard, { backgroundColor: theme.card }]}
              onPress={() => {
                if (!isPro) {
                  navigation.navigate('Pro', { fromPlantHelp: true });
                  return;
                }
                const plantName = plant?.name || 'this plant';
                const firstImg = Array.isArray(images) && images.length > 0 ? images[0] : undefined;
                const contextMessage = t('plant.helpContext', { name: plantName });
                navigation.navigate('Chat', {
                  plantImage: firstImg,
                  plantContextMessage: contextMessage,
                });
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.helpIcon, { backgroundColor: "transparent" }]}>
                <Sparkle size={35} color={theme.primary} weight="fill" />
              </View>
              <View style={styles.helpInfo}>
                <Text style={[styles.helpTitle, { color: theme.text }]}>{t('plant.needHelp')}</Text>
                <Text style={[styles.helpSubtitle, { color: theme.textSecondary }]}>{t('plant.mrOliver')}</Text>
              </View>
              <CaretRight size={22} color={theme.textSecondary} weight="bold"/>
            </TouchableOpacity>

            {/* Labels */}
            {labels.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.labelsScroll}>
                {labels.map((label, i) => (
                  <View key={i} style={[styles.labelChip, { backgroundColor: theme.backgroundTertiary, borderColor: theme.borderLight }]}>
                    <Text style={[styles.labelText, { color: theme.primary }]}>{label}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* OVERVIEW */}
            <View onLayout={onSectionLayout('overview')}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('plant.about')}</Text>
              {overview ? (
                <View style={[styles.overviewContainer, { backgroundColor: theme.card }]}>
                  {(() => {
                    const items = OVERVIEW_KEYS.map(({ key, labelKey }) => {
                      const item = overview[key] || overview[key.charAt(0).toLowerCase() + key.slice(1)];
                      if (!item) return null;
                      return { key, labelKey, item };
                    }).filter(Boolean) as { key: string; labelKey: string; item: any }[];

                    return items.map((entry, idx) => (
                      <React.Fragment key={entry.key}>
                        {idx > 0 && <View style={[styles.overviewDivider, { backgroundColor: theme.borderLight }]} />}
                        <TouchableOpacity style={[styles.overviewRow, { backgroundColor: theme.card }]} activeOpacity={0.7} onPress={() => setSelectedOverview(entry)}>
                          <Image
                            source={OVERVIEW_ICONS[entry.key]}
                            style={[styles.overviewIcon, { backgroundColor: theme.cardElevated }]}
                            resizeMode="contain"
                          />
                          <View style={styles.overviewInfo}>
                            <Text style={[styles.overviewLabel, { color: theme.text }]}>{t(entry.labelKey)}</Text>
                            <Text style={[styles.overviewDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                              {entry.item.mainDescription?.replace(/^[^\s]+\s/, '') || ''}
                            </Text>
                          </View>
                          <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
                        </TouchableOpacity>
                      </React.Fragment>
                    ));
                  })()}
                </View>
              ) : <Text style={[styles.emptySection, { color: theme.textTertiary }]}>{t('plant.noOverview')}</Text>}
            </View>

            {/* CARE */}
            <View onLayout={onSectionLayout('care')}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('plant.carePlan')}</Text>
              {activeCareplan ? (
                <View style={[styles.careContainer, { backgroundColor: theme.card }]}>
                  {CARE_KEYS.map(({ key, labelKey }, index) => {
                    const item = activeCareplan[key] || activeCareplan[key.charAt(0).toLowerCase() + key.slice(1)];
                    if (!item) return null;
                    const rawRepeat = formatRepeat(item);
                    const repeatText = rawRepeat === 'Every day' ? t('carePlan.everyDay') : rawRepeat === 'Every week' ? t('carePlan.everyWeek') : rawRepeat || t('carePlan.notSet');
                    return (
                      <React.Fragment key={key}>
                        {index > 0 && <View style={[styles.careDivider, { backgroundColor: theme.borderLight }]} />}
                        <TouchableOpacity
                          style={styles.careRow}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (!isGarden) {
                              if (checkedGarden && gardenPlant) {
                                Alert.alert(
                                  t('plant.alreadyInGarden'),
                                  t('plant.alreadyInGardenMessage'),
                                  [
                                    { text: t('garden.cancel'), style: 'cancel' },
                                    { text: t('plant.seeGarden'), onPress: handleSeeGarden },
                                  ],
                                );
                              } else {
                                Alert.alert(
                                  t('plant.addToGarden'),
                                  t('plant.addToGardenMessage'),
                                  [
                                    { text: t('garden.cancel'), style: 'cancel' },
                                    { text: t('plant.addToGarden'), onPress: handleAddToGarden },
                                  ],
                                );
                              }
                              return;
                            }
                            navigation.navigate('CarePlanDetail', {
                              plantName: plant.name,
                              careKey: key,
                              careLabel: t(labelKey),
                              careItem: item,
                              plantId: plantId || plant?.id,
                              isGarden,
                            });
                          }}
                        >
                          <View style={[styles.careIconWrap, { backgroundColor: theme.cardElevated }]}>
                            <Image source={CARE_ICONS[key]} style={styles.careIconImg} resizeMode="contain" />
                          </View>
                          <Text style={[styles.careLabel, { color: theme.text }]}>{t(labelKey)}</Text>
                          <View style={styles.careRight}>
                            <Text style={[styles.careRepeat, { color: theme.textSecondary }]}>{repeatText}</Text>
                            <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
                          </View>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>
              ) : <Text style={[styles.emptySection, { color: theme.textTertiary }]}>No care plan available</Text>}
            </View>

            {/* DISEASES */}
            <View onLayout={onSectionLayout('diseases')}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('plant.diseases')}</Text>
              {diseases.length > 0 ? diseases.map((d: any, i: number) => (
                <TouchableOpacity key={i} style={[styles.diseaseRow, { backgroundColor: theme.card }]} onPress={() => setSelectedDisease(d)} activeOpacity={0.7}>
                  {d.image ? (
                    <Image source={{ uri: d.image }} style={styles.diseaseImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.diseaseImg, styles.diseaseImgPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                      <Bug size={20} color={theme.textTertiary} />
                    </View>
                  )}
                  <Text style={[styles.diseaseTitle, { color: theme.text }]}>{d.title}</Text>
                  <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
                </TouchableOpacity>
              )) : <Text style={[styles.emptySection, { color: theme.textTertiary }]}>{t('plant.noDiseases')}</Text>}
            </View>

            {/* JOURNAL */}
            <View onLayout={onSectionLayout('journal')}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Care Weekly History</Text>
              <View style={[styles.journalTable, { backgroundColor: theme.card }]}>
                <View style={[styles.journalHeader, { borderBottomColor: theme.borderLight }]}>
                  <Text style={[styles.journalHeaderCell, styles.journalHeaderTask, { color: theme.textSecondary }]}>Task</Text>
                  <Text style={[styles.journalHeaderCell, styles.journalHeaderTime, { color: theme.textSecondary }]}>Time</Text>
                  <Text style={[styles.journalHeaderCell, styles.journalHeaderStatus, { color: theme.textSecondary }]}>Status</Text>
                </View>
                {journalList.length > 0 ? journalList.map((j: any, i: number) => (
                  <View key={`${j.Time || j.time}-${i}`} style={[styles.journalRow, { borderBottomColor: theme.borderLight }]}>
                    <Text style={[styles.journalCell, styles.journalCellTask, { color: theme.text }]} numberOfLines={1}>{j.Task || j.task}</Text>
                    <Text style={[styles.journalCell, styles.journalCellTime, { color: theme.textSecondary }]}>
                      {formatJournalTime(j.Time || j.time)}
                    </Text>
                    <View style={styles.journalStatusWrap}>
                      <View style={[
                        styles.journalStatusChip,
                        (j.Status || j.status) === 'Done'
                          ? [styles.journalDoneChip, isDark && { backgroundColor: 'rgba(31,200,92,0.25)' }]
                          : (j.Status || j.status) === 'Skipped'
                            ? [styles.journalSkippedChip, isDark && { backgroundColor: 'rgba(245,158,11,0.25)' }]
                            : [styles.journalPendingChip, { backgroundColor: theme.backgroundTertiary }],
                      ]}>
                        <Text style={[
                          styles.journalStatusText,
                          (j.Status || j.status) === 'Done'
                            ? [styles.journalDoneText, { color: theme.primary }]
                            : (j.Status || j.status) === 'Skipped'
                              ? [styles.journalSkippedText, { color: '#F59E0B' }]
                              : [styles.journalPendingText, { color: theme.textTertiary }],
                        ]}>
                          {j.Status || j.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                )) : (
                  <View style={styles.journalEmpty}>
                    <Timer size={32} color={theme.textTertiary} />
                    <Text style={[styles.journalEmptyText, { color: theme.textTertiary }]}>Care History is currently empty</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Close Button */}
      <View style={[styles.closeBtnWrap, { top: insets.top + 8 }]}>
        <Animated.View style={[styles.closeBtnCircle, styles.closeBtnImage, { opacity: closeBtnImageOpacity }]} pointerEvents="none">
          <X size={22} color="#fff" />
        </Animated.View>
        <Animated.View style={[styles.closeBtnCircle, styles.closeBtnStickyBg, { opacity: closeBtnStickyOpacity, backgroundColor: theme.card }]} pointerEvents="none">
          <X size={22} color={theme.text} />
        </Animated.View>
        <TouchableOpacity style={styles.closeBtnHitArea} onPress={handleClose} activeOpacity={0.7} />
      </View>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.md, backgroundColor: theme.card }]}>
        {renderBottomButton()}
      </View>

      {/* Disease Detail Modal */}
      <Modal visible={!!selectedDisease} animationType="none" transparent onRequestClose={closeDiseaseSheet}>
        <Animated.View style={[styles.diseaseModalOverlay, { opacity: diseaseOverlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeDiseaseSheet} />
          <Animated.View style={[styles.diseaseModalSheet, { transform: [{ translateY: diseaseSheetY }], backgroundColor: theme.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.borderLight }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.diseaseModalContent}>
              <View style={styles.diseaseModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.diseaseModalTitle, { color: theme.text }]}>{selectedDisease?.title}</Text>
                  <Text style={[styles.diseaseModalPlant, { color: theme.textSecondary }]}>{plant?.name}</Text>
                </View>
                <TouchableOpacity style={[styles.diseaseModalCloseBtn, { backgroundColor: theme.backgroundTertiary }]} onPress={closeDiseaseSheet}>
                  <X size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              {selectedDisease?.image && (
                <Image source={{ uri: selectedDisease.image }} style={styles.diseaseModalImage} resizeMode="cover" />
              )}
              {selectedDisease?.description ? <Text style={[styles.diseaseModalDesc, { color: theme.text }]}>{selectedDisease.description}</Text> : null}
              {(selectedDisease?.nagitive || selectedDisease?.negative) ? (
                <View style={[styles.causeCard, { backgroundColor: theme.cardElevated }]}>
                  <Text style={[styles.causeText, { color: theme.text }]}>{'\u26A0\uFE0F'} Cause: {selectedDisease.nagitive || selectedDisease.negative}</Text>
                </View>
              ) : null}
              {selectedDisease?.fix ? (
                <View style={[styles.fixCard, { backgroundColor: theme.cardElevated }]}>
                  <Text style={[styles.fixText, { color: theme.text }]}>{'\u2B50'} Fix: {selectedDisease.fix}</Text>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Group Selection Modal */}
      <Modal visible={groupSelectVisible} animationType="none" transparent onRequestClose={closeGroupSheet}>
        <Animated.View style={[styles.groupModalOverlay, { opacity: groupOverlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeGroupSheet} />
          <Animated.View style={[styles.groupModalSheet, { transform: [{ translateY: groupSheetY }], backgroundColor: theme.background }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.modalHandle, { backgroundColor: theme.borderLight }]} />
            <Text style={[styles.groupModalTitle, { color: theme.text }]}>Select Space</Text>
            <Text style={[styles.groupModalSubtitle, { color: theme.textSecondary }]}>Choose where to add this plant</Text>
            {availableGroups.map((group) => (
              <TouchableOpacity key={group.id} style={[styles.groupModalRow, { borderBottomColor: theme.borderLight }]} onPress={() => saveToGarden(group.id)} activeOpacity={0.7}>
                <View style={[styles.groupModalIcon, { backgroundColor: theme.backgroundTertiary }]}>
                  <FolderOpen size={20} color={theme.primary} />
                </View>
                <Text style={[styles.groupModalName, { color: theme.text }]}>{group.name}</Text>
                <CaretRight size={18} color={theme.textSecondary} weight="bold"/>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Overview Detail Bottom Sheet */}
      <Modal visible={!!selectedOverview} animationType="none" transparent onRequestClose={closeOverviewSheet}>
        <Animated.View style={[styles.overviewModalOverlay, { opacity: overviewOverlay }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeOverviewSheet} />
          <Animated.View style={[styles.overviewModalSheet, { transform: [{ translateY: overviewSheetY }], backgroundColor: theme.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.borderLight }]} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.overviewModalContent} bounces={false}>
              {/* Header row */}
              <View style={styles.overviewModalHeader}>
                <Text style={[styles.overviewModalTitle, { color: theme.text }]}>{selectedOverview ? t(selectedOverview.labelKey) : ''}</Text>
                <TouchableOpacity style={[styles.overviewModalClose, { backgroundColor: theme.backgroundTertiary }]} onPress={closeOverviewSheet}>
                  <X size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              {/* Main description */}
              <Text style={[styles.overviewModalMainDesc, { color: theme.text }]}>
                {selectedOverview?.item?.mainDescription || ''}
              </Text>

              {/* About sections */}
              {selectedOverview?.item?.about?.map((section: any, sIdx: number) => (
                <View key={sIdx} style={styles.overviewModalSection}>
                  <Text style={[styles.overviewModalSectionTitle, { color: theme.text }]}>{section.title}</Text>
                  {section.list?.map((bullet: string, bIdx: number) => (
                    <View key={bIdx} style={styles.overviewModalBulletRow}>
                      <Text style={[styles.overviewModalBulletDot, { color: theme.text }]}>{'\u2022'}</Text>
                      <Text style={[styles.overviewModalBulletText, { color: theme.text }]}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ))}

              {/* Negative / warning */}
              {selectedOverview?.item?.negative ? (
                <View style={[styles.overviewModalWarning, { backgroundColor: theme.errorContainer }]}>
                  <Text style={[styles.overviewModalWarningText, { color: theme.error }]}>
                    {'\u26A0\uFE0F'} {selectedOverview.item.negative}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {snackVisible && (
        <View style={[styles.snackbar, { backgroundColor: theme.card, borderColor: theme.textTertiary, bottom: insets.bottom + 88 }]} pointerEvents="box-none">
          <Text style={[styles.snackbarText, { color: theme.text }]}>{snackMessage}</Text>
          <TouchableOpacity onPress={() => setSnackVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.snackbarDismiss, { color: theme.primary }]}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  snackbar: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  snackbarText: { flex: 1, fontSize: FONT_SIZES.md },
  snackbarDismiss: { fontSize: FONT_SIZES.md, fontWeight: '600', marginLeft: SPACING.md },
  errorText: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  goBackBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.round },
  goBackBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZES.md },

  // Background image
  imageArea: { height: IMAGE_HEIGHT, width: '100%', backgroundColor: '#E0E0E0' },
  heroImage: { width, height: IMAGE_HEIGHT },
  dots: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  // Full-screen image gallery
  galleryOverlay: { flex: 1, backgroundColor: '#000' },
  galleryCloseWrap: { position: 'absolute', right: 16, zIndex: 10 },
  galleryCloseBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  galleryItem: { width, height: SCREEN_HEIGHT, justifyContent: 'center' },
  galleryImage: { width, height: SCREEN_HEIGHT },
  galleryCounter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  galleryCounterText: { fontSize: FONT_SIZES.md, color: 'rgba(255,255,255,0.9)' },

  // Sheet (absolute, snaps collapsed/expanded)
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#F8F8F8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  // Handle (6px with 16px vertical padding)
  handleWrap: {
    alignSelf: 'center',
  },
  headerHandle: {
    width: 40,
    borderRadius: 3,
    backgroundColor: '#CDCDCD',
    overflow: 'hidden',
  },

  // Sheet header (PanResponder area)
  sheetHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  plantName: { fontSize: 26, fontWeight: '700', color: COLORS.text },
  plantScientific: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginTop: 2 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  confidenceText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '500' },
  labelsScroll: { marginBottom: SPACING.md },
  labelChip: { backgroundColor: '#F0F9F0', borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, marginRight: SPACING.sm, borderWidth: 1, borderColor: '#D4EDD4' },
  labelText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '500' },
  tabsScroll: { marginTop: SPACING.md, marginBottom: SPACING.xs },
  tabsContent: { gap: SPACING.sm },
  tabBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.round, backgroundColor: '#EBEBEB' },
  tabBtnActive: { backgroundColor: COLORS.text },
  tabBtnText: { fontSize: FONT_SIZES.md, fontWeight: '500', color: COLORS.textSecondary },
  tabBtnTextActive: { color: '#fff' },

  // Content scroll & area
  contentScroll: { flex: 1 },
  contentArea: { backgroundColor: '#F8F8F8', paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

  // Help card
  helpCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: SPACING.lg, marginBottom: SPACING.xl, paddingLeft: SPACING.md, paddingVertical: 12 },
  helpIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  helpInfo: { flex: 1 },
  helpTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text },
  helpSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  // Section
  sectionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg, marginTop: SPACING.md },
  emptySection: { fontSize: FONT_SIZES.md, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: SPACING.xl },

  // Overview
  overviewContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginBottom: SPACING.xl,
  },
  overviewDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  overviewIcon: {
    width:48,
    height: 48,
    borderRadius: 14,
    marginRight: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  overviewInfo: { flex: 1 },
  overviewLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text },
  overviewDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },

  // Care
  careContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 14 },
  careDivider: { height: 1, backgroundColor: '#F0F0F0' },
  careRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  careIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F5F5F6', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  careIconImg: { width: 42, height: 42 },
  careLabel: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.text, flex: 1 },
  careRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  careRepeat: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },

  // Disease
  diseaseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm },
  diseaseImg: { width: 48, height: 48, borderRadius: RADIUS.md, marginRight: SPACING.md, backgroundColor: '#F5F5F5' },
  diseaseImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  diseaseTitle: { flex: 1, fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text },

  // Journal (no dividers; THead 16px 600 textSecondary, TBody task 16px 500 text, time 16px 500 textSecondary)
  journalTable: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
  },
  journalHeaderCell: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  journalHeaderTask: { flex: 1 },
  journalHeaderTime: { flex: 1, textAlign: 'center' },
  journalHeaderStatus: { width: 84, textAlign: 'right' },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  journalCell: { fontSize: 15, fontWeight: '500' },
  journalCellTask: { flex: 1, color: COLORS.text },
  journalCellTime: { flex: 1, textAlign: 'center', color: COLORS.textSecondary },
  journalStatusWrap: { width: 84, alignItems: 'flex-end' },
  journalStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  journalDoneChip: { backgroundColor: '#E8F5E9' },
  journalSkippedChip: { backgroundColor: '#FFF8E1' },
  journalPendingChip: { backgroundColor: '#F5F5F5' },
  journalStatusText: { fontSize: 12, fontWeight: '600' },
  journalDoneText: { color: COLORS.primary },
  journalSkippedText: { color: '#F59E0B' },
  journalPendingText: { color: COLORS.textTertiary },
  journalEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  journalEmptyText: { fontSize: FONT_SIZES.md, color: COLORS.textTertiary, marginTop: SPACING.sm },

  // Close button
  closeBtnWrap: { position: 'absolute', right: 16, width: 36, height: 36, zIndex: 100 },
  closeBtnCircle: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnImage: { backgroundColor: 'rgba(0,0,0,0.35)' },
  closeBtnStickyBg: { backgroundColor: '#F0F0F0' },
  closeBtnHitArea: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderRadius: 18 },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, backgroundColor: '#fff' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.round, paddingVertical: SPACING.lg, alignItems: 'center' },
  addBtnText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#fff' },
  seeGardenBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.round, paddingVertical: SPACING.lg, alignItems: 'center' },
  seeGardenBtnText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#fff' },
  deleteBtn: { backgroundColor: '#FF5252', borderRadius: RADIUS.round, paddingVertical: SPACING.lg, alignItems: 'center' },
  deleteBtnText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.5 },

  // Disease Modal
  diseaseModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  diseaseModalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingTop: SPACING.md },
  diseaseModalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  diseaseModalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.md },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.lg },
  diseaseModalContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  diseaseModalTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  diseaseModalPlant: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  diseaseModalImage: { width: '100%', height: 200, borderRadius: RADIUS.lg, marginBottom: SPACING.lg },
  diseaseModalDesc: { fontSize: FONT_SIZES.md, color: COLORS.text, lineHeight: 22, marginBottom: SPACING.lg },
  causeCard: { backgroundColor: '#FFEBEE', borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  causeText: { fontSize: FONT_SIZES.md, color: '#E53935', lineHeight: 22 },
  fixCard: { backgroundColor: '#E8F5E9', borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  fixText: { fontSize: FONT_SIZES.md, color: COLORS.primary, lineHeight: 22 },

  // Group Modal
  groupModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  groupModalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: SPACING.md, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl + 16 },
  groupModalTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.xs },
  groupModalSubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.xl },
  groupModalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  groupModalIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  groupModalName: { flex: 1, fontSize: FONT_SIZES.lg, fontWeight: '500', color: COLORS.text },

  // Overview Detail Bottom Sheet
  overviewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  overviewModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: SPACING.md,
  },
  overviewModalContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
  },
  overviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  overviewModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  overviewModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewModalMainDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  overviewModalSection: {
    marginBottom: SPACING.lg,
  },
  overviewModalSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  overviewModalBulletRow: {
    flexDirection: 'row',
    paddingRight: SPACING.md,
    marginBottom: 6,
  },
  overviewModalBulletDot: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginRight: 8,
    lineHeight: 22,
  },
  overviewModalBulletText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  overviewModalWarning: {
    backgroundColor: '#FFF0F0',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  overviewModalWarningText: {
    fontSize: FONT_SIZES.md,
    color: '#D32F2F',
    lineHeight: 22,
  },
});

// Article da blur qilish kerak titleni background ini