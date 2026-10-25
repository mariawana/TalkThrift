
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  size: string | null;
};

type Order = {
  id: string;
  created_at: string;
  items: OrderItem[];
  total: number;
  status: string;
  customer_name: string;
};

export default function MyOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      if (!supabase) {
        setError('Store connection is unavailable.');
        setLoading(false);
        return;
      }

      const client = supabase;

      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (!active) return;

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.replace('/account?next=orders');
        return;
      }

      const { data, error: ordersError } = await client
        .from('orders')
        .select('id,created_at,items,total,status,customer_name')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (ordersError) {
        setError(ordersError.message);
      } else {
        setOrders((data ?? []) as Order[]);
      }

      setLoading(false);
    }

    void loadOrders();

    return () => {
      active = false;
    };
  }, [router]);

  const formatPrice = (amount: number) =>
    `₱${Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  return (
    <main className="adminWrap">
      <header className="adminHeader">
        <Link href="/" className="brand">
          TALK<span>THRIFT</span>
        </Link>
        <Link href="/">← Back to Store</Link>
      </header>

      <section className="adminPanel">
        <p className="eyebrow">YOUR PURCHASES</p>
        <h1>My Orders</h1>
        <p>Track your TalkThrift finds and their order status.</p>

        {loading && <p>Loading your orders...</p>}

        {error && <p role="alert" className="notice">{error}</p>}

        {!loading && !error && orders.length === 0 && (
          <div className="emptyState">
            <h2>No orders yet.</h2>
            <p>Your next favorite find is waiting.</p>
            <Link href="/#shop" className="primary">
              Shop All ↗
            </Link>
          </div>
        )}

        {!loading && !error && orders.map((order) => (
          <article className="orderCard" key={order.id}>
            <div className="orderCardHeader">
              <div>
                <p className="eyebrow">ORDER</p>
                <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                <p>{formatDate(order.created_at)}</p>
              </div>

              <span className="orderStatus">
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>

            <div className="orderItems">
              {Array.isArray(order.items) &&
                order.items.map((item, index) => (
                  <div className="cartItem" key={`${item.id}-${index}`}>
                    <span>
                      {item.name}
                      {item.size ? ` · ${item.size}` : ''}
                    </span>
                    <strong>{formatPrice(item.price)}</strong>
                  </div>
                ))}
            </div>

            <div className="cartTotal">
              <span>Order total (excluding shipping)</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
