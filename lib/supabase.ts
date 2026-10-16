import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH === 'true';
const rememberMeStorageKey = 'pill_tracker_remember_me';

export const getRememberMePreference = () =>
  typeof window === 'undefined' || window.localStorage.getItem(rememberMeStorageKey) !== 'false';

export const setRememberMePreference = (rememberMe: boolean) => {
  window.localStorage.setItem(rememberMeStorageKey, String(rememberMe));
};

const authStorage = {
  async getItem(key: string) {
    if (typeof window === 'undefined') return null;
    const storage = getRememberMePreference() ? window.localStorage : window.sessionStorage;
    return storage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    const rememberMe = getRememberMePreference();
    const storage = rememberMe ? window.localStorage : window.sessionStorage;
    const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;
    storage.setItem(key, value);
    otherStorage.removeItem(key);
  },
  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const isSupabaseConfigured = Boolean(
  supabaseAuthEnabled && supabaseUrl && supabaseAnonKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { storage: authStorage },
    })
  : null;