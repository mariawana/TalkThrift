'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Alert, LoginDialog } from '../../components/StoreUI';
import type { Notice } from '../../components/StoreUI';

type Product = { id: string; name: string; category: string; size: string | null; condition: string; price: number; image_url: string | null; image_urls?: string[] | null; description: string | null; status: string };
const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [retry, setRetry] = useState(0);
  const [photo, setPhoto] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState('');
  const actionLock = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setNotice(null); setPhoto(0);
    (async () => {
      try {
        if (!supabase) throw new Error();
        const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (active) setProduct(data as Product | null);
      } catch { if (active) { setProduct(null); setNotice({ type: 'error', text: 'Unable to load this piece. Check your connection and try again.' }); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, retry]);
  async function customer() {
    if (!supabase) throw new Error('The store connection is unavailable.');
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user && (!error || error.name === 'AuthSessionMissingError')) { setLoginOpen(true); return false; }
    if (error || !user) throw new Error('Unable to verify your account. Please log in again.');
    const { data, error: roleError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (roleError) throw new Error('Unable to verify your account. Try again.');
    if (data?.role === 'owner') throw new Error('Use a customer account to buy or make offers. Your seller conversations are in Messages.');
    return true;
  }
  async function action(kind: 'buy' | 'message' | 'offer') {
    if (!product || actionLock.current) return;
    actionLock.current = true; setBusy(kind); setNotice(null);
    try {
      if (!(await customer())) return;
      if (!supabase) return;
      if (kind !== 'message' && product.status !== 'available') throw new Error('This piece is no longer available.');
      if (kind === 'offer') { setShowOffer(true); return; }
      if (kind === 'buy') {
        router.push(`/checkout?product=${encodeURIComponent(product.id)}`); return;
      }
      const { data, error } = await supabase.rpc('open_product_conversation', { p_product_id: product.id });
      if (error || !data) throw new Error('Unable to open this conversation. Please retry or contact the seller.');
      router.push(`/messages?conversation=${encodeURIComponent(data)}`);
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to continue. Try again.' }); }
    finally { setBusy(''); actionLock.current = false; }
  }
  async function sendOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product || actionLock.current) return;
    setNotice(null);
    const value = Number(amount);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()) || !Number.isFinite(value) || value <= 0 || value >= Number(product.price)) { setNotice({ type: 'error', text: 'Enter an offer greater than ₱0 and below the listed price, with up to two decimal places.' }); return; }
    actionLock.current = true; setBusy('send');
    try {
      if (!(await customer()) || !supabase) return;
      const { data, error } = await supabase.rpc('submit_product_offer', { p_product_id: product.id, p_amount: value });
      if (error || !data) {
        const pending = error?.message.includes('pending offer');
        throw new Error(pending ? 'You already have a pending offer. Open Messages to discuss it with the seller.' : 'Your offer could not be submitted. The price or availability may have changed. Refresh and try again.');
      }
      setShowOffer(false); setAmount(''); router.push(`/messages?conversation=${encodeURIComponent(data)}`);
    } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Unable to submit your offer. Try again.' }); }
    finally { setBusy(''); actionLock.current = false; }
  }
  async function share() {
    try { await navigator.clipboard.writeText(location.href); setNotice({ type: 'success', text: 'Product link copied. You can share it now.' }); }
    catch { setNotice({ type: 'info', text: 'Copy the product address from your browser to share this piece.' }); }
  }
  const photos = product ? Array.from(new Set([...(product.image_urls ?? []), product.image_url].filter((value): value is string => Boolean(value)))) : [];
  return <main className="productDetails"><Link className="backLink" href="/">← Back to collection</Link><Alert notice={notice} />
    {loading ? <p role="status">Loading this find…</p> : !product ? <section className="ttEmpty"><h1>This piece is unavailable.</h1><p>It may have been removed, or we couldn’t load it.</p><button className="secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></section> : <div className="detailsGrid">
      <section className="detailsPhotos" aria-label="Product photos"><div className="mainPhoto">{photos.length ? <img src={photos[Math.min(photo, photos.length - 1)]} alt={product.name} /> : <div className="noImage"><span>TT</span><small>PHOTO COMING SOON</small></div>}</div>
        {photos.length > 1 && <div className="photoThumbnails">{photos.map((url, index) => <button key={url} type="button" aria-label={`View photo ${index + 1}`} aria-pressed={index === photo} onClick={() => setPhoto(index)}><img src={url} alt={`${product.name}, photo ${index + 1}`} loading="lazy" /></button>)}</div>}
      </section>
      <section className="detailsInfo"><p className="eyebrow">THE TALKTHRIFT FIND</p><p className="detailCategory">{product.category}</p><h1>{product.name}</h1><p className="detailPrice">{money(product.price)}</p><p><strong>Condition:</strong> {product.condition}</p><p><strong>Size:</strong> {product.size || 'Size not listed'}</p><p><strong>Availability:</strong> {product.status}</p>
        <div className="detailDescription"><h2>About this piece</h2><p>{product.description || 'Message the seller if you need more details about this piece.'}</p></div>
        <div className="detailActions">{product.status === 'available' && <button className="primary" disabled={Boolean(busy)} onClick={() => void action('buy')}>{busy === 'buy' ? 'Checking account…' : 'Buy Now ↗'}</button>}<button className="secondaryAction" disabled={Boolean(busy)} onClick={() => void action('message')}>{busy === 'message' ? 'Opening conversation…' : 'Message Seller'}</button>{product.status === 'available' && <button className="secondaryAction" disabled={Boolean(busy)} onClick={() => void action('offer')}>{busy === 'offer' ? 'Checking account…' : 'Make an Offer'}</button>}</div>
        {showOffer && product.status === 'available' && <form className="offerPanel" onSubmit={sendOffer}><h2>Make an Offer</h2><p>Listed price: {money(product.price)}</p><label htmlFor="offer-amount">Your offer (PHP)</label><input id="offer-amount" type="number" min="0.01" step="0.01" max={Number(product.price) - 0.01} inputMode="decimal" autoFocus required value={amount} disabled={Boolean(busy)} onChange={(event) => setAmount(event.target.value)} /><div className="offerButtons"><button className="primary" disabled={Boolean(busy)}>{busy === 'send' ? 'Submitting…' : 'Submit Offer'}</button><button className="secondaryAction" type="button" disabled={Boolean(busy)} onClick={() => setShowOffer(false)}>Cancel</button></div></form>}
        <button className="shareAction" type="button" onClick={share}>↗ Share this find</button>
        <div className="shippingNote"><h2>Delivery information</h2><p>Luzon / Visayas — ₱89</p><p>Mindanao — ₱69</p><p>Meetup in Pagadian City — Free</p><p>Local Pagadian delivery — Starts at ₱30</p><small>Confirm the final delivery fee and payment arrangement with the seller before dispatch.</small></div>
        <div className="shippingNote"><h2>Connect with the seller</h2><p><a href="https://www.facebook.com/kilme.rudy" target="_blank" rel="noopener noreferrer">Facebook · KILME RUDY ↗</a></p><p><a href="https://www.instagram.com/talkthriftwhsorudy/" target="_blank" rel="noopener noreferrer">Instagram · @talkthriftwhsorudy ↗</a></p></div>
      </section></div>}
    <LoginDialog open={loginOpen} next={`/product/${id}`} onClose={() => setLoginOpen(false)} />
  </main>;
}
