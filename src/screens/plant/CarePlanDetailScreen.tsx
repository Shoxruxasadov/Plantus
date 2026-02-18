import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, CheckCircle } from 'phosphor-react-native';

import { RootStackParamList } from '../../types';
import { COLORS, FONT_SIZES, SPACING, RADIUS } from '../../utils/theme';
import { useTheme } from '../../hooks';
import { useAppStore } from '../../store/appStore';
import { updateGardenPlant, getGardenPlantById } from '../../services/supabase';
import {
  scheduleNotification,
  requestNotificationPermissions,
  cancelCareNotificationForPlant,
} from '../../services/notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'CarePlanDetail'>;

const { height: SCREEN_H } = Dimensions.get('window');
const ANIM_DURATION = 300;

// ---- Remind sheet options ----
const REMIND_OPTIONS = [
  { label: 'Every day', repeat: 'Everyday', customRepeat: { value: 1, type: 'day' } },
  { label: 'Every week', repeat: 'Everyweek', customRepeat: { value: 1, type: 'week' } },
  { label: 'Every month', repeat: 'Custom', customRepeat: { value: 1, type: 'month' } },
  { label: 'Not Set', repeat: 'NotSet', customRepeat: null },
  { label: 'Custom', repeat: 'Custom', customRepeat: null },
];

// ---- Custom picker data ----
const CUSTOM_NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1);
const CUSTOM_TYPES = ['Day', 'Week', 'Month', 'Year'];

// ---- Picker constants ----
const ITEM_H = 50;
const VISIBLE_ITEMS = 5;
const PICKER_H = ITEM_H * VISIBLE_ITEMS;

// ---- Helpers ----
function formatRepeatDisplay(repeat: string, customRepeat: any): string {
  if (repeat === 'Everyday') return 'Everyday';
  if (repeat === 'Everyweek') return 'Every week';
  if (repeat === 'NotSet') return 'Not Set';
  if (customRepeat) {
    const v = customRepeat.value || 1;
    const t = customRepeat.type || 'day';
    return `Every ${v} ${t}${v > 1 ? 's' : ''}`;
  }
  return repeat || 'Not Set';
}

function formatTimeDisplay(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function parseTime(item: any): Date {
  const t = item?.Time || item?.time;
  if (!t) { const d = new Date(); d.setHours(9, 0, 0, 0); return d; }
  return new Date(t);
}

function parseRepeat(item: any): { repeat: string; customRepeat: any } {
  const r = item?.Repeat || item?.repeat || 'NotSet';
  const c = item?.CustomRepeat || item?.customRepeat || null;
  return { repeat: r, customRepeat: c };
}

// ================================================================
//  Animated Bottom Sheet
// ================================================================
function AnimatedBottomSheet({
  visible,
  onClose,
  children,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  theme?: typeof COLORS;
}) {
  const [rendered, setRendered] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[sheetStyles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[sheetStyles.container, { transform: [{ translateY: sheetTranslateY }], backgroundColor: theme?.background ?? '#fff' }]}>
        <View style={[sheetStyles.handle, { backgroundColor: theme?.borderLight ?? '#D0D0D0' }]} />
        {children}
      </Animated.View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
    paddingTop: SPACING.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
});

