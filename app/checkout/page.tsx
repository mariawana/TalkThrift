'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type CartProduct = {
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
  const [cart, setCart] = useState<CartProduct[]>([]);
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

    const init = async () => {
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
          setAuthChecked(true);
          return;
        }

        setUserId(session.user.id);
        setEmail(session.user.email || '');

        const meta = session.user.user_metadata || {};

        setName(meta.full_name || '');
        setPhone(meta.phone || '');
        setAddress(meta.delivery_address || '');

        const raw = localStorage.getItem('rewear-cart');

        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);

            if (Array.isArray(parsed)) {
              setCart(parsed as CartProduct[]);
            } else {
              setCart([]);
            }
          } catch {
            setCart([]);
          }
        }

        setAuthChecked(true);
      } catch {
        if (active) {
          setMessage('Unable to load checkout. Please try again.');
          setAuthChecked(true);
        }
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [router]);

  const total = cart.reduce(
    (sum, product) => sum + Number(product.price),
    0,
  );

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase || !userId || !cart.length || busy) {
      if (!cart.length) {
        setMessage('Your bag is empty. Please add an item first.');
      }
      return;
    }

    const client = supabase;

    setBusy(true);
    setMessage('');

    try {
      // Verify that every cart item still exists and is available.
      const ids = [...new Set(cart.map((product) => product.id))];

      const {
        data: available,
        error: checkError,
      } = await client
        .from('products')
        .select('id,name,price,size,status')
        .in('id', ids)
        .eq('status', 'available');

      if (
        checkError ||
        !available ||
        available.length !== ids.length
      ) {
        setMessage(
          'One or more items are no longer available. Please return to the store and refresh your bag.',
        );
        return;
      }

      const verified = cart.map((item) => {
        const current = available.find(
          (product) => product.id === item.id,
        );

        if (!current) {
          throw new Error('An item is no longer available.');
        }

        return {
          id: current.id,
          name: current.name,
          price: Number(current.price),
          size: current.size,
        };
      });

      const verifiedTotal = verified.reduce(
        (sum, product) => sum + product.price,
        0,
      );

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
          items: verified,
          total: verifiedTotal,
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
          : 'Unable to place your order. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

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

  if (!cart.length) {
    return (
      <main className="adminWrap">
        <header className="adminHeader">
          <a href="/" className="brand">
            TalkThrift
          </a>
          <a href="/">Back to store ↗</a>
        </header>

        <section className="adminPanel">
          <h1>Your bag is empty.</h1>
          <p>Add an available item before checking out.</p>

          <a className="primary" href="/#shop">
            Browse the store ↗
          </a>

          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="adminWrap">
      <header className="adminHeader">
        <a href="/" className="brand">
          TalkThrift
        </a>
        <a href="/">Back to store ↗</a>
      </header>

      <form
        className="adminPanel checkoutPanel"
        onSubmit={submit}
      >
        <p className="eyebrow">SECURE ORDER DETAILS</p>

        <h1>
          Almost <em>yours.</em>
        </h1>

        <p>
          Logged in as {email}. Check your delivery details before
          placing your order.
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

          {cart.map((product, index) => (
            <div
              className="cartItem"
              key={`${product.id}-${index}`}
            >
              <span>
                {product.name}
                {product.size ? ` · ${product.size}` : ''}
              </span>

              <strong>
                ₱{Number(product.price).toLocaleString('en-PH')}
              </strong>
            </div>
          ))}

          <div className="cartTotal">
            <span>Subtotal</span>
            <strong>
              ₱{total.toLocaleString('en-PH')}
            </strong>
          </div>

          <p className="mutedNote">
            Shipping fee and payment instructions will be confirmed
            by the store before the order is finalized.
          </p>
        </div>

        <button
          className="primary"
          type="submit"
          disabled={busy || !userId}
        >
          {busy ? 'Placing order...' : 'Place order (Cash on Delivery request)'}
          {!busy && <span> ↗</span>}
        </button>

        {message && <p className="notice">{message}</p>}
      </form>
    </main>
  );
}
