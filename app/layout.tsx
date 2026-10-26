import type { Metadata } from 'next';
import { SiteTools } from './components/StoreUI';
import './globals.css';
export const metadata: Metadata = {
  title: 'TalkThrift | Preloved, Reloved',
  description: 'Handpicked preloved finds. Shop, make an offer, and chat with TalkThrift in Pagadian City.',
};
const themeScript = `(function(){try{var t=localStorage.getItem('talkthrift-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><SiteTools />{children}</body></html>;
}
