'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Alert } from '../components/StoreUI';
import type { Session } from '@supabase/supabase-js';
import {
  supabase,
  supabaseConfigCheck,
} from '@/lib/supabase';

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

type Order = {
  id: string;
  customer_id: string;
  customer_name: string;
  contact_number: string;
  delivery_address: string;
  items: unknown;
  total: number;
  status: string;
  created_at: string;
  delivery_method: string | null;
  shipping_region: string | null;
  item_subtotal: number | null;
  shipping_fee: number | null;
  fee_confirmed: boolean | null;
  payment_method: string | null;
  payment_status: string | null;
};

type Offer = {
  id: string;
  product_id: string;
  customer_id: string;
  offer_amount: number;
  status: string;
  created_at: string;
};

type Tab =
  | 'overview'
  | 'products'
  | 'orders'
  | 'offers'
  | 'contact';

const BUCKET = 'product-photos';
const MAX_TOTAL_PHOTO_BYTES = 50 * 1024 * 1024;

const FACEBOOK =
  'https://www.facebook.com/kilme.rudy';

const INSTAGRAM =
  'https://www.instagram.com/talkthriftwhsorudy/';

const initialForm = {
  name: '',
  category: 'Tops',
  size: '',
  condition: 'Very good',
  price: '',
  description: '',
  status: 'available',
};

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  margin: '7px 0 16px',
  border: '1px solid var(--line)',
  borderRadius: 9,
  fontSize: 14,
  background: 'var(--paper)',
  color: 'var(--ink)',
};

const cardStyle: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: 18,
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 9,
  padding: '11px 16px',
  background: 'var(--blue)',
  color: 'var(--paper)',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryStyle: CSSProperties = {
  ...buttonStyle,
  background: 'var(--blue-light)',
  color: 'var(--blue)',
};

const money = (amount: number) =>
  `₱${Number(amount).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })}`;

const dateText = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const formatBytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

function displayItems(items: unknown): string {
  if (typeof items === 'string') {
    try {
      return displayItems(JSON.parse(items));
    } catch {
      return items;
    }
  }

  if (Array.isArray(items)) {
    return items
      .map((item) => {
        if (typeof item === 'string') return item;

        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>;
          const name = String(
            entry.name ?? entry.title ?? 'Item'
          );
          const quantity = Number(
            entry.quantity ?? 1
          );

          return `${name} × ${quantity}`;
        }

        return String(item);
      })
      .join(', ');
  }

  if (items && typeof items === 'object') {
    return JSON.stringify(items);
  }

  return 'No item details';
}

