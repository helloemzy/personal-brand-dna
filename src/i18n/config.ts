import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Import translations
import enTranslations from './locales/en/translations.json';

// Placeholder translations until files are created
const esTranslations = {};
const frTranslations = {};
const deTranslations = {};
const zhTranslations = {};
const jaTranslations = {};

export const defaultNS = 'translations';
export const resources = {
  en: {
    translations: enTranslations,
  },
  es: {
    translations: esTranslations,
  },
  fr: {
    translations: frTranslations,
  },
  de: {
    translations: deTranslations,
  },
  zh: {
    translations: zhTranslations,
  },
  ja: {
    translations: jaTranslations,
  },
} as const;

i18n
  // Load translations using http backend
  .use(HttpBackend)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection options
    detection: {
      order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    resources,
    defaultNS,

    // React options
    react: {
      useSuspense: false, // Disable suspense to avoid loading states
    },

    // Backend options
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;

// Supported languages
export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

// Helper function to get current language
export const getCurrentLanguage = () => {
  return i18n.language || 'en';
};

// Helper function to change language
export const changeLanguage = async (language: string) => {
  await i18n.changeLanguage(language);
  // Store preference
  localStorage.setItem('preferredLanguage', language);
  // Update HTML lang attribute
  document.documentElement.lang = language;
};