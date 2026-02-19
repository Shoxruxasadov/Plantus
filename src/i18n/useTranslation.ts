import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { languageToLocale } from './locale';
import { t as tFn } from './translations';

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const locale = languageToLocale(language);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => tFn(locale, key, params),
    [locale]
  );

  return { t, locale, language };
}
