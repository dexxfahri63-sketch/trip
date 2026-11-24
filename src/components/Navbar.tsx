import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type AppView = 'landing' | 'catalog' | 'detail' | 'gallery' | 'admin';

interface NavbarProps {
  brandName: string;
  brandLogoUrl?: string;
  headerCtaText: string;
  navHomeLabel?: string;
  navCatalogLabel?: string;
  navGalleryLabel?: string;
  navWhyLabel?: string;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onScrollToWhy?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  brandName,
  brandLogoUrl,
  headerCtaText,
  navHomeLabel = 'Beranda',
  navCatalogLabel = 'Katalog Trip',
  navGalleryLabel = 'Galeri Guide',
  navWhyLabel = 'Keunggulan',
  currentView,
  onNavigate,
  onScrollToWhy,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (view: AppView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F6F5F0]/95 backdrop-blur-md border-b border-[#E2DFD5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Identity (Logo + Wordmark) */}
        <button
          type="button"
          onClick={() => handleNavClick('landing')}
          className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#1B3B2B] font-display whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C85A32] focus-visible:outline-offset-4"
        >
          <img
            src={brandLogoUrl || '/logo-dexxdigital.svg'}
            alt=""
            aria-hidden="true"
            className="w-8 h-8 rounded-lg object-contain shrink-0"
          />
          <span>{brandName}</span>
        </button>

        {/* Zone 2: Clean single-line text nav links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#526058]"
        >
          <button
            type="button"
            onClick={() => handleNavClick('landing')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentView === 'landing'
                ? 'text-[#1B3B2B] border-[#C85A32]'
                : 'border-transparent hover:text-[#1B3B2B]'
            }`}
          >
            {navHomeLabel}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('catalog')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentView === 'catalog' || currentView === 'detail'
                ? 'text-[#1B3B2B] border-[#C85A32]'
                : 'border-transparent hover:text-[#1B3B2B]'
            }`}
          >
            {navCatalogLabel}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('gallery')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentView === 'gallery'
                ? 'text-[#1B3B2B] border-[#C85A32]'
                : 'border-transparent hover:text-[#1B3B2B]'
            }`}
          >
            {navGalleryLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              if (currentView !== 'landing') {
                onNavigate('landing');
                setTimeout(() => onScrollToWhy?.(), 120);
              } else {
                onScrollToWhy?.();
              }
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-[#1B3B2B] transition-colors cursor-pointer"
          >
            {navWhyLabel}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('catalog')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1B3B2B]"
          >
            {headerCtaText}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            className="md:hidden p-2 rounded-lg text-[#1B3B2B] hover:bg-[#EDEBE4] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E2DFD5] bg-[#F6F5F0] px-4 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleNavClick('landing')}
            className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentView === 'landing'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#17231D] hover:bg-[#EDEBE4]'
            }`}
          >
            {navHomeLabel}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('catalog')}
            className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentView === 'catalog' || currentView === 'detail'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#17231D] hover:bg-[#EDEBE4]'
            }`}
          >
            {navCatalogLabel}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('gallery')}
            className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentView === 'gallery'
                ? 'bg-[#1B3B2B] text-white'
                : 'text-[#17231D] hover:bg-[#EDEBE4]'
            }`}
          >
            {navGalleryLabel}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('catalog')}
            className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#C85A32] rounded-lg"
          >
            {headerCtaText}
          </button>
        </div>
      )}
    </header>
  );
};
