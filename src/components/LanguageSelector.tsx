import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, supportedLanguages, getCurrentLanguage } from '../i18n/config';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'inline';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  className = '', 
  variant = 'dropdown' 
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const currentLanguage = getCurrentLanguage();
  const currentLangData = supportedLanguages.find(lang => lang.code === currentLanguage);

  const handleLanguageChange = async (languageCode: string) => {
    await changeLanguage(languageCode);
    setIsOpen(false);
  };

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              currentLanguage === lang.code
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
            title={lang.name}
          >
            <span className="mr-1">{lang.flag}</span>
            <span className="hidden sm:inline">{lang.code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{currentLangData?.flag}</span>
        <span className="hidden sm:inline">{currentLangData?.name}</span>
        <span className="sm:hidden">{currentLangData?.code.toUpperCase()}</span>
        <svg
          className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
            <div className="py-1">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    currentLanguage === lang.code
                      ? 'bg-gray-50 text-blue-700 dark:bg-gray-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <span className="mr-3 text-lg">{lang.flag}</span>
                  <span className="flex-1">{lang.name}</span>
                  {currentLanguage === lang.code && (
                    <svg
                      className="w-4 h-4 ml-2 text-blue-600 dark:text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};