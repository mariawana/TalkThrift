
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string;
  size: string | null;
  condition: string;
  price: number;
  image_url: string | null;
  description: string | null;
  status: string;
};

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: 'Tops',
    size: '',
    condition: 'Very good',
    price: '',
    image_url: '',
    description: '',
  });

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setMessage(error.message);
        return;
      }

      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const load = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setProducts((data || []) as Product[]);
    }
  };

  useEffect(() => {
    if (session) {
      void load();
    }
  }, [session]);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase) {
      setMessage('Supabase is not configured. Check your environment variables.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setMessage(error?.message || 'Logged in successfully.');
    } catch {
      setMessage('Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase || !session) {
      setMessage('Please sign in before adding a product.');
      return;
    }

    const price = Number(form.price);

    if (!Number.isFinite(price) || price < 0) {
      setMessage('Please enter a valid price.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.from('products').insert({
        name: form.name.trim(),
        category: form.category,
        size: form.size.trim() || null,
        condition: form.condition,
        price,
        image_url: form.image_url.trim() || null,
        description: form.description.trim() || null,
        status: 'available',
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Product added successfully.');

        setForm({
          name: '',
          category: 'Tops',
          size: '',
          condition: 'Very good',
          price: '',
          image_url: '',
          description: '',
        });

        await load();
      }
    } catch {
      setMessage('Unable to add product. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (product: Product, status: string) => {
    if (!supabase) return;

    setMessage('');

    const { error } = await supabase
      .from('products')
      .update({ status })
      .eq('id', product.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Product status updated.');
      await load();
    }
  };

  const remove = async (product: Product) => {
    if (!supabase) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`,
    );

    if (!confirmed) return;

    setMessage('');

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Product deleted.');
      await load();
    }
  };

  const signOut = async () => {
    if (!supabase) return;

    setBusy(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage(error.message);
      } else {
        setSession(null);
        setProducts([]);
        setMessage('Signed out successfully.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!supabase) {
    return (
      <main className="adminWrap">
        <a href="/" className="brand">
          TalkThrift
        </a>

        <section className="adminPanel">
          <h1>Store dashboard</h1>
          <p>
            Supabase is not configured. Check your environment variables in
            Vercel.
          </p>

          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>

          <a href="/">← Back to store</a>
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

        <span>OWNER DASHBOARD</span>

        <a href="/">View store ↗</a>
      </header>

      {!session ? (
        <form className="adminPanel" onSubmit={login}>
          <p className="eyebrow">PRIVATE ACCESS</p>
          <h1>Owner sign in</h1>
          <p>Sign in using your store-owner account.</p>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : 'Sign in'} <span>↗</span>
          </button>

          <a href="/">← Back to store</a>

          {message && <p className="notice">{message}</p>}
        </form>
      ) : (
        <div className="dashboard">
          <div className="dashboardTitle">
            <div>
              <p className="eyebrow">YOUR STORE, YOUR RULES</p>
              <h1>
                Manage your <em>pieces.</em>
              </h1>
            </div>

            <button
              className="secondary"
              type="button"
              onClick={signOut}
              disabled={busy}
            >
              {busy ? 'Please wait...' : 'Sign out'}
            </button>
          </div>

          <div className="adminColumns">
            <form className="adminPanel" onSubmit={add}>
              <h2>Add a product</h2>

              <label>
                Product name
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {[
                    'Tops',
                    'Bottoms',
                    'Dresses',
                    'Outerwear',
                    'Shoes',
                    'Accessories',
                    'Bags',
                    'Other',
                  ].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Size
                <input
                  value={form.size}
                  onChange={(e) =>
                    setForm({ ...form, size: e.target.value })
                  }
                  placeholder="S, M, L, or One size"
                />
              </label>

              <label>
                Condition
                <select
                  value={form.condition}
                  onChange={(e) =>
                    setForm({ ...form, condition: e.target.value })
                  }
                >
                  {['Like new', 'Very good', 'Good', 'Fair'].map(
                    (condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Price (PHP)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  required
                />
              </label>

              <label>
                Image URL
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) =>
                    setForm({ ...form, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </label>

              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>

              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Publish product'} <span>↗</span>
              </button>
            </form>

            <section className="adminPanel inventory">
              <div className="inventoryHead">
                <h2>Inventory</h2>

                <button
                  className="secondary"
                  type="button"
                  onClick={() => void load()}
                >
                  Refresh
                </button>
              </div>

              {products.length === 0 ? (
                <p>No products yet. Add your first item.</p>
              ) : (
                products.map((product) => (
                  <article className="inventoryItem" key={product.id}>
                    <div>
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} />
                      )}

                      <div>
                        <strong>{product.name}</strong>
                        <p>
                          ₱{Number(product.price).toLocaleString('en-PH')} ·{' '}
                          {product.size || 'One size'}
                        </p>
                        <small>{product.status}</small>
                      </div>
                    </div>

                    <div className="inventoryActions">
                      <button
                        type="button"
                        onClick={() =>
                          void updateStatus(
                            product,
                            product.status === 'available'
                              ? 'sold'
                              : 'available',
                          )
                        }
                      >
                        {product.status === 'available'
                          ? 'Mark sold'
                          : 'Mark available'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void remove(product)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>

          {message && <p className="notice">{message}</p>}
        </div>
      )}
    </main>
  );
}
