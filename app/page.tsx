
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
  description: string | null;
  status: string;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProducts() {
      const { data, error } = await supabase!
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter(Boolean)
        )
      ),
    ],
    [products]
  );

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      category === 'All' || product.category === category;

    const searchable =
      `${product.name} ${product.category} ${product.size ?? ''} ${product.condition}`.toLowerCase();

    return (
      matchesCategory &&
      searchable.includes(query.toLowerCase())
    );
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(price);

  function closeMenu() {
    setMenuOpen(false);
  }

  function selectCategory(item: string) {
    setCategory(item);
    closeMenu();

    document
      .getElementById('shop')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <main className="storeLayout" id="top">
      <button
        type="button"
        className="mobileMenuButton"
        onClick={() => setMenuOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="store-sidebar"
      >
        ☰ <span>MENU</span>
      </button>

      {menuOpen && (
        <button
          type="button"
          className="sidebarOverlay"
          onClick={closeMenu}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        id="store-sidebar"
        className={`sidebar ${menuOpen ? 'sidebarOpen' : ''}`}
      >
        <button
          type="button"
          className="sidebarClose"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          ✕
        </button>

        <Link
          href="/"
          className="brand sidebarBrand"
          onClick={closeMenu}
        >
          TALK<span>THRIFT</span>
        </Link>

        <p className="sidebarCaption">
          PRELOVED. RELOVED.
        </p>

        <nav className="sidebarNav">
          <a href="#shop" onClick={closeMenu}>
            Shop All
          </a>

          <p className="sidebarLabel">CATEGORIES</p>

          {categories
            .filter((item) => item !== 'All')
            .map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => selectCategory(item)}
              >
                {item}
              </button>
            ))}

          <a
            href="#shop"
            onClick={() => {
              setCategory('All');
              closeMenu();
            }}
          >
            All Categories
          </a>

          <p className="sidebarLabel">
            YOUR ACCOUNT
          </p>

          <Link href="/account" onClick={closeMenu}>
            Account / Sign In
          </Link>

          <Link href="/orders" onClick={closeMenu}>
            My Orders
          </Link>

          <p className="sidebarLabel">MORE</p>

          <a href="#footer" onClick={closeMenu}>
            Contact
          </a>

          <Link href="/admin" onClick={closeMenu}>
            Seller Dashboard
          </Link>
        </nav>

        <div className="sidebarBottom">
          <p>Good clothes deserve another life.</p>
          <span>© TALKTHRIFT</span>
        </div>
      </aside>

      <div className="storeMain">
        <div className="announcement">
          <div className="announcementTrack">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index}>
                HANDPICKED THRIFT FINDS ·
                ONE-OF-A-KIND PIECES ·
                MADE FOR YOU ·
                KILME RUDY ON FACEBOOK ·
                talkthrifwhsorudy on IG ·
              </span>
            ))}
          </div>
        </div>

        <header className="storeHeader">
          <span>CURATED PRELOVED FINDS</span>
          <a href="#shop">
            EXPLORE COLLECTION ↓
          </a>
        </header>

        <section className="hero storeHero">
          <div className="heroCopy">
            <p className="eyebrow">
              YOUR NEXT FAVORITE FIND
            </p>

            <h1>
              Your next find. Already loved.
            </h1>

            <p>
              Preloved pieces, handpicked with care.
              Find something that fits your style
              and give it another story.
            </p>

            <a href="#shop" className="viewPiece">
              SHOP ALL FINDS <span>↗</span>
            </a>
          </div>
        </section>

        <section className="shopSection" id="shop">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">
                THE COLLECTION
              </p>
              <h2>Find your next favorite.</h2>
            </div>

            <span>
              {filteredProducts.length} ITEMS
            </span>
          </div>

          <div className="tools">
            <input
              type="search"
              placeholder="Search clothes, size, category..."
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              aria-label="Search products"
            />

            <div className="filters">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    category === item ? 'active' : ''
                  }
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="emptyState">
              Loading handpicked finds...
            </p>
          ) : filteredProducts.length === 0 ? (
            <div className="emptyState">
              <h3>No items available yet.</h3>
              <p>
                Check back soon for new finds,
                or visit us again later.
              </p>
            </div>
          ) : (
            <div className="productGrid">
              {filteredProducts.map((product) => (
                <Link
                  href={`/product/${product.id}`}
                  className="product"
                  key={product.id}
                >
                  <div className="productImage">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                      />
                    ) : (
                      <div className="noImage">
                        TALKTHRIFT
                      </div>
                    )}
                  </div>

                  <div className="productInfo">
                    <div>
                      <p className="productCategory">
                        {product.category}
                      </p>

                      <h3>{product.name}</h3>

                      <p className="productMeta">
                        {product.size
                          ? `Size ${product.size}`
                          : 'Size not listed'}
                        {' · '}
                        {product.condition}
                      </p>
                    </div>

                    <strong>
                      {formatPrice(Number(product.price))}
                    </strong>
                  </div>

                  <span className="productView">
                    VIEW ITEM ↗
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer id="footer" className="storeFooter">
          <div>
            <Link href="/" className="brand">
              TALK<span>THRIFT</span>
            </Link>

            <p>Your next find. Already loved.</p>
          </div>

          <div className="socialText">
            <p>KILME RUDY ON FACEBOOK</p>
            <p>talkthrifwhsorudy on IG</p>
          </div>

          <p className="copyright">
            © {new Date().getFullYear()} TALKTHRIFT
          </p>
        </footer>
      </div>
    </main>
  );
}
