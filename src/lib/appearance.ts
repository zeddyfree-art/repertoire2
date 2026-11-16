import { useSyncExternalStore } from 'react';

export type Appearance = 'auto' | 'light' | 'dark';
const KEY = 'repertoire2-appearance';
const QUERY = '(prefers-color-scheme: dark)';
let preference: Appearance = read();
const listeners = new Set<() => void>();

function read(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function notify() { for (const listener of listeners) listener(); }

export function appearance(): Appearance { return preference; }

export function applyAppearance() {
  if (typeof document === 'undefined') return;
  const dark = preference === 'dark' || (preference === 'auto' && window.matchMedia?.(QUERY).matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function setAppearance(value: Appearance) {
  preference = value;
  try { localStorage.setItem(KEY, value); } catch { /* private browsing */ }
  applyAppearance();
  notify();
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    appearance,
    () => 'auto',
  );
}

export function initAppearance() {
  applyAppearance();
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia(QUERY).addEventListener('change', applyAppearance);
  }
}
