
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
  created_at?: string;
};

const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;
const BUCKET = 'product-photos';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'Tops',
    size: '',
    condition: 'Very good',
    price: '',
    description: '',
    status: 'available',
  });

  const totalPhotoBytes = photos.reduce(
    (sum, photo) => sum + photo.size,
    0
  );

  const formatBytes = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

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
      setMessage(`Unable to load products: ${error.message}`);
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

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Logged in successfully.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Login failed: ${error.message}`
          : 'Unable to sign in. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const choosePhotos = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);

    const invalid = selected.find(
      (file) => !file.type.startsWith('image/')
    );

    if (invalid) {
      setMessage('Please select image files only.');
      return;
    }

    const combined = [...photos, ...selected];

    const uniqueFiles = combined.filter(
      (file, index, array) =>
        array.findIndex(
          (other) =>
            other.name === file.name &&
            other.size === file.size &&
            other.lastModified === file.lastModified
        ) === index
    );

    const total = uniqueFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );

    if (total > MAX_TOTAL_PHOTO_BYTES) {
      setMessage(
        'The combined photo size exceeds 50 MB. Remove some photos or choose smaller files.'
      );
      return;
    }

    setPhotos(uniqueFiles);
    setMessage(`${uniqueFiles.length} photo(s) selected.`);
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
    setMessage('Photo removed from selection.');
  };

  const resetForm = () => {
    setForm({
      name: '',
      category: 'Tops',
      size: '',
      condition: 'Very good',
      price: '',
      description: '',
      status: 'available',
    });

    setPhotos([]);
    setEditingId(null);

    const input = document.getElementById(
      'product-photos'
    ) as HTMLInputElement | null;

    if (input) input.value = '';
  };

  const saveProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!supabase || !session?.user) {
      setMessage('Please log in first.');
      return;
    }

    if (!form.name.trim() || !form.price || Number(form.price) < 0) {
      setMessage('Enter a product name and valid price.');
      return;
    }

    if (totalPhotoBytes > MAX_TOTAL_PHOTO_BYTES) {
      setMessage('Photos must total 50 MB or less.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const imageUrls: string[] = [];

      for (const photo of photos) {
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, photo, {
            cacheControl: '3600',
            upsert: false,
            contentType: photo.type,
          });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);

        imageUrls.push(data.publicUrl);
      }

      const productData = {
        name: form.name.trim(),
        category: form.category,
        size: form.size.trim() || null,
        condition: form.condition,
        price: Number(form.price),
        description: form.description.trim() || null,
        status: form.status,
      };

      if (editingId) {
        const { data: oldProduct, error: readError } = await supabase
          .from('products')
          .select('image_urls, image_url')
          .eq('id', editingId)
          .single();

        if (readError) throw readError;

        const oldUrls: string[] =
          oldProduct.image_urls?.length
            ? oldProduct.image_urls
            : oldProduct.image_url
              ? [oldProduct.image_url]
              : [];

        const allUrls = [...oldUrls, ...imageUrls];

        const { error } = await supabase
          .from('products')
          .update({
            ...productData,
            image_urls: allUrls,
            image_url: allUrls[0] || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        setMessage('Product updated successfully.');
      } else {
        const { error } = await supabase.from('products').insert({
          ...productData,
          image_urls: imageUrls,
          image_url: imageUrls[0] || null,
        });

        if (error) throw error;
        setMessage('Product added successfully.');
      }

      resetForm();
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving the product.'
      );
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category || 'Tops',
      size: product.size || '',
      condition: product.condition || 'Very good',
      price: String(product.price),
      description: product.description || '',
      status: product.status || 'available',
    });
    setPhotos([]);
    setMessage(
      'Editing product. Existing photos will be kept; selected photos will be added.'
    );

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateStatus = async (
    productId: string,
    status: string
  ) => {
    if (!supabase) return;

    setMessage('');
    const { error } = await supabase
      .from('products')
      .update({ status })
      .eq('id', productId);

    if (error) {
      setMessage(`Status update failed: ${error.message}`);
    } else {
      setMessage('Product status updated.');
      await load();
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!supabase) return;

    const confirmed = window.confirm(
      `Delete "${product.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      setMessage('Product deleted.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Delete failed: ${error.message}`
          : 'Unable to delete product.'
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    setMessage(error ? error.message : 'Logged out.');
    resetForm();
  };

  if (!supabase) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Talk Thrift Admin</h1>
        <p>Supabase is not configured. Check your Vercel environment variables.</p>
        <pre>{JSON.stringify(supabaseConfigCheck, null, 2)}</pre>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={{ maxWidth: 420, margin: '40px auto', padding: 20 }}>
        <h1>Talk Thrift Admin</h1>
        <p>Log in to manage your thrift products.</p>

        <form onSubmit={login}>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 10 }}
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 10 }}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {message && <p>{message}</p>}
      </main>
    );
  }


  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: 16 }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1>Talk Thrift Admin</h1>
          <p>Manage your thrift products.</p>
        </div>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </header>

      {message && (
        <p
          role="status"
          style={{
            padding: 12,
            background: '#f1f5f9',
            color: '#172554',
            borderRadius: 8,
            overflowWrap: 'anywhere',
          }}
        >
          {message}
        </p>
      )}

      <section
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <h2>{editingId ? 'Edit Product' : 'Add New Product'}</h2>

        <form onSubmit={saveProduct}>
          <label htmlFor="product-name">Product name</label>
          <input
            id="product-name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            required
            style={fieldStyle}
          />

          <label htmlFor="product-category">Category</label>
          <select
            id="product-category"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            style={fieldStyle}
          >
            <option>Tops</option>
            <option>Bottoms</option>
            <option>Dresses</option>
            <option>Outerwear</option>
            <option>Shoes</option>
            <option>Bags</option>
            <option>Accessories</option>
            <option>Others</option>
          </select>

          <label htmlFor="product-size">Size</label>
          <input
            id="product-size"
            value={form.size}
            onChange={(e) =>
              setForm({ ...form, size: e.target.value })
            }
            placeholder="e.g. M, L, 28"
            style={fieldStyle}
          />

          <label htmlFor="product-condition">Condition</label>
          <select
            id="product-condition"
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value })
            }
            style={fieldStyle}
          >
            <option>Brand new</option>
            <option>Like new</option>
            <option>Very good</option>
            <option>Good</option>
            <option>Fair</option>
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
            style={fieldStyle}
          />

          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={4}
            style={fieldStyle}
          />

          <label htmlFor="product-status">Status</label>
          <select
            id="product-status"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value })
            }
            style={fieldStyle}
          >
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
          </select>

          <label htmlFor="product-photos">
            Product photos {editingId ? '(optional: add more)' : ''}
          </label>
          <input
            id="product-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => choosePhotos(e.target.files)}
            style={{ display: 'block', width: '100%', margin: '10px 0' }}
          />

          <p>
            Selected: {photos.length} photo(s) · {formatBytes(totalPhotoBytes)} / 50 MB
          </p>
          <p>
            You can select photos in batches. The combined size must not exceed 50 MB.
          </p>

          {photos.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 10,
                margin: '12px 0',
              }}
            >
              {photos.map((photo, index) => (
                <div key={`${photo.name}-${photo.lastModified}-${index}`}>
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={photo.name}
                    style={{
                      width: '100%',
                      height: 110,
                      objectFit: 'cover',
                      borderRadius: 8,
                    }}
                  />
                  <p style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
                    {photo.name}
                  </p>
                  <p style={{ fontSize: 12 }}>{formatBytes(photo.size)}</p>
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="submit" disabled={busy}>
              {busy
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Add Product'}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Your Products ({products.length})</h2>

        {products.length === 0 ? (
          <p>No products yet. Add your first thrift item above.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {products.map((product) => {
              const images =
                product.image_urls?.length
                  ? product.image_urls
                  : product.image_url
                    ? [product.image_url]
                    : [];

              return (
                <article
                  key={product.id}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 12,
                    padding: 12,
                    minWidth: 0,
                  }}
                >
                  {images.length > 0 ? (
                    <img
                      src={images[0]}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: 190,
                        objectFit: 'cover',
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 190,
                        display: 'grid',
                        placeItems: 'center',
                        background: '#f1f5f9',
                        borderRadius: 8,
                      }}
                    >
                      No photo
                    </div>
                  )}

                  <h3>{product.name}</h3>
                  <p>₱{Number(product.price).toLocaleString('en-PH')}</p>
                  <p>{product.category} · {product.size || 'No size'}</p>
                  <p>{product.condition}</p>
                  <p>{images.length} photo(s)</p>

                  <label htmlFor={`status-${product.id}`}>Status</label>
                  <select
                    id={`status-${product.id}`}
                    value={product.status}
                    onChange={(e) =>
                      void updateStatus(product.id, e.target.value)
                    }
                    style={fieldStyle}
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteProduct(product)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const fieldStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: 10,
  margin: '8px 0 16px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
};
