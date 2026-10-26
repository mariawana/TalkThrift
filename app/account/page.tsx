'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  supabase,
  getRememberMe,
  setRememberMe,
} from '@/lib/supabase';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

type Account = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  phone: string;
  address: string;
};

type Notice = {
  type: 'error' | 'success' | 'info';
  text: string;
} | null;

export default function AccountPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const showError = (text: string) =>
    setNotice({ type: 'error', text });

  const showSuccess = (text: string) =>
    setNotice({ type: 'success', text });

  const loadAccount = useCallback(async () => {
    if (!supabase) {
      setNotice({
        type: 'error',
        text: 'The store connection is unavailable. Please try again later.',
      });
      setChecking(false);
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!user) {
        setAccount(null);

        if (error && error.name !== 'AuthSessionMissingError') {
          setNotice({
            type: 'error',
            text: 'Unable to verify your session. Please log in again.',
          });
        }

        return;
      }

      if (error) throw error;

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role,full_name,phone,delivery_address')
          .eq('id', user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      setAccount({
        id: user.id,
        email: user.email ?? '',
        role: profile?.role ?? 'customer',
        fullName:
          profile?.full_name ??
          user.user_metadata?.full_name ??
          '',
        phone:
          profile?.phone ??
          user.user_metadata?.phone ??
          '',
        address:
          profile?.delivery_address ??
          user.user_metadata?.delivery_address ??
          '',
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'Unable to load your account. Please refresh and try again.',
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    setRemember(getRememberMe());

    const search = new URLSearchParams(window.location.search);

    if (search.get('mode') === 'reset') {
      setMode('reset');
    }

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );

    if (
      search.has('error') ||
      hash.has('error')
    ) {
      setNotice({
        type: 'error',
        text: 'This email link is invalid or expired. Request a new password reset link.',
      });
      setMode('forgot');
    }

    const subscription = supabase?.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset');
          setPassword('');
          setConfirmPassword('');
          setNotice(null);
        }

        if (event === 'SIGNED_OUT') {
          setAccount(null);
        }
      }
    );

    void loadAccount();

    return () => {
      subscription?.data.subscription.unsubscribe();
    };
  }, [loadAccount]);

  useEffect(() => {
    if (notice) {
      document.getElementById('account-notice')?.focus();
    }
  }, [notice]);

  function changeMode(next: Mode) {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setNotice(null);
  }

  function nextPath() {
    const value = new URLSearchParams(
      window.location.search
    ).get('next');

    if (
      value &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !/[\u0000-\u001f]/.test(value) &&
      value.split(/[?#]/)[0] !== '/account'
    ) {
      return value;
    }

    return '/';
  }

  function friendlyAuthError(
    error: { message: string; code?: string }
  ) {
    const code = error.code;
    const text = error.message.toLowerCase();

    if (
      code === 'invalid_credentials' ||
      text.includes('invalid login credentials')
    ) {
      return 'Incorrect email or password. Please try again.';
    }

    if (
      code === 'email_not_confirmed' ||
      text.includes('email not confirmed')
    ) {
      return 'Please confirm your email before logging in. Check your inbox and spam folder.';
    }

    if (
      code === 'over_request_rate_limit' ||
      code === 'over_email_send_rate_limit' ||
      text.includes('rate limit') ||
      text.includes('too many')
    ) {
      return 'Too many attempts. Please wait a little before trying again.';
    }

    if (
      code === 'user_already_exists' ||
      text.includes('already registered')
    ) {
      return 'Unable to create this account. Try logging in or resetting your password.';
    }

    if (code === 'weak_password') {
      return 'Choose a stronger password that meets the store’s password requirements.';
    }

    return 'Unable to complete your request. Check your details and connection, then try again.';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setNotice(null);

    const client = supabase;

    if (!client) {
      showError('The store connection is unavailable.');
      return;
    }

    const needsNewPassword =
      mode === 'signup' || mode === 'reset';

    if (
      needsNewPassword &&
      password.length < 8
    ) {
      showError('Use at least 8 characters for your password.');
      return;
    }

    if (
      needsNewPassword &&
      password !== confirmPassword
    ) {
      showError('Your passwords do not match.');
      return;
    }

    if (
      mode === 'signup' &&
      (!fullName.trim() || !phone.trim() || !address.trim())
    ) {
      showError('Please complete your name, contact number, and delivery address.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'forgot') {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              `${window.location.origin}/account?mode=reset`,
          }
        );

        if (error) {
          showError(friendlyAuthError(error));
          return;
        }

        showSuccess(
          'If an account exists for this email, you’ll receive a password reset link. Check your inbox and spam folder.'
        );
        return;
      }

      if (mode === 'reset') {
        const {
          data: { user },
          error: sessionError,
        } = await client.auth.getUser();

        if (sessionError || !user) {
          showError(
            'Your reset session is missing or expired. Request a new reset link.'
          );
          return;
        }

        const { error } = await client.auth.updateUser({
          password,
        });

        if (error) {
          showError(friendlyAuthError(error));
          return;
        }

        setPassword('');
        setConfirmPassword('');
        setMode('login');
        window.history.replaceState({}, '', '/account');

        await loadAccount();

        showSuccess(
          'Your password has been updated successfully.'
        );
        return;
      }

      /*
       * Apply the session choice before signing in.
       * Signups use a temporary session by default.
       */
      setRememberMe(mode === 'login' ? remember : false);

      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              delivery_address: address.trim(),
            },
          },
        });

        if (error) {
          showError(friendlyAuthError(error));
          return;
        }

        if (data.session) {
          router.push(nextPath());
          router.refresh();
          return;
        }

        setMode('login');
        setPassword('');
        setConfirmPassword('');

        showSuccess(
          'Check your email for account confirmation. If you already have an account, log in or reset your password.'
        );
        return;
      }

      const { error } =
        await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        showError(friendlyAuthError(error));
        return;
      }

      router.push(nextPath());
      router.refresh();
    } catch {
      showError(
        'Unable to connect. Check your internet connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    if (!account) return;

    setFullName(account.fullName);
    setPhone(account.phone);
    setAddress(account.address);
    setEditing(true);
    setNotice(null);
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!supabase || !account || busy) return;

    setNotice(null);

    if (
      !fullName.trim() ||
      !phone.trim() ||
      !address.trim()
    ) {
      showError('Please complete all your contact details.');
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          delivery_address: address.trim(),
        })
        .eq('id', account.id)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        showError(
          'Your changes could not be saved. Please try again.'
        );
        return;
      }

      setAccount({
        ...account,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });

      setEditing(false);
      showSuccess('Your account information has been updated.');
    } catch {
      showError('Unable to save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!supabase || !account || busy) return;

    setNotice(null);

    const value = newEmail.trim();

    if (value.toLowerCase() === account.email.toLowerCase()) {
      showError('Please enter a different email address.');
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        email: value,
      });

      if (error) {
        showError(friendlyAuthError(error));
        return;
      }

      if (data.user?.email?.toLowerCase() === value.toLowerCase()) {
        setAccount({ ...account, email: data.user.email });
        showSuccess('Your email address has been updated.');
      } else {
        showSuccess(
          'Check your new email and current inbox for confirmation instructions. Your email changes after the required confirmations.'
        );
      }

      setNewEmail('');
    } catch {
      showError('Unable to update your email. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!supabase || busy) return;

    setNotice(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        showError('Unable to log out. Please try again.');
        return;
      }

      setAccount(null);
      setEditing(false);
      setPassword('');
      setConfirmPassword('');
      setMode('login');

      showSuccess('You have logged out successfully.');
      router.replace('/account');
      router.refresh();
    } catch {
      showError('Unable to log out. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  const noticeBox = notice ? (
    <div
      id="account-notice"
      tabIndex={-1}
      role={notice.type === 'error' ? 'alert' : 'status'}
      style={{
        padding: '14px 16px',
        borderRadius: 8,
        lineHeight: 1.6,
        fontSize: 14,
        overflowWrap: 'anywhere',
        background:
          notice.type === 'error'
            ? '#fff1f2'
            : notice.type === 'success'
              ? '#ecfdf5'
              : '#eff6ff',
        color:
          notice.type === 'error'
            ? '#9f1239'
            : notice.type === 'success'
              ? '#065f46'
              : '#1e40af',
        border: `1px solid ${
          notice.type === 'error'
            ? '#fecdd3'
            : notice.type === 'success'
              ? '#a7f3d0'
              : '#bfdbfe'
        }`,
      }}
    >
      <strong>
        {notice.type === 'error'
          ? 'Please check: '
          : notice.type === 'success'
            ? 'Success: '
            : ''}
      </strong>
      {notice.text}
    </div>
  ) : null;

  const newPasswordMode =
    mode === 'signup' || mode === 'reset';

  return (
    <main className="adminWrap">
      <header className="adminHeader">
        <Link href="/" className="brand">
          TALK<span>THRIFT</span>
        </Link>

        <Link href="/">← Back to Store</Link>
      </header>

      {checking ? (
        <section className="adminPanel accountPanel">
          <p role="status">Checking your account…</p>
        </section>
      ) : mode !== 'reset' && account ? (
        <section className="adminPanel accountPanel">
          <p className="eyebrow">YOUR TALKTHRIFT ACCOUNT</p>

          <h1>
            {account.fullName
              ? `Hello, ${account.fullName}!`
              : 'My Account'}
          </h1>

          {noticeBox}

          {editing ? (
            <form
              onSubmit={saveProfile}
              style={{ display: 'grid', gap: 16 }}
            >
              <h2>Edit account information</h2>

              <label>
                Full name
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  required
                  maxLength={120}
                  disabled={busy}
                />
              </label>

              <label>
                Contact number
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  required
                  maxLength={30}
                  disabled={busy}
                />
              </label>

              <label>
                Delivery address
                <textarea
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  required
                  maxLength={500}
                  disabled={busy}
                />
              </label>

              <button
                type="submit"
                className="primary"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>

              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setNotice(null);
                }}
              >
                Cancel editing
              </button>
            </form>
          ) : (
            <>
              <dl
                style={{
                  display: 'grid',
                  gap: 10,
                  lineHeight: 1.7,
                  overflowWrap: 'anywhere',
                }}
              >
                <dt><strong>Email</strong></dt>
                <dd style={{ margin: 0 }}>{account.email}</dd>

                <dt><strong>Contact number</strong></dt>
                <dd style={{ margin: 0 }}>
                  {account.phone || 'Not added yet'}
                </dd>

                <dt><strong>Delivery address</strong></dt>
                <dd style={{ margin: 0 }}>
                  {account.address || 'Not added yet'}
                </dd>

                <dt><strong>Account type</strong></dt>
                <dd style={{ margin: 0 }}>
                  {account.role === 'owner'
                    ? 'Seller / Admin'
                    : 'Customer'}
                </dd>
              </dl>

              <button
                type="button"
                className="secondary"
                onClick={startEditing}
                disabled={busy}
              >
                Edit account information
              </button>

              <details>
                <summary style={{ cursor: 'pointer', padding: '12px 0' }}>
                  Change email address
                </summary>

                <form
                  onSubmit={changeEmail}
                  style={{ display: 'grid', gap: 12 }}
                >
                  <label>
                    New email address
                    <input
                      type="email"
                      autoComplete="email"
                      value={newEmail}
                      onChange={(event) =>
                        setNewEmail(event.target.value)
                      }
                      required
                      disabled={busy}
                    />
                  </label>

                  <button
                    type="submit"
                    className="secondary"
                    disabled={busy}
                  >
                    {busy ? 'Please wait…' : 'Update email'}
                  </button>
                </form>
              </details>
            </>
          )}

          {account.role === 'owner' && (
            <Link href="/admin" className="primary">
              Seller Dashboard ↗
            </Link>
          )}

          <Link href="/orders" className="primary">
            My Orders ↗
          </Link>

          <Link href="/messages" className="secondary">
            My Messages ↗
          </Link>

          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setEmail(account.email);
              changeMode('forgot');
              setAccount(null);
            }}
          >
            Request password reset
          </button>

          <button
            type="button"
            className="secondary"
            onClick={logout}
            disabled={busy}
            style={{ color: '#b91c1c', borderColor: '#b91c1c' }}
          >
            {busy ? 'Please wait…' : 'Log out'}
          </button>
        </section>
      ) : (
        <form
          className="adminPanel accountPanel"
          onSubmit={submit}
        >
          <p className="eyebrow">YOUR TALKTHRIFT ACCOUNT</p>

          <h1>
            {mode === 'signup'
              ? 'Create your account'
              : mode === 'forgot'
                ? 'Forgot your password?'
                : mode === 'reset'
                  ? 'Set a new password'
                  : 'Welcome back.'}
          </h1>

          <p>
            {mode === 'signup'
              ? 'Sign up to shop, make offers, and message the seller.'
              : mode === 'forgot'
                ? 'Enter your account email to request a password reset link.'
                : mode === 'reset'
                  ? 'Choose a new password with at least 8 characters.'
                  : 'Log in to shop, view your orders, and message the seller.'}
          </p>

          {noticeBox}

          {mode === 'signup' && (
            <>
              <label>
                Full name
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  required
                  maxLength={120}
                  disabled={busy}
                />
              </label>

              <label>
                Contact number
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="09XXXXXXXXX"
                  required
                  maxLength={30}
                  disabled={busy}
                />
              </label>

              <label>
                Delivery address
                <textarea
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) =>
                    setAddress(event.target.value)
                  }
                  placeholder="House, street, barangay, city, province"
                  required
                  maxLength={500}
                  disabled={busy}
                />
              </label>
            </>
          )}

          {mode !== 'reset' && (
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                disabled={busy}
              />
            </label>
          )}

          {mode !== 'forgot' && (
            <>
              <label htmlFor="account-password">
                {mode === 'reset' ? 'New password' : 'Password'}
              </label>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 8,
                }}
              >
                <input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    newPasswordMode
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={newPasswordMode ? 8 : undefined}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  disabled={busy}
                  style={{ minWidth: 0, flex: 1 }}
                />

                <button
                  type="button"
                  className="secondary"
                  aria-controls="account-password"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  disabled={busy}
                  style={{ minWidth: 68, padding: '10px' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </>
          )}

          {newPasswordMode && (
            <label>
              Confirm password
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                required
                disabled={busy}
              />
            </label>
          )}

          {mode === 'login' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <label
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) =>
                    setRemember(event.target.checked)
                  }
                  disabled={busy}
                  style={{
                    width: 18,
                    height: 18,
                    padding: 0,
                    accentColor: '#243f9b',
                  }}
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() => changeMode('forgot')}
                disabled={busy}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--blue)',
                  textDecoration: 'underline',
                  padding: '8px 0',
                  fontSize: 12,
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="primary"
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : mode === 'reset'
                    ? 'Save new password'
                    : 'Log in'}
            <span aria-hidden="true">↗</span>
          </button>

          {mode === 'login' || mode === 'signup' ? (
            <p className="accountSwitch">
              {mode === 'signup'
                ? 'Already have an account?'
                : 'New to TalkThrift?'}{' '}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  changeMode(mode === 'signup' ? 'login' : 'signup')
                }
              >
                {mode === 'signup' ? 'Log in' : 'Sign up'}
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                changeMode('login');
                window.history.replaceState({}, '', '/account');
                void loadAccount();
              }}
            >
              ← Back to account
            </button>
          )}

          {mode === 'reset' && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => changeMode('forgot')}
            >
              Request a new reset link
            </button>
          )}
        </form>
      )}
    </main>
  );
}
