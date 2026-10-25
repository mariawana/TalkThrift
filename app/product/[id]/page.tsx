
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SELLER_FACEBOOK = 'https://www.facebook.com/kilme.rudy';
const SELLER_INSTAGRAM = 'https://www.instagram.com/talkthriftwhsorudy/';

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
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showOffer, setShowOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data) {
          setProduct(data as Product);
        } else {
          setProduct(null);
        }

        setLoading(false);
      }
    }

    if (params.id) {
      loadProduct();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
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
    `₱${Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  async function buyNow() {
    if (!product || !supabase) {
      setNotice('Unable to proceed. Please try again.');
      return;
    }

    if (product.status !== 'available') {
      setNotice('This item is no longer available.');
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
      router.push(
        `/account?next=${encodeURIComponent(
          `/product/${product.id}`
        )}`
      );
      return;
    }

    // Keeps compatibility with the existing checkout page.
    // The customer buys only this selected product.
    localStorage.setItem(
      'rewear-cart',
      JSON.stringify([product])
    );

    router.push('/checkout');
  }

  function messageSeller() {
    if (!product) return;

    window.open(
      SELLER_FACEBOOK,
      '_blank',
      'noopener,noreferrer'
    );

    setNotice(
      `Message KILME RUDY on Facebook about "${product.name}".`
    );
  }

  function makeOffer() {
    setShowOffer(true);
    setNotice('');
  }

  async function sendOffer() {
    if (!product) return;

    const amount = Number(offerAmount);

    if (!offerAmount.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0) {
      setNotice('Please enter a valid offer amount.');
      return;
    }

    if (amount >= Number(product.price)) {
      setNotice(
        'Your offer must be lower than the listed price. Use Buy Now for the full price.'
      );
      return;
    }

    const message =
      `Hello! I would like to make an offer for this TalkThrift item.\n\n` +
      `Product: ${product.name}\n` +
      `Listed price: ${price(product.price)}\n` +
      `My offer: ${price(amount)}\n` +
      `Product link: ${window.location.href}\n\n` +
      `Please let me know if my offer is acceptable. Thank you!`;

    try {
      await navigator.clipboard.writeText(message);

      window.open(
        SELLER_FACEBOOK,
        '_blank',
        'noopener,noreferrer'
      );

      setNotice(
        'Offer message copied! Open Message on the seller Facebook profile, then paste and send your offer.'
      );
    } catch {
      window.open(
        SELLER_FACEBOOK,
        '_blank',
        'noopener,noreferrer'
      );

      setNotice(
        `Please message KILME RUDY about your ${price(amount)} offer for ${product.name}.`
      );
    }

    setShowOffer(false);
  }

  async function shareProduct() {
    try {
      await navigator.clipboard.writeText(
        window.location.href
      );

      setNotice(
        'Product link copied! You can now share it.'
      );
    } catch {
      setNotice(
        'Please copy the product link from your browser.'
      );
    }
  }

  if (loading) {
    return (
      <main className="productDetails">
        <p>Loading this find...</p>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="productDetails">
        <h1>We couldn't find this piece.</h1>
        <a href="/">← Back to TalkThrift</a>
      </main>
    );
  }

  return (
    <main className="productDetails">
      <a href="/" className="backLink">
        ← Back to TalkThrift
      </a>

      <div className="detailsGrid">
        <section className="detailsPhotos">
          <div className="mainPhoto">
            {photos.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  photos[
                    Math.min(
                      photoIndex,
                      photos.length - 1
                    )
                  ]
                }
                alt={product.name}
              />
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
                  type="button"
                  key={photo}
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`View photo ${index + 1}`}
                  aria-pressed={photoIndex === index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`${product.name} photo ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detailsInfo">
          <p className="eyebrow">
            THE TALKTHRIFT FIND
          </p>

          <p className="detailCategory">
            {product.category}
          </p>

          <h1>{product.name}</h1>

          <p className="detailPrice">
            {price(product.price)}
          </p>

          <p>
            <strong>Condition:</strong>{' '}
            {product.condition}
          </p>

          <p>
            <strong>Size:</strong>{' '}
            {product.size || 'One size'}
          </p>

          <p>
            <strong>Availability:</strong>{' '}
            {product.status === 'available'
              ? 'Available'
              : 'Unavailable'}
          </p>

          <div className="detailDescription">
            <h2>About this piece</h2>
            <p>
              {product.description ||
                'No description has been added yet.'}
            </p>
          </div>

          {product.status === 'available' ? (
            <div className="detailActions">
              <button
                type="button"
                className="primary"
                onClick={buyNow}
              >
                Buy Now ↗
              </button>

              <button
                type="button"
                className="secondaryAction"
                onClick={messageSeller}
              >
                Message Seller
              </button>

              <button
                type="button"
                className="secondaryAction"
                onClick={makeOffer}
              >
                Make an Offer
              </button>
            </div>
          ) : (
            <p>
              This item is no longer available.
            </p>
          )}

          {showOffer &&
            product.status === 'available' && (
              <div className="offerPanel">
                <h2>Make an Offer</h2>

                <p>
                  Listed price: {price(product.price)}
                </p>

                <label htmlFor="offerAmount">
                  Your offer (PHP)
                </label>

                <input
                  id="offerAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  max={product.price}
                  value={offerAmount}
                  placeholder="Enter your offer"
                  onChange={(event) =>
                    setOfferAmount(event.target.value)
                  }
                />

                <div className="offerButtons">
                  <button
                    type="button"
                    className="primary"
                    onClick={sendOffer}
                  >
                    Copy Offer & Open Facebook
                  </button>

                  <button
                    type="button"
                    className="secondaryAction"
                    onClick={() => {
                      setShowOffer(false);
                      setNotice('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          <button
            type="button"
            className="shareAction"
            onClick={shareProduct}
          >
            ↗ Share this find
          </button>

          <div className="shippingNote">
            <h2>Delivery information</h2>

            <p>Luzon — ₱89</p>
            <p>Visayas — ₱89</p>
            <p>Mindanao — ₱69</p>
            <p>Meetup in Pagadian City — Free</p>
            <p>
              Local Pagadian delivery — Starts at ₱30
            </p>

            <small>
              Confirm your delivery fee and payment
              arrangement with the seller before
              completing your transaction.
            </small>
          </div>

          <div className="shippingNote">
            <h2>Connect with the seller</h2>

            <p>
              <a
                href={SELLER_FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook — KILME RUDY ↗
              </a>
            </p>

            <p>
              <a
                href={SELLER_INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram — @talkthriftwhsorudy ↗
              </a>
            </p>
          </div>

          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
