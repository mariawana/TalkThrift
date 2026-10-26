import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const REMEMBER_KEY = 'talkthrift-remember-me';
const memory = new Map<string, string>();

export function getRememberMe(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(REMEMBER_KEY) === 'true'; }
  catch { return false; }
}
export function setRememberMe(value: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(REMEMBER_KEY, String(value)); } catch {}
}
const storage = {
  getItem(name: string): string | null {
    if (typeof window === 'undefined') return null;
    if (memory.has(name)) return memory.get(name)!;
    try { return sessionStorage.getItem(name) ?? localStorage.getItem(name); }
    catch { return null; }
  },
  setItem(name: string, value: string) {
    if (typeof window === 'undefined') return;
    memory.set(name, value);
    try {
      const target = getRememberMe() ? localStorage : sessionStorage;
      const other = getRememberMe() ? sessionStorage : localStorage;
      target.setItem(name, value);
      other.removeItem(name);
      memory.delete(name);
    } catch {
      try { localStorage.removeItem(name); } catch {}
      try { sessionStorage.removeItem(name); } catch {}
    }
  },
  removeItem(name: string) {
    memory.delete(name);
    if (typeof window === 'undefined') return;
    try { sessionStorage.removeItem(name); } catch {}
    try { localStorage.removeItem(name); } catch {}
  },
};
export const supabase = url && key ? createClient(url, key, {
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export const supabaseConfigCheck = { hasUrl: Boolean(url), hasPublishableKey: Boolean(key) };
