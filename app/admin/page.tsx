
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
  image_urls?: string[] | null;
  description: string | null;
  status: string;
};

const MAX_PHOTOS = 20;
const BUCKET = 'product-photos';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const [form, setForm] = useState({
    name: '',
    category: 'Tops',
    size: '',
    condition: 'Very good',
    price: '',
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
    if (session) void load();
  }, [session]);

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase) {
      setMessage('Supabase is not configured.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) setMessage(error.message);
      else setMessage('Logged in successfully.');
    } catch {
      setMessage('Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const choosePhotos = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);

    if (selected.length > MAX_PHOTOS) {
      setPhotos([]);
      setMessage('Please select no more than 20 photos.');
      return;
    }

    const invalid = selected.find(
      (file) => !file.type.startsWith('image/')
    );

    if (invalid) {
      setPhotos([]);
      setMessage('Please select image files only.');
      return;
    }

    const tooLarge = selected.find(
      (file) => file.size > 10 * 1024 * 1024
    );

    if (tooLarge) {
      setPhotos([]);
      setMessage('Each photo must be 10 MB or smaller.');
      return;
    }

    setPhotos(selected);
    setMessage(`${selected.length} photo(s) selected.`);
  };

  const addProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase || !session) {
      setMessage('Please log in first.');
      return;
    }

    const price = Number(form.price);

    if (
      !form.name.trim() ||
      !form.category.trim() ||
      !form.price.trim() ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setMessage('Enter a product name, category, and valid price.');
      return;
    }

    if (photos.length > MAX_PHOTOS) {
      setMessage('You can upload a maximum of 20 photos.');
      return;
    }

    setBusy(true);
    setMessage('Uploading product photos...');

    const uploadedPaths: string[] = [];

    try {
      const imageUrls: string[] = [];

      for (const file of photos) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        uploadedPaths.push(path);

        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);

        imageUrls.push(data.publicUrl);
      }

      const { error: insertError } = await supabase
        .from('products')
        .insert({
          name: form.name.trim(),
          category: form.category,
          size: form.size.trim() || null,
          condition: form.condition,
          price,
          image_url: imageUrls[0] || null,
          image_urls: imageUrls,
          description: form.description.trim() || null,
          status: 'available',
        });

      if (insertError) throw new Error(insertError.message);

      setMessage('Product and photos added successfully!');

      setForm({
        name: '',
        category: 'Tops',
        size: '',
        condition: 'Very good',
        price: '',
        description: '',
      });

      setPhotos([]);

      const fileInput = document.getElementById(
        'product-photos'
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = '';

      await load();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Please try again.';

      setMessage(reason);

      // Clean up uploaded files if saving the product fails.
      if (uploadedPaths.length > 0 && supabase) {
        await supabase.storage.from(BUCKET).remove(uploadedPaths);
      }
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
        <a href="/" className="brand">TalkThrift</a>
        <section className="adminPanel">
          <h1>Store dashboard</h1>
          <p>Supabase configuration diagnostic</p>
          <p>
            URL detected:{' '}
            <strong>{supabaseConfigCheck.hasUrl ? 'YES' : 'NO'}</strong>
          </p>
          <p>
            Publishable key detected:{' '}
            <strong>
              {supabaseConfigCheck.hasPublishableKey ? 'YES' : 'NO'}
            </strong>
          </p>
          <p>Check your Vercel environment variables and redeploy if missing.</p>
          <a href="/">← Back to store</a>
        </section>
      </main>
    );
  }

  return (
    <main className="adminWrap">
      <a href="/" className="brand">TalkThrift</a>

      <section className="adminPanel">
        <h1>Store dashboard</h1>

        {message && <p role="status">{message}</p>}

        {!session ? (
          <form onSubmit={login} className="adminForm">
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

              <label htmlFor="product-photos">
                Product photos (up to 20)
              </label>
              <input
                id="product-photos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => choosePhotos(e.target.files)}
              />
              <p>
                {photos.length} of {MAX_PHOTOS} photos selected.
                Maximum 10 MB per photo.
              </p>

              {photos.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '8px',
                  }}
                >
                  {photos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`}>
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Selected photo ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotos((current) =>
                            current.filter((_, i) => i !== index)
                          );
                          const input = document.getElementById(
                            'product-photos'
                          ) as HTMLInputElement | null;
                          if (input) input.value = '';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <button type="submit" disabled={busy}>
                {busy ? 'Uploading...' : 'Add product'}
              </button>
            </form>

            <h2>Products ({products.length})</h2>

            {products.length === 0 ? (
              <p>No products found yet.</p>
            ) : (
              <div className="productList">
                {products.map((product) => {
                  const images =
                    product.image_urls?.length
                      ? product.image_urls
                      : product.image_url
                        ? [product.image_url]
                        : [];

                  return (
                    <article key={product.id} className="productItem">
                      {images.map((url, index) => (
                        <img
                          key={`${product.id}-${index}`}
                          src={url}
                          alt={`${product.name} photo ${index + 1}`}
                          width="100"
                          style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'cover',
                            marginRight: '6px',
                          }}
                        />
                      ))}

                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.category} · {product.size || 'No size'}</p>
                        <p>₱{Number(product.price).toLocaleString('en-PH')}</p>
                        <p>{product.condition} · {product.status}</p>
                        {product.description && <p>{product.description}</p>}
                        <p>{images.length} photo(s)</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
