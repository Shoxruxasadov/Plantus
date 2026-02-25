import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import { Plant, Reminder } from '../types';
import { getGardenPlants } from './supabase';
import { useAppStore } from '../store/appStore';
import { languageToLocale } from '../i18n/locale';
import type { Locale } from '../i18n/locale';
import { t } from '../i18n/translations';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B5E20',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

export const getNotificationPermissionStatus = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
};

// Schedule a local notification
export const scheduleNotification = async (
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
  data?: Record<string, any>
) => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger,
    });
    return { success: true, id };
  } catch (error) {
    console.error('Schedule notification error:', error);
    return { success: false, error };
  }
};

// Cancel a scheduled notification
export const cancelNotification = async (notificationId: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return { success: true };
  } catch (error) {
    console.error('Cancel notification error:', error);
    return { success: false, error };
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { success: true };
  } catch (error) {
    console.error('Cancel all notifications error:', error);
    return { success: false, error };
  }
};

// Get all scheduled notifications
export const getScheduledNotifications = async () => {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return { success: true, data: notifications };
  } catch (error) {
    console.error('Get scheduled notifications error:', error);
    return { success: false, error };
  }
};

// ---- Care plan notifications (per plant) ----
const CARE_PLAN_KEYS = ['Watering', 'Fertilize', 'Repotting', 'Pruning', 'Humidity', 'Soilcheck'];

const CARE_TITLE_KEYS: Record<string, string> = {
  Watering: 'notifications.wateringTitle',
  Fertilize: 'notifications.fertilizeTitle',
  Repotting: 'notifications.repottingTitle',
  Pruning: 'notifications.pruningTitle',
  Humidity: 'notifications.humidityTitle',
  Soilcheck: 'notifications.soilcheckTitle',
};

const CARE_BODY_KEYS: Record<string, string> = {
  Watering: 'notifications.wateringBody',
  Fertilize: 'notifications.fertilizeBody',
  Repotting: 'notifications.repottingBody',
  Pruning: 'notifications.pruningBody',
  Humidity: 'notifications.humidityBody',
  Soilcheck: 'notifications.soilcheckBody',
};

function getNotificationLocale(): Locale {
  const language = useAppStore.getState().language;
  return languageToLocale(language);
}

function parseCareplan(cp: any): any {
  if (cp == null) return null;
  if (typeof cp === 'string') {
    try {
      return JSON.parse(cp);
    } catch {
      return null;
    }
  }
  return cp;
}

