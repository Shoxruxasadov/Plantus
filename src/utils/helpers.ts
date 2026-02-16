import { Alert, Linking, Platform, Share, Vibration } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

// Format date helpers
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateTime = (date: Date | string): string => {
  return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Returns whether a care task is due today based on customcareplan repeat schedule.
 * Mirrors Flutter hasTaskDueToday: uses Time (last care date), Repeat, and CustomRepeat.
 */
export function hasTaskDueToday(customCarePlan: Record<string, any> | null, careKey: string): boolean {
  if (!customCarePlan) return false;

  const careData =
    customCarePlan[careKey] || customCarePlan[careKey.charAt(0).toLowerCase() + careKey.slice(1)];
  if (!careData) return false;

  const timeValue = careData.Time ?? careData.time;
  if (timeValue == null) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCareDate = new Date(timeValue);
  const lastCareDay = new Date(
    lastCareDate.getFullYear(),
    lastCareDate.getMonth(),
    lastCareDate.getDate()
  );

  const repeat = careData.Repeat ?? careData.repeat ?? '';
  const repeatNorm = String(repeat).replace(/\s+/g, ''); // "Every day" -> "Everyday"

  if (repeatNorm === 'Everyday') {
    return true;
  }
  if (repeatNorm === 'Everyweek') {
    const daysDiff = Math.floor((today.getTime() - lastCareDay.getTime()) / (24 * 60 * 60 * 1000));
    return daysDiff >= 7;
  }
  if (repeatNorm === 'Everymonth') {
    const monthsDiff =
      (today.getFullYear() - lastCareDay.getFullYear()) * 12 +
      (today.getMonth() - lastCareDay.getMonth());
    return monthsDiff >= 1;
  }
  if (repeatNorm === 'Custom') {
    const cr = careData.CustomRepeat ?? careData.customRepeat;
    if (!cr) return false;
    const value = cr.Value ?? cr.value;
    const type = (cr.Type ?? cr.type ?? '').toLowerCase();
    if (value == null || type == null) return false;

    if (type === 'day') {
      const daysDiff = Math.floor((today.getTime() - lastCareDay.getTime()) / (24 * 60 * 60 * 1000));
      return daysDiff >= value;
    }
    if (type === 'week') {
      const daysDiff = Math.floor((today.getTime() - lastCareDay.getTime()) / (24 * 60 * 60 * 1000));
      return daysDiff >= value * 7;
    }
    if (type === 'month') {
      const monthsDiff =
        (today.getFullYear() - lastCareDay.getFullYear()) * 12 +
        (today.getMonth() - lastCareDay.getMonth());
      return monthsDiff >= value;
    }
    if (type === 'year') {
      const yearsDiff = today.getFullYear() - lastCareDay.getFullYear();
      return yearsDiff >= value;
    }
  }

  return false;
}

export const timeAgo = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(d);
};

// Location helpers
export const getCurrentLocation = async (): Promise<{
  success: boolean;
  coords?: { latitude: number; longitude: number };
  error?: string;
}> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      success: true,
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    };
  } catch (error) {
    console.error('Get location error:', error);
    return { success: false, error: 'Failed to get location' };
  }
};

// Temperature conversion
export const celsiusToFahrenheit = (celsius: number): number => {
  return Math.round((celsius * 9) / 5 + 32);
};

export const fahrenheitToCelsius = (fahrenheit: number): number => {
  return Math.round(((fahrenheit - 32) * 5) / 9);
};

export const formatTemperature = (
  temp: number,
  unit: 'metric' | 'imperial'
): string => {
  // API returns Celsius; convert to Fahrenheit when displaying in imperial
  if (unit === 'imperial') {
    return `${celsiusToFahrenheit(temp)}°F`;
  }
  return `${temp}°C`;
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Alert helpers
export const showAlert = (
  title: string,
  message: string,
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
) => {
  Alert.alert(title, message, buttons || [{ text: 'OK' }]);
};

export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  Alert.alert(title, message, [
    {
      text: 'Cancel',
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: 'Confirm',
      onPress: onConfirm,
    },
  ]);
};

// URL helpers
export const openURL = async (url: string): Promise<boolean> => {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Open URL error:', error);
    return false;
  }
};

export const openEmail = (email: string, subject?: string, body?: string) => {
  const url = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
  openURL(url);
};

export const openAppStore = () => {
  const iosUrl = 'https://apps.apple.com/app/plantus/id123456789'; // Replace with actual ID
  const androidUrl = 'https://play.google.com/store/apps/details?id=com.webnum.plantus';
  openURL(Platform.OS === 'ios' ? iosUrl : androidUrl);
};

// Share helper
export const shareContent = async (
  title: string,
  message: string,
  url?: string
) => {
  try {
    await Share.share({
      title,
      message: url ? `${message}\n${url}` : message,
      url,
    });
  } catch (error) {
    console.error('Share error:', error);
  }
};

// Haptic feedback (App Settings → Vibration ga bog‘liq)
export const triggerHaptic = async (vibrationEnabled: boolean) => {
  if (!vibrationEnabled) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_) {}
};

export const vibrate = (pattern: number | number[] = 100) => {
  if (typeof pattern === 'number') {
    Vibration.vibrate(pattern);
  } else {
    Vibration.vibrate(pattern);
  }
};

// String helpers
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

export const capitalizeFirst = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const capitalizeWords = (text: string): string => {
  return text
    .split(' ')
    .map((word) => capitalizeFirst(word))
    .join(' ');
};

// Image helpers
export const getImageUri = (
  uri: string | null | undefined,
  placeholder?: string
): string => {
  if (!uri) {
    return placeholder || 'https://via.placeholder.com/300';
  }
  return uri;
};

export const isBase64Image = (str: string): boolean => {
  return str.startsWith('data:image') || /^[A-Za-z0-9+/=]+$/.test(str);
};

// Array helpers
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const removeDuplicates = <T>(array: T[], key?: keyof T): T[] => {
  if (key) {
    const seen = new Set();
    return array.filter((item) => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
  return [...new Set(array)];
};

// Number helpers
export const clamp = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max);
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Delay helper
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Debounce helper
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle helper
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Parse JSON safely
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};
