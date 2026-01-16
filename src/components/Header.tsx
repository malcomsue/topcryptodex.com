'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpToLine,
  Bell,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  Menu,
  PieChart,
  RefreshCcw,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

type OpenMenu = null | 'spot' | 'futures' | 'finance' | 'assets';

function NavItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-gray-800 hover:text-gray-900 transition"
    >
      {children}
    </Link>
  );
}

function Dropdown({
  label,
  open,
  onToggle,
  menuClassName,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  menuClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-sm text-gray-800 hover:text-gray-900 transition"
        aria-expanded={open}
      >
        {label}
        <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute left-0 mt-3 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden z-50 ${
            menuClassName ?? 'w-56'
          }`}
        >
          <div className="p-2">{children}</div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl px-3 py-2 hover:bg-gray-50 transition"
    >
      <div className="text-sm font-medium text-gray-900">{title}</div>
      {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
    </Link>
  );
}

function AssetItem({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: typeof ArrowDownToLine;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
    >
      <Icon size={16} className="text-gray-500" />
      <span className="font-medium">{title}</span>
    </Link>
  );
}

export default function Header() {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const displayUser = () => {
    const anyUser = user as any;
    return (
      anyUser?.email?.address ??
      anyUser?.email ??
      anyUser?.phone?.number ??
      anyUser?.phone ??
      (anyUser?.wallet?.address
        ? `${String(anyUser.wallet.address).slice(0, 6)}…${String(anyUser.wallet.address).slice(-4)}`
        : null)
    );
  };

  const handleAuthClick = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!headerRef.current) return;
      if (!headerRef.current.contains(target)) setOpenMenu(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <header
        ref={(node) => {
          headerRef.current = node;
        }}
        className="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-gray-200"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                TOPCRYPTODEX
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-7">
              
              <NavItem href="/market">Markets</NavItem>

              <Dropdown
                label="Spot"
                open={openMenu === 'spot'}
                onToggle={() => setOpenMenu(openMenu === 'spot' ? null : 'spot')}
              >
                <DropdownItem href="/trade" title="Spot Trade" description="Buy and sell crypto instantly" />
                <DropdownItem href="/market" title="Market Board" description="Browse prices and pairs" />
              </Dropdown>

              <Dropdown
                label="Futures"
                open={openMenu === 'futures'}
                onToggle={() => setOpenMenu(openMenu === 'futures' ? null : 'futures')}
              >
                <div className="rounded-xl px-3 py-2 text-sm text-gray-500">
                  Futures coming soon
                </div>
              </Dropdown>

              <Dropdown
                label="Finance"
                open={openMenu === 'finance'}
                onToggle={() => setOpenMenu(openMenu === 'finance' ? null : 'finance')}
              >
                <DropdownItem href="/#finance" title="Finance" description="Earn and manage funds" />
                <DropdownItem href="/#learn" title="Learn" description="Guides and education" />
              </Dropdown>

              <NavItem href="/#faq">ICO</NavItem>
              
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              <Dropdown
                label="Assets"
                open={openMenu === 'assets'}
                onToggle={() => setOpenMenu(openMenu === 'assets' ? null : 'assets')}
                menuClassName="w-72"
              >
                <div className="space-y-1">
                  <AssetItem href="/deposit" title="Deposit" icon={ArrowDownToLine} />
                  <AssetItem href="/withdraw" title="Withdraw" icon={ArrowUpToLine} />
                  <AssetItem href="/trade" title="Spot account" icon={Wallet} />
                  <AssetItem href="/#" title="Convert" icon={RefreshCcw} />
                  <AssetItem href="/transfer" title="Transfer" icon={ArrowLeftRight} />
                </div>
                <div className="my-2 h-px bg-gray-100" />
                <div className="space-y-1">
                  <AssetItem href="/#" title="Overview" icon={PieChart} />
                  <AssetItem href="/#" title="Funding Records" icon={Wallet} />
                  <AssetItem href="/history" title="History" icon={Clock} />
                  <AssetItem href="/#" title="Financial Records" icon={FileText} />
                </div>
              </Dropdown>

              <Link
                href="/deposit"
                className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:opacity-90 transition"
              >
                Deposit
              </Link>

              <div className="h-6 w-px bg-gray-200" />
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 transition text-gray-700"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 transition text-gray-700"
                aria-label="Language"
              >
                <Globe size={18} />
              </button>

              {user ? (
                <>
                  <div className="flex items-center gap-2">
                    <UserCircle2 size={22} className="text-gray-600" />
                    <span className="text-sm text-gray-700 max-w-44 truncate">{displayUser()}</span>
                  </div>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition text-sm"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleAuthClick('signin')}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition text-sm"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Register
                  </button>
                </>
              )}
            </div>

            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-4 space-y-3">
              <Link href="/" className="block text-gray-700 hover:text-gray-900">Home</Link>
              <Link href="/market" className="block text-gray-700 hover:text-gray-900">Markets</Link>
              <Link href="/trade" className="block text-gray-700 hover:text-gray-900">Spot</Link>
              <Link href="/deposit" className="block text-gray-700 hover:text-gray-900">Deposit</Link>
              <Link href="/#finance" className="block text-gray-700 hover:text-gray-900">Finance</Link>
              <Link href="/#faq" className="block text-gray-700 hover:text-gray-900">FAQ</Link>
              {user ? (
                <button onClick={signOut} className="block w-full text-left text-gray-700">
                  Sign Out
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleAuthClick('signin')}
                    className="block w-full text-left text-gray-700"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="block w-full bg-blue-600 text-white rounded-full py-2 text-center"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
        />
      )}
    </>
  );
}