/** Parse Time from care item: number (timestamp) yoki "HH:mm:ss" string -> bugungi sana + vaqt. */
function parseCareTime(t: any): Date {
  if (t == null || t === '') return new Date(new Date().setHours(9, 0, 0, 0));
  if (typeof t === 'number' && Number.isFinite(t)) {
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : new Date(new Date().setHours(9, 0, 0, 0));
  }
  if (typeof t === 'string') {
    const parts = t.trim().split(/[:.]/).map((p) => parseInt(p, 10));
    const hours = Number.isFinite(parts[0]) ? Math.min(23, Math.max(0, parts[0])) : 9;
    const minutes = Number.isFinite(parts[1]) ? Math.min(59, Math.max(0, parts[1])) : 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : new Date(new Date().setHours(9, 0, 0, 0));
}

/** Compute next trigger date from repeat/customRepeat and time. */
function computeTriggerDate(now: Date, time: Date, rep: string, cr: any): Date {
  const triggerDate = new Date(now);
  triggerDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
  if (triggerDate <= now) {
    if (rep === 'Everyday') {
      triggerDate.setDate(triggerDate.getDate() + 1);
    } else if (rep === 'Everyweek') {
      triggerDate.setDate(triggerDate.getDate() + 7);
    } else if (cr) {
      const { value, type } = cr;
      const v = value ?? 1;
      switch (type) {
        case 'day':
          triggerDate.setDate(triggerDate.getDate() + v);
          break;
        case 'week':
          triggerDate.setDate(triggerDate.getDate() + v * 7);
          break;
        case 'month':
          triggerDate.setMonth(triggerDate.getMonth() + v);
          break;
        case 'year':
          triggerDate.setFullYear(triggerDate.getFullYear() + v);
          break;
        default:
          triggerDate.setDate(triggerDate.getDate() + 1);
      }
    } else {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }
  }
  const minFuture = now.getTime() + 60 * 1000;
  if (!Number.isFinite(triggerDate.getTime()) || triggerDate.getTime() < minFuture) {
    triggerDate.setTime(minFuture);
  }
  return triggerDate;
}

interface CarePlanSlot {
  plantId: string;
  plantName: string;
  careKey: string;
  repeat: string;
  customRepeat: any;
  time: Date;
}

/** Bir xil vaqt va turdagi (masalan Watering 9:00) reminderlarni bitta guruhga birlashtirib, bitta notification yuboradi. */
function scheduleGroupedCareplanNotificationsForUser(userId: string): Promise<void> {
  return (async () => {
    const hasPerms = await requestNotificationPermissions();
    if (!hasPerms) return;

    const { data: plants, error } = await getGardenPlants(userId);
    if (error || !plants?.length) return;

    const slots: CarePlanSlot[] = [];
    for (const plant of plants) {
      const id = plant.id;
      const name = plant.name ?? 'Plant';
      const cp = parseCareplan(plant.careplan ?? plant.customcareplan);
      if (!id || !cp) continue;

      for (const key of CARE_PLAN_KEYS) {
        const item = cp[key] || cp[key.charAt(0).toLowerCase() + key.slice(1)];
        if (!item) continue;
        if (item.NotificationEnabled === false || item.notificationEnabled === false) continue;
        const rep = item.Repeat || item.repeat;
        if (!rep || rep === 'NotSet') continue;
        const cr = item.CustomRepeat || item.customRepeat;
        const t = item.Time || item.time;
        const time = parseCareTime(t);
        slots.push({ plantId: id, plantName: name, careKey: key, repeat: rep, customRepeat: cr, time });
      }
    }

    const groupKey = (s: CarePlanSlot) =>
      `${s.careKey}_${s.time.getHours()}_${s.time.getMinutes()}_${s.repeat}_${JSON.stringify(s.customRepeat ?? '')}`;
    const groups = new Map<string, CarePlanSlot[]>();
    for (const s of slots) {
      const k = groupKey(s);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }

    const locale = getNotificationLocale();
    const now = new Date();
    for (const [, groupSlots] of groups) {
      if (groupSlots.length === 0) continue;
      const first = groupSlots[0];
      const triggerDate = computeTriggerDate(now, first.time, first.repeat, first.customRepeat);
      const careTitle = t(locale, CARE_TITLE_KEYS[first.careKey] ?? 'notifications.careReminder');
      const plantNames = groupSlots.map((s) => s.plantName).join(', ');
      const title = `${careTitle}: ${plantNames}`;
      const body = t(locale, CARE_BODY_KEYS[first.careKey] ?? 'notifications.checkPlants').replace(/\bplant\b/gi, 'plants');
      const plantIds = groupSlots.map((s) => s.plantId);
      try {
        await scheduleNotification(
          title,
          body,
          { type: SchedulableTriggerInputTypes.DATE, date: triggerDate },
          { type: 'careplan', careKey: first.careKey, plantIds, groupKey: groupKey(first) }
        );
      } catch (e) {
        console.warn('[Notifications] Grouped schedule failed:', first.careKey, e);
      }
    }
  })();
}

/** Schedule care plan reminders for one garden plant. Reschedules all grouped so the new plant is included. */
export const scheduleCareplanNotificationsForPlant = async (
  plantName: string,
  gardenId: string,
  careplan: any,
  userId?: string
): Promise<{ ok: boolean; error?: string }> => {
  if (userId) {
    await scheduleGroupedCareplanNotificationsForUser(userId);
    return { ok: true };
  }
  const hasPerms = await requestNotificationPermissions();
  if (!hasPerms) return { ok: false, error: 'Permission denied' };
  const cp = parseCareplan(careplan);
  if (!cp) return { ok: true };
  const locale = getNotificationLocale();
  let hasError = false;
  for (const key of CARE_PLAN_KEYS) {
    const item = cp[key] || cp[key.charAt(0).toLowerCase() + key.slice(1)];
    if (!item) continue;
    if (item.NotificationEnabled === false || item.notificationEnabled === false) continue;
    const rep = item.Repeat || item.repeat;
    if (!rep || rep === 'NotSet') continue;
    const cr = item.CustomRepeat || item.customRepeat;
    const timeVal = item.Time || item.time;
    const time = parseCareTime(timeVal);
    const now = new Date();
    const triggerDate = computeTriggerDate(now, time, rep, cr);
    const careTitle = t(locale, CARE_TITLE_KEYS[key] ?? 'notifications.careReminder');
    const title = `${careTitle} ${plantName}`;
    const body = t(locale, CARE_BODY_KEYS[key] ?? 'notifications.checkPlants').replace(/\bplant\b/gi, plantName);
    try {
      const res = await scheduleNotification(
        title,
        body,
        { type: SchedulableTriggerInputTypes.DATE, date: triggerDate },
        { plantId: gardenId, careKey: key, type: 'careplan' }
      );
      if (!res.success) hasError = true;
    } catch (e) {
      console.error('[Notifications] Care plan schedule failed:', key, e);
      hasError = true;
    }
  }
  return hasError ? { ok: false, error: 'Failed to schedule some reminders' } : { ok: true };
};

/** Cancel scheduled care notifications for a single plant + care type (e.g. Watering for one plant). */
export const cancelCareNotificationForPlant = async (
  plantId: string,
  careKey: string
): Promise<{ success: boolean; error?: any }> => {
  try {
    const { data: scheduled } = await getScheduledNotifications();
    if (!scheduled?.length) return { success: true };
    for (const n of scheduled) {
      const data = n.content?.data;
      if (data?.type === 'careplan' && data?.plantId === plantId && data?.careKey === careKey) {
        await cancelNotification(n.identifier);
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Cancel care notification error:', error);
    return { success: false, error };
  }
};

/** Setup notifications for all garden plants (e.g. on login). Bir xil vaqt va turdagi reminderlar bitta notificationda birlashtiriladi. */
export const setupGardenNotificationsForUser = async (userId: string): Promise<void> => {
  const hasPerms = await requestNotificationPermissions();
  if (!hasPerms) return;

  const { data: scheduled } = await getScheduledNotifications();
  if (scheduled?.length) {
    for (const n of scheduled) {
      if (n.content.data?.type === 'careplan') {
        await cancelNotification(n.identifier);
      }
    }
  }

  await scheduleGroupedCareplanNotificationsForUser(userId);
};

// Setup plant care reminders
export const setupPlantReminder = async (
  plant: Plant,
  reminderType: 'watering' | 'fertilizing' | 'repotting',
  reminder: Reminder
) => {
  if (!reminder.enabled) {
    return { success: false, error: 'Reminder is disabled' };
  }

  const title = getReminderTitle(reminderType, plant.name);
  const body = getReminderBody(reminderType, plant.name);
  
  // Calculate trigger based on repeat type
  const trigger = calculateTrigger(reminder);
  
  if (!trigger) {
    return { success: false, error: 'Invalid reminder configuration' };
  }

  return scheduleNotification(title, body, trigger, {
    plantId: plant.id,
    plantName: plant.name,
    type: reminderType,
  });
};

// Helper to get reminder title (app language)
const getReminderTitle = (
  type: 'watering' | 'fertilizing' | 'repotting',
  plantName: string
): string => {
  const locale = getNotificationLocale();
  const key =
    type === 'watering'
      ? 'notifications.timeToWater'
      : type === 'fertilizing'
        ? 'notifications.timeToFertilize'
        : type === 'repotting'
          ? 'notifications.timeToRepot'
          : 'notifications.plantCareReminder';
  return t(locale, key, { name: plantName });
};

// Helper to get reminder body (app language)
const getReminderBody = (
  type: 'watering' | 'fertilizing' | 'repotting',
  plantName: string
): string => {
  const locale = getNotificationLocale();
  const key =
    type === 'watering'
      ? 'notifications.wateringBodyReminder'
      : type === 'fertilizing'
        ? 'notifications.fertilizingBodyReminder'
        : type === 'repotting'
          ? 'notifications.repottingBodyReminder'
          : 'notifications.checkPlant';
  return t(locale, key, { name: plantName });
};

/** Parse time from reminder: Date, timestamp number, or "HH:mm:ss" string. */
function parseReminderTime(t: any): Date {
  if (t == null || t === '') return new Date(new Date().setHours(9, 0, 0, 0));
  if (typeof t === 'object' && t instanceof Date && Number.isFinite(t.getTime())) return t;
  if (typeof t === 'number' && Number.isFinite(t)) {
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : new Date(new Date().setHours(9, 0, 0, 0));
  }
  if (typeof t === 'string') {
    const parts = t.trim().split(/[:.]/).map((p) => parseInt(p, 10));
    const hours = Number.isFinite(parts[0]) ? Math.min(23, Math.max(0, parts[0])) : 9;
    const minutes = Number.isFinite(parts[1]) ? Math.min(59, Math.max(0, parts[1])) : 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  return new Date(new Date().setHours(9, 0, 0, 0));
}

// Calculate notification trigger based on reminder settings
const calculateTrigger = (reminder: Reminder): Notifications.NotificationTriggerInput | null => {
  const now = new Date();
  const reminderTime = parseReminderTime(reminder.time);

  const nextTrigger = new Date(now);
  nextTrigger.setHours(reminderTime.getHours(), reminderTime.getMinutes(), 0, 0);

  if (nextTrigger <= now) {
    switch (reminder.repeat) {
      case 'Everyday':
        nextTrigger.setDate(nextTrigger.getDate() + 1);
        break;
      case 'Every 2 Days':
        nextTrigger.setDate(nextTrigger.getDate() + 2);
        break;
      case 'Every 3 Days':
        nextTrigger.setDate(nextTrigger.getDate() + 3);
        break;
      case 'Weekly':
        nextTrigger.setDate(nextTrigger.getDate() + 7);
        break;
      case 'Every 2 Weeks':
        nextTrigger.setDate(nextTrigger.getDate() + 14);
        break;
      case 'Monthly':
        nextTrigger.setMonth(nextTrigger.getMonth() + 1);
        break;
      case 'Custom':
        if (reminder.customRepeat) {
          const { value, type } = reminder.customRepeat;
          const v = value ?? 1;
          switch (type) {
            case 'day':
              nextTrigger.setDate(nextTrigger.getDate() + v);
              break;
            case 'week':
              nextTrigger.setDate(nextTrigger.getDate() + v * 7);
              break;
            case 'month':
              nextTrigger.setMonth(nextTrigger.getMonth() + v);
              break;
            default:
              nextTrigger.setDate(nextTrigger.getDate() + 1);
          }
        } else {
          nextTrigger.setDate(nextTrigger.getDate() + 1);
        }
        break;
      default:
        nextTrigger.setDate(nextTrigger.getDate() + 1);
    }
  }

  const minFuture = now.getTime() + 60 * 1000;
  if (nextTrigger.getTime() < minFuture) nextTrigger.setTime(minFuture);

  return {
    type: SchedulableTriggerInputTypes.DATE,
    date: nextTrigger,
  };
};

// Remove all reminders for a specific plant
export const removePlantReminders = async (plantId: string) => {
  try {
    const { data: notifications } = await getScheduledNotifications();
    
    if (notifications) {
      for (const notification of notifications) {
        if (notification.content.data?.plantId === plantId) {
          await cancelNotification(notification.identifier);
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Remove plant reminders error:', error);
    return { success: false, error };
  }
};

// Listen for notification responses (when user taps notification)
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// Listen for notifications received while app is foregrounded
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

// Register for push notifications (for future use)
export const registerForPushNotifications = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B5E20',
    });
  }

  const hasPermission = await requestNotificationPermissions();
  
  if (!hasPermission) {
    return { success: false, error: 'Permission not granted' };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return { success: true, token: token.data };
  } catch (error) {
    console.error('Get push token error:', error);
    return { success: false, error };
  }
};
