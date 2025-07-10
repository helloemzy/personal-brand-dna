import { useTranslation as useI18nTranslation } from 'react-i18next';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();
  
  return {
    t,
    i18n,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
  };
};

// Re-export the Trans component for complex translations
export { Trans } from 'react-i18next';