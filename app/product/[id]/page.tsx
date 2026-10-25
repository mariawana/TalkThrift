
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SELLER_FACEBOOK = 'https://www.facebook.com/kilme.rudy';
const SELLER_INSTAGRAM =
  'https://www.instagram.com/talkthriftwhsorudy/';

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
  const [sendingOffer, setSendingOffer] = useState(false);

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
        setProduct(!error && data ? (data as Product) : null);
        setLoading(false);
      }
    }

    if (params.id) {
      void loadProduct();
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
    if (!product || !supabase || sendingOffer) return;

    setNotice('');

    if (product.status !== 'available') {
      setNotice('This item is no longer available.');
      return;
    }

    const amount = Number(offerAmount);

    if (
      !offerAmount.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(amount * 100)
    ) {
      setNotice(
        'Please enter a valid offer amount with up to two decimal places.'
      );
      return;
    }

    if (amount >= Number(product.price)) {
      setNotice(
        'Your offer must be lower than the listed price. Use Buy Now for the full price.'
      );
      return;
    }

    setSendingOffer(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setNotice(
          'Unable to verify your account. Please try again.'
        );
        return;
      }

      if (!user) {
        setNotice(
          'Please log in or create an account before submitting an offer.'
        );

        router.push(
          `/account?next=${encodeURIComponent(
            `/product/${product.id}`
          )}`
        );
        return;
      }

      const { data: latestProduct, error: productError } =
        await supabase
          .from('products')
          .select('id, price, status')
          .eq('id', product.id)
          .maybeSingle();

      if (productError || !latestProduct) {
        setNotice(
          'Unable to verify this product. Please try again.'
        );
        return;
      }

      if (latestProduct.status !== 'available') {
        setNotice(
          'Sorry, this product is no longer available.'
        );
        return;
      }

      if (amount >= Number(latestProduct.price)) {
        setNotice(
          'The product price has changed. Please enter an offer below the current price.'
        );
        setProduct((current) =>
          current
            ? {
                ...current,
                price: Number(latestProduct.price),
                status: latestProduct.status,
              }
            : current
        );
        return;
      }

      const { data: existingOffers, error: checkError } =
        await supabase
          .from('offers')
          .select('id')
          .eq('product_id', product.id)
          .eq('customer_id', user.id)
          .eq('status', 'pending')
          .limit(1);

      if (checkError) {
        setNotice(
          `Unable to check existing offers: ${checkError.message}`
        );
        return;
      }

      if (existingOffers && existingOffers.length > 0) {
        setNotice(
          'You already have a pending offer for this product. Please wait for the seller to respond.'
        );
        return;
      }

      const { error: insertError } = await supabase
        .from('offers')
        .insert({
          product_id: product.id,
          customer_id: user.id,
          offer_amount: amount,
          status: 'pending',
        });

      if (insertError) {
        setNotice(
          `Unable to submit your offer: ${insertError.message}`
        );
        return;
      }

      setShowOffer(false);
      setOfferAmount('');
      setNotice(
        'Your offer was submitted successfully! The seller can now review it in the Seller Dashboard.'
      );
    } catch {
      setNotice(
        'Something went wrong while submitting your offer. Please try again.'
      );
    } finally {
      setSendingOffer(false);
    }
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
        <h1>We couldn&apos;t find this piece.</h1>
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
              : product.status === 'reserved'
                ? 'Reserved'
                : product.status === 'sold'
                  ? 'Sold'
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
                  min="0.01"
                  step="0.01"
                  max={product.price}
                  value={offerAmount}
                  placeholder="Enter your offer"
                  disabled={sendingOffer}
                  onChange={(event) =>
                    setOfferAmount(event.target.value)
                  }
                />

                <div className="offerButtons">
                  <button
                    type="button"
                    className="primary"
                    onClick={sendOffer}
                    disabled={sendingOffer}
                  >
                    {sendingOffer
                      ? 'Submitting...'
                      : 'Submit Offer'}
                  </button>

                  <button
                    type="button"
                    className="secondaryAction"
                    disabled={sendingOffer}
                    onClick={() => {
                      setShowOffer(false);
                      setOfferAmount('');
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
