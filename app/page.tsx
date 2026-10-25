
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string;
  size: string | null;
  condition: string;
  price: number;
  image_url: string | null;
  status: string;
};

function MessageIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (!cancelled) {
        if (!error && data) {
          setProducts(data as Product[]);
        }
        setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          products.map((p) => p.category).filter(Boolean)
        )
      ),
    ],
    [products]
  );

  const filtered = products.filter((p) => {
    const matchesCategory =
      category === 'All' || p.category === category;

    const searchable =
      `${p.name} ${p.category} ${p.size ?? ''} ${p.condition}`.toLowerCase();

    return (
      matchesCategory &&
      searchable.includes(query.toLowerCase())
    );
  });

  const price = (value: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);

  function selectCategory(value: string) {
    setCategory(value);
    setMenuOpen(false);

    document
      .getElementById('shop')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  const marqueeText =
    'HANDPICKED THRIFT FINDS · ONE-OF-A-KIND PIECES · MADE FOR YOU · KILME RUDY ON FACEBOOK · talkthrifwhsorudy on IG · ';

  return (
    <main className="ttLayout">
      <header className="ttMobileHeader">
        <Link href="/" className="ttLogo">
          TALK<span>THRIFT</span>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Link
            href="/messages"
            aria-label="Open Messages"
            title="Messages"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <MessageIcon size={23} />
          </Link>

          <button
            type="button"
            className="ttMenuButton"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            ☰ <span>MENU</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="ttOverlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`ttSidebar ${
          menuOpen ? 'ttSidebarOpen' : ''
        }`}
      >
        <div className="ttSidebarTop">
          <Link
            href="/"
            className="ttLogo"
            onClick={() => setMenuOpen(false)}
          >
            TALK<span>THRIFT</span>
          </Link>

          <button
            type="button"
            className="ttClose"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <p className="ttTagline">PRELOVED. RELOVED.</p>

        <nav className="ttSidebarNav">
          <a
            href="#shop"
            onClick={() => selectCategory('All')}
          >
            Shop All
          </a>

          <p className="ttNavLabel">CATEGORIES</p>

          {categories
            .filter((item) => item !== 'All')
            .map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectCategory(item)}
              >
                {item}
              </button>
            ))}

          <button
            type="button"
            onClick={() => selectCategory('All')}
          >
            All Categories
          </button>

          <p className="ttNavLabel">YOUR ACCOUNT</p>

          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
          >
            Account / Sign In
          </Link>

          <Link
            href="/orders"
            onClick={() => setMenuOpen(false)}
          >
            My Orders
          </Link>

          <Link
            href="/messages"
            onClick={() => setMenuOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <MessageIcon size={19} />
            Messages
          </Link>

          <p className="ttNavLabel">MORE</p>

          <a
            href="#footer"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </a>

          <Link
            href="/admin"
            onClick={() => setMenuOpen(false)}
          >
            Seller Dashboard
          </Link>
        </nav>

        <div className="ttSidebarFooter">
          Good clothes deserve another life.
        </div>
      </aside>

      <div className="ttContent">
        <div className="ttMarquee">
          <div className="ttMarqueeTrack">
            <span>{marqueeText}</span>
            <span aria-hidden="true">
              {marqueeText}
            </span>
          </div>
        </div>

        <section className="ttHero">
          <p className="ttEyebrow">
            CURATED PRELOVED FINDS
          </p>

          <h1>
            Your next find.
            <br />
            <em>Already loved.</em>
          </h1>

          <p className="ttHeroDescription">
            Discover handpicked preloved pieces made
            for your personal style. Great finds,
            better stories.
          </p>

          <a href="#shop" className="ttPrimaryButton">
            EXPLORE COLLECTION ↗
          </a>

          <div style={{ marginTop: 24 }}>
            <Link
              href="/messages"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                color: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textDecoration: 'underline',
                textUnderlineOffset: 5,
              }}
            >
              <MessageIcon size={19} />
              YOUR MESSAGES ↗
            </Link>
          </div>
        </section>

        <section className="ttShop" id="shop">
          <div className="ttSectionHeading">
            <div>
              <p className="ttEyebrow">
                THE COLLECTION
              </p>

              <h2>Shop the latest finds.</h2>
            </div>

            <span>{filtered.length} ITEMS</span>
          </div>

          <input
            className="ttSearch"
            type="search"
            placeholder="Search for your next find..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />

          <div className="ttFilters">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={
                  category === item ? 'selected' : ''
                }
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="ttEmpty">
              Loading products...
            </p>
          ) : filtered.length === 0 ? (
            <div className="ttEmpty">
              <h3>No items found.</h3>
              <p>
                New handpicked finds are coming soon.
              </p>
            </div>
          ) : (
            <div className="ttProductGrid">
              {filtered.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="ttProduct"
                >
                  <div className="ttProductImage">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                      />
                    ) : (
                      <span>TALKTHRIFT</span>
                    )}
                  </div>

                  <div className="ttProductInfo">
                    <p className="ttProductCategory">
                      {product.category}
                    </p>

                    <h3>{product.name}</h3>

                    <p className="ttProductMeta">
                      {product.size
                        ? `Size ${product.size}`
                        : 'Size not listed'}
                      {' · '}
                      {product.condition}
                    </p>

                    <strong>
                      {price(Number(product.price))}
                    </strong>

                    <span className="ttViewProduct">
                      VIEW DETAILS ↗
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer
          className="ttFooter"
          id="footer"
        >
          <div>
            <h2>TALKTHRIFT</h2>
            <p>Your next find. Already loved.</p>
          </div>

          <div>
            <p>KILME RUDY ON FACEBOOK</p>
            <p>talkthrifwhsorudy on IG</p>
          </div>

          <small>
            © {new Date().getFullYear()} TalkThrift.
            All rights reserved.
          </small>
        </footer>
      </div>
    </main>
  );
}
