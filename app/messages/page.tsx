'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Alert } from '../components/StoreUI';
import type { Notice } from '../components/StoreUI';
type Conversation = { id: string; buyer_id: string; product_id: string; products: { name: string; price: number } | null };
type Message = { id: string; sender_id: string; body: string; created_at: string };
export default function MessagesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [owner, setOwner] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [retry, setRetry] = useState(0);
  const messageBox = useRef<HTMLDivElement>(null);
  const selection = useRef<string | null>(null);
  const requestCount = useRef(0);
  const sending = useRef(false);
  const drafts = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        if (!supabase) throw new Error();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active) return;
        if (!user && (!error || error.name === 'AuthSessionMissingError')) { router.replace('/account?next=%2Fmessages'); return; }
        if (error || !user) throw new Error();
        const [{ data: profile, error: profileError }, { data, error: queryError }] = await Promise.all([
          supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
          supabase.from('conversations').select('id,buyer_id,product_id,products(name,price)').order('created_at', { ascending: false }),
        ]);
        if (profileError || queryError) throw new Error();
        if (!active) return;
        setUserId(user.id); setOwner(profile?.role === 'owner');
        const items = (data ?? []) as unknown as Conversation[];
        setConversations(items);
        const wanted = new URLSearchParams(location.search).get('conversation');
        if (wanted && items.some((item) => item.id === wanted)) { setSelectedId(wanted); setMobileThread(true); }
        else setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
      } catch { if (active) setNotice({ type: 'error', text: 'Unable to load your inbox. Check your connection, then try Refresh.' }); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [router, retry]);
  const fetchMessages = useCallback(async (id: string, quiet = false) => {
    if (!supabase) return;
    const request = ++requestCount.current;
    try {
      const { data, error } = await supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200);
      if (selection.current !== id || request !== requestCount.current) return;
      if (error) throw error;
      setMessages(((data ?? []) as Message[]).reverse());
    } catch {
      if (!quiet && selection.current === id) setNotice({ type: 'error', text: 'Unable to load messages. Your draft is still here. Try Refresh.' });
    } finally { if (selection.current === id && request === requestCount.current) setThreadLoading(false); }
  }, []);
  useEffect(() => {
    selection.current = selectedId;
    setMessages([]);
    if (!selectedId) return;
    setThreadLoading(true);
    void fetchMessages(selectedId);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void fetchMessages(selectedId, true); }, 4000);
    return () => { window.clearInterval(timer); selection.current = null; requestCount.current++; };
  }, [selectedId, fetchMessages]);
  useEffect(() => {
    const box = messageBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, selectedId]);
  function selectConversation(id: string) {
    if (selectedId) drafts.current.set(selectedId, draft);
    setSelectedId(id); setDraft(drafts.current.get(id) ?? ''); setMobileThread(true); setNotice(null);
    history.replaceState({}, '', `/messages?conversation=${encodeURIComponent(id)}`);
  }
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedId || !userId || sending.current) return;
    const body = draft.trim(), id = selectedId;
    if (!body || body.length > 2000) { setNotice({ type: 'error', text: 'Enter a message between 1 and 2,000 characters.' }); return; }
    sending.current = true; setBusy(true); setNotice(null);
    try {
      const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: userId, body });
      if (error) throw error;
      drafts.current.delete(id);
      if (selection.current === id) { setDraft(''); await fetchMessages(id); }
    } catch { setNotice({ type: 'error', text: 'Message not confirmed as sent. Your draft is kept. Refresh the conversation before retrying to avoid sending a duplicate.' }); }
    finally { setBusy(false); sending.current = false; }
  }
  const selected = conversations.find((item) => item.id === selectedId);
  return <main className="ttMessagesPage"><div className="ttPageHeading"><div><h1>Messages</h1><p>Chat privately with {owner ? 'your customers' : 'the TalkThrift seller'}.</p></div><button className="secondary" type="button" disabled={busy || loading} onClick={() => { setNotice(null); setRetry((value) => value + 1); if (selectedId) void fetchMessages(selectedId); }}>Refresh</button></div><Alert notice={notice} />
    {loading ? <p role="status">Loading your inbox…</p> : <div className={`ttInbox ${mobileThread ? 'ttShowThread' : ''}`}>
      <aside className="ttConversationList" aria-label="Conversations"><h2>Conversations</h2>{!conversations.length && <div className="ttInboxEmpty"><p>No conversations yet. Open a product and select Message Seller.</p><Link className="secondary" href="/#shop">Browse finds ↗</Link></div>}{conversations.map((item) => <button key={item.id} type="button" disabled={busy} className={selectedId === item.id ? 'isSelected' : ''} aria-pressed={selectedId === item.id} onClick={() => selectConversation(item.id)}><strong>{item.products?.name ?? 'Product conversation'}</strong><small>{owner ? `Customer ${item.buyer_id.slice(0, 8)}` : 'TalkThrift Seller'} · #{item.id.slice(0, 5)}</small></button>)}</aside>
      <section className="ttThread" aria-label="Selected conversation">{selected ? <><header className="ttThreadHeading"><button type="button" className="ttThreadBack secondary" onClick={() => setMobileThread(false)}>← Conversations</button><strong>{selected.products?.name ?? 'Product conversation'}</strong><Link href={`/product/${selected.product_id}`}>View product ↗</Link></header>
        <div ref={messageBox} className="ttMessageHistory" role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions"><p className="mutedNote">Showing up to the latest 200 messages. Updates every 4 seconds while this page is visible.</p>{threadLoading ? <p role="status">Loading conversation…</p> : !messages.length ? <p>Start your conversation below.</p> : messages.map((message) => <div key={message.id} className={`ttBubble ${message.sender_id === userId ? 'ttMine' : ''}`}><div>{message.body}</div><small>{message.sender_id === userId ? 'You' : owner ? 'Customer' : 'Seller'} · {new Date(message.created_at).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Manila' })}</small></div>)}</div>
        <form className="ttComposer" onSubmit={send}><label className="ttSrOnly" htmlFor="message-draft">Your message</label><textarea id="message-draft" rows={2} maxLength={2000} value={draft} disabled={busy || threadLoading} onChange={(event) => setDraft(event.target.value)} placeholder="Type your message…" /><button className="primary" disabled={busy || threadLoading || !draft.trim()}>{busy ? 'Sending…' : 'Send ↗'}</button></form>
      </> : <div className="ttInboxEmpty"><h2>Your conversations live here.</h2><p>Select a conversation, or open a product to message the seller.</p><Link className="primary" href="/#shop">Browse the collection ↗</Link></div>}</section>
    </div>}
  </main>;
}
