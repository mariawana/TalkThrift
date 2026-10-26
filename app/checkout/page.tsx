'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Alert, Modal } from '../components/StoreUI';
import type { Notice } from '../components/StoreUI';
type Product = { id: string; name: string; price: number; size: string | null; status: string };
export default function CheckoutPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const requestKey = useRef('');
  const requestStorageKey = useRef('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!supabase) throw new Error();
        let id = new URLSearchParams(location.search).get('product');
        // Compatibility with the original Buy Now button.
        if (!id) { try { id = JSON.parse(localStorage.getItem('rewear-cart') ?? '[]')[0]?.id ?? null; } catch {} }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active) return;
        if (!user && (!error || error.name === 'AuthSessionMissingError')) { router.replace(`/account?next=${encodeURIComponent(id ? `/checkout?product=${id}` : '/checkout')}`); return; }
        if (error || !user) throw new Error();
        const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,phone,delivery_address,role').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;
        if (profile?.role === 'owner') { setNotice({ type: 'error', text: 'Please use a customer account to place an order.' }); return; }
        setName(profile?.full_name ?? user.user_metadata?.full_name ?? '');
        setPhone(profile?.phone ?? user.user_metadata?.phone ?? '');
        setAddress(profile?.delivery_address ?? user.user_metadata?.delivery_address ?? '');
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
    if (!name.trim() || !phone.trim() || !address.trim()) { setNotice({ type: 'error', text: 'Complete your delivery details before placing your order.' }); return; }
    setConfirmOpen(true);
  }
  async function placeOrder() {
    if (!supabase || !product || lock.current) return;
    lock.current = true; setBusy(true); setNotice(null);
    try {
      const { data, error } = await supabase.rpc('place_customer_order', { p_product_id: product.id, p_name: name.trim(), p_phone: phone.trim(), p_address: address.trim(), p_request_key: requestKey.current });
      if (error || !data) { setNotice({ type: 'error', text: 'Unable to place this order. The piece may already be reserved or unavailable. Check My Orders before retrying.' }); return; }
      try { localStorage.removeItem('rewear-cart'); sessionStorage.removeItem(requestStorageKey.current); } catch {}
      router.replace(`/order-success?id=${encodeURIComponent(data)}`);
    } catch { setNotice({ type: 'error', text: 'We couldn’t confirm the result. Check My Orders before retrying. Retrying this checkout uses the same order request.' }); }
    finally { setBusy(false); setConfirmOpen(false); lock.current = false; }
  }
  return <main className="adminWrap"><header className="adminHeader"><Link className="brand" href="/">TALK<span>THRIFT</span></Link><Link href={product ? `/product/${product.id}` : '/'}>← Back</Link></header>
    <section className="adminPanel checkoutPanel"><p className="eyebrow">YOUR ORDER DETAILS</p><h1>Almost yours.</h1><Alert notice={notice} />
      {loading ? <p role="status">Loading checkout…</p> : !product ? <><p>No available item selected.</p><Link className="primary" href="/#shop">Browse the collection ↗</Link><Link href="/orders">Check My Orders</Link></> : <form className="ttStack" onSubmit={review}>
        <p>Review your delivery details. Final shipping and payment arrangements are confirmed with the seller.</p><label>Full name<input autoComplete="name" required maxLength={120} disabled={busy} value={name} onChange={(e) => setName(e.target.value)} /></label><label>Contact number<input type="tel" autoComplete="tel" required maxLength={30} disabled={busy} value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label>Complete delivery address<textarea autoComplete="street-address" required maxLength={500} disabled={busy} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <div className="checkoutSummary"><h2>Order summary</h2><p>{product.name}{product.size ? ` · ${product.size}` : ''}</p><div className="cartTotal"><span>Subtotal, excluding shipping</span><strong>₱{Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div><p className="mutedNote">This creates an order request, not an online payment. Contact the seller to confirm shipping and payment. You may cancel before dispatch.</p></div><button className="primary" disabled={busy}>{busy ? 'Placing order…' : 'Review and Place Order ↗'}</button><Link href="/orders">View My Orders</Link>
      </form>}
    </section><Modal open={confirmOpen} title="Place this order?" onClose={() => { if (!busy) setConfirmOpen(false); }}><p>Your item subtotal is ₱{Number(product?.price ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}, excluding shipping. The seller will confirm delivery and payment arrangements.</p><div className="ttActions"><button type="button" className="secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Review details</button><button type="button" className="primary" disabled={busy} onClick={placeOrder}>{busy ? 'Placing…' : 'Confirm Order'}</button></div></Modal>
  </main>;
}
