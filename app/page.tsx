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

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setError('');

      try {
        if (!supabase) {
          throw new Error('Store connection unavailable.');
        }

        const { data, error: requestError } = await supabase
          .from('products')
          .select(
            'id,name,category,size,condition,price,image_url,status'
          )
          .eq('status', 'available')
          .order('created_at', { ascending: false });

        if (requestError) throw requestError;

        if (!cancelled) {
          setProducts((data ?? []) as Product[]);
        }
      } catch {
        if (!cancelled) {
          setError(
            'We couldn’t load the collection. Please try again.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [retry]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const media = window.matchMedia('(max-width: 900px)');
    const sidebar = document.getElementById('store-navigation');

    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) ?? []
      ).filter((element) => element.getClientRects().length > 0);

    if (media.matches) {
      document.body.style.overflow = 'hidden';
      focusable()[0]?.focus();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }

      if (event.key !== 'Tab' || !media.matches) return;

      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleResize() {
      if (!media.matches) setMenuOpen(false);
    }

    document.addEventListener('keydown', handleKey);
    media.addEventListener('change', handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      media.removeEventListener('change', handleResize);

      if (media.matches) {
        document.getElementById('store-menu-button')?.focus();
      }
    };
  }, [menuOpen]);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(products.map((product) => product.category).filter(Boolean))
      ),
    ],
    [products]
  );

  const filtered = products.filter((product) => {
    const text =
      `${product.name} ${product.category} ` +
      `${product.size ?? ''} ${product.condition}`;

    return (
      (category === 'All' || product.category === category) &&
      text.toLowerCase().includes(query.trim().toLowerCase())
    );
  });

  if (sort === 'low') {
    filtered.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sort === 'high') {
    filtered.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sort === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  function selectCategory(value: string) {
    setCategory(value);
    setMenuOpen(false);
  }

  function clearFilters() {
    setQuery('');
    setCategory('All');
  }

  const announcement =
    'HANDPICKED THRIFT FINDS · ONE-OF-A-KIND PIECES · ' +
    'PRELOVED. RELOVED. · BASED IN PAGADIAN CITY · ';

  return (
    <main className="ttLayout">
      <a href="#shop" className="ttSkipLink">
        Skip to collection
      </a>

      <header className="ttMobileHeader">
        <Link href="/" className="ttLogo">
          TALK<span>THRIFT</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/messages" aria-label="Open messages">
            Messages
          </Link>

          <button
            id="store-menu-button"
            type="button"
            className="ttMenuButton"
            aria-controls="store-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰ MENU
          </button>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="ttOverlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="store-navigation"
        className={`ttSidebar ${menuOpen ? 'ttSidebarOpen' : ''}`}
        aria-label="Store navigation"
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
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <p className="ttTagline">PRELOVED. RELOVED.</p>

        <nav className="ttSidebarNav" aria-label="Shop">
          <a href="#shop" onClick={() => selectCategory('All')}>
            Shop All ↗
          </a>

          <p className="ttNavLabel">CATEGORIES</p>

          {categories
            .filter((item) => item !== 'All')
            .map((item) => (
              <a
                href="#shop"
                key={item}
                aria-current={category === item ? 'true' : undefined}
                onClick={() => selectCategory(item)}
              >
                {item}
              </a>
            ))}

          <p className="ttNavLabel">YOUR ACCOUNT</p>

          <Link href="/account" onClick={() => setMenuOpen(false)}>
            Account / Sign In
          </Link>

          <Link href="/orders" onClick={() => setMenuOpen(false)}>
            My Orders
          </Link>

          <Link href="/messages" onClick={() => setMenuOpen(false)}>
            Messages
          </Link>

          <p className="ttNavLabel">MORE</p>

          <a href="#footer" onClick={() => setMenuOpen(false)}>
            Contact
          </a>

          <Link href="/admin" onClick={() => setMenuOpen(false)}>
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
            <span>{announcement}</span>
            <span aria-hidden="true">{announcement}</span>
          </div>
        </div>

        <section className="ttHero">
          <div className="ttHeroCopy">
            <p className="ttEyebrow">CURATED PRELOVED FINDS</p>

            <h1>
              Your next find.
              <br />
              <em>Already loved.</em>
            </h1>

            <p className="ttHeroDescription">
              Discover handpicked preloved pieces made for your personal
              style. Great finds, better stories.
            </p>

            <a href="#shop" className="ttPrimaryButton">
              EXPLORE COLLECTION ↗
            </a>

            <p className="ttHeroDescription" style={{ fontSize: 12 }}>
              A little character. A fresh beginning. A style that’s yours.
            </p>
          </div>

          <div className="ttHeroArt" aria-hidden="true">
            <span className="ttArtCaption">
              THE ART OF A GOOD FIND
            </span>

            <div className="ttArtCard">
              <span>TT / PRELOVED COLLECTION</span>
              <strong>
                Good style.
                <br />
                <em>Second story.</em>
              </strong>
              <span>CURATED WITH CARE ↗</span>
            </div>

            <span className="ttArtFoot">
              PRELOVED. RELOVED. REPEAT.
            </span>
          </div>
        </section>

        <div className="ttTrust">
          <span>↗ Handpicked pieces</span>
          <span>♡ Preloved, with personality</span>
          <span>⌂ Based in Pagadian City</span>
        </div>

        <section className="ttShop" id="shop">
          <div className="ttSectionHeading">
            <div>
              <p className="ttEyebrow">THE COLLECTION</p>
              <h2>Shop the latest finds.</h2>
            </div>

            <span role="status" aria-live="polite">
              {loading
                ? 'Loading collection…'
                : error
                  ? 'Collection unavailable'
                  : `${filtered.length} ${
                      filtered.length === 1 ? 'ITEM' : 'ITEMS'
                    }`}
            </span>
          </div>

          <div className="ttCatalogTools">
            <input
              className="ttSearch"
              type="search"
              aria-label="Search by product name, category, size or condition"
              placeholder="Search for your next find..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <label className="ttSort">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>

          <div
            className="ttFilters"
            role="group"
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? 'selected' : ''}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div
              className="ttProductGrid"
              aria-label="Loading products"
              aria-busy="true"
            >
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div className="ttSkeleton" key={item} aria-hidden="true">
                  <div />
                  <p />
                  <p />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="ttEmpty" role="alert">
              <h3>Let’s try that again.</h3>
              <p>{error}</p>
              <button
                type="button"
                className="ttPrimaryButton"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry collection
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ttEmpty">
              <h3>
                {query.trim() || category !== 'All'
                  ? 'No matches just yet.'
                  : 'The next good find is on its way.'}
              </h3>

              <p>
                {query.trim() || category !== 'All'
                  ? 'Try another search or browse all available pieces.'
                  : 'Check back soon for new handpicked pieces.'}
              </p>

              {(query || category !== 'All') && (
                <button
                  type="button"
                  className="ttPrimaryButton"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
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
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
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
                      {money.format(Number(product.price))}
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

        <footer className="ttFooter" id="footer">
          <div>
            <h2>TALKTHRIFT</h2>
            <p>Your next find. Already loved.</p>
          </div>

          <div>
            <p>
              <a
                href="https://www.facebook.com/kilme.rudy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook · KILME RUDY ↗
              </a>
            </p>

            <p>
              <a
                href="https://www.instagram.com/talkthriftwhsorudy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram · @talkthriftwhsorudy ↗
              </a>
            </p>
          </div>

          <small>
            © {new Date().getFullYear()} TalkThrift. All rights reserved.
          </small>
        </footer>
      </div>
    </main>
  );
}
