import type { Language } from '../types';

export type Locale = 'en' | 'de' | 'fr' | 'es' | 'pt' | 'ja' | 'ko' | 'zh' | 'th' | 'id';

const LANGUAGE_TO_LOCALE: Record<Language, Locale> = {
  'English (US)': 'en',
  'German (Deutsch)': 'de',
  'French (Français)': 'fr',
  'Spanish (Español)': 'es',
  'Portuguese (Português)': 'pt',
  'Japanese (日本語)': 'ja',
  'Korean (한국어)': 'ko',
  'Chinese Simplified': 'zh',
  'Thai (ไทย)': 'th',
  'Indonesian (Bahasa)': 'id',
};

export function languageToLocale(language: Language): Locale {
  return LANGUAGE_TO_LOCALE[language] ?? 'en';
}
