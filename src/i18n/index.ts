import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zh from "./locales/zh.json";

const DEFAULT_LANGUAGE = "zh";

const resources = {
  zh: {
    translation: zh,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  debug: false,
});

export default i18n;
