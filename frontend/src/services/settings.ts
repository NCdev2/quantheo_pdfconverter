const STORAGE_KEY = 'stirlingpdf-backend-url';
const DEFAULT_BACKEND = 'http://localhost:4000';

export const getBackendUrl = (): string => {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim().length > 0) {
    return stored.trim();
  }
  return DEFAULT_BACKEND;
};

export const saveBackendUrl = (value: string): void => {
  const url = value.trim() || DEFAULT_BACKEND;
  window.localStorage.setItem(STORAGE_KEY, url);
};
