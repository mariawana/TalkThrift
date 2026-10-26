'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
export function SiteTools() {
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? 'light');
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('talkthrift-theme'); } catch {}
      const next = saved === 'dark' || saved === 'light' ? saved : media.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('talkthrift-theme', next); } catch {}
  }
  return <div className="ttSiteTools" aria-label="Page controls">
    <Link href="/">{pathname === '/' ? 'TALKTHRIFT' : '← Back to Store'}</Link>
    <div><Link href="/account">Account</Link><button className="ttThemeButton" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      {theme === 'dark' ? '☀ Light' : '☾ Dark'}
    </button></div>
  </div>;
}
