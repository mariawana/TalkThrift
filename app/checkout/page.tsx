
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type CheckoutProduct = {
  id: string;
  name: string;
  price: number;
  size: string | null;
  image_url: string | null;
};

export default function CheckoutPage() {
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [product, setProduct] = useState<CheckoutProduct | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setMessage('Store setup is not complete yet.');
      setAuthChecked(true);
      return;
    }

    const client = supabase;
    let active = true;

    async function init() {
      try {
        const {
          data: { session },
          error,
        } = await client.auth.getSession();

        if (!active) return;

        if (error) {
          setMessage(error.message);
          setAuthChecked(true);
          return;
        }

        if (!session) {
          router.replace('/account?next=checkout');
          return;
        }

        setUserId(session.user.id);
        setEmail(session.user.email || '');

        const meta = session.user.user_metadata || {};

        setName(meta.full_name || '');
        setPhone(meta.phone || '');
        setAddress(meta.delivery_address || '');

        // Compatibility with the existing Buy Now button.
        const raw = localStorage.getItem('rewear-cart');

        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);

            if (Array.isArray(parsed) && parsed.length === 1) {
              const item = parsed[0];

              if (
                item &&
                typeof item.id === 'string' &&
                typeof item.name === 'string' &&
                Number.isFinite(Number(item.price))
              ) {
                setProduct(item as CheckoutProduct);
              }
            }
          } catch {
            setMessage('Unable to load your selected item.');
          }
        }

        setAuthChecked(true);
      } catch {
        if (active) {
          setMessage('Unable to load checkout. Please try again.');
          setAuthChecked(true);
        }
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [router]);

  const formatPrice = (amount: number) =>
    `₱${Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!supabase || !userId || !product || busy) return;

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setMessage('Please complete all your delivery information.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const client = supabase;

      // Verify product availability and price from Supabase.
      const {
        data: current,
        error: checkError,
      } = await client
        .from('products')
        .select('id,name,price,size,status')
        .eq('id', product.id)
        .maybeSingle();

      if (checkError) {
        throw new Error(checkError.message);
      }

      if (!current || current.status !== 'available') {
        setMessage(
          'Sorry, this item is no longer available. Please choose another find.'
        );
        return;
      }

      const verifiedItem = {
        id: current.id,
        name: current.name,
        price: Number(current.price),
        size: current.size,
      };

      const {
        data,
        error,
      } = await client
        .from('orders')
        .insert({
          customer_id: userId,
          customer_name: name.trim(),
          contact_number: phone.trim(),
          delivery_address: address.trim(),
          items: [verifiedItem],
          total: verifiedItem.price,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      localStorage.removeItem('rewear-cart');

      router.replace(`/order-success?id=${data.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to place your order. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="adminWrap">
        <section className="adminPanel">
          <h1>Loading checkout...</h1>
          <p>Please wait while we check your account.</p>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="adminWrap">
        <header className="adminHeader">
          <a href="/" className="brand">TalkThrift</a>
          <a href="/">Back to store ↗</a>
        </header>

        <section className="adminPanel">
          <h1>No item selected.</h1>
          <p>
            Choose a product and tap Buy Now to continue.
          </p>

          <a className="primary" href="/#shop">
            Browse the collection ↗
          </a>

          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="adminWrap">
      <header className="adminHeader">
        <a href="/" className="brand">TalkThrift</a>
        <a href="/">Back to store ↗</a>
      </header>

      <form className="adminPanel checkoutPanel" onSubmit={submit}>
        <p className="eyebrow">YOUR ORDER DETAILS</p>

        <h1>
          Almost <em>yours.</em>
        </h1>

        <p>
          Logged in as {email}. Please review your information
          before placing your order.
        </p>

        <label>
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>

        <label>
          Contact number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </label>

        <label>
          Complete delivery address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
            placeholder="House/building, street, barangay, city, province, postal code"
            required
          />
        </label>

        <div className="checkoutSummary">
          <h2>Order summary</h2>

          <div className="cartItem">
            <span>
              {product.name}
              {product.size ? ` · ${product.size}` : ''}
            </span>
            <strong>{formatPrice(product.price)}</strong>
          </div>

          <div className="cartTotal">
            <span>Subtotal</span>
            <strong>{formatPrice(product.price)}</strong>
          </div>

          <p className="mutedNote">
            Shipping fees and payment instructions will be
            confirmed by the seller before your order is finalized.
          </p>
        </div>

        <button
          className="primary"
          type="submit"
          disabled={busy || !userId}
        >
          {busy
            ? 'Placing your order...'
            : 'Place Order — Cash on Delivery Request'}
          {!busy && <span> ↗</span>}
        </button>

        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
