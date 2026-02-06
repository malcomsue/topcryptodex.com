import { ReactNode } from 'react';
import Footer from './Footer';
import Header from './Header';
import ChatWidget from './ChatWidget';

export default function AppLayout({
  children,
  showFooter = true,
}: {
  children: ReactNode;
  showFooter?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">{children}</main>
      {showFooter ? <Footer /> : null}
      <ChatWidget />
    </div>
  );
}
