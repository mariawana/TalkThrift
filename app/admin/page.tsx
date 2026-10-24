
'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase, supabaseConfigCheck } from '@/lib/supabase';

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

  const addProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase || !session) {
      setMessage('Please log in first.');
      return;
    }

    const price = Number(form.price);

    if (!form.name.trim() || !form.category.trim() || !form.price.trim() ||
        !Number.isFinite(price) || price < 0) {
      setMessage('Please enter a product name, category, and valid price.');
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
        return;
      }

      setMessage('Product added successfully!');

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
    } catch {
      setMessage('Unable to add product. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Logged out successfully.');
      setProducts([]);
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

          <p>Supabase configuration diagnostic</p>

          <p>
            URL detected:{' '}
            <strong>
              {supabaseConfigCheck.hasUrl ? 'YES' : 'NO'}
            </strong>
          </p>

          <p>
            Publishable key detected:{' '}
            <strong>
              {supabaseConfigCheck.hasPublishableKey ? 'YES' : 'NO'}
            </strong>
          </p>

          <p>
            {supabaseConfigCheck.hasUrl &&
            supabaseConfigCheck.hasPublishableKey
              ? 'Both values are detected. Check the Supabase client configuration.'
              : 'One or both values are missing from the deployed build. Check Vercel environment variables and redeploy.'}
          </p>

          <a href="/">← Back to store</a>
        </section>
      </main>
    );
  }

  return (
    <main className="adminWrap">
      <a href="/" className="brand">
        TalkThrift
      </a>

      <section className="adminPanel">
        <h1>Store dashboard</h1>

        {message && <p role="status">{message}</p>}

        {!session ? (
          <form
            onSubmit={login}
            className="adminForm"
          >
            <h2>Admin login</h2>

            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={busy}>
              {busy ? 'Please wait...' : 'Log in'}
            </button>
          </form>
        ) : (
          <>
            <div className="adminHeader">
              <h2>Add product</h2>
              <button type="button" onClick={logout} disabled={busy}>
                Log out
              </button>
            </div>

            <form onSubmit={addProduct} className="adminForm">
              <label htmlFor="product-name">Product name</label>
              <input
                id="product-name"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
              />

              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                <option value="Tops">Tops</option>
                <option value="Bottoms">Bottoms</option>
                <option value="Outerwear">Outerwear</option>
                <option value="Shoes">Shoes</option>
                <option value="Accessories">Accessories</option>
                <option value="Others">Others</option>
              </select>

              <label htmlFor="product-size">Size</label>
              <input
                id="product-size"
                value={form.size}
                onChange={(e) =>
                  setForm({ ...form, size: e.target.value })
                }
              />

              <label htmlFor="product-condition">Condition</label>
              <select
                id="product-condition"
                value={form.condition}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value })
                }
              >
                <option value="Brand new">Brand new</option>
                <option value="Like new">Like new</option>
                <option value="Very good">Very good</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>

              <label htmlFor="product-price">Price (₱)</label>
              <input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                required
              />

              <label htmlFor="product-image">Image URL</label>
              <input
                id="product-image"
                type="url"
                placeholder="https://..."
                value={form.image_url}
                onChange={(e) =>
                  setForm({ ...form, image_url: e.target.value })
                }
              />

              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <button type="submit" disabled={busy}>
                {busy ? 'Please wait...' : 'Add product'}
              </button>
            </form>

            <h2>Products ({products.length})</h2>

            {products.length === 0 ? (
              <p>No products found yet.</p>
            ) : (
              <div className="productList">
                {products.map((product) => (
                  <article key={product.id} className="productItem">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        width="100"
                      />
                    )}

                    <div>
                      <h3>{product.name}</h3>
                      <p>{product.category} · {product.size || 'No size'}</p>
                      <p>₱{Number(product.price).toLocaleString('en-PH')}</p>
                      <p>{product.condition} · {product.status}</p>
                      {product.description && <p>{product.description}</p>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
