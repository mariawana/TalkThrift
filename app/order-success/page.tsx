import Link from 'next/link';
export default function OrderSuccess() {
  return <main className="adminWrap"><section className="adminPanel successPanel"><p className="eyebrow">ORDER REQUEST RECEIVED</p><h1>Thanks for shopping TalkThrift.</h1><p>Your order is pending. The seller will confirm shipping and payment arrangements. You can track it or cancel before dispatch in My Orders.</p><Link className="primary" href="/orders">View My Orders ↗</Link><Link className="secondary" href="/messages">Open Messages ↗</Link><Link href="/">← Back to Store</Link></section></main>;
}
