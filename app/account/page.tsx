
'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Mode = 'signup' | 'login';

type AccountInfo = {
  id: string;
  email: string;
  role: string;
  fullName: string;
};

export default function AccountPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState<AccountInfo | null>(
    null
  );

  const getNextPath = useCallback(() => {
    if (typeof window === 'undefined') {
      return '/';
    }

    const next = new URLSearchParams(
      window.location.search
    ).get('next');

    if (
      next &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !next.includes('\\') &&
      next !== '/account'
    ) {
      return next;
    }

    return '/';
  }, []);

  const loadAccount = useCallback(async () => {
    if (!supabase) {
      setChecking(false);
      setMessage(
        'The store is not connected to Supabase yet.'
      );
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setAccount(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      setAccount({
        id: user.id,
        email: user.email ?? '',
        role: profile?.role ?? 'unknown',
        fullName:
          profile?.full_name ??
          user.user_metadata?.full_name ??
          '',
      });
    } catch {
      setAccount(null);
      setMessage('Unable to load account information.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase) {
      setMessage(
        'The store is not connected to Supabase yet.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
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
          setMessage(error.message);
          return;
        }

        if (data.session) {
          await loadAccount();
          router.push(getNextPath());
          router.refresh();
        } else {
          setMode('login');
          setPassword('');
          setMessage(
            'Account created. Check your email to confirm your account, then log in.'
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          setMessage(error.message);
          return;
        }

        await loadAccount();

        router.push(getNextPath());
        router.refresh();
      }
    } catch {
      setMessage(
        'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) {
      setMessage('Supabase is not connected.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage('Logout failed: ' + error.message);
        return;
      }

      setAccount(null);
      setEmail('');
      setPassword('');
      setMode('login');
      setMessage('You have successfully logged out.');

      router.replace('/account');
      router.refresh();
    } catch {
      setMessage(
        'Unable to log out. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="adminWrap">
      <header className="adminHeader">
        <Link href="/" className="brand">
          TALK<span>THRIFT.</span>
        </Link>

        <Link href="/">Back to store ↗</Link>
      </header>

      {checking ? (
        <div className="adminPanel accountPanel">
          <p>Checking your account...</p>
        </div>
      ) : account ? (
        <section className="adminPanel accountPanel">
          <p className="eyebrow">YOUR TALKTHRIFT ACCOUNT</p>

          <h1>
            {account.fullName
              ? `Hello, ${account.fullName}!`
              : 'My Account'}
          </h1>

          <p>
            You are currently signed in to TalkThrift.
          </p>

          <div
            style={{
              padding: '18px 0',
              marginTop: 12,
              marginBottom: 12,
              borderTop: '1px solid #e5e5e5',
              borderBottom: '1px solid #e5e5e5',
            }}
          >
            <p style={{ marginBottom: 8 }}>
              <strong>Email:</strong> {account.email}
            </p>

            <p style={{ marginBottom: 0 }}>
              <strong>Account type:</strong>{' '}
              {account.role === 'owner'
                ? 'Seller / Admin'
                : account.role === 'customer'
                  ? 'Customer'
                  : 'Not configured'}
            </p>
          </div>

          {account.role === 'owner' ? (
            <Link
              href="/admin"
              className="primary"
              style={{
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              Seller Dashboard ↗
            </Link>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Link
                href="/orders"
                className="primary"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                My Orders ↗
              </Link>
            </div>
          )}

          <Link
            href="/messages"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '13px 16px',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              color: 'inherit',
              textDecoration: 'none',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            💬 My Messages
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={busy}
            style={{
              width: '100%',
              padding: '14px 18px',
              border: '1px solid #d33',
              borderRadius: 8,
              background: 'transparent',
              color: '#b91c1c',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Logging out...' : 'Log Out ↗'}
          </button>

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </section>
      ) : (
        <form
          className="adminPanel accountPanel"
          onSubmit={submit}
        >
          <p className="eyebrow">
            YOUR TALKTHRIFT ACCOUNT
          </p>

          <h1>
            {mode === 'signup'
              ? 'Create your account'
              : 'Welcome back.'}
          </h1>

          <p>
            {mode === 'signup'
              ? 'Sign up to shop, make offers, and message the seller.'
              : 'Log in to continue shopping, view orders, and message the seller.'}
          </p>

          {mode === 'signup' && (
            <>
              <label>
                Full name
                <input
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  required
                />
              </label>

              <label>
                Contact number
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value)
                  }
                  placeholder="09XXXXXXXXX"
                  required
                />
              </label>

              <label>
                Delivery address
                <input
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  placeholder="House/building, street, barangay, city, province"
                  required
                />
              </label>
            </>
          )}

          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete={
                mode === 'signup'
                  ? 'new-password'
                  : 'current-password'
              }
              minLength={6}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />
          </label>

          <button
            type="submit"
            className="primary"
            disabled={busy}
          >
            {busy
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create account'
                : 'Log in'}
            <span>↗</span>
          </button>

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          <p className="accountSwitch">
            {mode === 'signup'
              ? 'Already have an account?'
              : 'New to TalkThrift?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(
                  mode === 'signup'
                    ? 'login'
                    : 'signup'
                );
                setMessage('');
              }}
            >
              {mode === 'signup'
                ? 'Log in'
                : 'Sign up'}
            </button>
          </p>
        </form>
      )}
    </main>
  );
}