export default function Admin() {
  const [session, setSession] =
    useState<Session | null>(null);

  const [checking, setChecking] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tab, setTab] = useState<Tab>('overview');

  const [products, setProducts] =
    useState<Product[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [offers, setOffers] =
    useState<Offer[]>([]);

  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<File[]>([]);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const totalPhotoBytes = photos.reduce(
    (sum, photo) => sum + photo.size,
    0
  );

  const loadData = useCallback(async () => {
    if (!supabase) return;

    const [
      productResult,
      orderResult,
      offerResult,
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('orders')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('offers')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),
    ]);

    const errors: string[] = [];

    if (productResult.error) {
      errors.push(
        `Products: ${productResult.error.message}`
      );
    } else {
      setProducts(
        (productResult.data ?? []) as Product[]
      );
    }

    if (orderResult.error) {
      errors.push(
        `Orders: ${orderResult.error.message}`
      );
    } else {
      setOrders(
        (orderResult.data ?? []) as Order[]
      );
    }

    if (offerResult.error) {
      errors.push(
        `Offers: ${offerResult.error.message}`
      );
    } else {
      setOffers(
        (offerResult.data ?? []) as Offer[]
      );
    }

    if (errors.length > 0) {
      setMessage(errors.join(' | '));
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }

    const client = supabase;
    let active = true;

    async function checkAccount(
      nextSession: Session | null
    ) {
      if (!active) return;

      setChecking(true);
      setSession(nextSession);
      setIsOwner(false);

      if (!nextSession) {
        setProducts([]);
        setOrders([]);
        setOffers([]);
        setChecking(false);
        return;
      }

      const { data, error } = await client
        .from('profiles')
        .select('role')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setMessage(
          `Account check failed: ${error.message}`
        );
      }

      const owner =
        !error && data?.role === 'owner';

      setIsOwner(owner);
      setChecking(false);

      if (owner) {
        void loadData();
      }
    }

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setMessage(error.message);
          setChecking(false);
          return;
        }

        void checkAccount(data.session);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) {
          setTimeout(() => {
            if (active) {
              void checkAccount(nextSession);
            }
          }, 0);
        }
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadData]);

  async function login(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!supabase) return;

    setBusy(true);
    setMessage('');

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setMessage(error.message);
      }
    } catch {
      setMessage(
        'Unable to sign in. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setForm({ ...initialForm });
    setPhotos([]);
    setEditingId(null);

    const input = document.getElementById(
      'product-photos'
    ) as HTMLInputElement | null;

    if (input) {
      input.value = '';
    }
  }

  async function logout() {
    if (!supabase) return;

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSession(null);
    setIsOwner(false);
    setProducts([]);
    setOrders([]);
    setOffers([]);
    resetForm();
  }

  function choosePhotos(files: FileList | null) {
    if (!files) return;

    const selected = Array.from(files);

    if (
      selected.some(
        (file) => !file.type.startsWith('image/')
      )
    ) {
      setMessage(
        'Please select image files only.'
      );
      return;
    }

    const combined = [...photos, ...selected];

    const unique = combined.filter(
      (file, index, array) =>
        array.findIndex(
          (other) =>
            other.name === file.name &&
            other.size === file.size &&
            other.lastModified === file.lastModified
        ) === index
    );

    const total = unique.reduce(
      (sum, file) => sum + file.size,
      0
    );

    if (total > MAX_TOTAL_PHOTO_BYTES) {
      setMessage(
        'Combined photos must be 50 MB or less.'
      );
      return;
    }

    setPhotos(unique);

    setMessage(
      `${unique.length} photo(s) selected.`
    );
  }

  async function saveProduct(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (
      !supabase ||
      !session?.user ||
      !isOwner
    ) {
      setMessage(
        'Owner access is required.'
      );
      return;
    }

    if (
      !form.name.trim() ||
      form.price.trim() === '' ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) < 0
    ) {
      setMessage(
        'Enter a valid product name and price.'
      );
      return;
    }

    if (
      totalPhotoBytes >
      MAX_TOTAL_PHOTO_BYTES
    ) {
      setMessage(
        'Photos must total 50 MB or less.'
      );
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const imageUrls: string[] = [];

      for (const photo of photos) {
        const safeName = photo.name.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

        const path =
          `${session.user.id}/` +
          `${crypto.randomUUID()}-${safeName}`;

        const { error } =
          await supabase.storage
            .from(BUCKET)
            .upload(path, photo, {
              cacheControl: '3600',
              upsert: false,
              contentType: photo.type,
            });

        if (error) {
          throw new Error(
            `Photo upload failed: ${error.message}`
          );
        }

        const { data } =
          supabase.storage
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
        description:
          form.description.trim() || null,
        status: form.status,
      };

      if (editingId) {
        const {
          data: oldProduct,
          error: readError,
        } = await supabase
          .from('products')
          .select('image_urls, image_url')
          .eq('id', editingId)
          .single();

        if (readError) {
          throw readError;
        }

        const oldUrls: string[] =
          oldProduct.image_urls?.length
            ? oldProduct.image_urls
            : oldProduct.image_url
              ? [oldProduct.image_url]
              : [];

        const allUrls = Array.from(
          new Set([
            ...oldUrls,
            ...imageUrls,
          ])
        );

        const { error } = await supabase
          .from('products')
          .update({
            ...productData,
            image_urls: allUrls,
            image_url: allUrls[0] || null,
          })
          .eq('id', editingId);

        if (error) {
          throw error;
        }

        setMessage(
          'Product updated successfully.'
        );
      } else {
        const { error } = await supabase
          .from('products')
          .insert({
            ...productData,
            image_urls: imageUrls,
            image_url:
              imageUrls[0] || null,
          });

        if (error) {
          throw error;
        }

        setMessage(
          'Product added successfully.'
        );
      }

      resetForm();
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save product.'
      );
    } finally {
      setBusy(false);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);

    setForm({
      name: product.name,
      category:
        product.category || 'Tops',
      size: product.size || '',
      condition:
        product.condition || 'Very good',
      price: String(product.price),
      description:
        product.description || '',
      status:
        product.status || 'available',
    });

    setPhotos([]);
    setTab('products');

    setMessage(
      'Editing product. Existing photos will be kept.'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function updateProductStatus(
    productId: string,
    status: string
  ) {
    if (!supabase || !isOwner) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({ status })
        .eq('id', productId);

      if (error) {
        setMessage(
          `Status update failed: ${error.message}`
        );
      } else {
        setMessage(
          'Product status updated.'
        );
        await loadData();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(
    product: Product
  ) {
    if (!supabase || !isOwner) return;

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

      if (error) {
        throw error;
      }

      if (editingId === product.id) {
        resetForm();
      }

      setMessage('Product deleted.');
      await loadData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Delete failed: ${error.message}`
          : 'Unable to delete product.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(orderId: string) {
    if (!supabase || !isOwner || busy) return;
    if (!window.confirm('Confirm only if you have checked your account and received this payment. Continue?')) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('seller_confirm_payment', { p_order_id: orderId });
      if (error) setMessage('Unable to confirm payment. Check the order status and try again.');
      else { setMessage('Payment marked as received by the seller.'); await loadData(); }
    } catch { setMessage('Unable to confirm payment. Please try again.'); }
    finally { setBusy(false); }
  }

  async function confirmLocalFee(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    if (!supabase || !isOwner || busy) return;
    const value = String(new FormData(event.currentTarget).get('fee') ?? '').trim();
    const amount = Number(value);
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(amount) || amount < 30) {
      setMessage('Enter a valid local delivery fee of at least ₱30.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('seller_confirm_local_fee', { p_order_id: orderId, p_fee: amount });
      if (error) setMessage('Unable to confirm the local delivery fee. Check the order status.');
      else { setMessage('Local delivery fee updated. Inform the customer of the final total.'); await loadData(); }
    } catch { setMessage('Unable to update the delivery fee.'); }
    finally { setBusy(false); }
  }

  async function updateOrderStatus(
    orderId: string,
    status: string
  ) {
    if (!supabase || !isOwner) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) {
        setMessage(
          `Order update failed: ${error.message}`
        );
      } else {
        setMessage(
          'Order status updated.'
        );
        await loadData();
      }
    } catch {
      setMessage(
        'Unable to update order.'
      );
    } finally {
      setBusy(false);
    }
  }

  // CORRECTED OFFER STATUS FUNCTION
  async function updateOfferStatus(
    offerId: string,
    status: 'accepted' | 'rejected'
  ) {
    if (!supabase || !isOwner) return;

    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase
        .from('offers')
        .update({ status })
        .eq('id', offerId)
        .eq('status', 'pending')
        .select('id');

      if (error) {
        setMessage(
          `Offer update failed: ${error.message}`
        );
      } else if (!data?.length) {
        setMessage(
          'Offer was already updated. Refresh and try again.'
        );
      } else {
        setMessage(
          `Offer ${status}.`
        );
        await loadData();
      }
    } catch {
      setMessage(
        'Unable to update offer. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  const availableCount =
    products.filter(
      (product) =>
        product.status === 'available'
    ).length;

  const pendingOrders =
    orders.filter(
      (order) =>
        order.status === 'pending'
    ).length;

  const pendingOffers =
    offers.filter(
      (offer) =>
        offer.status === 'pending'
    ).length;

  if (!supabase) {
    return (
      <main style={{ padding: 24 }}>
        <h1>TalkThrift Admin</h1>

        <p>
          Supabase is not configured.
        </p>

        <pre>
          {JSON.stringify(
            supabaseConfigCheck,
            null,
            2
          )}
        </pre>
      </main>
    );
  }

  if (checking) {
    return (
      <main style={{ padding: 30 }}>
        Checking your TalkThrift account...
      </main>
    );
  }

  if (!session) {
    return <main className="adminWrap"><section className="adminPanel accountPanel"><h1>Seller access</h1><Alert notice={message ? { type: 'error', text: message } : null} /><p>Log in with your seller account to manage TalkThrift.</p><Link className="primary" href="/account?next=%2Fadmin">Log in ↗</Link><Link href="/">← Back to Store</Link></section></main>;
  }

  if (!isOwner) {
    return (
      <main
        style={{
          maxWidth: 500,
          margin: '50px auto',
          padding: 24,
        }}
      >
        <h1>Owner Access Required</h1>

        <p>
          This account does not have
          permission to access the
          TalkThrift Seller Dashboard.
        </p>

        <p>
          Your account must have the
          owner role in Supabase.
        </p>

        {message && (
          <p role="status">
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={logout}
          style={buttonStyle}
        >
          Log Out
        </button>
      </main>
    );
  }

  const tabs: {
    id: Tab;
    label: string;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
    },
    {
      id: 'products',
      label: 'Products',
    },
    {
      id: 'orders',
      label: 'Orders',
    },
    {
      id: 'offers',
      label: 'Offers',
    },
    {
      id: 'contact',
      label: 'Seller Contact',
    },
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        color: 'var(--ink)',
        padding: '22px 16px 60px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div>
            <p
              style={{
                color: 'var(--blue)',
                fontWeight: 700,
              }}
            >
              TALKTHRIFT
            </p>

            <h1
              style={{
                margin: '4px 0',
              }}
            >
              Seller Dashboard
            </h1>

            <p
              style={{
                color: 'var(--muted)',
              }}
            >
              Manage your thrift store
              in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            style={secondaryStyle}
          >
            Log Out
          </button>
        </header>

        <nav
          aria-label="Dashboard sections"
          style={{
            display: 'flex',
            gap: 9,
            overflowX: 'auto',
            paddingBottom: 12,
            marginBottom: 18,
          }}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setMessage('');
              }}
              style={{
                ...(tab === item.id
                  ? buttonStyle
                  : secondaryStyle),
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <Alert notice={message ? { type: /failed|error|unable|invalid|cannot|not allowed|not connected|not configured|required|must|only|expired/i.test(message) ? 'error' : 'info', text: message } : null} />

        {tab === 'overview' && (
          <section>
            <h2>Store Overview</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 14,
              }}
            >
              {[
                [
                  'Total Products',
                  products.length,
                ],
                [
                  'Available Items',
                  availableCount,
                ],
                [
                  'Total Orders',
                  orders.length,
                ],
                [
                  'Pending Orders',
                  pendingOrders,
                ],
                [
                  'Pending Offers',
                  pendingOffers,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  style={cardStyle}
                >
                  <p
                    style={{
                      color: 'var(--muted)',
                    }}
                  >
                    {label}
                  </p>

                  <h2
                    style={{
                      fontSize: 32,
                      margin: '8px 0',
                      color: 'var(--blue)',
                    }}
                  >
                    {value}
                  </h2>
                </div>
              ))}
            </div>

            <div
              style={{
                ...cardStyle,
                marginTop: 22,
              }}
            >
              <h2>Quick Actions</h2>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() =>
                    setTab('products')
                  }
                >
                  Manage Products
                </button>

                <button
                  type="button"
                  style={secondaryStyle}
                  onClick={() =>
                    setTab('orders')
                  }
                >
                  View Orders
                </button>

                <button
                  type="button"
                  style={secondaryStyle}
                  onClick={() =>
                    setTab('offers')
                  }
                >
                  Review Offers
                </button>

                <button
                  type="button"
                  style={secondaryStyle}
                  onClick={() =>
                    void loadData()
                  }
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </section>
        )}

        {tab === 'products' && (
          <section>
            <div style={cardStyle}>
              <h2>
                {editingId
                  ? 'Edit Product'
                  : 'Add New Product'}
              </h2>

              <form onSubmit={saveProduct}>
                <label htmlFor="product-name">
                  Product Name
                </label>

                <input
                  id="product-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  required
                  style={inputStyle}
                />

                <label htmlFor="product-category">
                  Category
                </label>

                <select
                  id="product-category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {[
                    'Tops',
                    'Bottoms',
                    'Dresses',
                    'Outerwear',
                    'Shoes',
                    'Bags',
                    'Accessories',
                    'Others',
                  ].map((category) => (
                    <option key={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <label htmlFor="product-size">
                  Size
                </label>

                <input
                  id="product-size"
                  value={form.size}
                  placeholder="e.g. M, L, 28"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      size: e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <label htmlFor="product-condition">
                  Condition
                </label>

                <select
                  id="product-condition"
                  value={form.condition}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      condition: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  {[
                    'Brand new',
                    'Like new',
                    'Very good',
                    'Good',
                    'Fair',
                  ].map((condition) => (
                    <option key={condition}>
                      {condition}
                    </option>
                  ))}
                </select>

                <label htmlFor="product-price">
                  Price (₱)
                </label>

                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price: e.target.value,
                    })
                  }
                  required
                  style={inputStyle}
                />

                <label htmlFor="product-description">
                  Description
                </label>

                <textarea
                  id="product-description"
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target.value,
                    })
                  }
                  style={inputStyle}
                />

                <label htmlFor="product-status">
                  Status
                </label>

                <select
                  id="product-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                    })
                  }
                  style={inputStyle}
                >
                  <option value="available">
                    Available
                  </option>

                  <option value="reserved">
                    Reserved
                  </option>

                  <option value="sold">
                    Sold
                  </option>

                  <option value="hidden">
                    Hidden
                  </option>
                </select>

                <label htmlFor="product-photos">
                  Product Photos
                  {editingId
                    ? ' (add more photos)'
                    : ''}
                </label>

                <input
                  id="product-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    choosePhotos(
                      e.target.files
                    )
                  }
                  style={inputStyle}
                />

                <p>
                  {photos.length} selected ·{' '}
                  {formatBytes(
                    totalPhotoBytes
                  )}{' '}
                  / 50 MB
                </p>

                {photos.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 16,
                    }}
                  >
                    {photos.map(
                      (photo, index) => (
                        <div
                          key={
                            `${photo.name}-` +
                            `${index}`
                          }
                          style={{
                            border:
                              '1px solid var(--line)',
                            padding: 10,
                            borderRadius: 9,
                            maxWidth: 180,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              overflowWrap:
                                'anywhere',
                            }}
                          >
                            {photo.name}
                          </p>

                          <p
                            style={{
                              fontSize: 12,
                            }}
                          >
                            {formatBytes(
                              photo.size
                            )}
                          </p>

                          <button
                            type="button"
                            style={
                              secondaryStyle
                            }
                            onClick={() =>
                              setPhotos(
                                (current) =>
                                  current.filter(
                                    (_, i) =>
                                      i !==
                                      index
                                  )
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="submit"
                    disabled={busy}
                    style={buttonStyle}
                  >
                    {busy
                      ? 'Saving...'
                      : editingId
                        ? 'Save Changes'
                        : 'Add Product'}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      style={
                        secondaryStyle
                      }
                      onClick={resetForm}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <h2
              style={{
                marginTop: 30,
              }}
            >
              Your Products (
              {products.length})
            </h2>

            {products.length === 0 ? (
              <p>No products yet.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 16,
                }}
              >
                {products.map(
                  (product) => {
                    const image =
                      product
                        .image_urls?.[0] ||
                      product.image_url;

                    return (
                      <article
                        key={product.id}
                        style={cardStyle}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt={
                              product.name
                            }
                            style={{
                              width:
                                '100%',
                              height: 190,
                              objectFit:
                                'cover',
                              borderRadius: 9,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 190,
                              background:
                                'var(--blue-light)',
                              display:
                                'grid',
                              placeItems:
                                'center',
                              borderRadius: 9,
                            }}
                          >
                            No Photo
                          </div>
                        )}

                        <h3>
                          {product.name}
                        </h3>

                        <p>
                          {money(
                            product.price
                          )}
                        </p>

                        <p>
                          {
                            product.category
                          }{' '}
                          ·{' '}
                          {product.size ||
                            'No size'}
                        </p>

                        <p>
                          {
                            product.condition
                          }
                        </p>

                        <label
                          htmlFor={
                            `status-` +
                            product.id
                          }
                        >
                          Status
                        </label>

                        <select
                          id={
                            `status-` +
                            product.id
                          }
                          value={
                            product.status
                          }
                          disabled={busy}
                          onChange={(e) =>
                            void updateProductStatus(
                              product.id,
                              e.target.value
                            )
                          }
                          style={inputStyle}
                        >
                          <option value="available">
                            Available
                          </option>

                          <option value="reserved">
                            Reserved
                          </option>

                          <option value="sold">
                            Sold
                          </option>

                          <option value="hidden">
                            Hidden
                          </option>
                        </select>

                        <div
                          style={{
                            display:
                              'flex',
                            gap: 8,
                            flexWrap:
                              'wrap',
                          }}
                        >
                          <button
                            type="button"
                            style={
                              secondaryStyle
                            }
                            onClick={() =>
                              startEdit(
                                product
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            style={{
                              ...secondaryStyle,
                              color:
                                '#b91c1c',
                            }}
                            disabled={busy}
                            onClick={() =>
                              void deleteProduct(
                                product
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'orders' && (
          <section>
            <h2>
              Customer Orders (
              {orders.length})
            </h2>

            <button
              type="button"
              style={secondaryStyle}
              onClick={() =>
                void loadData()
              }
            >
              Refresh Orders
            </button>

            {orders.length === 0 && (
              <p>
                No orders have been
                placed yet.
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gap: 15,
                marginTop: 18,
              }}
            >
              {orders.map((order) => (
                <article
                  key={order.id}
                  style={cardStyle}
                >
                  <h3>
                    Order #
                    {order.id.slice(
                      0,
                      8
                    )}
                  </h3>

                  <p>
                    <strong>
                      Customer:
                    </strong>{' '}
                    {
                      order.customer_name
                    }
                  </p>

                  <p>
                    <strong>
                      Contact:
                    </strong>{' '}
                    {
                      order.contact_number
                    }
                  </p>

                  <p>
                    <strong>
                      Address:
                    </strong>{' '}
                    {
                      order.delivery_address
                    }
                  </p>

                  <p>
                    <strong>
                      Items:
                    </strong>{' '}
                    {displayItems(
                      order.items
                    )}
                  </p>

                  <p>
                    <strong>
                      {order.fee_confirmed === false ? 'Estimated total (starts at):' : 'Total:'}
                    </strong>{' '}
                    {money(
                      order.total
                    )}
                  </p>

                  <p>
                    <strong>
                      Date:
                    </strong>{' '}
                    {dateText(
                      order.created_at
                    )}
                  </p>
                  {order.delivery_method && <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
                    <p><strong>Delivery:</strong> {order.delivery_method === 'shipping' ? `Shipping · ${order.shipping_region ?? ''}` : order.delivery_method === 'meetup' ? 'Pagadian meetup' : 'Pagadian local delivery'}</p>
                    <p><strong>Item subtotal:</strong> {money(order.item_subtotal ?? 0)}</p>
                    <p><strong>Delivery fee:</strong> {money(order.shipping_fee ?? 0)} {order.fee_confirmed === false ? '(starting estimate — confirm final fee)' : ''}</p>
                    <p><strong>{order.fee_confirmed === false ? 'Estimated total:' : 'Order total:'}</strong> {money(order.total)}</p>
                    {order.delivery_method === 'shipping' && <><p><strong>Payment:</strong> {order.payment_method?.toUpperCase()} · {order.payment_status === 'verified' ? 'Verified by seller' : 'Awaiting verification'}</p>{order.payment_status === 'pending' && ['pending', 'confirmed', 'packed'].includes(order.status) && <><p>Check your payment account first. Do not dispatch until payment is confirmed.</p><button type="button" style={secondaryStyle} disabled={busy} onClick={() => void confirmPayment(order.id)}>Confirm payment received</button></>}</>}
                    {order.delivery_method === 'local_delivery' && ['pending', 'confirmed', 'packed'].includes(order.status) && <form onSubmit={(event) => void confirmLocalFee(event, order.id)} style={{display:'grid',gap:8,marginTop:10}}><label htmlFor={`local-fee-${order.id}`}>Confirm final local delivery fee (₱30 minimum)</label><input id={`local-fee-${order.id}`} name="fee" type="number" min="30" step="0.01" defaultValue={order.shipping_fee ?? 30} required disabled={busy} style={inputStyle} /><button type="submit" style={secondaryStyle} disabled={busy}>Confirm local delivery fee</button></form>}
                  </div>}

                  <label
                    htmlFor={
                      `order-` +
                      order.id
                    }
                  >
                    Order Status
                  </label>

                  <select
                    id={
                      `order-` +
                      order.id
                    }
                    value={
                      order.status
                    }
                    disabled={busy}
                    onChange={(e) =>
                      void updateOrderStatus(
                        order.id,
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="pending" disabled={order.status !== 'pending' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('pending')}>
                      Pending
                    </option>

                    <option value="confirmed" disabled={order.status !== 'confirmed' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('confirmed')}>
                      Confirmed
                    </option>

                    <option value="packed" disabled={order.status !== 'packed' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('packed')}>
                      Packed
                    </option>

                    <option value="shipped" disabled={order.status !== 'shipped' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('shipped')}>
                      Shipped
                    </option>

                    <option value="completed" disabled={order.status !== 'completed' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('completed')}>
                      Completed
                    </option>

                    <option value="cancelled" disabled={order.status !== 'cancelled' && !({ pending: ['confirmed','cancelled'], confirmed: ['packed','shipped','cancelled'], packed: ['shipped','cancelled'], shipped: ['completed'], completed: [], cancelled: [] } as Record<string, string[]>)[order.status]?.includes('cancelled')}>
                      Cancelled
                    </option>
                  </select>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === 'offers' && (
          <section>
            <h2>
              Customer Offers (
              {offers.length})
            </h2>

            <p
              style={{
                color: 'var(--muted)',
              }}
            >
              Offers submitted through
              Supabase appear here.
              Facebook messages are
              not automatically recorded.
            </p>

            <button
              type="button"
              style={secondaryStyle}
              onClick={() =>
                void loadData()
              }
            >
              Refresh Offers
            </button>

            {offers.length === 0 && (
              <p>
                No offers have been
                submitted yet.
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gap: 15,
                marginTop: 18,
              }}
            >
              {offers.map((offer) => {
                const product =
                  products.find(
                    (p) =>
                      p.id ===
                      offer.product_id
                  );

                return (
                  <article
                    key={offer.id}
                    style={cardStyle}
                  >
                    <h3>
                      {product?.name ||
                        'Product'}
                    </h3>

                    <p>
                      <strong>
                        Listed Price:
                      </strong>{' '}
                      {product
                        ? money(
                            product.price
                          )
                        : 'Unavailable'}
                    </p>

                    <p>
                      <strong>
                        Customer Offer:
                      </strong>{' '}
                      {money(
                        offer.offer_amount
                      )}
                    </p>

                    <p>
                      <strong>
                        Status:
                      </strong>{' '}
                      {offer.status}
                    </p>

                    <p>
                      <strong>
                        Date:
                      </strong>{' '}
                      {dateText(
                        offer.created_at
                      )}
                    </p>

                    <p
                      style={{
                        fontSize: 12,
                        overflowWrap:
                          'anywhere',
                      }}
                    >
                      Customer ID:{' '}
                      {
                        offer.customer_id
                      }
                    </p>

                    {offer.status ===
                      'pending' && (
                      <div
                        style={{
                          display:
                            'flex',
                          gap: 10,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          style={
                            buttonStyle
                          }
                          onClick={() =>
                            void updateOfferStatus(
                              offer.id,
                              'accepted'
                            )
                          }
                        >
                          Accept Offer
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          style={
                            secondaryStyle
                          }
                          onClick={() =>
                            void updateOfferStatus(
                              offer.id,
                              'rejected'
                            )
                          }
                        >
                          Reject Offer
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'contact' && (
          <section>
            <h2>
              Seller Contact
            </h2>

            <div style={cardStyle}>
              <h3>
                TalkThrift Social Accounts
              </h3>

              <p>
                <strong>
                  Facebook:
                </strong>{' '}
                <a
                  href={FACEBOOK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  KILME RUDY
                </a>
              </p>

              <p>
                <strong>
                  Instagram:
                </strong>{' '}
                <a
                  href={INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @talkthriftwhsorudy
                </a>
              </p>

              <p
                style={{
                  color: 'var(--muted)',
                }}
              >
                These contact links are
                currently set in the
                website code.
              </p>
            </div>

            <div
              style={{
                ...cardStyle,
                marginTop: 16,
              }}
            >
              <h3>
                Delivery Information
              </h3>

              <p>
                Luzon — ₱89
              </p>

              <p>
                Visayas — ₱89
              </p>

              <p>
                Mindanao — ₱69
              </p>

              <p>
                Meetup in Pagadian City
                — Free
              </p>

              <p>
                Local Pagadian delivery
                — Starts at ₱30
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
