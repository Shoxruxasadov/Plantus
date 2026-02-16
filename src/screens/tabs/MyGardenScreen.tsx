import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Animated,
  LayoutChangeEvent,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Leaf, Plus, PlusCircle, CaretRight, Camera, Info, PencilSimple, Trash, Plant as PlantIcon } from 'phosphor-react-native';

import { RootStackParamList, Plant, Group } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS, PLACEHOLDER_IMAGE } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useAppStore } from '../../store/appStore';
import {
  getGardenPlants,
  getGroups,
  getSnaps,
  deleteSnap,
  createGroup,
  deleteGroup,
  deleteGardenPlant,
  removePlantFromGroup,
  updateGroup,
  updateGardenPlant,
} from '../../services/supabase';
import { hasTaskDueToday } from '../../utils/helpers';

const TABS: { key: TabType; label: string }[] = [
  { key: 'garden', label: 'My Garden' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'history', label: 'Snap History' },
];

// ---- Reminder helpers ----
const CARE_ICONS: Record<string, any> = {
  Watering: require('../../../assets/images/Careplan1.png'),
  Fertilize: require('../../../assets/images/Careplan2.png'),
  Repotting: require('../../../assets/images/Careplan3.png'),
  Pruning: require('../../../assets/images/Careplan4.png'),
  Humidity: require('../../../assets/images/Careplan5.png'),
  Soilcheck: require('../../../assets/images/Careplan6.png'),
};
const CARE_LABELS: Record<string, string> = {
  Watering: 'Watering', Fertilize: 'Fertilize', Repotting: 'Repotting',
  Pruning: 'Pruning', Humidity: 'Humidity', Soilcheck: 'Soil check',
};
function safeParse(val: any) {
  if (!val) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function todayStart() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function getTodayJournal(journals: any[], taskKey: string): any | null {
  const today = todayStart();
  return journals.find((j) => {
    if ((j.Task || j.task) !== taskKey) return false;
    const time = j.Time || j.time;
    return time ? isSameDay(new Date(time), today) : false;
  }) || null;
}

interface ReminderPlant {
  id: string; name: string; image: string;
  tasks: { key: string; label: string; status: 'pending' | 'Done' | 'Skipped' }[];
  journals: any[];
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'garden' | 'reminders' | 'history';

export default function MyGardenScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isLoggedIn, userCollection, darkMode } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('garden');
  const [plants, setPlants] = useState<Plant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reminders data
  const [reminderPlants, setReminderPlants] = useState<ReminderPlant[]>([]);

  // Animated tab indicator
  const tabWidths = useRef<number[]>([0, 0, 0]).current;
  const tabXs = useRef<number[]>([0, 0, 0]).current;
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;

  // Selected space
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Create Space modal
  const [createSpaceVisible, setCreateSpaceVisible] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const createSpaceOverlay = useRef(new Animated.Value(0)).current;
  const createSpaceScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (createSpaceVisible) {
      createSpaceOverlay.setValue(0);
      createSpaceScale.setValue(0);
      Animated.parallel([
        Animated.timing(createSpaceOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(createSpaceScale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [createSpaceVisible]);
  const closeCreateSpaceSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(createSpaceOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(createSpaceScale, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setCreateSpaceVisible(false);
      setSpaceName('');
    });
  }, []);

  // Options modal
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const OPTIONS_SHEET_Y = Dimensions.get('window').height;
  const optionsOverlay = useRef(new Animated.Value(0)).current;
  const optionsSheetY = useRef(new Animated.Value(OPTIONS_SHEET_Y)).current;
  useEffect(() => {
    if (optionsVisible) {
      optionsOverlay.setValue(0);
      optionsSheetY.setValue(OPTIONS_SHEET_Y);
      Animated.parallel([
        Animated.timing(optionsOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(optionsSheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [optionsVisible]);
  const closeOptionsSheet = useCallback((afterClose?: () => void) => {
    Animated.parallel([
      Animated.timing(optionsOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(optionsSheetY, { toValue: OPTIONS_SHEET_Y, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setOptionsVisible(false);
      afterClose?.();
    });
  }, []);

  // Edit Name modal
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const editOverlay = useRef(new Animated.Value(0)).current;
  const editScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (editVisible) {
      editOverlay.setValue(0);
      editScale.setValue(0);
      Animated.parallel([
        Animated.timing(editOverlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(editScale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [editVisible]);
  const closeEditSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(editOverlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(editScale, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setEditVisible(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        loadData();
      } else {
        setLoading(false);
      }
    }, [isLoggedIn])
  );

  const loadData = async () => {
    if (!userCollection.id) return;

    try {
      const [plantsResult, groupsResult] = await Promise.all([
        getGardenPlants(userCollection.id),
        getGroups(userCollection.id),
      ]);

      if (plantsResult.data) {
        setPlants(plantsResult.data as Plant[]);
        buildReminders(plantsResult.data as Plant[]);
      }
      if (groupsResult.data) {
        setGroups(groupsResult.data as Group[]);
        // Auto-select first group if none selected
        if (!selectedGroupId && groupsResult.data.length > 0) {
          setSelectedGroupId(groupsResult.data[0].id);
        }
      }

      // Load snaps for history
      try {
        const snapsResult = await getSnaps(userCollection.id);
        if (snapsResult.data) {
          setSnaps(snapsResult.data);
        }
      } catch (_e) {
        // snaps may not exist
      }
    } catch (error) {
      console.error('Load garden data error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build reminders from plants
  const buildReminders = (allPlants: Plant[]) => {
    const result: ReminderPlant[] = [];
    for (const plant of allPlants) {
      const cp = safeParse((plant as any).customcareplan) || safeParse((plant as any).careplan);
      if (!cp || typeof cp !== 'object') continue;

      let journals: any[] = [];
      if ((plant as any).journals) {
        if (Array.isArray((plant as any).journals)) {
          journals = (plant as any).journals.map((j: any) => (typeof j === 'string' ? safeParse(j) : j)).filter(Boolean);
        }
      }

      const tasks: ReminderPlant['tasks'] = [];
      for (const careKey of Object.keys(CARE_LABELS)) {
        const item = cp[careKey] || cp[careKey.charAt(0).toLowerCase() + careKey.slice(1)];
        if (!item) continue;
        const repeat = item.Repeat || item.repeat;
        if (!repeat || repeat === 'NotSet') continue;
        if (!hasTaskDueToday(cp, careKey)) continue;

        const todayEntry = getTodayJournal(journals, careKey);
        let status: 'pending' | 'Done' | 'Skipped' = 'pending';
        if (todayEntry) {
          status = (todayEntry.Status || todayEntry.status) === 'Done' ? 'Done' : 'Skipped';
        }
        tasks.push({ key: careKey, label: CARE_LABELS[careKey], status });
      }
      if (tasks.length === 0) continue;

      const images = (plant as any).images || [];
      result.push({
        id: String(plant.id),
        name: plant.name || 'Unknown',
        image: images.length > 0 ? images[0] : PLACEHOLDER_IMAGE,
        tasks,
        journals,
      });
    }
    setReminderPlants(result);
  };

  // Animated tab switch
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const idx = TABS.findIndex((t) => t.key === tab);
    if (idx >= 0 && tabWidths[idx] > 0) {
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: tabXs[idx], useNativeDriver: false, tension: 68, friction: 12 }),
        Animated.spring(indicatorW, { toValue: tabWidths[idx], useNativeDriver: false, tension: 68, friction: 12 }),
      ]).start();
    }
  };

  const onTabLayout = (idx: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    tabXs[idx] = x;
    tabWidths[idx] = width;
    // Set initial position for garden tab
    if (idx === 0 && activeTab === 'garden') {
      indicatorX.setValue(x);
      indicatorW.setValue(width);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePlant = (plant: Plant) => {
    navigation.navigate('Plant', {
      plantId: plant.id,
      isGarden: true,
      snap: plant,
    });
  };

  const handleSnap = (snap: any) => {
    navigation.navigate('Plant', {
      isGarden: false,
      snap,
    });
  };

  const handleDeleteSnap = (snap: any) => {
    Alert.alert(
      'Delete Snap',
      `Remove "${snap.name || 'this snap'}" from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteSnap(String(snap.id));
              if (!error) {
                setSnaps((prev) => prev.filter((s) => s.id !== snap.id));
              } else {
                Alert.alert('Error', 'Failed to delete snap');
              }
            } catch (_e) {
              Alert.alert('Error', 'Failed to delete snap');
            }
          },
        },
      ]
    );
  };

  const handleGroup = (group: Group) => {
    navigation.navigate('Group', { groupId: group.id });
  };

  const handleDeletePlant = (plant: Plant) => {
    Alert.alert(
      'Remove Plant',
      `Remove "${plant.name}" from your garden?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const plantIdStr = String(plant.id);
              // Remove plant from any space (group) that contains it
              const groupsWithPlant = groups.filter(
                (g) => g.plant_id && g.plant_id.some((id) => String(id) === plantIdStr)
              );
              for (const group of groupsWithPlant) {
                await removePlantFromGroup(group.id, plant.id, group.plant_id ?? []);
              }
              const { error } = await deleteGardenPlant(plantIdStr);
              if (!error) {
                const nextPlants = plants.filter((p) => p.id !== plant.id);
                setPlants(nextPlants);
                if (groupsWithPlant.length > 0) {
                  setGroups((prev) =>
                    prev.map((g) => {
                      if (!g.plant_id) return g;
                      const nextIds = g.plant_id.filter((id) => String(id) !== plantIdStr);
                      return { ...g, plant_id: nextIds };
                    })
                  );
                }
                buildReminders(nextPlants);
              } else {
                Alert.alert('Error', 'Failed to remove plant');
              }
            } catch (_e) {
              Alert.alert('Error', 'Failed to remove plant');
            }
          },
        },
      ]
    );
  };

  // ---- Create Space ----
  const handleOpenCreateSpace = () => {
    if (!isLoggedIn) {
      navigation.navigate('Started');
      return;
    }
    setSpaceName('');
    setCreateSpaceVisible(true);
  };

  const handleCreateSpaceSubmit = async () => {
    if (!spaceName.trim() || !userCollection.id) return;
    setCreating(true);
    try {
      const { data, error } = await createGroup(spaceName.trim(), userCollection.id);
      if (error) {
        Alert.alert('Error', error.message || 'Failed to create space');
      } else if (data) {
        setGroups((prev) => [...prev, data as Group]);
        setSelectedGroupId(data.id);
        closeCreateSpaceSheet();
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  // ---- Options ----
  const handleOpenOptions = (group: Group) => {
    setSelectedGroup(group);
    setOptionsVisible(true);
  };

  const handleEditName = () => {
    if (!selectedGroup) return;
    setEditName(selectedGroup.name);
    closeOptionsSheet(() => setEditVisible(true));
  };

  const handleEditNameSubmit = async () => {
    if (!editName.trim() || !selectedGroup) return;
    try {
      const { data, error } = await updateGroup(selectedGroup.id, { name: editName.trim() });
      if (!error && data) {
        setGroups((prev) =>
          prev.map((g) => (g.id === selectedGroup.id ? { ...g, name: editName.trim() } : g))
        );
      }
    } catch (_e) {}
    closeEditSheet();
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    closeOptionsSheet();

    Alert.alert(
      'Delete Space',
      `Are you sure you want to delete "${selectedGroup.name}"? Plants will be moved to ungrouped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteGroup(selectedGroup.id);
              if (!error) {
                setGroups((prev) => prev.filter((g) => g.id !== selectedGroup.id));
                // Move plants to ungrouped
                setPlants((prev) =>
                  prev.map((p) =>
                    (p as any).group === selectedGroup.id ? { ...p, group: undefined } : p
                  )
                );
                if (selectedGroupId === selectedGroup.id) {
                  setSelectedGroupId(groups.length > 1 ? groups.find((g) => g.id !== selectedGroup.id)?.id || null : null);
                }
              }
            } catch (_e) {
              Alert.alert('Error', 'Failed to delete space');
            }
          },
        },
      ]
    );
  };

  const handleAddPlant = () => {
    navigation.navigate('Scanner', { initialMode: 'identify' });
  };

  // Get plants for selected group using group.plant_id array
  const getFilteredPlants = () => {
    if (!selectedGroupId) return plants;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group || !group.plant_id || group.plant_id.length === 0) return [];
    const plantIdSet = new Set(group.plant_id.map((id) => String(id)));
    return plants.filter((p) => plantIdSet.has(String(p.id)));
  };

  const getGroupPlantCount = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group?.plant_id?.length || 0;
  };

  const getGroupForSnap = (snap: any) => {
    return 'General';
  };

  // Get first plant image for a space
  const getSpaceImage = (group: Group): string | null => {
    if (!group.plant_id || group.plant_id.length === 0) return null;
    const plantIdSet = new Set(group.plant_id.map((id) => String(id)));
    const spacePlant = plants.find((p) => plantIdSet.has(String(p.id)));
    return spacePlant?.images?.[0] || null;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
  };

  // ---- Reminder task toggle ----
  const handleToggleReminder = (plantIdx: number, taskKey: string, currentStatus: string) => {
    const plant = reminderPlants[plantIdx];
    if (!plant) return;

    if (currentStatus === 'Done') {
      Alert.alert('Undo Task', `Remove "${CARE_LABELS[taskKey]}" from today's completed?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', onPress: () => updateReminderJournal(plantIdx, taskKey, null) },
      ]);
    } else {
      Alert.alert('Complete Task', `Mark "${CARE_LABELS[taskKey]}" as done for today?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => updateReminderJournal(plantIdx, taskKey, 'Done') },
      ]);
    }
  };

  const updateReminderJournal = async (plantIdx: number, taskKey: string, status: string | null) => {
    const plant = reminderPlants[plantIdx];
    if (!plant) return;
    try {
      const today = todayStart();
      let journals = [...plant.journals];
      journals = journals.filter((j) => {
        if ((j.Task || j.task) !== taskKey) return true;
        const time = j.Time || j.time;
        return time ? !isSameDay(new Date(time), today) : true;
      });
      if (status) {
        journals.push({ Task: taskKey, Time: Date.now(), Status: status });
      }
      await updateGardenPlant(plant.id, { journals });
      setReminderPlants((prev) => {
        const copy = [...prev];
        copy[plantIdx] = {
          ...copy[plantIdx],
          journals,
          tasks: copy[plantIdx].tasks.map((t) =>
            t.key === taskKey ? { ...t, status: status === 'Done' ? 'Done' as const : 'pending' as const } : t
          ),
        };
        return copy;
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  // ===== RENDER =====

  // Empty state for My Garden
  const renderGardenEmpty = () => (
    <View style={styles.emptyState}>
       <Image
        source={require('../../../assets/cbimage.png')}
        style={styles.snapHistoryEmptyImage}
        resizeMode="contain"
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>You didn't added any plant</Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Create space and add your plants where{'\n'}do you want
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenCreateSpace}>
        <Plus size={20} color={COLORS.textLight} />
        <Text style={styles.primaryBtnText}>Create a Space</Text>
      </TouchableOpacity>
      <View style={{height: 68}}></View>
    </View>
  );

  // Empty state for Snap History
  const renderHistoryEmpty = () => (
    <View style={styles.emptyState}>
      <Image
        source={require('../../../assets/cbimage.png')}
        style={styles.snapHistoryEmptyImage}
        resizeMode="contain"
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Snap history is empty</Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Snap plant and get more information{'\n'}and care plan
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleAddPlant}>
        <Camera size={18} color={COLORS.textLight} />
        <Text style={styles.primaryBtnText}>Snap a Plant</Text>
      </TouchableOpacity>
    </View>
  );

  // Plant card for garden
  const renderPlantCard = ({ item }: { item: Plant }) => (
    <TouchableOpacity
      style={[styles.plantCard, { backgroundColor: theme.background }]}
      onPress={() => handlePlant(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: (item.images && item.images[0]) || PLACEHOLDER_IMAGE }}
        style={styles.plantImage}
        resizeMode="cover"
      />
      <View style={styles.plantInfo}>
        <Text style={[styles.plantName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
        {item.labels && item.labels.length > 0 && (
          <Text style={[styles.plantLabel, { color: theme.textSecondary }]} numberOfLines={1}>{item.labels[0]}</Text>
        )}
      </View>
      <CaretRight size={20} color={theme.textTertiary} />
    </TouchableOpacity>
  );

  // Snap card — same style as All My Plants, swipe to delete
  const renderSnapCard = ({ item }: { item: any }) => (
    <Swipeable
      renderRightActions={() => (
        <TouchableOpacity
          style={[styles.allPlantDeleteAction, { backgroundColor: COLORS.error }]}
          onPress={() => handleDeleteSnap(item)}
          activeOpacity={0.8}
        >
          <Trash size={24} color="#fff" weight="bold" />
          <Text style={styles.allPlantDeleteText}>Delete</Text>
        </TouchableOpacity>
      )}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity
        style={[styles.allPlantCard, { backgroundColor: theme.card }]}
        onPress={() => handleSnap(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.images?.[0] || PLACEHOLDER_IMAGE }}
          style={[styles.allPlantImage, { backgroundColor: theme.backgroundTertiary }]}
          resizeMode="cover"
        />
        <View style={styles.allPlantInfo}>
          <Text style={[styles.allPlantName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.allPlantRealname, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.realname || item.description || ''}
          </Text>
          <Text style={[styles.allPlantDate, { color: theme.textTertiary }]}>
            {item.created_at ? formatDate(item.created_at) : ''}
          </Text>
        </View>
        <CaretRight size={20} color={theme.textTertiary} />
      </TouchableOpacity>
    </Swipeable>
  );

  // Garden content
  const renderGardenContent = () => {
    if (groups.length === 0 && plants.length === 0) {
      return renderGardenEmpty();
    }

    return (
      <ScrollView
        style={styles.gardenContainer}
        contentContainerStyle={styles.gardenScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Spaces Header */}
        <View style={styles.spacesHeader}>
          <Text style={[styles.spacesTitle, { color: theme.text }]}>Spaces</Text>
          <TouchableOpacity onPress={handleOpenCreateSpace}>
            <PlusCircle size={28} color={theme.text} weight="fill" />
          </TouchableOpacity>
        </View>

        {/* Horizontal Space Cards */}
        {groups.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spaceCardsContainer}
          >
            {groups.map((group) => {
              const count = getGroupPlantCount(group.id);
              const img = getSpaceImage(group);
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.spaceCard, { backgroundColor: theme.card }]}
                  onPress={() => handleGroup(group)}
                  onLongPress={() => handleOpenOptions(group)}
                  activeOpacity={0.8}
                >
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={[styles.spaceCardImage, { backgroundColor: theme.backgroundTertiary }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.spaceCardImage, styles.spaceCardImagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
                      <PlantIcon size={24} color={theme.textSecondary} weight="fill" />
                    </View>
                  )}
                  <View style={styles.spaceCardInfo}>
                    <Text style={[styles.spaceCardName, { color: theme.text }]} numberOfLines={1}>{group.name}</Text>
                    <Text style={[styles.spaceCardCount, { color: theme.textSecondary }]}>{count} {count === 1 ? 'Plant' : 'Plants'}</Text>
                  </View>
                  <CaretRight size={18} color={theme.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* All My Plants */}
        {plants.length > 0 && (
          <>
            <Text style={[styles.allPlantsTitle, { color: theme.text }]}>All My Plants</Text>
            {plants.map((plant) => (
              <Swipeable
                key={plant.id}
                renderRightActions={() => (
                  <TouchableOpacity
                    style={[styles.allPlantDeleteAction, { backgroundColor: COLORS.error }]}
                    onPress={() => handleDeletePlant(plant)}
                    activeOpacity={0.8}
                  >
                    <Trash size={24} color="#fff" weight="bold" />
                    <Text style={styles.allPlantDeleteText}>Delete</Text>
                  </TouchableOpacity>
                )}
                friction={2}
                rightThreshold={40}
              >
                <TouchableOpacity
                  style={[styles.allPlantCard, { backgroundColor: theme.card }]}
                  onPress={() => handlePlant(plant)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: plant.images?.[0] || PLACEHOLDER_IMAGE }}
                    style={[styles.allPlantImage, { backgroundColor: theme.backgroundTertiary }]}
                    resizeMode="cover"
                  />
                  <View style={styles.allPlantInfo}>
                    <Text style={[styles.allPlantName, { color: theme.text }]} numberOfLines={1}>{plant.name}</Text>
                    <Text style={[styles.allPlantRealname, { color: theme.textSecondary }]} numberOfLines={1}>
                      {(plant as any).description || (plant.labels && plant.labels[0]) || ''}
                    </Text>
                    <Text style={[styles.allPlantDate, { color: theme.textTertiary }]}>
                      {(plant as any).created_at ? formatDate((plant as any).created_at) : ''}
                    </Text>
                  </View>
                  <CaretRight size={20} color={theme.textTertiary} />
                </TouchableOpacity>
              </Swipeable>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  // Reminders content (inline)
  const renderRemindersContent = () => {
    if (reminderPlants.length === 0) {
      return (
        <View style={styles.emptyState}>
             <Image
        source={require('../../../assets/reminder.webp')}
        style={styles.snapHistoryEmptyImage}
        resizeMode="contain"
      />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No care reminders yet</Text>
          <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>Add plants to your garden to see care{'\n'}reminders here.</Text>
          <View style={{height: 40}}></View>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.gardenContainer}
        contentContainerStyle={styles.gardenScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reminderPlants.map((plant, plantIdx) => {
          const completed = plant.tasks.filter((t) => t.status === 'Done').length;
          return (
            <View key={plant.id} style={[styles.reminderCard, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={[styles.reminderHeader]}
                activeOpacity={0.7}
                onPress={() => {
                  const found = plants.find((p) => String(p.id) === plant.id);
                  if (found) navigation.navigate('Plant', { plantId: found.id, isGarden: true, snap: found });
                }}
              >
                <Image source={{ uri: plant.image }} style={[styles.reminderImg, { backgroundColor: theme.backgroundTertiary }]} resizeMode="cover" />
                <View style={styles.reminderInfo}>
                  <Text style={[styles.reminderName, { color: theme.text }]}>{plant.name}</Text>
                  <Text style={[styles.reminderProgress, { color: theme.textSecondary }]}>{completed} of {plant.tasks.length} completed</Text>
                </View>
                <CaretRight size={18} color={theme.textTertiary} />
              </TouchableOpacity>
              {plant.tasks.map((task, index) => (
                <TouchableOpacity
                  key={task.key}
                  style={[styles.reminderTaskRow, { borderTopWidth: index===0?0:1, borderTopColor: theme.accent3 }]}
                  onPress={() => handleToggleReminder(plantIdx, task.key, task.status)}
                  activeOpacity={0.7}
                >
                  <Image source={CARE_ICONS[task.key]} style={styles.reminderTaskIcon} resizeMode="contain" />
                  <Text style={[
                    styles.reminderTaskLabel,
                    { color: task.status === 'Done' ? theme.textTertiary : theme.text },
                  ]}>
                    {task.label}
                  </Text>
                  <View style={[
                    styles.reminderCheckbox,
                    task.status !== 'Done' && task.status !== 'Skipped' && { borderColor: theme.borderLight },
                    task.status === 'Done' && styles.reminderCheckboxDone,
                    task.status === 'Skipped' && styles.reminderCheckboxSkipped,
                  ]}>
                    {task.status === 'Done' && <Text style={styles.reminderCheckmark}>✓</Text>}
                    {task.status === 'Skipped' && <Text style={styles.reminderSkippedMark}>–</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[styles.title, { color: theme.text }]}>My Garden</Text>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: darkMode ? theme.card : theme.backgroundTertiary }]}>
        {/* Animated white indicator */}
        <Animated.View
          style={[
            styles.tabIndicator,
            { transform: [{ translateX: indicatorX }], width: indicatorW, backgroundColor: "#ffffff" },
          ]}
        />
        {TABS.map((tab, idx) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => switchTab(tab.key)}
            onLayout={onTabLayout(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === tab.key && { color: "#000000", fontWeight: '600' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.textSecondary} />
        </View>
      ) : activeTab === 'garden' ? (
        renderGardenContent()
      ) : activeTab === 'reminders' ? (
        renderRemindersContent()
      ) : (
        <FlatList
          data={snaps}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSnapCard}
          ListEmptyComponent={renderHistoryEmpty}
          contentContainerStyle={[
            styles.snapListContent,
            snaps.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* ===== MODALS ===== */}

      {/* Create Space Modal */}
      <Modal
        visible={createSpaceVisible}
        animationType="none"
        transparent
        onRequestClose={closeCreateSpaceSheet}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeCreateSpaceSheet}>
          <Animated.View style={[styles.sheetOverlay, { opacity: createSpaceOverlay }]} />
        </TouchableOpacity>
        <View style={styles.sheetWrapperCenter} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetKeyboardAvoid}
            keyboardVerticalOffset={40}
          >
            <Animated.View style={[styles.sheetCenter, { transform: [{ scale: createSpaceScale }] }]}>
              <View style={[styles.sheet, styles.sheetCenterCard, { backgroundColor: theme.background, paddingBottom: 20 }]} onStartShouldSetResponder={() => true}>
                <View style={[styles.sheetHandle, { backgroundColor: 'transparent', marginBottom: 0, height: 8 }]} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Create Space</Text>

                <Text style={[styles.inputLabel, { color: theme.text }]}>Name of Space</Text>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }, spaceName.length > 0 && styles.sheetInputActive]}
                  placeholder="ex: My Office"
                  placeholderTextColor={theme.textTertiary}
                  value={spaceName}
                  onChangeText={setSpaceName}
                  autoFocus
                />

                <View style={styles.infoRow}>
                  <Info size={18} color={theme.textTertiary} />
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    Creating space is effective way of organizing your plants
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.sheetBtn, (!spaceName.trim() || creating) && styles.sheetBtnDisabled]}
                  onPress={handleCreateSpaceSubmit}
                  disabled={!spaceName.trim() || creating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetBtnText}>
                    {creating ? 'Creating...' : 'Create Space'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal
        visible={optionsVisible}
        animationType="none"
        transparent
        onRequestClose={() => closeOptionsSheet()}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closeOptionsSheet()}>
          <Animated.View style={[styles.sheetOverlay, { opacity: optionsOverlay }]} />
        </TouchableOpacity>
        <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: optionsSheetY }] }]} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: theme.background }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Options</Text>

            <TouchableOpacity style={[styles.optionRow, { borderBottomColor: theme.borderLight }]} onPress={handleEditName} activeOpacity={0.7}>
              <PencilSimple size={22} color={theme.text} />
              <Text style={[styles.optionText, { color: theme.text }]}>Edit Name</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, { borderBottomColor: theme.borderLight }, !selectedGroup?.deletemode && styles.optionRowDisabled]}
              onPress={handleDeleteGroup}
              disabled={!selectedGroup?.deletemode}
              activeOpacity={0.7}
            >
              <Trash size={22} color={selectedGroup?.deletemode ? COLORS.error : theme.textTertiary} />
              <Text style={[styles.optionText, { color: selectedGroup?.deletemode ? COLORS.error : theme.textTertiary }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        visible={editVisible}
        animationType="none"
        transparent
        onRequestClose={closeEditSheet}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeEditSheet}>
          <Animated.View style={[styles.sheetOverlay, { opacity: editOverlay }]} />
        </TouchableOpacity>
        <View style={styles.sheetWrapperCenter} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetKeyboardAvoid}
            keyboardVerticalOffset={40}
          >
            <Animated.View style={[styles.sheetCenter, { transform: [{ scale: editScale }] }]}>
              <View style={[styles.sheet, styles.sheetCenterCard, { backgroundColor: theme.background, paddingBottom: 20 }]} onStartShouldSetResponder={() => true}>
                <View style={[styles.sheetHandle, { backgroundColor:  'transparent', marginBottom: 0, height: 8 }]} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Edit Name</Text>

                <Text style={[styles.inputLabel, { color: theme.text }]}>Name of Space</Text>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }, editName.length > 0 && styles.sheetInputActive]}
                  placeholder="Space name"
                  placeholderTextColor={theme.textTertiary}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.sheetBtn, !editName.trim() && styles.sheetBtnDisabled]}
                  onPress={handleEditNameSubmit}
                  disabled={!editName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <View style={{ height: 95 }}></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    backgroundColor: '#EBEBEB',
    borderRadius: RADIUS.round,
    padding: 4,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.round - 2,
    ...SHADOWS.small,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.round,
    zIndex: 1,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Garden layout
  gardenContainer: {
    // paddingTop: 24,
    flex: 1,
  },
  gardenScrollContent: {
    paddingBottom: 40,
  },
  spacesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  spacesTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  // Space cards (horizontal scroll)
  spaceCardsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  spaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    width: 220,
  },
  spaceCardImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.backgroundSecondary,
  },
  spaceCardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  spaceCardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  spaceCardName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  spaceCardCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // All Plants
  allPlantsTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  allPlantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  allPlantImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.backgroundSecondary,
  },
  allPlantInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  allPlantName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  allPlantRealname: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingVertical: 2,
    marginTop: 1,
  },
  allPlantDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  allPlantDeleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: SPACING.md,
    borderRadius: 16,
    marginHorizontal: SPACING.lg,
  },
  allPlantDeleteText: {
    color: '#fff',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  // Lists
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl + 80,
  },
  snapListContent: {
    paddingTop: 12,
    paddingBottom: SPACING.md + 80,
  },
  emptyListContent: {
    paddingTop: 24,
    flex: 1,
  },
  // Plant card
  plantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  plantImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundTertiary,
  },
  plantInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  plantName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  plantLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  // Empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  snapHistoryEmptyImage: {
    width: 150,
    height: 150,
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    gap: SPACING.sm,
  },
  primaryBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  groupEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  groupEmptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  addPlantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPlantBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheetWrapperCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetKeyboardAvoid: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: SPACING.lg,
  },
  sheetCenter: {
    width: '100%',
  },
  sheetCenterCard: {
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    borderRadius: RADIUS.xxl,
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl + 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  sheetInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: SPACING.md,
  },
  sheetInputActive: {
    borderColor: COLORS.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textTertiary,
    lineHeight: 20,
  },
  sheetBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  sheetBtnDisabled: {
    opacity: 0.5,
  },
  sheetBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  optionRowDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.text,
  },
  // ---- Reminders inline styles ----
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderImg: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  reminderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  reminderName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  reminderProgress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  reminderTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
  },
  reminderTaskIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    // backgroundColor: COLORS.backgroundSecondary,
  },
  reminderTaskLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  reminderTaskDone: {
    color: COLORS.textTertiary,
  },
  reminderCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D3D5D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCheckboxDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  reminderCheckboxSkipped: {
    backgroundColor: '#FAC515',
    borderColor: '#FAC515',
  },
  reminderCheckmark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  reminderSkippedMark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