// ================================================================
//  CupertinoPicker-style ScrollPicker
// ================================================================
function WheelPicker({
  data,
  selectedIndex,
  onSelect,
  renderLabel,
  fontSize = 20,
  textColor = COLORS.text,
}: {
  data: any[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderLabel: (item: any) => string;
  fontSize?: number;
  textColor?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * ITEM_H)).current;
  const isSnappingRef = useRef(false);

  const handleScrollEnd = useCallback(
    (e: any) => {
      if (isSnappingRef.current) return;
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(data.length - 1, idx));
      const targetY = clamped * ITEM_H;
      if (Math.abs(y - targetY) < 1) return;
      isSnappingRef.current = true;
      onSelect(clamped);
      scrollRef.current?.scrollTo({ y: targetY, animated: false });
      setTimeout(() => {
        isSnappingRef.current = false;
      }, 100);
    },
    [data.length, onSelect],
  );

  return (
    <View style={wheelStyles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        contentOffset={{ x: 0, y: selectedIndex * ITEM_H }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {data.map((item, i) => {
          const itemCenter = i * ITEM_H;
          const opacity = scrollY.interpolate({
            inputRange: [
              itemCenter - ITEM_H * 1.2,
              itemCenter - ITEM_H * 0.5,
              itemCenter,
              itemCenter + ITEM_H * 0.5,
              itemCenter + ITEM_H * 1.2,
            ],
            outputRange: [0.2, 0.5, 1, 0.5, 0.2],
            extrapolate: 'clamp',
          });
          const scale = scrollY.interpolate({
            inputRange: [itemCenter - ITEM_H * 0.6, itemCenter, itemCenter + ITEM_H * 0.6],
            outputRange: [0.92, 1, 0.92],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View key={i} style={[wheelStyles.item, { opacity, transform: [{ scale }] }]}>
              <Text style={[wheelStyles.itemText, { fontSize, color: textColor }]}>
                {renderLabel(item)}
              </Text>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  container: { height: PICKER_H, overflow: 'hidden', flex: 1 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontWeight: '600', color: COLORS.text },
});

// ================================================================
//  MAIN SCREEN
// ================================================================
export default function CarePlanDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { notifications } = useAppStore();

  const { plantName, careKey, careLabel, careItem, plantId, isGarden } = route.params;

  const parsed = parseRepeat(careItem);
  const [repeat, setRepeat] = useState(parsed.repeat);
  const [customRepeat, setCustomRepeat] = useState(parsed.customRepeat);
  const [notifyTime, setNotifyTime] = useState(parseTime(careItem));
  const [notificationEnabled, setNotificationEnabled] = useState(
    (careItem as any)?.NotificationEnabled !== false && (careItem as any)?.notificationEnabled !== false,
  );
  const [saving, setSaving] = useState(false);

  // ---- Sheet states ----
  const [remindVisible, setRemindVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [notifyVisible, setNotifyVisible] = useState(false);

  // ---- Custom picker state ----
  const [customValue, setCustomValue] = useState(customRepeat?.value ?? 1);
  const [customType, setCustomType] = useState<string>(
    customRepeat?.type ? customRepeat.type.charAt(0).toUpperCase() + customRepeat.type.slice(1) : 'Week',
  );

  // ---- Notify picker state ----
  const [pickerHour, setPickerHour] = useState(notifyTime.getHours());
  const [pickerMinute, setPickerMinute] = useState(notifyTime.getMinutes());

  const handleBack = () => navigation.goBack();

  // ---- Remind sheet handlers ----
  const handleRemindSelect = (option: typeof REMIND_OPTIONS[0]) => {
    if (option.label === 'Custom') {
      setRemindVisible(false);
      setTimeout(() => setCustomVisible(true), 350);
      return;
    }
    setRepeat(option.repeat);
    setCustomRepeat(option.customRepeat);
    setRemindVisible(false);
  };

  const handleCustomConfirm = () => {
    setRepeat('Custom');
    setCustomRepeat({ value: customValue, type: customType.toLowerCase() });
    setCustomVisible(false);
  };

  const handleNotifyConfirm = () => {
    const d = new Date();
    d.setHours(pickerHour, pickerMinute, 0, 0);
    setNotifyTime(d);
    setNotifyVisible(false);
  };

  // ---- Schedule notification (faqat App Settings → Notifications yoqilganda) ----
  const scheduleCareNotification = async (plantNm: string, key: string, rep: string, cr: any, time: Date, pId: string) => {
    if (!notifications) return null;
    const hasPerms = await requestNotificationPermissions();
    if (!hasPerms) { Alert.alert('Permission required', 'Please enable notifications in Settings.'); return null; }
    if (rep === 'NotSet') return null;

    const now = new Date();
    const triggerDate = new Date(now);
    triggerDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

    if (triggerDate <= now) {
      if (rep === 'Everyday') triggerDate.setDate(triggerDate.getDate() + 1);
      else if (rep === 'Everyweek') triggerDate.setDate(triggerDate.getDate() + 7);
      else if (cr) {
        const { value, type } = cr;
        switch (type) {
          case 'day': triggerDate.setDate(triggerDate.getDate() + value); break;
          case 'week': triggerDate.setDate(triggerDate.getDate() + value * 7); break;
          case 'month': triggerDate.setMonth(triggerDate.getMonth() + value); break;
          case 'year': triggerDate.setFullYear(triggerDate.getFullYear() + value); break;
        }
      } else triggerDate.setDate(triggerDate.getDate() + 1);
    }

    const TITLES: Record<string, string> = {
      Watering: `💧 Time to water ${plantNm}`, Fertilize: `🌱 Time to fertilize ${plantNm}`,
      Repotting: `🪴 Time to repot ${plantNm}`, Pruning: `✂️ Time to prune ${plantNm}`,
      Humidity: `💨 Check humidity for ${plantNm}`, Soilcheck: `🌍 Soil check for ${plantNm}`,
    };
    const BODIES: Record<string, string> = {
      Watering: `Your ${plantNm} needs some water.`, Fertilize: `Give ${plantNm} some nutrients.`,
      Repotting: `Check if ${plantNm} needs a new pot.`, Pruning: `Time to prune ${plantNm}.`,
      Humidity: `Check the humidity for ${plantNm}.`, Soilcheck: `Check the soil for ${plantNm}.`,
    };

    const result = await scheduleNotification(
      TITLES[key] || `🌿 Care reminder for ${plantNm}`,
      BODIES[key] || `Check on your ${plantNm}`,
      { type: SchedulableTriggerInputTypes.DATE, date: triggerDate },
      { plantId: pId, careKey: key, type: 'careplan' },
    );
    return result.success ? result.id : null;
  };

  // ---- Done ----
  const handleDone = async () => {
    if (!plantId || !isGarden) { navigation.goBack(); return; }
    setSaving(true);
    try {
      const { data: currentPlant } = await getGardenPlantById(String(plantId));
      if (!currentPlant) { Alert.alert('Error', 'Plant not found'); setSaving(false); return; }

      let cp = currentPlant.customcareplan;
      if (typeof cp === 'string') { try { cp = JSON.parse(cp); } catch { cp = {}; } }
      if (!cp || Array.isArray(cp)) cp = {};

      cp[careKey] = {
        Repeat: repeat,
        Time: notifyTime.getTime(),
        CustomRepeat: customRepeat,
        NotificationEnabled: notificationEnabled,
      };

      await updateGardenPlant(String(plantId), { customcareplan: JSON.stringify(cp) });

      if (notificationEnabled) {
        const notifId = await scheduleCareNotification(plantName, careKey, repeat, customRepeat, notifyTime, String(plantId));
        if (notifId) console.log(`[CarePlan] Notification scheduled: ${careKey} -> ${notifId}`);
      } else {
        await cancelCareNotificationForPlant(String(plantId), careKey);
      }

      navigation.goBack();
    } catch (error) {
      console.error('[CarePlan] Save error:', error);
      Alert.alert('Error', 'Failed to save care plan');
    } finally { setSaving(false); }
  };

  const displayRepeat = formatRepeatDisplay(repeat, customRepeat);
  const displayTime = formatTimeDisplay(notifyTime);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = Array.from({ length: 60 }, (_, i) => i);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.header, { backgroundColor: theme.backgroundSecondary }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{careLabel}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        <View style={[styles.row_start, { backgroundColor: theme.card }]}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Plant</Text>
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{plantName}</Text>
        </View>
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Enable notification</Text>
          <Switch
            value={notificationEnabled}
            onValueChange={setNotificationEnabled}
            trackColor={{ false: theme.borderLight, true: COLORS.primary + '99' }}
            thumbColor={notificationEnabled ? COLORS.primary : theme.textTertiary}
          />
        </View>
        <TouchableOpacity style={[styles.row, { backgroundColor: theme.card }]} onPress={() => setRemindVisible(true)} activeOpacity={0.7}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Repeat</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{displayRepeat}</Text>
            <CaretRight size={18} color={theme.textSecondary} weight="bold" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row_end, { backgroundColor: theme.card }]} onPress={() => setNotifyVisible(true)} activeOpacity={0.7}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Notify</Text>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{displayTime}</Text>
            <CaretRight size={18} color={theme.textSecondary} weight="bold" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }} />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.doneBtn, saving && { opacity: 0.6 }]}
          onPress={handleDone}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.doneBtnText}>{saving ? 'Saving...' : 'Done'}</Text>
        </TouchableOpacity>
      </View>

      {/* ==================== REMIND SHEET ==================== */}
      <AnimatedBottomSheet visible={remindVisible} onClose={() => setRemindVisible(false)} theme={theme}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>Remind</Text>
        {REMIND_OPTIONS.map((opt) => {
          const isSelected =
            (opt.label === 'Every day' && repeat === 'Everyday') ||
            (opt.label === 'Every week' && repeat === 'Everyweek') ||
            (opt.label === 'Every month' && repeat === 'Custom' && customRepeat?.type === 'month' && customRepeat?.value === 1) ||
            (opt.label === 'Not Set' && repeat === 'NotSet');
          return (
            <TouchableOpacity key={opt.label} style={[styles.sheetRow, { borderBottomColor: theme.borderLight }]} onPress={() => handleRemindSelect(opt)} activeOpacity={0.7}>
              <View style={[styles.radioCircle, { borderColor: theme.borderLight }, isSelected && styles.radioCircleActive]}>
                {isSelected && <CheckCircle size={24} color={theme.primary} weight="fill" />}
              </View>
              <Text style={[styles.sheetRowText, { color: theme.text }, isSelected && styles.sheetRowTextActive]}>{opt.label}</Text>
              {opt.label === 'Custom' && <CaretRight size={18} color={theme.textSecondary} style={{ marginLeft: 'auto' }} weight="bold" />}
            </TouchableOpacity>
          );
        })}
      </AnimatedBottomSheet>

      {/* ==================== CUSTOM REPEAT SHEET ==================== */}
      <AnimatedBottomSheet visible={customVisible} onClose={() => setCustomVisible(false)} theme={theme}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>Repeat</Text>
        <View style={styles.pickerArea}>
          <View style={[styles.pickerHighlight, { backgroundColor: theme.backgroundTertiary }]} pointerEvents="none" />
          <View style={styles.pickerRow}>
            <View style={styles.everyLabel}>
              <Text style={[styles.everyText, { color: theme.text }]}>Every</Text>
            </View>
            <WheelPicker
              data={CUSTOM_NUMBERS}
              selectedIndex={customValue - 1}
              onSelect={(i) => setCustomValue(CUSTOM_NUMBERS[i])}
              renderLabel={(n) => String(n)}
              textColor={theme.text}
            />
            <WheelPicker
              data={CUSTOM_TYPES}
              selectedIndex={CUSTOM_TYPES.indexOf(customType)}
              onSelect={(i) => setCustomType(CUSTOM_TYPES[i])}
              renderLabel={(t) => t}
              textColor={theme.text}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleCustomConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </AnimatedBottomSheet>

      {/* ==================== NOTIFY TIME SHEET ==================== */}
      <AnimatedBottomSheet visible={notifyVisible} onClose={() => setNotifyVisible(false)} theme={theme}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>Notify</Text>
        <View style={styles.pickerArea}>
          <View style={[styles.pickerHighlight, { backgroundColor: theme.backgroundTertiary }]} pointerEvents="none" />
          <View style={styles.pickerRow}>
            <WheelPicker
              data={HOURS}
              selectedIndex={pickerHour}
              onSelect={(i) => setPickerHour(HOURS[i])}
              renderLabel={(h) => String(h).padStart(2, '0')}
              fontSize={24}
              textColor={theme.text}
            />
            <View style={styles.colonWrap}>
              <Text style={[styles.colonText, { color: theme.text }]}>:</Text>
            </View>
            <WheelPicker
              data={MINUTES}
              selectedIndex={pickerMinute}
              onSelect={(i) => setPickerMinute(MINUTES[i])}
              renderLabel={(m) => String(m).padStart(2, '0')}
              fontSize={24}
              textColor={theme.text}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleNotifyConfirm} activeOpacity={0.85}>
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </TouchableOpacity>
      </AnimatedBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: COLORS.backgroundSecondary,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, gap: 4 },
  row_start: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg + 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg + 2,
  },
  row_end: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg + 2,
  },
  rowLabel: { fontSize: FONT_SIZES.lg, fontWeight: '500', color: COLORS.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { fontSize: FONT_SIZES.lg, color: COLORS.textSecondary },
  bottomBar: { paddingHorizontal: SPACING.lg },
  doneBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.round, paddingVertical: SPACING.lg, alignItems: 'center' },
  doneBtnText: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: '#fff' },

  // ---- Sheet content ----
  sheetTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.lg },

  // Remind rows
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  radioCircleActive: { borderWidth: 0 },
  sheetRowText: { fontSize: FONT_SIZES.lg, color: COLORS.text },
  sheetRowTextActive: { fontWeight: '600' },

  // Picker area (shared by custom repeat & time)
  pickerArea: { marginBottom: SPACING.xl, position: 'relative' },
  pickerHighlight: {
    position: 'absolute', top: PICKER_H / 2 - ITEM_H / 2, left: 12, right: 12,
    height: ITEM_H + 2, backgroundColor: '#F5F5F6', borderRadius: 12, zIndex: -1,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', height: PICKER_H },

  // "Every" label
  everyLabel: { width: 70, height: PICKER_H, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.xxl, marginRight: SPACING.lg },
  everyText: { fontSize: 20, fontWeight: '600', color: COLORS.text },

  // Colon
  colonWrap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  colonText: { fontSize: 24, fontWeight: '700', color: COLORS.text },

  // Confirm button
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.round, paddingVertical: SPACING.lg, alignItems: 'center' },
  confirmBtnText: { fontSize: FONT_SIZES.xl, fontWeight: '600', color: '#fff' },
});
