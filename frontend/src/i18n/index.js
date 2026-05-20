import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";
import ar from "./ar.json";
import frFlat from "@/locales/fr.json";
import enFlat from "@/locales/en.json";
import arFlat from "@/locales/ar.json";
import settingsJson from "./settings.json";

const storedLanguage = localStorage.getItem("airsense_lang");
const initialLanguage = storedLanguage || "fr";

i18n.use(initReactI18next).init({
  resources: {
    // Compat: certaines pages utilisent des clés “plates” (ex: sidebar_dashboard),
    // d’autres utilisent des namespaces (ex: status.realtime). On fusionne les 2.
    fr: { translation: { ...frFlat, ...fr, ...settingsJson } },
    en: { translation: { ...enFlat, ...en, ...settingsJson } },
    ar: { translation: { ...arFlat, ...ar, ...settingsJson } },
  },
  lng: initialLanguage,
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

function applyDocumentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  localStorage.setItem("airsense_lang", language);
}

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", applyDocumentLanguage);

export default i18n;
