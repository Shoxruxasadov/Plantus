import type { Locale } from '../locale';
import { en } from './en';
import { de } from './de';
import { fr } from './fr';
import { es } from './es';
import { pt } from './pt';
import { ja } from './ja';
import { ko } from './ko';
import { zh } from './zh';
import { th } from './th';
import { id } from './id';

const all: Record<Locale, Record<string, string>> = {
  en,
  de,
  fr,
  es,
  pt,
  ja,
  ko,
  zh,
  th,
  id,
};

export function getTranslations(locale: Locale): Record<string, string> {
  const strings = all[locale] ?? all.en;
  return strings;
}

export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const strings = all[locale] ?? all.en;
  let value = strings[key] ?? (all.en as Record<string, string>)[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    });
  }
  return value;
}

export { en, de, fr, es, pt, ja, ko, zh, th, id };
