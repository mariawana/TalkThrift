
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
        setLoading(false);
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

        <button
          type="button"
          className="ttMenuButton"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          ☰ <span>MENU</span>
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="ttOverlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside className={`ttSidebar ${menuOpen ? 'ttSidebarOpen' : ''}`}>
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
          <a href="#shop" onClick={() => selectCategory('All')}>
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
          <Link href="/account">Account / Sign In</Link>
          <Link href="/orders">My Orders</Link>

          <p className="ttNavLabel">MORE</p>
          <a
            href="#footer"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </a>
          <Link href="/admin">Seller Dashboard</Link>
        </nav>

        <div className="ttSidebarFooter">
          Good clothes deserve another life.
        </div>
      </aside>

      <div className="ttContent">
        <div className="ttMarquee">
          <div className="ttMarqueeTrack">
            <span>{marqueeText}</span>
            <span aria-hidden="true">{marqueeText}</span>
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
            Discover handpicked preloved pieces made for your
            personal style. Great finds, better stories.
          </p>

          <a href="#shop" className="ttPrimaryButton">
            EXPLORE COLLECTION ↗
          </a>
        </section>

        <section className="ttShop" id="shop">
          <div className="ttSectionHeading">
            <div>
              <p className="ttEyebrow">THE COLLECTION</p>
              <h2>Shop the latest finds.</h2>
            </div>
            <span>{filtered.length} ITEMS</span>
          </div>

          <input
            className="ttSearch"
            type="search"
            placeholder="Search for your next find..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="ttFilters">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? 'selected' : ''}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="ttEmpty">Loading products...</p>
          ) : filtered.length === 0 ? (
            <div className="ttEmpty">
              <h3>No items found.</h3>
              <p>New handpicked finds are coming soon.</p>
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
                    <strong>{price(Number(product.price))}</strong>
                    <span className="ttViewProduct">
                      VIEW DETAILS ↗
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="ttFooter" id="footer">
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
