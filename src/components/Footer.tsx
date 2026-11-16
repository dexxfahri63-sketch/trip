import React from 'react';
import { Lock, Mail, MapPin, Phone } from 'lucide-react';
import type { SiteContent } from '../types/trip';
import type { AppView } from './Navbar';

interface FooterProps {
  whatsappNumber: string;
  siteContent: SiteContent;
  onNavigate: (view: AppView) => void;
}

export const Footer: React.FC<FooterProps> = ({
  whatsappNumber,
  siteContent,
  onNavigate,
}) => {
  const formattedWa = whatsappNumber.startsWith('62')
    ? `+${whatsappNumber.slice(0, 2)} ${whatsappNumber.slice(2, 5)}-${whatsappNumber.slice(5, 9)}-${whatsappNumber.slice(9)}`
    : whatsappNumber;

  return (
    <footer className="bg-[#132A1E] text-[#F6F5F0]/90 border-t border-[#1B3B2B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-3">
            <p className="text-xl font-bold tracking-tight font-display text-white">
              {siteContent.brandName}
            </p>
            <p className="text-sm leading-relaxed text-[#F6F5F0]/75 max-w-md">
              {siteContent.footerDescription}
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-sm font-semibold text-white font-display">
              {siteContent.footerNavTitle || 'Navigasi'}
            </h3>
            <ul className="space-y-2 text-sm text-[#F6F5F0]/75">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('landing')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {siteContent.navHomeLabel || 'Beranda'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('catalog')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {siteContent.navCatalogLabel || 'Katalog Trip'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('gallery')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {siteContent.navGalleryLabel || 'Galeri Guide'}
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-sm font-semibold text-white font-display">
              {siteContent.footerContactTitle || 'Kontak Basecamp'}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#F6F5F0]/75">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 text-[#DB724B] shrink-0" aria-hidden="true" />
                <span>{siteContent.basecampAddress}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#DB724B] shrink-0" aria-hidden="true" />
                <span className="tabular-nums">{formattedWa}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#DB724B] shrink-0" aria-hidden="true" />
                <span>{siteContent.contactEmail}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#F6F5F0]/55">
          <p>{siteContent.copyrightText}</p>

          {/* Hidden / Discreet Admin CMS Access */}
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            data-testid="hidden-admin-trigger"
            className="inline-flex items-center gap-1.5 text-xs text-[#F6F5F0]/45 hover:text-[#F6F5F0]/90 transition-colors cursor-pointer py-1 px-2 rounded focus-visible:outline-2 focus-visible:outline-[#C85A32]"
            title="Panel Manajemen Konten & Leads"
          >
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>Akses Pengelola</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
