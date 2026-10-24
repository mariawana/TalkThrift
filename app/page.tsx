'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string;
  size: string | null;
  condition: string;
  price: number;
  image_url: string | null;
  description: string | null;
  status: string;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<Product[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rewear-cart');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCart(parsed as Product[]);
        }
      }
    } catch {
      // Ignore invalid saved cart data.
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function loadProducts() {
      const { data, error } = await supabase!
        .from('products')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (!cancelled && !error && data) {
        setProducts(data as Product[]);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(products.map((p) => p.category).filter(Boolean))
      ),
    ],
    [products]
  );

  const filtered = products.filter((p) => {
    const matchesCategory =
      category === 'All' || p.category === category;

    const searchable =
      `${p.name} ${p.category} ${p.size ?? ''} ${p.condition}`
        .toLowerCase();

    return (
      matchesCategory &&
      searchable.includes(query.toLowerCase())
    );
  });

  const saveCart = (next: Product[]) => {
    setCart(next);

    try {
      localStorage.setItem('rewear-cart', JSON.stringify(next));
    } catch {
      setNotice('Your bag could not be saved on this device.');
    }
  };

  const addToCart = (product: Product) => {
    if (cart.some((item) => item.id === product.id)) {
      setNotice('This handpicked piece is already in your bag.');
      return;
    }

    saveCart([...cart, product]);
    setNotice(`${product.name} has been added to your bag.`);
  };

  const checkout = async () => {
    if (!cart.length) {
      setNotice('Your bag is empty. Find a piece you love first.');
      return;
    }

    if (!supabase) {
      setNotice(
        'The store is temporarily unavailable. Please try again later.'
      );
      return;
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      setNotice('Unable to check your account. Please try again.');
      return;
    }

    if (!session) {
      window.location.href = '/account?next=checkout';
      return;
    }

    window.location.href = '/checkout';
  };

  const formatPrice = (price: number) =>
    `₱${Number(price).toLocaleString('en-PH')}`;

  return (
    <main id="top">
      <div className="announcement">
        HANDPICKED THRIFT FINDS · ONE-OF-A-KIND PIECES · MADE FOR YOU
      </div>

      <header className="nav">
        <a
          className="brand"
          href="#top"
          aria-label="Talk Thrift home"
        >
          Talk <span>Thrift.</span>
        </a>

        <nav aria-label="Main navigation">
          <a href="#shop">Shop all</a>
          <a href="#about">Our story</a>
          <a href="#footer">Contact</a>
          <a href="/account">Account</a>
        </nav>

        <button
          className="cartButton"
          onClick={() =>
            document
              .getElementById('cart')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Bag ({cart.length})
        </button>
      </header>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">GOOD FINDS. PERSONAL STYLE.</p>

          <h1>
            Your next find.
            <br />
            <em>Already loved.</em>
          </h1>

          <p className="heroText">
            Welcome to Talk Thrift, where every piece is handpicked
            with care. Discover pre-loved clothes, find your own style,
            and give a good find a new home.
          </p>

          <a className="primary" href="#shop">
            Explore the collection <span>↗</span>
          </a>

          <div className="heroNote">
            <span className="dot" />
            Handpicked pieces · Thoughtful finds · Affordable style
          </div>
        </div>

        <div
          className="heroImage heroArtwork"
          role="img"
          aria-label="Talk Thrift's Persian blue and white brand artwork"
        >
          <div className="artworkCircle artworkCircleOne" />
          <div className="artworkCircle artworkCircleTwo" />

          <div className="artworkLabel">
            <span>THE THRIFT EDIT</span>
            <strong>Found with care.</strong>
            <span>READY FOR YOUR NEXT CHAPTER</span>
          </div>

          <div className="artworkStamp">TT</div>
        </div>
      </section>

      <section className="ticker" aria-label="Our values">
        <span>HANDPICKED FINDS</span>
        <span>✳</span>
        <span>PERSONAL STYLE</span>
        <span>✳</span>
        <span>GIVE GOOD CLOTHES ANOTHER CHANCE</span>
      </section>

      <section className="shopSection" id="shop">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">THE TALK THRIFT COLLECTION</p>
            <h2>
              Find something <em>you.</em>
            </h2>
          </div>

          <p>
            Carefully chosen pieces.
            <br />
            Ready for their next home.
          </p>
        </div>

        <div className="tools">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clothes, sizes, categories..."
            aria-label="Search products"
          />

          <div className="filters" aria-label="Filter by category">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="catalogCount">
          {filtered.length}{' '}
          {filtered.length === 1 ? 'piece' : 'pieces'} to explore
        </div>

        <div className="productGrid">
          {filtered.map((p) => (
            <article
              className="product"
              key={p.id}
              onClick={() => {
                window.location.href = `/product/${p.id}`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  window.location.href = `/product/${p.id}`;
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`View details for ${p.name}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="productImage">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="noImage">
                    <span>TT</span>
                    <small>PHOTO COMING SOON</small>
                  </div>
                )}

                <span className="condition">{p.condition}</span>

                <button
                  className="add"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(p);
                  }}
                  aria-label={`Add ${p.name} to bag`}
                >
                  +
                </button>
              </div>

              <div className="productInfo">
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.category} · {p.size || 'One size'}
                  </p>
                </div>

                <strong>{formatPrice(p.price)}</strong>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="emptyCatalog">
            <span className="emptyMark">TT</span>

            <h3>
              {products.length === 0
                ? 'Our racks are waiting.'
                : 'No matching finds just yet.'}
            </h3>

            <p>
              {products.length === 0
                ? 'We are getting ready for our first collection. Check back when new pieces arrive.'
                : 'Try another keyword or choose a different category.'}
            </p>
          </div>
        )}
      </section>

      <section className="story" id="about">
        <div className="storyPhoto storyArtwork">
          <div className="storyGraphic">
            <span>THOUGHTFULLY CHOSEN</span>
            <strong>Good clothes deserve another story.</strong>
            <div className="storyGraphicLine" />
            <small>TALK THRIFT · HANDPICKED FINDS</small>
          </div>
        </div>

        <div className="storyText">
          <p className="eyebrow">A LITTLE ABOUT US</p>

          <h2>
            Good finds.
            <br />
            <em>Good stories.</em>
          </h2>

          <p>
            Talk Thrift is all about finding pieces worth keeping.
            Each item is handpicked for someone who loves personal
            style, unique finds, and shopping with a little more thought.
          </p>

          <p>
            No need to follow every trend. Find what feels like you,
            make it your own, and give a pre-loved piece a new chapter.
          </p>

          <a className="textLink" href="#shop">
            Find your next favorite <span>↗</span>
          </a>
        </div>
      </section>

      <section className="cartSection" id="cart">
        <div>
          <p className="eyebrow">SAVED FOR YOU</p>
          <h2>
            Your bag <em>({cart.length})</em>
          </h2>
        </div>

        {cart.length === 0 ? (
          <p className="empty">
            Nothing in your bag yet. Your next good find is waiting.
          </p>
        ) : (
          <>
            <div className="cartItems">
              {cart.map((p, i) => (
                <div className="cartItem" key={`${p.id}-${i}`}>
                  <span>{p.name}</span>
                  <strong>{formatPrice(p.price)}</strong>

                  <button
                    onClick={() =>
                      saveCart(
                        cart.filter((_, index) => index !== i)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="cartTotal">
              <span>Subtotal</span>
              <strong>
                {formatPrice(
                  cart.reduce(
                    (sum, p) => sum + Number(p.price),
                    0
                  )
                )}
              </strong>
            </div>

            <button className="primary" onClick={checkout}>
              Continue to order <span>↗</span>
            </button>

            <p className="mutedNote">
              You will be asked to sign in before placing an order.
            </p>
          </>
        )}

        {notice && (
          <p className="notice" role="status">
            {notice}

            <button
              className="dismissNotice"
              onClick={() => setNotice('')}
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </p>
        )}
      </section>

      <footer id="footer">
        <a className="brand footerBrand" href="#top">
          Talk <span>Thrift.</span>
        </a>

        <p>Handpicked finds, ready for a new home.</p>

        <small>
          © {new Date().getFullYear()} Talk Thrift. Made with care.
        </small>
      </footer>
    </main>
  );
}
