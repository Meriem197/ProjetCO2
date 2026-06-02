import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";
import ar from "./ar.json";
import frFlat from "@/locales/fr.json";
import enFlat from "@/locales/en.json";
import arFlat from "@/locales/ar.json";
import settingsFr from "./settings.json";
import settingsEn from "./settings.en.json";
import settingsAr from "./settings.ar.json";

const LANG_STORAGE_KEY = "airsense_lang";
const LANG_USER_CHOICE_KEY = "airsense_lang_user_choice";

/** Français au premier démarrage ; autre langue uniquement après clic explicite dans le Header. */
function resolveInitialLanguage() {
  const userChose = localStorage.getItem(LANG_USER_CHOICE_KEY) === "1";
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (userChose && stored && ["fr", "en", "ar"].includes(stored)) {
    return stored;
  }
  return "fr";
}

const initialLanguage = resolveInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: { ...frFlat, ...fr, ...settingsFr } },
    en: { translation: { ...enFlat, ...en, ...settingsEn } },
    ar: { translation: { ...arFlat, ...ar, ...settingsAr } },
  },
  lng: initialLanguage,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

function applyDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  localStorage.setItem(LANG_STORAGE_KEY, language);
}

/** À appeler uniquement depuis le sélecteur de langue du Header. */
export function setUserLanguage(language) {
  if (!["fr", "en", "ar"].includes(language)) return;
  localStorage.setItem(LANG_USER_CHOICE_KEY, "1");
  i18n.changeLanguage(language);
}

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;
