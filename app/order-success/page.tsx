import Link from 'next/link';
export default function OrderSuccess() {
  return <main className="adminWrap"><section className="adminPanel successPanel"><p className="eyebrow">ORDER REQUEST RECEIVED</p><h1>Thanks for shopping TalkThrift.</h1><p>Your order is pending. For shipping, payment is required before dispatch. Contact the seller for payment details and arrange proof of payment; your order is not automatically marked paid.</p><p>For local delivery, the seller confirms the final fee. Check My Orders for your order details and status.</p><Link className="primary" href="/orders">View My Orders ↗</Link><Link className="secondary" href="/messages">Open Messages ↗</Link><Link href="/">← Back to Store</Link></section></main>;
}
