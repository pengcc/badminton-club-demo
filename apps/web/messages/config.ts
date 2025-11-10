export const languages = ['en', 'de', 'zh'] as const;
export const defaultLanguage = 'de';

export type Language = typeof languages[number];
