import { create } from 'zustand';
import { NativeModules, Platform, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import {
  User,
  Location,
  Weather,
  TemperatureUnit,
  Language,
  Reminder,
} from '../types';

export const SUPPORTED_LANGUAGES: Language[] = [
  'English (US)',
  'German (Deutsch)',
  'French (Français)',
  'Spanish (Español)',
  'Portuguese (Português)',
  'Japanese (日本語)',
  'Korean (한국어)',
  'Chinese Simplified',
  'Thai (ไทย)',
  'Indonesian (Bahasa)',
];

function localeToLanguage(languageCode: string, languageTag?: string): Language {
  const code = (languageCode || '').toLowerCase();
  const tag = (languageTag || '').toLowerCase();
  if (code.startsWith('en')) return 'English (US)';
  if (code === 'de') return 'German (Deutsch)';
  if (code === 'fr') return 'French (Français)';
  if (code === 'es') return 'Spanish (Español)';
  if (code === 'pt') return 'Portuguese (Português)';
  if (code === 'ja') return 'Japanese (日本語)';
  if (code === 'ko') return 'Korean (한국어)';
  if (code === 'zh' || tag.includes('hans')) return 'Chinese Simplified';
  if (code === 'th') return 'Thai (ไทย)';
  if (code === 'id') return 'Indonesian (Bahasa)';
  return 'English (US)';
}

/** Qurilma tilini expo-localization ishlamasa (Expo Go / eski build) o‘qish. */
function getDeviceLocaleFallback(): string {
  try {
    if (Platform.OS === 'ios') {
      const appleLocale = typeof Settings?.get === 'function' ? Settings.get('AppleLocale') : null;
      const appleLangs = typeof Settings?.get === 'function' ? Settings.get('AppleLanguages') : null;
      const raw = (typeof appleLocale === 'string' ? appleLocale : null) ?? (Array.isArray(appleLangs) ? appleLangs[0] : null);
      if (raw && typeof raw === 'string') {
        const code = raw.split(/[-_]/)[0]?.toLowerCase() ?? '';
        return localeToLanguage(code, raw);
      }
      const settings = NativeModules.SettingsManager?.settings;
      const fallbackRaw = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
      if (fallbackRaw && typeof fallbackRaw === 'string') {
        const code = fallbackRaw.split(/[-_]/)[0]?.toLowerCase() ?? '';
        return localeToLanguage(code, fallbackRaw);
      }
    } else {
      const locale = NativeModules.I18nManager?.localeIdentifier;
      if (locale && typeof locale === 'string') {
        const code = locale.split(/[-_]/)[0]?.toLowerCase() ?? '';
        return localeToLanguage(code, locale);
      }
    }
  } catch {
    // ignore
  }
  return 'English (US)';
}

// Storage keys
const STORAGE_KEYS = {
  IS_FIRST_STEP: '@plantus_is_first_step',
  CHAT_CREATED: '@plantus_chat_created',
  ASSISTANT_CHAT_ID: '@plantus_assistant_chat_id',
  USER_COLLECTION: '@plantus_user_collection',
  LOCATION: '@plantus_location',
  TEMPERATURE: '@plantus_temperature',
  LANGUAGE: '@plantus_language',
  WATERING_REMINDER: '@plantus_watering_reminder',
  FERTILIZING_REMINDER: '@plantus_fertilizing_reminder',
  REPOTTING_REMINDER: '@plantus_repotting_reminder',
  NOTIFICATIONS: '@plantus_notifications',
  VIBRATION: '@plantus_vibration',
  DARK_MODE: '@plantus_dark_mode',
  WEATHER: '@plantus_weather',
  CITY: '@plantus_city',
  REMAINING_SCANS: '@plantus_remaining_scans',
};

// Default reminder configuration
const defaultReminder: Reminder = {
  enabled: true,
  repeat: 'Everyday',
  customRepeat: { value: 1, type: 'day' },
  time: new Date(new Date().setHours(9, 0, 0, 0)),
  plants: [],
};

// Default location
const defaultLocation: Location = {
  name: 'United States',
  code: 'USA',
};

// Default weather
const defaultWeather: Weather = {
  temp: 0,
  location: 'Globe',
};

interface AppState {
  // Auth state
  user: SupabaseUser | null;
  session: Session | null;
  isLoggedIn: boolean;
  isInited: boolean;

  // User data
  userCollection: User;

  // App state
  isFirstStep: boolean;
  chatCreated: boolean;
  assistantChatId: string | null;
  chatScrollToEnd: boolean;

  // Location & Weather
  location: Location;
  weather: Weather;
  city: string;

  // Settings
  temperature: TemperatureUnit;
  language: Language;
  notifications: boolean;
  vibration: boolean;
  darkMode: boolean;

  // Reminders
  wateringReminder: Reminder;
  fertilizingReminder: Reminder;
  repottingReminder: Reminder;

  // UI state
  selectedSegment: number;
  isPro: boolean;
  remainingScans: number;
  showProModal: boolean;
  proModalParams: { isFirstStep?: boolean } | null;
  showOneTimeOfferModal: boolean;
  oneTimeOfferParams: { fromFirstTime?: boolean } | null;

  // Actions
  setUser: (user: SupabaseUser | null) => void;
  setSession: (session: Session | null) => void;
  setIsInited: (value: boolean) => void;
  setUserCollection: (user: User) => void;
  updateUserCollection: (updates: Partial<User>) => void;
  setIsFirstStep: (value: boolean) => void;
  setChatCreated: (value: boolean) => void;
  setAssistantChatId: (value: string | null) => void;
  setChatScrollToEnd: (value: boolean) => void;
  setLocation: (location: Location) => void;
  setWeather: (weather: Weather) => void;
  setCity: (city: string) => void;
  setTemperature: (unit: TemperatureUnit) => void;
  setLanguage: (lang: Language) => void;
  setNotifications: (value: boolean) => void;
  setVibration: (value: boolean) => void;
  setDarkMode: (value: boolean) => void;
  setWateringReminder: (reminder: Reminder) => void;
  updateWateringReminder: (updates: Partial<Reminder>) => void;
  setFertilizingReminder: (reminder: Reminder) => void;
  updateFertilizingReminder: (updates: Partial<Reminder>) => void;
  setRepottingReminder: (reminder: Reminder) => void;
  updateRepottingReminder: (updates: Partial<Reminder>) => void;
  setSelectedSegment: (segment: number) => void;
  setIsPro: (value: boolean) => void;
  setRemainingScans: (value: number) => void;
  decrementRemainingScans: () => void;
  setShowProModal: (show: boolean, params?: { isFirstStep?: boolean }) => void;
  setShowOneTimeOfferModal: (show: boolean, params?: { fromFirstTime?: boolean }) => void;
  initializePersistedState: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  isLoggedIn: false,
  isInited: false,
  userCollection: { id: '', name: '', email: '' },
  isFirstStep: true,
  chatCreated: false,
  assistantChatId: null,
  chatScrollToEnd: false,
  location: defaultLocation,
  weather: defaultWeather,
  city: '',
  temperature: 'metric',
  language: 'English (US)',
  notifications: true,
  vibration: true,
  darkMode: false,
  wateringReminder: { ...defaultReminder },
  fertilizingReminder: { ...defaultReminder },
  repottingReminder: { ...defaultReminder },
  selectedSegment: 1,
  isPro: false,
  remainingScans: 1,
  showProModal: false,
  showOneTimeOfferModal: false,
  proModalParams: null,
  oneTimeOfferParams: null,

  // Actions
  setUser: (user) => set({ user, isLoggedIn: !!user }),

  setSession: (session) => set({ session }),

  setIsInited: (value) => set({ isInited: value }),

  setUserCollection: async (userCollection) => {
    set({ userCollection });
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_COLLECTION,
      JSON.stringify(userCollection)
    );
  },

  updateUserCollection: async (updates) => {
    const { userCollection } = get();
    const updated = { ...userCollection, ...updates };
    set({ userCollection: updated });
    await AsyncStorage.setItem(
      STORAGE_KEYS.USER_COLLECTION,
      JSON.stringify(updated)
    );
  },

  setIsFirstStep: async (value) => {
    set({ isFirstStep: value });
    await AsyncStorage.setItem(STORAGE_KEYS.IS_FIRST_STEP, JSON.stringify(value));
  },

  setChatCreated: async (value) => {
    set({ chatCreated: value });
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_CREATED, JSON.stringify(value));
  },

  setAssistantChatId: async (value) => {
    set({ assistantChatId: value });
    const toStore = value != null && value !== '' ? String(value) : '';
    await AsyncStorage.setItem(STORAGE_KEYS.ASSISTANT_CHAT_ID, toStore);
  },

  setChatScrollToEnd: (value) => set({ chatScrollToEnd: value }),

  setLocation: async (location) => {
    set({ location });
    await AsyncStorage.setItem(STORAGE_KEYS.LOCATION, JSON.stringify(location));
  },

  setWeather: async (weather) => {
    set({ weather });
    await AsyncStorage.setItem(STORAGE_KEYS.WEATHER, JSON.stringify(weather));
  },

  setCity: async (city) => {
    set({ city });
    await AsyncStorage.setItem(STORAGE_KEYS.CITY, city);
  },

  setTemperature: async (unit) => {
    set({ temperature: unit });
    await AsyncStorage.setItem(STORAGE_KEYS.TEMPERATURE, unit);
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  },

  setNotifications: async (value) => {
    set({ notifications: value });
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(value));
  },

  setVibration: async (value) => {
    set({ vibration: value });
    await AsyncStorage.setItem(STORAGE_KEYS.VIBRATION, JSON.stringify(value));
  },

  setDarkMode: async (value) => {
    set({ darkMode: value });
    await AsyncStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(value));
  },

  setWateringReminder: async (reminder) => {
    set({ wateringReminder: reminder });
    await AsyncStorage.setItem(
      STORAGE_KEYS.WATERING_REMINDER,
      JSON.stringify(reminder)
    );
  },

  updateWateringReminder: async (updates) => {
    const { wateringReminder } = get();
    const updated = { ...wateringReminder, ...updates };
    set({ wateringReminder: updated });
    await AsyncStorage.setItem(
      STORAGE_KEYS.WATERING_REMINDER,
      JSON.stringify(updated)
    );
  },

  setFertilizingReminder: async (reminder) => {
    set({ fertilizingReminder: reminder });
    await AsyncStorage.setItem(
      STORAGE_KEYS.FERTILIZING_REMINDER,
      JSON.stringify(reminder)
    );
  },

  updateFertilizingReminder: async (updates) => {
    const { fertilizingReminder } = get();
    const updated = { ...fertilizingReminder, ...updates };
    set({ fertilizingReminder: updated });
    await AsyncStorage.setItem(
      STORAGE_KEYS.FERTILIZING_REMINDER,
      JSON.stringify(updated)
    );
  },

  setRepottingReminder: async (reminder) => {
    set({ repottingReminder: reminder });
    await AsyncStorage.setItem(
      STORAGE_KEYS.REPOTTING_REMINDER,
      JSON.stringify(reminder)
    );
  },

  updateRepottingReminder: async (updates) => {
    const { repottingReminder } = get();
    const updated = { ...repottingReminder, ...updates };
    set({ repottingReminder: updated });
    await AsyncStorage.setItem(
      STORAGE_KEYS.REPOTTING_REMINDER,
      JSON.stringify(updated)
    );
  },

  setSelectedSegment: (segment) => set({ selectedSegment: segment }),

  setIsPro: (value) => set({ isPro: value }),

  setRemainingScans: async (value) => {
    set({ remainingScans: Math.max(0, value) });
    await AsyncStorage.setItem(STORAGE_KEYS.REMAINING_SCANS, String(Math.max(0, value)));
  },

  decrementRemainingScans: async () => {
    const { remainingScans } = get();
    const next = Math.max(0, remainingScans - 1);
    set({ remainingScans: next });
    await AsyncStorage.setItem(STORAGE_KEYS.REMAINING_SCANS, String(next));
  },

  setShowProModal: (show, params) =>
    set({
      showProModal: show,
      proModalParams: show && params ? { isFirstStep: params.isFirstStep } : null,
    }),

  setShowOneTimeOfferModal: (show, params) =>
    set({
      showOneTimeOfferModal: show,
      oneTimeOfferParams: show && params ? { fromFirstTime: params.fromFirstTime } : null,
    }),

  initializePersistedState: async () => {
    try {
      const [
        isFirstStep,
        chatCreated,
        assistantChatId,
        userCollection,
        location,
        temperature,
        language,
        wateringReminder,
        fertilizingReminder,
        repottingReminder,
        notifications,
        vibration,
        darkMode,
        weather,
        city,
        remainingScans,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.IS_FIRST_STEP),
        AsyncStorage.getItem(STORAGE_KEYS.CHAT_CREATED),
        AsyncStorage.getItem(STORAGE_KEYS.ASSISTANT_CHAT_ID),
        AsyncStorage.getItem(STORAGE_KEYS.USER_COLLECTION),
        AsyncStorage.getItem(STORAGE_KEYS.LOCATION),
        AsyncStorage.getItem(STORAGE_KEYS.TEMPERATURE),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.WATERING_REMINDER),
        AsyncStorage.getItem(STORAGE_KEYS.FERTILIZING_REMINDER),
        AsyncStorage.getItem(STORAGE_KEYS.REPOTTING_REMINDER),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.VIBRATION),
        AsyncStorage.getItem(STORAGE_KEYS.DARK_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.WEATHER),
        AsyncStorage.getItem(STORAGE_KEYS.CITY),
        AsyncStorage.getItem(STORAGE_KEYS.REMAINING_SCANS),
      ]);

      set({
        isFirstStep: isFirstStep ? JSON.parse(isFirstStep) : true,
        chatCreated: chatCreated ? JSON.parse(chatCreated) : false,
        assistantChatId: assistantChatId && assistantChatId.length > 0 ? assistantChatId : null,
        userCollection: userCollection
          ? JSON.parse(userCollection)
          : { id: '', name: '', email: '' },
        location: location ? JSON.parse(location) : defaultLocation,
        temperature: (temperature as TemperatureUnit) || 'metric',
        language: (language as Language) || 'English (US)',
        wateringReminder: wateringReminder
          ? JSON.parse(wateringReminder)
          : { ...defaultReminder },
        fertilizingReminder: fertilizingReminder
          ? JSON.parse(fertilizingReminder)
          : { ...defaultReminder },
        repottingReminder: repottingReminder
          ? JSON.parse(repottingReminder)
          : { ...defaultReminder },
        notifications: notifications ? JSON.parse(notifications) : true,
        vibration: vibration ? JSON.parse(vibration) : true,
        darkMode: darkMode ? JSON.parse(darkMode) : false,
        weather: weather ? JSON.parse(weather) : defaultWeather,
        city: city ?? '',
        remainingScans: remainingScans != null && !Number.isNaN(parseInt(remainingScans, 10)) ? parseInt(remainingScans, 10) : 5,
      });

      // Til: avval expo-localization (per-app), bo‘lmasa qurilma tili (Settings → General → Language).
      try {
        const { getLocales } = require('expo-localization');
        const locales = getLocales();
        const first = locales?.[0];
        const systemLang = first
          ? localeToLanguage(first.languageCode ?? '', first.languageTag)
          : getDeviceLocaleFallback();
        set({ language: systemLang });
        await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, systemLang);
      } catch {
        const fallback = getDeviceLocaleFallback();
        set({ language: fallback });
        await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, fallback);
      }
    } catch (error) {
      console.error('Error loading persisted state:', error);
    }
  },

  logout: async () => {
    // Clear user-specific data but keep settings
    set({
      user: null,
      session: null,
      isLoggedIn: false,
      userCollection: { id: '', name: '', email: '' },
      chatCreated: false,
      assistantChatId: null,
      isPro: false,
    });

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.USER_COLLECTION),
      AsyncStorage.removeItem(STORAGE_KEYS.CHAT_CREATED),
      AsyncStorage.removeItem(STORAGE_KEYS.ASSISTANT_CHAT_ID),
    ]);
  },
}));
