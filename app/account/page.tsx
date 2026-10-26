'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getRememberMe, setRememberMe } from '@/lib/supabase';
import { Alert, Modal } from '../components/StoreUI';
import type { Notice } from '../components/StoreUI';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
type Account = { id: string; email: string; role: string; fullName: string; phone: string; address: string };
function authError(error: { message: string; code?: string }) {
  const text = error.message.toLowerCase();
  if (error.code === 'invalid_credentials' || text.includes('invalid login credentials')) return 'Incorrect email or password. Please try again.';
  if (error.code === 'email_not_confirmed' || text.includes('email not confirmed')) return 'Please confirm your email before logging in. Check your inbox and spam folder.';
  if (text.includes('rate limit') || text.includes('too many') || error.code?.includes('rate_limit')) return 'Too many attempts. Please wait before trying again.';
  if (error.code === 'weak_password') return 'Choose a stronger password that meets the store’s password requirements.';
  if (error.code === 'same_password') return 'Choose a password different from your current password.';
  return 'Unable to complete your request. Check your details and internet connection, then try again.';
}
export default function AccountPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const fail = (text: string) => setNotice({ type: 'error', text });
  const success = (text: string) => setNotice({ type: 'success', text });
  const loadAccount = useCallback(async () => {
    if (!supabase) { setNotice({ type: 'error', text: 'Store connection is unavailable. Please try again later.' }); setChecking(false); return; }
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user) {
        setAccount(null);
        if (error && error.name !== 'AuthSessionMissingError') setNotice({ type: 'error', text: 'Unable to verify your session. Please log in again.' });
        return;
      }
      if (error) throw error;
      const { data, error: profileError } = await supabase.from('profiles').select('role,full_name,phone,delivery_address').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      setAccount({ id: user.id, email: user.email ?? '', role: data?.role ?? 'customer', fullName: data?.full_name ?? user.user_metadata?.full_name ?? '', phone: data?.phone ?? user.user_metadata?.phone ?? '', address: data?.delivery_address ?? user.user_metadata?.delivery_address ?? '' });
    } catch { setNotice({ type: 'error', text: 'Unable to load your account. Refresh and try again.' }); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    setRemember(getRememberMe());
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'reset') setMode('reset');
    else if (params.get('mode') === 'signup') setMode('signup');
    const hash = new URLSearchParams(location.hash.slice(1));
    if (params.has('error') || hash.has('error')) { setMode('forgot'); setNotice({ type: 'error', text: 'Your email link is invalid or expired. Request a new reset link.' }); }
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { setMode('reset'); setPassword(''); setConfirmation(''); setNotice(null); }
      if (event === 'SIGNED_OUT') setAccount(null);
    });
    void loadAccount();
    return () => subscription?.data.subscription.unsubscribe();
  }, [loadAccount]);
  function changeMode(next: Mode) { setMode(next); setPassword(''); setConfirmation(''); setVisible(false); setNotice(null); }
  function nextPath() {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && !/[\u0000-\u001f]/.test(next) && next.split(/[?#]/)[0] !== '/account' ? next : '/';
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setNotice(null);
    if (!supabase) { fail('The store connection is unavailable.'); return; }
    if ((mode === 'signup' || mode === 'reset') && (password.length < 8 || password !== confirmation)) { fail(password.length < 8 ? 'Use at least 8 characters for your password.' : 'Your passwords do not match.'); return; }
    if (mode === 'signup' && (!fullName.trim() || !phone.trim() || !address.trim())) { fail('Please complete your name, contact number, and delivery address.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/account?mode=reset` });
        if (error) { fail(authError(error)); return; }
        success('If an account exists for this email, you’ll receive a reset link. Check your inbox and spam folder.'); return;
      }
      if (mode === 'reset') {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) { fail('Your reset session is missing or expired. Request a new reset link.'); return; }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { fail(authError(error)); return; }
        setPassword(''); setConfirmation(''); setMode('login'); history.replaceState({}, '', '/account'); await loadAccount(); success('Your password has been updated.'); return;
      }
      setRememberMe(mode === 'login' ? remember : false);
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim(), phone: phone.trim(), delivery_address: address.trim() } } });
        if (error) { fail(authError(error)); return; }
        if (data.session) { router.push(nextPath()); router.refresh(); return; }
        changeMode('login'); success('Check your email for account confirmation. If you already have an account, log in or reset your password.'); return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { fail(authError(error)); return; }
      router.push(nextPath()); router.refresh();
    } catch { fail('Unable to connect. Check your internet and try again.'); }
    finally { setBusy(false); }
  }
  function startEditing() { if (!account) return; setFullName(account.fullName); setPhone(account.phone); setAddress(account.address); setEditing(true); setNotice(null); }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !account || busy) return; setNotice(null);
    if (!fullName.trim() || !phone.trim() || !address.trim()) { fail('Please complete all your contact details.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim(), delivery_address: address.trim() }).eq('id', account.id).select('id').maybeSingle();
      if (error || !data) { fail('Your changes could not be saved. Please try again.'); return; }
      setAccount({ ...account, fullName: fullName.trim(), phone: phone.trim(), address: address.trim() }); setEditing(false); success('Your account information has been updated.');
    } catch { fail('Unable to save. Check your internet connection.'); }
    finally { setBusy(false); }
  }
  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !account || busy) return; setNotice(null);
    const value = newEmail.trim();
    if (value.toLowerCase() === account.email.toLowerCase()) { fail('Enter a different email address.'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email: value });
      if (error) { fail(authError(error)); return; }
      if (data.user?.email?.toLowerCase() === value.toLowerCase()) { setAccount({ ...account, email: data.user.email }); success('Your email address has been updated.'); }
      else success('Check your new email and current inbox for confirmation instructions. Your email changes after the required confirmations.');
      setNewEmail('');
    } catch { fail('Unable to update your email. Try again.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!supabase || busy) return; setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) { fail('Unable to log out. Try again.'); return; }
      setAccount(null); setEditing(false); changeMode('login'); success('You have logged out successfully.'); router.replace('/account'); router.refresh();
    } catch { fail('Unable to log out. Check your connection.'); }
    finally { setBusy(false); setLogoutOpen(false); }
  }
  const signedInView = account && (mode === 'login' || mode === 'signup');
  const isNewPassword = mode === 'signup' || mode === 'reset';
  return <main className="adminWrap"><header className="adminHeader"><Link href="/" className="brand">TALK<span>THRIFT</span></Link><Link href="/">← Back to Store</Link></header>
    {checking ? <section className="adminPanel accountPanel"><p role="status">Checking your account…</p></section> : signedInView ?
    <section className="adminPanel accountPanel"><p className="eyebrow">YOUR TALKTHRIFT ACCOUNT</p><h1>{account.fullName ? `Hello, ${account.fullName}!` : 'My Account'}</h1><Alert notice={notice} />
      {editing ? <form className="ttStack" onSubmit={saveProfile}><h2>Edit account information</h2>
        <label>Full name<input autoComplete="name" required maxLength={120} disabled={busy} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
        <label>Contact number<input type="tel" autoComplete="tel" required maxLength={30} disabled={busy} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>Delivery address<textarea autoComplete="street-address" required maxLength={500} disabled={busy} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(false); setNotice(null); }}>Cancel editing</button>
      </form> : <><dl className="ttAccountDetails"><dt>Name</dt><dd>{account.fullName || 'Not added'}</dd><dt>Email</dt><dd>{account.email}</dd><dt>Contact number</dt><dd>{account.phone || 'Not added'}</dd><dt>Delivery address</dt><dd>{account.address || 'Not added'}</dd><dt>Account type</dt><dd>{account.role === 'owner' ? 'Seller / Admin' : 'Customer'}</dd></dl>
        <button type="button" className="secondary" disabled={busy} onClick={startEditing}>Edit account information</button>
        <details><summary>Change email address</summary><form className="ttStack" onSubmit={changeEmail}><label>New email address<input type="email" autoComplete="email" required disabled={busy} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></label><button className="secondary" disabled={busy}>{busy ? 'Please wait…' : 'Update email'}</button></form></details></>}
      {account.role === 'owner' && <Link className="primary" href="/admin">Seller Dashboard ↗</Link>}
      <Link className="primary" href="/orders">My Orders ↗</Link><Link className="secondary" href="/messages">My Messages ↗</Link>
      <button type="button" className="secondary" disabled={busy} onClick={() => { setEmail(account.email); changeMode('forgot'); }}>Request password reset</button>
      <button type="button" className="ttDanger" disabled={busy} onClick={() => setLogoutOpen(true)}>Log out</button>
    </section> : <form className="adminPanel accountPanel" onSubmit={submit}>
      <p className="eyebrow">YOUR TALKTHRIFT ACCOUNT</p><h1>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Forgot your password?' : mode === 'reset' ? 'Set a new password' : 'Welcome back.'}</h1>
      <p>{mode === 'forgot' ? 'Enter your account email to request a reset link.' : mode === 'reset' ? 'Choose a new password with at least 8 characters.' : 'Shop your next find, make an offer, and message the seller.'}</p><Alert notice={notice} />
      {mode === 'signup' && <><label>Full name<input autoComplete="name" required maxLength={120} disabled={busy} value={fullName} onChange={(e) => setFullName(e.target.value)} /></label><label>Contact number<input type="tel" autoComplete="tel" required maxLength={30} disabled={busy} value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label>Delivery address<textarea autoComplete="street-address" required maxLength={500} disabled={busy} value={address} onChange={(e) => setAddress(e.target.value)} /></label></>}
      {mode !== 'reset' && <label>Email address<input type="email" autoComplete="email" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      {mode !== 'forgot' && <><label htmlFor="account-password">{mode === 'reset' ? 'New password' : 'Password'}</label><div className="ttPasswordRow"><input id="account-password" type={visible ? 'text' : 'password'} autoComplete={isNewPassword ? 'new-password' : 'current-password'} minLength={isNewPassword ? 8 : undefined} required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="secondary" aria-controls="account-password" aria-pressed={visible} aria-label={visible ? 'Hide password' : 'Show password'} disabled={busy} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></>}
      {isNewPassword && <label>Confirm password<input type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} disabled={busy} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>}
      {mode === 'login' && <div className="ttLoginOptions"><label className="ttCheckLabel"><input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />Remember me</label><button type="button" className="ttPlainButton" disabled={busy} onClick={() => changeMode('forgot')}>Forgot password?</button></div>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in ↗' : mode === 'signup' ? 'Create account ↗' : mode === 'forgot' ? 'Send reset link ↗' : 'Save new password ↗'}</button>
      {(mode === 'login' || mode === 'signup') ? <p className="accountSwitch">{mode === 'login' ? 'New to TalkThrift?' : 'Already have an account?'} <button type="button" disabled={busy} onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign up' : 'Log in'}</button></p> : <button type="button" className="secondary" disabled={busy} onClick={() => { changeMode('login'); history.replaceState({}, '', '/account'); void loadAccount(); }}>← Back to account</button>}
      {mode === 'reset' && <button type="button" className="ttPlainButton" disabled={busy} onClick={() => changeMode('forgot')}>Request a new reset link</button>}
    </form>}
    <Modal open={logoutOpen} title="Log out of TalkThrift?" onClose={() => { if (!busy) setLogoutOpen(false); }}><p>You can log in again any time.</p><div className="ttActions"><button className="secondary" type="button" disabled={busy} onClick={() => setLogoutOpen(false)}>Stay signed in</button><button className="ttDanger" type="button" disabled={busy} onClick={logout}>{busy ? 'Logging out…' : 'Log out'}</button></div></Modal>
  </main>;
}
