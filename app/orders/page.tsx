'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Alert, Modal } from '../components/StoreUI';
import type { Notice } from '../components/StoreUI';
type Item = { id: string; name: string; price: number; size: string | null };
type Order = { id: string; created_at: string; items: Item[]; total: number; status: string; cancelled_at: string | null; received_at: string | null; delivery_method: string | null; shipping_region: string | null; address_details: {street:string;barangay:string;city:string;province:string;postal_code:string} | null; item_subtotal: number | null; shipping_fee: number | null; fee_confirmed: boolean | null; payment_method: string | null; payment_status: string | null };
const formatMoney = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
const date = (value: string) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const steps = ['pending', 'confirmed', 'packed', 'shipped', 'completed'];
export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirmation, setConfirmation] = useState<{ id: string; action: 'cancel' | 'received' } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!supabase) throw new Error();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!user && (!error || error.name === 'AuthSessionMissingError')) { router.replace('/account?next=%2Forders'); return; }
      if (error || !user) throw new Error();
      const { data, error: queryError } = await supabase.from('orders').select('id,created_at,items,total,status,cancelled_at,received_at,delivery_method,shipping_region,address_details,item_subtotal,shipping_fee,fee_confirmed,payment_method,payment_status').eq('customer_id', user.id).order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setOrders((data ?? []) as Order[]);
    } catch { setNotice({ type: 'error', text: 'Unable to load orders. Check your connection and try Refresh.' }); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  async function confirm() {
    if (!supabase || !confirmation || lock.current) return;
    lock.current = true; setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.rpc('customer_order_action', { p_order_id: confirmation.id, p_action: confirmation.action });
      if (error) throw error;
      setNotice({ type: 'success', text: confirmation.action === 'cancel' ? 'Order cancelled. If you already paid, contact the seller to arrange a refund. This is not a refund confirmation.' : 'Order marked as received. Thank you for shopping with TalkThrift!' });
      await load();
    } catch { setNotice({ type: 'error', text: 'This action could not be completed. The order may have changed or already been dispatched. Refresh your orders and try again.' }); }
    finally { setConfirmation(null); setBusy(false); lock.current = false; }
  }
  return <main className="adminWrap"><header className="adminHeader"><Link className="brand" href="/">TALK<span>THRIFT</span></Link><Link href="/account">← My Account</Link></header>
    <section className="ttPagePanel"><div className="ttPageHeading"><div><p className="eyebrow">YOUR PURCHASES</p><h1>My Orders</h1></div><button className="secondary" type="button" disabled={loading || busy} onClick={() => { setNotice(null); void load(); }}>Refresh</button></div><Alert notice={notice} />
      <p>Track your finds. You can cancel an order before dispatch or confirm receipt after shipping.</p>
      {loading ? <p role="status">Loading orders…</p> : !orders.length ? <div className="ttEmpty"><h2>No orders to show.</h2><Link className="primary" href="/#shop">Browse the collection ↗</Link></div> : orders.map((order) => <article className="orderCard" key={order.id}>
        <div className="orderCardHeader"><div><p className="eyebrow">ORDER #{order.id.slice(0, 8).toUpperCase()}</p><p>{date(order.created_at)}</p></div><span className={`orderStatus status-${order.status}`}>{order.status === 'shipped' ? 'DISPATCHED / SHIPPED' : order.status === 'completed' ? 'RECEIVED / COMPLETED' : order.status.toUpperCase()}</span></div>
        {order.status !== 'cancelled' && <ol className="ttOrderSteps" aria-label="Order progress">{steps.map((step, index) => <li key={step} className={index <= steps.indexOf(order.status) ? 'isDone' : ''} aria-current={step === order.status ? 'step' : undefined}>{step === 'completed' ? 'Received' : step}</li>)}</ol>}
        <div className="orderItems">{Array.isArray(order.items) && order.items.map((item, index) => <div className="cartItem" key={`${item.id}-${index}`}><span>{item.name}{item.size ? ` · ${item.size}` : ''}</span><strong>{formatMoney(item.price)}</strong></div>)}</div>
        {order.delivery_method ? <><div className="cartTotal"><span>Items</span><strong>{formatMoney(order.item_subtotal ?? 0)}</strong></div><div className="cartTotal"><span>{order.delivery_method === 'meetup' ? 'Meetup' : order.delivery_method === 'local_delivery' ? order.fee_confirmed ? 'Local delivery' : 'Local delivery (starts at)' : `Shipping · ${order.shipping_region}`}</span><strong>{formatMoney(order.shipping_fee ?? 0)}</strong></div><div className="cartTotal"><span>{order.fee_confirmed === false ? 'Estimated total (starts at)' : 'Total'}</span><strong>{formatMoney(order.total)}</strong></div>{order.address_details && <p>Address: {order.address_details.street}, {order.address_details.barangay}, {order.address_details.city}, {order.address_details.province} {order.address_details.postal_code}</p>}{order.delivery_method === 'shipping' && <p>Payment: {order.payment_method?.toUpperCase()} · {order.payment_status === 'verified' ? 'Payment confirmed by seller' : 'Awaiting seller verification'}</p>}{order.delivery_method === 'shipping' && order.payment_status !== 'verified' && <p className="mutedNote">Payment first before shipping. Contact the seller for payment details and proof of payment.</p>}</> : <div className="cartTotal"><span>Total, excluding shipping</span><strong>{formatMoney(order.total)}</strong></div>}
        {order.received_at && <p className="mutedNote">Received: {date(order.received_at)}</p>}{order.cancelled_at && <p className="mutedNote">Cancelled: {date(order.cancelled_at)}</p>}
        <div className="ttActions">{['pending','confirmed','packed'].includes(order.status) && <button className="ttDanger" disabled={busy} type="button" onClick={() => setConfirmation({ id: order.id, action: 'cancel' })}>Cancel Order</button>}{order.status === 'shipped' && <button className="primary" disabled={busy} type="button" onClick={() => setConfirmation({ id: order.id, action: 'received' })}>Order Received ✓</button>}<Link className="secondary" href="/messages">Open Messages ↗</Link></div>
        {order.status === 'shipped' && <p className="mutedNote">Already dispatched. Contact the seller for delivery issues; cancellation is no longer available.</p>}{order.status === 'cancelled' && <p className="mutedNote">If you already paid, contact the seller to arrange your refund. Cancellation does not automatically refund a payment.</p>}
      </article>)}
    </section><Modal open={Boolean(confirmation)} title={confirmation?.action === 'cancel' ? 'Cancel this order?' : 'Have you received your order?'} onClose={() => { if (!busy) setConfirmation(null); }}><p>{confirmation?.action === 'cancel' ? 'Confirm cancellation before dispatch. If you already paid, arrange a refund with the seller.' : 'Only confirm after the item is in your hands. This marks the order as completed.'}</p><div className="ttActions"><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Go back</button><button type="button" className={confirmation?.action === 'cancel' ? 'ttDanger' : 'primary'} disabled={busy} onClick={confirm}>{busy ? 'Updating…' : confirmation?.action === 'cancel' ? 'Yes, cancel order' : 'Yes, received'}</button></div></Modal>
  </main>;
}
