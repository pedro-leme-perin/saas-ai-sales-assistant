'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '@/stores';
import type { Locale } from './index';

// Pre-load pt-BR synchronously for instant first render
import ptBR from './dictionaries/pt-BR.json';

type Dictionary = typeof ptBR;
type DotPath<T, Prefix extends string = ''> = T extends object
  ? { [K in keyof T & string]: DotPath<T[K], Prefix extends '' ? K : `${Prefix}.${K}`> }[keyof T & string]
  : Prefix;

const cache = new Map<Locale, Dictionary>();
cache.set('pt-BR', ptBR);

function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path;
}

export function useTranslation() {
  const { locale } = useUIStore();
  const [dictionary, setDictionary] = useState<Dictionary>(
    cache.get(locale as Locale) ?? ptBR
  );

  useEffect(() => {
    const currentLocale = locale as Locale;
    if (cache.has(currentLocale)) {
      setDictionary(cache.get(currentLocale)!);
      return;
    }

    import(`./dictionaries/${currentLocale}.json`)
      .then((mod) => {
        cache.set(currentLocale, mod.default);
        setDictionary(mod.default);
      })
      .catch(() => {
        // Fallback to pt-BR
        setDictionary(ptBR);
      });
  }, [locale]);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>): string => {
      let value = getNestedValue(dictionary, key);
      if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, String(v));
        });
      }
      return value;
    },
    [dictionary]
  );

  return { t, locale: locale as Locale };
}
