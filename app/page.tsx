'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Alert, ThemeToggle } from './components/StoreUI';

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
  const [isOwner, setIsOwner] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState('newest');
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    const mobile = window.matchMedia('(max-width: 900px)');
    if (mobile.matches) document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLButtonElement>('.ttClose')?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
      if (event.key !== 'Tab' || !mobile.matches) return;
      const nodes = sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function onResize() { if (!mobile.matches) setMenuOpen(false); }
    mobile.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      mobile.removeEventListener('change', onResize);
      if (mobile.matches) menuButton.current?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setLoading(true);
      setLoadError('');
      try {
        if (!supabase) throw new Error('Unavailable');
        const { data, error } = await supabase.from('products')
          .select('id,name,category,size,condition,price,image_url,status')
          .eq('status', 'available').order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setProducts((data ?? []) as Product[]);
      } catch {
        if (!cancelled) setLoadError('We couldn’t load the collection. Please try again.');
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
    const client = supabase;
    if (!client) return;
    let active = true;
    let revision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function updateRole() {
      const version = ++revision;
      setIsOwner(false);
      const { data: { user }, error } = await client!.auth.getUser();
      if (!active || version !== revision || error || !user) return;
      const { data } = await client!.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active && version === revision) setIsOwner(data?.role === 'owner');
    }
    void updateRole();
    const { data: { subscription } } = client.auth.onAuthStateChange(() => {
      revision++;
      setIsOwner(false);
      clearTimeout(timer);
      timer = setTimeout(() => { if (active) void updateRole(); }, 0);
    });
    return () => { active = false; clearTimeout(timer); subscription.unsubscribe(); };
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
      searchable.includes(query.trim().toLowerCase())
    );
  });

  if (sort === 'low') filtered.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'high') filtered.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

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
      ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  const marqueeText =
    'HANDPICKED THRIFT FINDS · ONE-OF-A-KIND PIECES · MADE FOR YOU · KILME RUDY ON FACEBOOK · talkthriftwhsorudy on IG · ';

  return (
    <main className="ttLayout">
      <a className="ttSkipLink" href="#shop">Skip to collection</a>
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

          <button
            type="button"
            className="ttMenuButton"
            ref={menuButton}
            aria-controls="store-navigation"
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
        id="store-navigation"
        ref={sidebar}
        aria-label="Store navigation"
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

          <p className="ttNavLabel">DISPLAY</p>
          <ThemeToggle />

          <p className="ttNavLabel">MORE</p>

          <a
            href="#footer"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </a>

          {isOwner && <Link href="/admin" onClick={() => setMenuOpen(false)}>Seller Dashboard</Link>}
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

        <section className="ttHero ttHeroNew">
          <div className="ttHeroCopy">
            <p className="ttEyebrow">PAGADIAN CITY · PRELOVED FINDS</p>
            <h1>Wear what<br /><em>you love.</em></h1>
            <p className="ttHeroDescription">Good finds, good prices, and pieces with a story. Find your next favourite in our handpicked collection.</p>
            <a href="#shop" className="ttPrimaryButton">SHOP THE COLLECTION <span aria-hidden="true">↗</span></a>
            <div className="ttHeroBottom"><span>01 / THE COLLECTION</span><span>PRELOVED. RELOVED.</span></div>
          </div>
          <div className="ttHeroVisual">
            <div className="ttHeroVisualTop"><span>THE GOOD FINDS EDIT</span><span>TT / 01</span></div>
            {products.find((item) => item.image_url) ? (() => {
              const featured = products.find((item) => item.image_url)!;
              return <Link className="ttFeaturePhoto" href={`/product/${featured.id}`} aria-label={`View ${featured.name}`}>
                <img src={featured.image_url!} alt={featured.name} />
                <span className="ttFeatureLabel"><span>SPOTTED IN THE SHOP</span><strong>{featured.name}</strong><span>{price(Number(featured.price))} ↗</span></span>
              </Link>;
            })() : <div className="ttFeaturePlaceholder"><span>GOOD THINGS<br /><em>LIVE ON.</em></span><small>THE NEXT CHAPTER STARTS HERE ↗</small></div>}
            <div className="ttHeroVisualBottom"><span>HANDPICKED FOR YOU</span><span>SCROLL TO EXPLORE ↓</span></div>
            <span className="ttHeroStamp" aria-hidden="true">PRELOVED<br />& LOVED ♡</span>
          </div>
        </section>
        <div className="ttTrust"><span>↗ Handpicked pieces</span><span>♡ Preloved, with personality</span><span>⌂ Based in Pagadian City</span></div>

        <section className="ttShop" id="shop">
          <div className="ttSectionHeading">
            <div>
              <p className="ttEyebrow">
                THE COLLECTION
              </p>

              <h2>Shop the latest finds.</h2>
            </div>

            <span role="status" aria-live="polite">{loading ? 'Loading collection…' : loadError ? 'Collection unavailable' : `${filtered.length} ${filtered.length === 1 ? 'ITEM' : 'ITEMS'}`}</span>
          </div>

          <div className="ttCatalogTools">
          <input
            aria-label="Search products by name, category, size, or condition"
            className="ttSearch"
            type="search"
            placeholder="Search for your next find..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />

          <label className="ttSort">Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name: A–Z</option>
            </select>
          </label></div>
          <div className="ttFilters" role="group" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={category === item}
                className={
                  category === item ? 'selected' : ''
                }
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <Alert notice={loadError ? { type: 'error', text: loadError } : null} />
          {loading ? (
            <div className="ttProductGrid" aria-label="Loading products" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((item) => <div className="ttSkeleton" key={item} aria-hidden="true"><div /><p /><p /></div>)}
            </div>
          ) : loadError ? (
            <div className="ttEmpty" role="alert"><h3>Let’s try that again.</h3><p>Check your connection, then retry the collection.</p><button className="ttPrimaryButton" onClick={() => setRetry((value) => value + 1)}>Retry collection</button></div>
          ) : filtered.length === 0 ? (
            <div className="ttEmpty">
              <h3>{query.trim() || category !== 'All' ? 'No matches just yet.' : 'The next good find is on its way.'}</h3>
              <p>{query.trim() || category !== 'All' ? 'Try another search or browse all available pieces.' : 'Check back soon for new handpicked pieces.'}</p>
              {(query || category !== 'All') && <button className="ttPrimaryButton" onClick={() => { setQuery(''); setCategory('All'); }}>Clear filters</button>}
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
            <p><a href="https://www.facebook.com/kilme.rudy" target="_blank" rel="noopener noreferrer">Facebook · KILME RUDY ↗</a></p>
            <p><a href="https://www.instagram.com/talkthriftwhsorudy/" target="_blank" rel="noopener noreferrer">Instagram · @talkthriftwhsorudy ↗</a></p>
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
