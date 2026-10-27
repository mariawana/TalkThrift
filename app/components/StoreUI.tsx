'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type Notice = { type: 'error' | 'success' | 'info'; text: string } | null;
export function Alert({ notice }: { notice: Notice }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (notice) ref.current?.focus(); }, [notice]);
  if (!notice) return null;
  return <div ref={ref} tabIndex={-1} role={notice.type === 'error' ? 'alert' : 'status'} className={`ttAlert ttAlert-${notice.type}`}>
    <strong>{notice.type === 'error' ? 'Please check: ' : notice.type === 'success' ? 'Success: ' : ''}</strong>{notice.text}
  </div>;
}
export function Modal({ open, title, onClose, children }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [open]);
  return <dialog ref={ref} className="ttDialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ttDialogBody"><div className="ttDialogHeading"><h2 id={titleId}>{title}</h2>
      <button type="button" className="ttIconButton" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</section>
  </dialog>;
}
export function LoginDialog({ open, next, onClose }: { open: boolean; next: string; onClose: () => void }) {
  return <Modal open={open} title="Log in to continue" onClose={onClose}>
    <p>Please log in or create an account to buy this piece, make an offer, or message the seller.</p>
    <div className="ttStack"><Link className="primary" href={`/account?next=${encodeURIComponent(next)}`}>Log In ↗</Link>
      <Link className="secondary" href={`/account?mode=signup&next=${encodeURIComponent(next)}`}>Create Account</Link>
      <button className="ttPlainButton" type="button" onClick={onClose}>Not Now</button></div>
  </Modal>;
}
export function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    function sync() {
      let saved: string | null = null;
      try { saved = localStorage.getItem('talkthrift-theme'); } catch {}
      const value = saved === 'dark' || saved === 'light' ? saved : media.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = value;
      setTheme(value);
    }
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    window.addEventListener('talkthrift-theme-change', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); window.removeEventListener('talkthrift-theme-change', sync); };
  }, []);
  function toggle() {
    const value = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try { localStorage.setItem('talkthrift-theme', value); } catch {}
    window.dispatchEvent(new Event('talkthrift-theme-change'));
  }
  return <button className="ttThemeNav" type="button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
    <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span><span className="ttThemeNavHint">{theme === 'dark' ? 'ON' : 'OFF'}</span>
  </button>;
}
export function SiteTools() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open || !supabase) return;
    const client = supabase;
    let active = true;
    setIsOwner(false);
    (async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (!active || error || !user) return;
      const { data } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active) setIsOwner(data?.role === 'owner');
    })();
    return () => { active = false; };
  }, [open]);
  if (pathname === '/') return null;
  return <><header className="ttPageNav"><Link href="/" className="ttLogo">TALK<span>THRIFT</span></Link><button type="button" className="ttMenuButton ttPageMenuButton" aria-label="Open navigation menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>☰ <span>MENU</span></button></header>
    <Modal open={open} title="Menu" onClose={() => setOpen(false)}><nav className="ttDialogNav" aria-label="Store navigation">
      <Link href="/#shop" onClick={() => setOpen(false)}>Shop all <span>↗</span></Link>
      <Link href="/account" onClick={() => setOpen(false)}>Account / Sign in <span>↗</span></Link>
      <Link href="/orders" onClick={() => setOpen(false)}>My orders <span>↗</span></Link>
      <Link href="/messages" onClick={() => setOpen(false)}>Messages <span>↗</span></Link>
      {isOwner && <Link href="/admin" onClick={() => setOpen(false)}>Seller dashboard <span>↗</span></Link>}
      <Link href="/#footer" onClick={() => setOpen(false)}>Contact <span>↗</span></Link>
      <ThemeToggle />
    </nav></Modal></>;
}
