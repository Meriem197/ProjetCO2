import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import frLocale from './locales/fr.json';
import enLocale from './locales/en.json';
import arLocale from './locales/ar.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: frLocale },
      en: { translation: enLocale },
      ar: { translation: arLocale },
    },
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
});

export default i18n;
