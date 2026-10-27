'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Alert, Modal } from '../components/StoreUI';
import type { Notice } from '../components/StoreUI';
type Product = { id: string; name: string; price: number; size: string | null; status: string };
type Delivery = '' | 'shipping' | 'meetup' | 'local_delivery';
type Region = '' | 'luzon' | 'visayas' | 'mindanao';
type Payment = '' | 'gcash' | 'maya' | 'gotyme';
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
export default function CheckoutPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postal, setPostal] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('');
  const [region, setRegion] = useState<Region>('');
  const [payment, setPayment] = useState<Payment>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const requestKey = useRef('');
  const requestStorageKey = useRef('');
  const lock = useRef(false);
  const local = delivery === 'meetup' || delivery === 'local_delivery';
  const pagadian = ['pagadian', 'pagadian city'].includes(city.trim().replace(/\s+/g, ' ').toLowerCase());
  const fee = delivery === 'meetup' ? 0 : delivery === 'local_delivery' ? 30 : region === 'mindanao' ? 69 : region === 'luzon' || region === 'visayas' ? 89 : null;
  const subtotal = Number(product?.price ?? 0);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!supabase) throw new Error();
        let id = new URLSearchParams(location.search).get('product');
        if (!id) { try { id = JSON.parse(localStorage.getItem('rewear-cart') ?? '[]')[0]?.id ?? null; } catch {} }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active) return;
        if (!user && (!error || error.name === 'AuthSessionMissingError')) { router.replace(`/account?next=${encodeURIComponent(id ? `/checkout?product=${id}` : '/checkout')}`); return; }
        if (error || !user) throw new Error();
        const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,phone,role').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;
        if (profile?.role === 'owner') { setNotice({ type: 'error', text: 'Please use a customer account to place an order.' }); return; }
        setName(profile?.full_name ?? user.user_metadata?.full_name ?? '');
        setPhone(profile?.phone ?? user.user_metadata?.phone ?? '');
        if (!id) return;
        const { data, error: queryError } = await supabase.from('products').select('id,name,price,size,status').eq('id', id).maybeSingle();
        if (queryError) throw queryError;
        if (!active) return;
        if (!data || data.status !== 'available') { setNotice({ type: 'error', text: 'This piece is no longer available. Please choose another find.' }); return; }
        setProduct(data as Product);
        const tokenKey = `talkthrift-checkout-${user.id}-${id}`;
        requestStorageKey.current = tokenKey;
        try { requestKey.current = sessionStorage.getItem(tokenKey) || crypto.randomUUID(); sessionStorage.setItem(tokenKey, requestKey.current); }
        catch { requestKey.current = crypto.randomUUID(); }
      } catch { if (active) setNotice({ type: 'error', text: 'Unable to load checkout. Check your internet connection and refresh.' }); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [router]);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null);
    if (![name, phone, street, barangay, city, province, postal].every((value) => value.trim()) || !/^\d{4}$/.test(postal.trim())) { setNotice({ type: 'error', text: 'Complete your full address and a four-digit postal code.' }); return; }
    if (!delivery) { setNotice({ type: 'error', text: 'Please select a delivery method.' }); return; }
    if (local && !pagadian) { setNotice({ type: 'error', text: 'Meetup and local delivery are for Pagadian City only. Enter Pagadian City or choose shipping.' }); return; }
    if (delivery === 'shipping' && (!region || !payment)) { setNotice({ type: 'error', text: 'Choose your shipping destination and payment method.' }); return; }
    if (delivery === 'shipping' && pagadian && region !== 'mindanao') { setNotice({ type: 'error', text: 'Pagadian City is in Mindanao. Please choose Mindanao.' }); return; }
    setConfirmOpen(true);
  }
  async function placeOrder() {
    if (!supabase || !product || lock.current) return;
    lock.current = true; setBusy(true); setNotice(null);
    try {
      const { data, error } = await supabase.rpc('place_customer_order_v2', { p_product_id: product.id, p_name: name.trim(), p_phone: phone.trim(), p_street: street.trim(), p_barangay: barangay.trim(), p_city: city.trim(), p_province: province.trim(), p_postal: postal.trim(), p_delivery: delivery, p_region: region || null, p_payment: payment || null, p_request_key: requestKey.current });
      if (error || !data) { setNotice({ type: 'error', text: 'Unable to place this order. Check your address and My Orders before trying again; the item may already be reserved.' }); return; }
      try { localStorage.removeItem('rewear-cart'); sessionStorage.removeItem(requestStorageKey.current); } catch {}
      router.replace(`/order-success?id=${encodeURIComponent(data)}`);
    } catch { setNotice({ type: 'error', text: 'We couldn’t confirm the result. Check My Orders before retrying. Retrying this checkout uses the same order request.' }); }
    finally { setBusy(false); setConfirmOpen(false); lock.current = false; }
  }
  return <main className="adminWrap"><header className="adminHeader"><Link className="brand" href="/">TALK<span>THRIFT</span></Link><Link href={product ? `/product/${product.id}` : '/'}>← Back</Link></header>
    <section className="adminPanel checkoutPanel"><p className="eyebrow">YOUR ORDER DETAILS</p><h1>Almost yours.</h1><Alert notice={notice} />
      {loading ? <p role="status">Loading checkout…</p> : !product ? <><p>No available item selected.</p><Link className="primary" href="/#shop">Browse the collection ↗</Link><Link href="/orders">Check My Orders</Link></> : <form className="ttStack" onSubmit={review}>
        <p>Fill in your complete details so the seller can prepare your order.</p>
        <label>Full name<input autoComplete="name" required maxLength={120} disabled={busy} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Contact number<input type="tel" autoComplete="tel" required maxLength={30} disabled={busy} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>House / building number and street<input autoComplete="address-line1" required maxLength={150} disabled={busy} value={street} onChange={(e) => setStreet(e.target.value)} /></label>
        <label>Barangay<input autoComplete="address-line2" required maxLength={100} disabled={busy} value={barangay} onChange={(e) => setBarangay(e.target.value)} /></label>
        <label>City / municipality<input autoComplete="address-level2" required maxLength={100} disabled={busy} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Pagadian City" /></label>
        <label>Province<input autoComplete="address-level1" required maxLength={100} disabled={busy} value={province} onChange={(e) => setProvince(e.target.value)} /></label>
        <label>Postal code<input autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{4}" required maxLength={4} disabled={busy} value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="4 digits" /></label>
        <label>Delivery method<select value={delivery} required disabled={busy} onChange={(e) => { setDelivery(e.target.value as Delivery); setRegion(''); setPayment(''); }}><option value="">Choose delivery method</option><option value="shipping">Shipping</option><option value="meetup">Meetup — Pagadian City only, free</option><option value="local_delivery">Local delivery — Pagadian City only, starts at ₱30</option></select></label>
        {local && <p className="mutedNote">Meetup and local delivery are available only within Pagadian City. {delivery === 'local_delivery' ? 'The seller confirms the final delivery fee; ₱30 is the starting estimate.' : 'Contact the seller to arrange the meetup and payment.'}</p>}
        {delivery === 'shipping' && <><label>Shipping destination<select value={region} required disabled={busy} onChange={(e) => setRegion(e.target.value as Region)}><option value="">Choose destination</option><option value="luzon">Luzon — ₱89</option><option value="visayas">Visayas — ₱89</option><option value="mindanao">Mindanao — ₱69</option></select></label><label>Payment method<select value={payment} required disabled={busy} onChange={(e) => setPayment(e.target.value as Payment)}><option value="">Choose payment method</option><option value="gcash">GCash</option><option value="maya">Maya / PayMaya</option><option value="gotyme">GoTyme</option></select></label><p className="mutedNote"><strong>Payment first for shipping.</strong> After placing your request, message the seller for the correct payment details and arrange proof of payment. The seller must verify payment before dispatch. This website does not process payments automatically.</p></>}
        <div className="checkoutSummary"><h2>Order summary</h2><p>{product.name}{product.size ? ` · ${product.size}` : ''}</p><div className="cartTotal"><span>Item subtotal</span><strong>{money(subtotal)}</strong></div><div className="cartTotal"><span>{delivery === 'meetup' ? 'Meetup fee' : delivery === 'local_delivery' ? 'Local delivery (starts at)' : 'Shipping fee'}</span><strong>{fee === null ? 'Choose destination' : money(fee)}</strong></div><div className="cartTotal"><span>{delivery === 'local_delivery' ? 'Estimated total (starts at)' : 'Total'}</span><strong>{fee === null ? 'Choose destination' : money(subtotal + fee)}</strong></div>{delivery === 'local_delivery' && <p className="mutedNote">The final total may be higher after the seller confirms your delivery fee.</p>}</div>
        <button className="primary" disabled={busy}>{busy ? 'Placing order…' : 'Review and Place Order ↗'}</button><Link href="/orders">View My Orders</Link>
      </form>}
    </section><Modal open={confirmOpen} title="Place this order?" onClose={() => { if (!busy) setConfirmOpen(false); }}><p>{delivery === 'local_delivery' ? 'Estimated total starts at' : 'Your total is'} {fee === null ? 'not available' : money(subtotal + fee)}{delivery === 'local_delivery' ? '. The seller will confirm the final local delivery fee.' : '.'}</p><p>{delivery === 'shipping' ? 'Payment first via your chosen method. Request the seller’s payment details and send proof directly; payment is not yet verified.' : 'Contact the seller to arrange payment and your meetup or delivery.'}</p><div className="ttActions"><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Review details</button><button type="button" className="primary" disabled={busy} onClick={placeOrder}>{busy ? 'Placing…' : 'Confirm Order'}</button></div></Modal>
  </main>;
}
