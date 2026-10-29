/**
 * Ajson Studio i18n Localization Engine
 * Provides typed string translation with fallback and parameter interpolation.
 */

export type Locale = 'en' | 'es' | 'ja' | 'de';

export const translations: Record<string, string> = {
  // App Titles & Brand
  'app.title': 'Ajson Studio',
  'app.subtitle': 'AI-Native Desktop Development Environment',
  'app.version': 'v0.2.0-frontend-complete',

  // Layout & Navigation
  'nav.explorer': 'Explorer',
  'nav.search': 'Search',
  'nav.git': 'Source Control',
  'nav.debug': 'Run & Debug',
  'nav.tests': 'Test Explorer',
  'nav.extensions': 'Extensions & MCP',
  'nav.settings': 'Settings',

  // Actions
  'action.newFile': 'New File',
  'action.openFolder': 'Open Folder',
  'action.save': 'Save',
  'action.saveAs': 'Save As',
  'action.commit': 'Commit',
  'action.stage': 'Stage',
  'action.unstage': 'Unstage',
  'action.discard': 'Discard Changes',
  'action.approve': 'Approve',
  'action.reject': 'Reject',
  'action.cancel': 'Cancel',
  'action.clear': 'Clear',
  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.send': 'Send',
  'action.stop': 'Stop',

  // Status & Notifications
  'status.ready': 'AI Ready',
  'status.indexed': 'Indexed: 100%',
  'status.clean': 'Working tree clean',
  'status.noProblems': 'No problems detected in workspace',
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
  }
  return text;
}
