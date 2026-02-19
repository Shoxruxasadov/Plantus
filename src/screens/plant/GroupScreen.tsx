import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CaretRight,
  Plant as PlantIcon,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  ArrowsLeftRight,
} from 'phosphor-react-native';

import { RootStackParamList, Plant, Group } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS, PLACEHOLDER_IMAGE } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/appStore';
import {
  getGroupPlants,
  getGroups,
  groupsTable,
  updateGroup,
  deleteGroup,
  updateGardenPlant,
  deleteGardenPlant,
  addPlantToGroup,
  removePlantFromGroup,
} from '../../services/supabase';
import { showConfirmAlert } from '../../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'Group'>;

const SHEET_INITIAL_Y = Dimensions.get('window').height;

function useSheetAnimation(visible: boolean, onClose: () => void) {
  const overlay = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_INITIAL_Y)).current;

  useEffect(() => {
    if (visible) {
      overlay.setValue(0);
      sheetY.setValue(SHEET_INITIAL_Y);
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [visible]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: SHEET_INITIAL_Y, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  return { overlay, sheetY, closeSheet };
}

function useCenterSheetAnimation(visible: boolean, onClose: () => void) {
  const overlay = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      overlay.setValue(0);
      scale.setValue(0);
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }),
      ]).start();
    }
  }, [visible]);

  const closeSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose]);

  return { overlay, scale, closeSheet };
}

