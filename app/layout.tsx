import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'TalkThrift | Pre-loved, re-loved', description: 'Thoughtfully thrifted finds, ready for a new home.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
