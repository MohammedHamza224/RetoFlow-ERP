import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';

const savedLanguage = typeof localStorage !== 'undefined' ? (localStorage.getItem('restoflow_lang') || 'en') : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    ar: { translation: arTranslations },
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// Update DOM attribute for LTR/RTL layout switching
export function setAppLanguage(lang: 'en' | 'ar') {
  i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('restoflow_lang', lang);
  }
  if (typeof document !== 'undefined') {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }
}

// Initial setting on app load
if (typeof document !== 'undefined') {
  setAppLanguage(savedLanguage as 'en' | 'ar');
}

export default i18n;
