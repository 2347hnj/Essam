import { User } from 'firebase/auth';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations';
import { CitizenProfile, Lang } from '../types/world';

interface TopNavProps {
  lang: Lang;
  user: User | null;
  citizen: CitizenProfile | null;
  isAdmin: boolean;
  onSignIn: () => void;
  onOpenProfile: () => void;
  onOpenFounder: () => void;
}

export function TopNav({
  lang,
  user,
  citizen,
  isAdmin,
  onSignIn,
  onOpenProfile,
  onOpenFounder,
}: TopNavProps) {
  const t = TRANSLATIONS[lang];
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '#island-map', label: t.navMap },
    { href: '#daily-vote', label: t.navVote },
    { href: '#simulation-events', label: t.navEvents },
    { href: '#chronicle', label: t.navChronicle },
    { href: '#news', label: t.navNews },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/40 bg-[#071118]/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#top"
          className="font-display-en text-lg font-bold tracking-[0.14em] text-amber-300 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          {t.brand}
        </a>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap shrink-0 border-b border-transparent py-1 transition-colors hover:border-amber-400/70 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenFounder}
              className="whitespace-nowrap shrink-0 border-b border-transparent py-1 text-amber-300 transition-colors hover:border-amber-300 hover:text-amber-200 cursor-pointer"
            >
              {t.navFounder}
            </button>
          )}
        </nav>

        {/* Zone 3: 1 primary action + mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="flex min-h-[40px] items-center gap-2.5 rounded-lg border border-emerald-800/60 bg-[#0d1e28] px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:border-amber-500/60 hover:bg-[#122734] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {citizen?.photoURL || user.photoURL ? (
                <img
                  src={citizen?.photoURL || user.photoURL || ''}
                  alt={citizen?.displayName || user.displayName || 'Citizen'}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-xs font-semibold text-amber-200">
                  {(user.displayName || 'C').charAt(0)}
                </span>
              )}
              <span className="max-w-[140px] truncate">
                {citizen?.displayName || user.displayName || t.myAccount}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="min-h-[40px] rounded-lg bg-amber-500 px-4 py-2 text-xs sm:text-sm font-semibold text-[#071118] transition-colors hover:bg-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.signInGoogle}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-900/50 text-slate-200 md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileOpen && (
        <div className="border-t border-emerald-900/40 bg-[#091720] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="min-h-[44px] flex items-center rounded-md px-3 text-sm font-medium text-slate-200 hover:bg-emerald-950/60"
              >
                {link.label}
              </a>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenFounder();
                }}
                className="min-h-[44px] flex items-center rounded-md px-3 text-sm font-semibold text-amber-300 hover:bg-emerald-950/60 text-start cursor-pointer"
              >
                {t.navFounder}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
