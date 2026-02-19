import type { Locale } from '../i18n/locale';

export interface ArticleSection {
  title: string;
  description: string;
}

/**
 * Get localized string from article title/description JSON.
 * DB format: { "en": "...", "de": "...", ... }
 */
export function getLocalizedString(
  value: Record<string, string> | string | null | undefined,
  locale: Locale
): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value['en'] ?? Object.values(value)[0] ?? '';
}

/**
 * Get localized sections array from article sections JSON.
 * DB format: { "en": [{ title, description }], "de": [...], ... }
 */
export function getLocalizedSections(
  sections: Record<string, ArticleSection[]> | null | undefined,
  locale: Locale
): ArticleSection[] {
  if (sections == null) return [];
  const list = sections[locale] ?? sections['en'];
  return Array.isArray(list) ? list : [];
}
