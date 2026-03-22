export type Locale = 'pt-BR' | 'en';

export const defaultLocale: Locale = 'pt-BR';

export const locales: { code: Locale; label: string }[] = [
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'en', label: 'English' },
];

const dictionaries: Record<Locale, () => Promise<Record<string, any>>> = {
  'pt-BR': () => import('./dictionaries/pt-BR.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
