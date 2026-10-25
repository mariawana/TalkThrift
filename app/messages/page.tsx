
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Conversation = {
  id: string;
  buyer_id: string;
  product_id: string;
  created_at: string;
  products: {
    name: string;
    price: number;
    image_url: string | null;
  } | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('conversation');

  const [userId, setUserId] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!supabase) return;

    const { data, error: queryError } = await supabase
      .from('conversations')
      .select(
        'id,buyer_id,product_id,created_at,products(name,price,image_url)'
      )
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const items = (data ?? []) as unknown as Conversation[];
    setConversations(items);

    setSelectedId((current) => {
      if (requestedId && items.some((c) => c.id === requestedId)) {
        return requestedId;
      }

      if (current && items.some((c) => c.id === current)) {
        return current;
      }

      return items[0]?.id ?? null;
    });
  }, [requestedId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!supabase) return;

    const { data, error: queryError } = await supabase
      .from('messages')
      .select('id,conversation_id,sender_id,body,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace(
          `/account?next=${encodeURIComponent('/messages')}`
        );
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;

      setIsOwner(profile?.role === 'owner');
      await loadConversations();

      if (active) setLoading(false);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router, loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedId);

    const interval = window.setInterval(() => {
      void loadMessages(selectedId);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !userId || !selectedId || busy) return;

    const body = draft.trim();

    if (!body || body.length > 2000) {
      setError('Message must be between 1 and 2000 characters.');
      return;
    }

    setBusy(true);
    setError('');

    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedId,
        sender_id: userId,
        body,
      });

    if (insertError) {
      setError(`Message not sent: ${insertError.message}`);
    } else {
      setDraft('');
      await loadMessages(selectedId);
    }

    setBusy(false);
  }

  const selected = conversations.find(
    (conversation) => conversation.id === selectedId
  );

  const time = (value: string) =>
    new Date(value).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const money = (value: number) =>
    `₱${Number(value).toLocaleString('en-PH')}`;

  return (
    <main
      style={{
        maxWidth: 1150,
        margin: '0 auto',
        padding: '24px 16px',
        color: '#26221e',
      }}
    >
      <Link
        href="/"
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        ← Back to TalkThrift
      </Link>

      <h1 style={{ fontSize: 32, marginBottom: 4 }}>
        Messages
      </h1>

      <p style={{ color: '#6b625b', marginTop: 0 }}>
        Chat privately with{' '}
        {isOwner ? 'your customers' : 'the TalkThrift seller'}.
      </p>

      {error && (
        <p
          role="alert"
          style={{
            padding: 12,
            background: '#fff0eb',
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading your inbox...</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(130px, 280px) minmax(0, 1fr)',
            minHeight: 520,
            border: '1px solid #ddd5cd',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          <aside
            style={{
              borderRight: '1px solid #ddd5cd',
              overflowY: 'auto',
            }}
          >
            <h2
              style={{
                fontSize: 16,
                padding: '16px 12px',
                margin: 0,
              }}
            >
              Conversations
            </h2>

            {conversations.length === 0 && (
              <p style={{ padding: 12, fontSize: 14 }}>
                No conversations yet. Open a product and
                select Message Seller.
              </p>
            )}

            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setError('');
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 14,
                  border: 0,
                  borderBottom: '1px solid #eee',
                  background:
                    selectedId === conversation.id
                      ? '#f0e9df'
                      : '#fff',
                  color: '#26221e',
                  cursor: 'pointer',
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {conversation.products?.name ?? 'Product'}
                </strong>

                <small
                  style={{
                    display: 'block',
                    marginTop: 4,
                    color: '#756b62',
                  }}
                >
                  {isOwner
                    ? `Buyer ${conversation.buyer_id.slice(0, 8)}…`
                    : 'TalkThrift Seller'}
                </small>
              </button>
            ))}
          </aside>

          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {selected ? (
              <>
                <header
                  style={{
                    padding: 16,
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <strong>
                    {selected.products?.name ??
                      'Product conversation'}
                  </strong>

                  {selected.products && (
                    <span
                      style={{
                        marginLeft: 10,
                        color: '#786d63',
                      }}
                    >
                      {money(selected.products.price)}
                    </span>
                  )}

                  <div>
                    <Link
                      href={`/product/${selected.product_id}`}
                      style={{ fontSize: 13 }}
                    >
                      View product
                    </Link>
                  </div>
                </header>

                <div
                  style={{
                    flex: 1,
                    minHeight: 350,
                    maxHeight: 550,
                    overflowY: 'auto',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {messages.length === 0 && (
                    <p style={{ color: '#756b62' }}>
                      Start your conversation below.
                    </p>
                  )}

                  {messages.map((message) => {
                    const mine =
                      message.sender_id === userId;

                    return (
                      <div
                        key={message.id}
                        style={{
                          alignSelf: mine
                            ? 'flex-end'
                            : 'flex-start',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          background: mine
                            ? '#e2eadc'
                            : '#f3f0ec',
                          borderRadius: 14,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <div
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {message.body}
                        </div>

                        <small
                          style={{
                            display: 'block',
                            marginTop: 5,
                            color: '#70685f',
                          }}
                        >
                          {mine
                            ? 'You'
                            : isOwner
                              ? 'Buyer'
                              : 'Seller'}
                          {' · '}
                          {time(message.created_at)}
                        </small>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: 12,
                    borderTop: '1px solid #eee',
                  }}
                >
                  <input
                    aria-label="Your message"
                    value={draft}
                    maxLength={2000}
                    onChange={(event) =>
                      setDraft(event.target.value)
                    }
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: 12,
                      border: '1px solid #cfc6bd',
                      borderRadius: 8,
                    }}
                  />

                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    style={{
                      padding: '10px 16px',
                      border: 0,
                      borderRadius: 8,
                      background: '#313d2c',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {busy ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ padding: 24 }}>
                Select a conversation to start chatting.
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
