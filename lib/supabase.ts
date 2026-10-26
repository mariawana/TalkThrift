import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const REMEMBER_KEY = 'talkthrift-remember-me';

/*
 * Remember me checked:
 * Keep the session in localStorage.
 *
 * Remember me unchecked:
 * Keep the session in sessionStorage.
 *
 * Passwords are never saved here.
 */

export function getRememberMe(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(REMEMBER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setRememberMe(remember: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      REMEMBER_KEY,
      String(remember)
    );
  } catch {
    // Sign-in can continue if preference storage is unavailable.
  }
}

/*
 * Temporary fallback for browsers that block web storage.
 * This only holds the session in memory.
 */
const memoryStorage = new Map<string, string>();

const authStorage = {
  getItem(name: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const temporary = window.sessionStorage.getItem(name);

      if (temporary !== null) return temporary;

      return (
        window.localStorage.getItem(name) ??
        memoryStorage.get(name) ??
        null
      );
    } catch {
      return memoryStorage.get(name) ?? null;
    }
  },

  setItem(name: string, value: string): void {
    if (typeof window === 'undefined') return;

    memoryStorage.set(name, value);

    try {
      if (getRememberMe()) {
        window.localStorage.setItem(name, value);
        window.sessionStorage.removeItem(name);
      } else {
        window.sessionStorage.setItem(name, value);
        window.localStorage.removeItem(name);
      }

      memoryStorage.delete(name);
    } catch {
      /*
       * Remove stale copies where possible.
       * The current session remains in memory.
       */
      try {
        window.localStorage.removeItem(name);
      } catch {}

      try {
        window.sessionStorage.removeItem(name);
      } catch {}
    }
  },

  removeItem(name: string): void {
    memoryStorage.delete(name);

    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(name);
    } catch {}

    try {
      window.sessionStorage.removeItem(name);
    } catch {}
  },
};

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const supabaseConfigCheck = {
  hasUrl: Boolean(url),
  hasPublishableKey: Boolean(key),
};
