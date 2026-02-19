// User types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Profile image URL (Supabase storage, bucket: users) */
  image?: string | null;
  isPro?: boolean;
  createdAt?: string;
}

// Location types
export interface Location {
  name: string;
  code: string;
  lat?: number;
  lon?: number;
}

// Weather types
export interface Weather {
  temp: number;
  location: string;
  icon?: string;
  description?: string;
}

// Temperature units
export type TemperatureUnit = 'metric' | 'imperial';

// Languages (display names; change only via iOS Settings → Plantus → Language)
export type Language =
  | 'English (US)'
  | 'German (Deutsch)'
  | 'French (Français)'
  | 'Spanish (Español)'
  | 'Portuguese (Português)'
  | 'Japanese (日本語)'
  | 'Korean (한국어)'
  | 'Chinese Simplified'
  | 'Thai (ไทย)'
  | 'Indonesian (Bahasa)';

// Reminder types
export interface Reminder {
  enabled: boolean;
  repeat: RepeatType;
  customRepeat?: CustomRepeat;
  time: Date;
  plants: string[];
}

export interface CustomRepeat {
  value: number;
  type: 'day' | 'week' | 'month';
}

export type RepeatType = 'Everyday' | 'Every 2 Days' | 'Every 3 Days' | 'Weekly' | 'Every 2 Weeks' | 'Monthly' | 'Custom';

// Plant types
export interface Plant {
  id: string;
  name: string;
  description?: string;
  images: string[];
  labels?: string[];
  overview?: PlantOverview;
  careplan?: PlantCarePlanFull;
  disease?: PlantDiseaseItem[];
  journals?: PlantJournal[];
  group?: string;
  user?: string;
  created_at?: string;
  // Legacy aliases
  groupId?: string;
  userId?: string;
  createdAt?: string;
}

// Detailed overview item with about sections (from Gemini API)
export interface PlantOverviewItem {
  mainDescription: string;
  negative: string;
  about: Array<{
    title: string;
    list: string[];
  }>;
}

// Full plant overview with all care categories
export interface PlantOverview {
  wateringNeeds?: PlantOverviewItem;
  fertilizing?: PlantOverviewItem;
  lightRequirement?: PlantOverviewItem;
  humidity?: PlantOverviewItem;
  temperatureRange?: PlantOverviewItem;
  soilType?: PlantOverviewItem;
  potDrainage?: PlantOverviewItem;
  pruningNeeds?: PlantOverviewItem;
}

// Care plan item with repeat schedule
export interface PlantCarePlanItem {
  repeat: string;
  customRepeat: {
    value: number;
    type: string;
  };
  time: string;
}

// Full care plan with all care types
export interface PlantCarePlanFull {
  watering?: PlantCarePlanItem;
  fertilize?: PlantCarePlanItem;
  repotting?: PlantCarePlanItem;
  pruning?: PlantCarePlanItem;
  humidity?: PlantCarePlanItem;
  soilcheck?: PlantCarePlanItem;
}

// Legacy care plan format (for backwards compatibility)
export interface PlantCarePlan {
  title: string;
  description: string;
  icon?: string;
  frequency?: string;
}

// Disease item with fix instructions
export interface PlantDiseaseItem {
  image: string;
  title: string;
  description: string;
  negative: string;
  fix: string;
}

// Legacy disease format
export interface PlantDisease {
  name: string;
  description: string;
  image?: string;
  treatment?: string;
}

export interface PlantJournal {
  id: string;
  note: string;
  images?: string[];
  createdAt: string;
}

// Group types
export interface Group {
  id: string;
  name: string;
  plant_id?: number[];
  user?: string;
  deletemode?: boolean;
  created_at?: string;
  // Computed
  plantCount?: number;
}

// Article types
export interface Article {
  id: string;
  title: string;
  description: string;
  image: string;
  content?: string;
  category?: string;
  createdAt?: string;
}

// Chat/AI types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  createdAt: string;
}

export interface AIChat {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
}

// Scanner types
export type ScannerMode = 'identify' | 'diagnose' | 'multiple';

export interface ScanResult {
  name: string;
  description: string;
  images: string[];
  labels?: string[];
  overview?: PlantOverview;
  careplan?: PlantCarePlan[];
  disease?: PlantDisease[];
  confidence?: number;
}

// Snap (scanned plant) types
export interface Snap {
  id: string;
  name: string;
  description?: string;
  images: string[];
  labels?: string[];
  overview?: PlantOverview | string;
  careplan?: PlantCarePlanFull | PlantCarePlan[] | string;
  disease?: PlantDiseaseItem[] | PlantDisease[] | string;
  user?: string;
  created_at?: string;
  // Legacy aliases
  userId?: string;
  createdAt?: string;
}

// Notification types
export interface PlantNotification {
  id: string;
  plantId: string;
  type: 'watering' | 'fertilizing' | 'repotting';
  scheduledAt: string;
  title: string;
  body: string;
}

// Navigation param types
export type RootStackParamList = {
  // Auth screens
  Onboarding: undefined;
  Started: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ResetEmail: undefined;
  VerifyEmail: { email?: string };
  ResetPassword: { token?: string };
  Success: { message?: string };

  // Main tabs
  MainTabs: undefined;
  Home: undefined;
  MyGarden: undefined;
  Scanner: { initialMode?: ScannerMode };
  Assistant: undefined;
  Profile: undefined;

  // Plant screens
  Plant: { plantId?: string; snapId?: string; isGarden?: boolean; snap?: Snap };
  CarePlanDetail: { plantName: string; careKey: string; careLabel: string; careItem: any; plantId?: string; isGarden?: boolean };
  Group: { groupId: string };
  Article: { article: Article };

  // Reminder screens
  Reminder: { reminderId: string };
  Reminders: undefined;

  // Settings screens
  Personal: undefined;
  Location: undefined;
  LoadingLocation: undefined;
  AppSettings: undefined;
  Support: undefined;
  Watering: undefined;
  Fertilizing: undefined;
  Repotting: undefined;

  // Subscription screens
  Pro: { isFirstStep?: boolean; fromScanner?: boolean; fromAssistant?: boolean; fromPlantHelp?: boolean };
  OneTimeOffer: { fromFirstTime?: boolean };

  // Chat screens
  Chat: { chatId?: string; plantImage?: string; plantContextMessage?: string };
  ChatProfile: undefined;

  // Scanner info
  InfoScanner: undefined;

  // Tools
  LightMeter: undefined;
};

export type BottomTabParamList = {
  HomeTab: undefined;
  GardenTab: undefined;
  ScannerTab: undefined;
  AssistantTab: undefined;
  ProfileTab: undefined;
};
