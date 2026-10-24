'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Product = {
  id: string;
  name: string;
  category: string;
  size: string | null;
  condition: string;
  price: number;
  image_url: string | null;
  image_urls?: string[] | null;
  description: string | null;
  status: string;
};

export default function ProductDetails() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function loadProduct() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (!error && data) {
        setProduct(data as Product);
      }

      setLoading(false);
    }

    if (params.id) loadProduct();
  }, [params.id]);

  const photos = product
    ? Array.from(
        new Set(
          [
            ...(product.image_urls ?? []),
            product.image_url,
          ].filter((url): url is string => Boolean(url))
        )
      )
    : [];

  const price = (amount: number) =>
    `₱${Number(amount).toLocaleString('en-PH')}`;

  function addToCart(goToCart = false) {
    if (!product) return;

    try {
      const saved = localStorage.getItem('rewear-cart');
      const cart = saved ? JSON.parse(saved) : [];

      if (!Array.isArray(cart)) {
        setNotice('Unable to read your saved bag. Please try again.');
        return;
      }

      if (!cart.some((item: Product) => item.id === product.id)) {
        localStorage.setItem(
          'rewear-cart',
          JSON.stringify([...cart, product])
        );
      }

      if (goToCart) {
        window.location.href = '/#cart';
      } else {
        setNotice('This piece is saved in your bag.');
      }
    } catch {
      setNotice('Unable to save your bag on this device.');
    }
  }

  async function messageSeller() {
    if (!product) return;

    if (!supabase) {
      setNotice('Please try again later.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href =
        `/account?next=${encodeURIComponent(`/product/${product.id}`)}`;
      return;
    }

    setNotice(
      'Please contact the seller through the available contact details while TalkThrift messaging is being set up.'
    );
  }

  async function shareProduct() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Product link copied. Share it with a friend!');
    } catch {
      setNotice('Copy the product link from your browser address bar.');
    }
  }

  if (loading) {
    return <main className="productDetails"><p>Loading this find...</p></main>;
  }

  if (!product) {
    return (
      <main className="productDetails">
        <h1>We couldn't find this piece.</h1>
        <a href="/">Back to TalkThrift</a>
      </main>
    );
  }

  return (
    <main className="productDetails">
      <a href="/" className="backLink">← Back to TalkThrift</a>

      <div className="detailsGrid">
        <section className="detailsPhotos">
          <div className="mainPhoto">
            {photos.length > 0 ? (
              <img src={photos[photoIndex]} alt={product.name} />
            ) : (
              <div className="noImage">
                <span>TT</span>
                <small>PHOTO COMING SOON</small>
              </div>
            )}
          </div>

          {photos.length > 1 && (
            <div className="photoThumbnails">
              {photos.map((photo, index) => (
                <button
                  key={photo}
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`View photo ${index + 1}`}
                  aria-pressed={photoIndex === index}
                >
                  <img src={photo} alt={`${product.name} ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detailsInfo">
          <p className="eyebrow">THE TALK THRIFT FIND</p>
          <p className="detailCategory">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="detailPrice">{price(product.price)}</p>

          <p>
            <strong>Condition:</strong> {product.condition}
          </p>
          <p>
            <strong>Size:</strong> {product.size || 'One size'}
          </p>
          <p>
            <strong>Availability:</strong>{' '}
            {product.status === 'available' ? 'Available' : 'Unavailable'}
          </p>

          <div className="detailDescription">
            <h2>About this piece</h2>
            <p>{product.description || 'No description has been added yet.'}</p>
          </div>

          {product.status === 'available' ? (
            <div className="detailActions">
              <button className="primary" onClick={() => addToCart(true)}>
                Buy Now ↗
              </button>
              <button
                className="secondaryAction"
                onClick={() => addToCart(false)}
              >
                Add to Bag
              </button>
              <button className="secondaryAction" onClick={messageSeller}>
                Message Seller
              </button>
            </div>
          ) : (
            <p>This item is no longer available.</p>
          )}

          <button className="shareAction" onClick={shareProduct}>
            ↗ Share this find
          </button>

          <div className="shippingNote">
            <h2>Delivery information</h2>
            <p>Luzon — ₱89</p>
            <p>Visayas — ₱89</p>
            <p>Mindanao — ₱69</p>
            <p>Meetup in Pagadian City — Free</p>
            <p>Local Pagadian delivery — Starts at ₱30</p>
            <small>
              Confirm your delivery fee and payment arrangement with the seller
              before completing your transaction.
            </small>
          </div>

          {notice && (
            <p role="status" className="notice">{notice}</p>
          )}
        </section>
      </div>
    </main>
  );
      }
              