export default function GroupScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userCollection } = useAppStore();

  const { groupId } = route.params;
  const [groupName, setGroupName] = useState('');
  const [groupDeletemode, setGroupDeletemode] = useState(true);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Space options (header dots)
  const [spaceOptionsVisible, setSpaceOptionsVisible] = useState(false);
  const spaceSheet = useSheetAnimation(spaceOptionsVisible, () => setSpaceOptionsVisible(false));
  // Change space name sheet (center modal)
  const [changeNameVisible, setChangeNameVisible] = useState(false);
  const changeNameSheet = useCenterSheetAnimation(changeNameVisible, () => setChangeNameVisible(false));
  const [editSpaceName, setEditSpaceName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Plant item options (row dots)
  const [plantOptionsVisible, setPlantOptionsVisible] = useState(false);
  const plantSheet = useSheetAnimation(plantOptionsVisible, () => { setPlantOptionsVisible(false); setSelectedPlant(null); });
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  // Change plant name (center modal)
  const [changePlantNameVisible, setChangePlantNameVisible] = useState(false);
  const changePlantNameSheet = useCenterSheetAnimation(changePlantNameVisible, () => setChangePlantNameVisible(false));
  const [editPlantName, setEditPlantName] = useState('');
  const [savingPlantName, setSavingPlantName] = useState(false);
  // Change space (move to another group)
  const [changeSpaceVisible, setChangeSpaceVisible] = useState(false);
  const changeSpaceSheet = useSheetAnimation(changeSpaceVisible, () => setChangeSpaceVisible(false));
  const [otherGroups, setOtherGroups] = useState<Group[]>([]);
  const [movingPlant, setMovingPlant] = useState(false);

  const loadData = useCallback(async () => {
    if (!userCollection?.id) return;
    try {
      const { data: group } = await groupsTable().select('*').eq('id', groupId).single();
      if (group) {
        setGroupName(group.name || '');
        setGroupDeletemode((group as any).deletemode !== false);
      }

      const { data: plantsData } = await getGroupPlants(groupId, userCollection.id);
      if (plantsData) setPlants(plantsData as Plant[]);
    } catch (error) {
      console.error('Load group data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, userCollection?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBack = () => navigation.goBack();

  const handlePlant = (plant: Plant) => {
    navigation.navigate('Plant', { plantId: plant.id, isGarden: true, snap: plant });
  };

  const openSpaceOptions = () => setSpaceOptionsVisible(true);
  const closeSpaceOptions = () => spaceSheet.closeSheet();

  const openChangeName = () => {
    setEditSpaceName(groupName);
    setSpaceOptionsVisible(false);
    setChangeNameVisible(true);
  };

  const handleChangeSpaceName = async () => {
    const name = editSpaceName.trim();
    if (!name) return;
    setSavingName(true);
    try {
      const { error } = await updateGroup(groupId, { name });
      if (error) throw new Error(error.message);
      setGroupName(name);
      changeNameSheet.closeSheet();
    } catch (e) {
      Alert.alert(t('common.error'), t('group.errorSpaceName'));
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteGroup = () => {
    spaceSheet.closeSheet();
    showConfirmAlert(
      t('group.deleteGroup'),
      t('group.deleteGroupConfirm'),
      async () => {
        try {
          await deleteGroup(groupId);
          navigation.goBack();
        } catch (error) {
          console.error('Delete group error:', error);
          Alert.alert(t('common.error'), t('group.errorDelete'));
        }
      }
    );
  };

  const openPlantOptions = (plant: Plant) => {
    setSelectedPlant(plant);
    setPlantOptionsVisible(true);
  };

  const closePlantOptions = () => plantSheet.closeSheet();

  const openChangePlantName = () => {
    if (!selectedPlant) return;
    setEditPlantName(selectedPlant.name || '');
    setPlantOptionsVisible(false);
    setChangePlantNameVisible(true);
  };

  const handleChangePlantName = async () => {
    if (!selectedPlant || !editPlantName.trim()) return;
    setSavingPlantName(true);
    try {
      const { error } = await updateGardenPlant(selectedPlant.id, { name: editPlantName.trim() });
      if (error) throw new Error(error.message);
      setPlants((prev) =>
        prev.map((p) => (p.id === selectedPlant.id ? { ...p, name: editPlantName.trim() } : p))
      );
      setSelectedPlant((p) => (p ? { ...p, name: editPlantName.trim() } : null));
      changePlantNameSheet.closeSheet();
    } catch (e) {
      Alert.alert(t('common.error'), t('group.errorPlantName'));
    } finally {
      setSavingPlantName(false);
    }
  };

  const openChangeSpace = async () => {
    if (!selectedPlant) return;
    setPlantOptionsVisible(false);
    try {
      const { data: groups } = await getGroups(userCollection?.id || '');
      const list = (groups || []).filter((g: Group) => g.id !== groupId) as Group[];
      setOtherGroups(list);
      setChangeSpaceVisible(true);
    } catch (e) {
      Alert.alert(t('common.error'), t('group.errorLoad'));
    }
  };

  const handleMoveToGroup = async (targetGroupId: string) => {
    if (!selectedPlant) return;
    setMovingPlant(true);
    try {
      const targetGroup = otherGroups.find((g) => g.id === targetGroupId);
      const targetIds = (targetGroup?.plant_id || []) as number[];
      await addPlantToGroup(targetGroupId, Number(selectedPlant.id), targetIds);
      await updateGardenPlant(selectedPlant.id, { group: targetGroupId } as any);
      const currentGroupPlantIds = plants.map((p) => Number(p.id));
      await removePlantFromGroup(groupId, Number(selectedPlant.id), currentGroupPlantIds);
      setPlants((prev) => prev.filter((p) => p.id !== selectedPlant.id));
      changeSpaceSheet.closeSheet();
      setSelectedPlant(null);
    } catch (e) {
      Alert.alert(t('common.error'), t('group.errorMove'));
    } finally {
      setMovingPlant(false);
    }
  };

  const handleDeleteFromGarden = () => {
    if (!selectedPlant) return;
    plantSheet.closeSheet();
    showConfirmAlert(
      t('group.deleteFromGarden'),
      t('group.removePlantConfirm', { name: selectedPlant.name || '' }),
      async () => {
        try {
          const currentGroupPlantIds = plants.map((p) => Number(p.id));
          await removePlantFromGroup(groupId, Number(selectedPlant.id), currentGroupPlantIds);
          await deleteGardenPlant(selectedPlant.id);
          setPlants((prev) => prev.filter((p) => p.id !== selectedPlant.id));
          setSelectedPlant(null);
        } catch (e) {
          Alert.alert(t('common.error'), t('group.errorRemove'));
        }
      }
    );
  };

  const getScientificName = (plant: any) =>
    plant.realname || plant.description || (plant.labels && plant.labels[0]) || '';

  const renderPlantCard = ({ item }: { item: Plant }) => (
    <View style={[styles.plantCard, { backgroundColor: theme.card }]}>
      <TouchableOpacity
        style={styles.plantCardMain}
        onPress={() => handlePlant(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.images?.[0] || PLACEHOLDER_IMAGE }}
          style={[styles.plantImage, { backgroundColor: theme.backgroundTertiary }]}
          resizeMode="cover"
        />
        <View style={styles.plantInfo}>
          <Text style={[styles.plantName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.plantSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {getScientificName(item)}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.plantDots}
        onPress={() => openPlantOptions(item)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <DotsThreeVertical size={22} color={theme.textTertiary} weight="bold" />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <PlantIcon size={48} color={theme.textTertiary} weight='fill' />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('group.empty')}</Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('group.emptyHint')}</Text>
    </View>
  );

  const renderOptionRow = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void,
    disabled?: boolean
  ) => {
    if (disabled) {
      return (
        <View style={[styles.optionRow, styles.optionRowDisabled, { borderBottomColor: theme.borderLight }]}>
          {icon}
          <Text style={[styles.optionRowText, { color: theme.textTertiary }]}>{label}</Text>
          <CaretRight size={20} color={theme.textSecondary} weight="bold"/>
        </View>
      );
    }
    return (
      <TouchableOpacity style={[styles.optionRow, { borderBottomColor: theme.borderLight }]} onPress={onPress} activeOpacity={0.7}>
        {icon}
        <Text style={[styles.optionRowText, { color: theme.text }]}>{label}</Text>
        <CaretRight size={20} color={theme.textSecondary} weight="bold"/>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundSecondary }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <ArrowLeft size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {groupName}
        </Text>
        <TouchableOpacity style={styles.headerDots} onPress={openSpaceOptions}>
          <DotsThreeVertical size={24} color={theme.text} weight="bold" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={theme.textSecondary} />
        </View>
      ) : (
        <FlatList
          data={plants}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPlantCard}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            plants.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Space options sheet (image 3) */}
      <Modal
        visible={spaceOptionsVisible}
        animationType="none"
        transparent
        onRequestClose={closeSpaceOptions}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSpaceOptions}>
          <Animated.View style={[styles.sheetOverlay, { opacity: spaceSheet.overlay }]} />
        </TouchableOpacity>
        <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: spaceSheet.sheetY }] }]} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: theme.background }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('group.options')}</Text>
            {renderOptionRow(
              <PencilSimple size={22} color={theme.text} />,
              t('group.changeName'),
              openChangeName
            )}
            {renderOptionRow(
              <Trash size={22} color={theme.text} />,
              t('garden.delete'),
              handleDeleteGroup,
              !groupDeletemode
            )}
          </View>
        </Animated.View>
      </Modal>

      {/* Change Space Name sheet (center modal) */}
      <Modal
        visible={changeNameVisible}
        animationType="none"
        transparent
        onRequestClose={() => changeNameSheet.closeSheet()}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => changeNameSheet.closeSheet()}>
          <Animated.View style={[styles.sheetOverlay, { opacity: changeNameSheet.overlay }]} />
        </TouchableOpacity>
        <View style={styles.sheetWrapperCenter} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetKeyboardAvoid}
            keyboardVerticalOffset={40}
          >
            <Animated.View style={[styles.sheetCenter, { transform: [{ scale: changeNameSheet.scale }] }]}>
              <View style={[styles.sheet, styles.sheetCenterCard, { backgroundColor: theme.background, paddingBottom: 20 }]} onStartShouldSetResponder={() => true}>
                <View style={[styles.sheetHandle, { backgroundColor:  'transparent', marginTop: 0, marginBottom: 0, height: 24 }]} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('group.changeSpaceName')}</Text>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{t('group.nameOfSpace')}</Text>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder={t('group.spaceNamePlaceholder')}
                  placeholderTextColor={theme.textTertiary}
                  value={editSpaceName}
                  onChangeText={setEditSpaceName}
                  autoFocus
                />
                <View style={styles.sheetInfo}>
                  <Text style={[styles.sheetInfoText, { color: theme.textSecondary }]}>{t('group.creatingSpaceHint')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.sheetBtn, savingName && styles.sheetBtnDisabled]}
                  onPress={handleChangeSpaceName}
                  disabled={savingName || !editSpaceName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetBtnText}>{t('group.changeSpaceName')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Plant options sheet (image 5) */}
      <Modal
        visible={plantOptionsVisible}
        animationType="none"
        transparent
        onRequestClose={closePlantOptions}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePlantOptions}>
          <Animated.View style={[styles.sheetOverlay, { opacity: plantSheet.overlay }]} />
        </TouchableOpacity>
        <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: plantSheet.sheetY }] }]} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: theme.background }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('group.options')}</Text>
            {renderOptionRow(
              <PencilSimple size={22} color={theme.text} />,
              t('group.changeName'),
              openChangePlantName
            )}
            {renderOptionRow(
              <ArrowsLeftRight size={22} color={theme.text} />,
              t('group.changeSpace'),
              openChangeSpace
            )}
            {renderOptionRow(
              <Trash size={22} color={theme.text} />,
              t('group.deleteFromGarden'),
              handleDeleteFromGarden
            )}
          </View>
        </Animated.View>
      </Modal>

      {/* Change Plant Name (center modal) */}
      <Modal
        visible={changePlantNameVisible}
        animationType="none"
        transparent
        onRequestClose={() => changePlantNameSheet.closeSheet()}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => changePlantNameSheet.closeSheet()}>
          <Animated.View style={[styles.sheetOverlay, { opacity: changePlantNameSheet.overlay }]} />
        </TouchableOpacity>
        <View style={styles.sheetWrapperCenter} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetKeyboardAvoid}
            keyboardVerticalOffset={40}
          >
            <Animated.View style={[styles.sheetCenter, { transform: [{ scale: changePlantNameSheet.scale }] }]}>
              <View style={[styles.sheet, styles.sheetCenterCard, { backgroundColor: theme.background, paddingBottom: 20 }]} onStartShouldSetResponder={() => true}>
                <View style={[styles.sheetHandle, { backgroundColor: 'transparent', marginTop: 0, marginBottom: 0, height: 24 }]} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('group.changePlantName')}</Text>
                <Text style={[styles.inputLabel, { color: theme.text }]}>{t('group.nameOfPlant')}</Text>
                <TextInput
                  style={[styles.sheetInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder={t('group.plantNamePlaceholder')}
                  placeholderTextColor={theme.textTertiary}
                  value={editPlantName}
                  onChangeText={setEditPlantName}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.sheetBtn, savingPlantName && styles.sheetBtnDisabled]}
                  onPress={handleChangePlantName}
                  disabled={savingPlantName || !editPlantName.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetBtnText}>{t('garden.save')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Change Space (move to another group) */}
      <Modal
        visible={changeSpaceVisible}
        animationType="none"
        transparent
        onRequestClose={() => changeSpaceSheet.closeSheet()}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => changeSpaceSheet.closeSheet()}>
          <Animated.View style={[styles.sheetOverlay, { opacity: changeSpaceSheet.overlay }]} />
        </TouchableOpacity>
        <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY: changeSpaceSheet.sheetY }] }]} pointerEvents="box-none">
          <View style={[styles.sheet, { backgroundColor: theme.background }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{t('group.changeSpace')}</Text>
            <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>{t('group.moveTo')}</Text>
            {otherGroups.length === 0 ? (
              <Text style={[styles.noGroupsText, { color: theme.textSecondary }]}>{t('group.noOtherSpaces')}</Text>
            ) : (
              otherGroups.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.groupOptionRow, { borderBottomColor: theme.borderLight }]}
                  onPress={() => handleMoveToGroup(g.id)}
                  disabled={movingPlant}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.groupOptionText, { color: theme.text }]}>{g.name}</Text>
                  <CaretRight size={20} color={theme.textSecondary} weight="bold"/>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Animated.View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  backButton: {
    padding: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerDots: {
    padding: SPACING.sm,
    minWidth: 40,
    alignItems: 'flex-end',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl + 80,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  plantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  plantCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  plantImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.backgroundSecondary,
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
  plantSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  plantDots: {
    padding: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderRadius: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl + 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  sheetSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  optionRowText: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.text,
  },
  optionRowDisabled: {
    opacity: 0.5,
  },
  optionRowTextDisabled: {
    color: COLORS.textTertiary,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  sheetInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sheetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  sheetInfoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  sheetBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  sheetBtnDisabled: {
    opacity: 0.6,
  },
  sheetBtnText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#fff',
  },
  groupOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  groupOptionText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '500',
    color: COLORS.text,
  },
  noGroupsText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
