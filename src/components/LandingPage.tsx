import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Calendar,
  Compass,
  MapPin,
  Receipt,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import type {
  LandingSettings,
  SiteContent,
  Testimonial,
  TripPackage,
  WhyIconKey,
} from '../types/trip';
import { DEFAULT_DURATION_RANGES, formatIDR } from '../utils/tripLogic';
import { ResilientImage } from './ResilientImage';

interface LandingPageProps {
  landing: LandingSettings;
  siteContent: SiteContent;
  trips: TripPackage[];
  testimonials: Testimonial[];
  whySectionRef: React.RefObject<HTMLElement | null>;
  onSearchSubmit: (filters: {
    destination: string;
    date: string;
    durationRange: string;
  }) => void;
  onSelectTrip: (trip: TripPackage) => void;
  onGoToCatalog: () => void;
  onGoToGallery: () => void;
}

function renderWhyIcon(icon: WhyIconKey) {
  if (icon === 'award') return <Award className="w-5 h-5" aria-hidden="true" />;
  if (icon === 'receipt') return <Receipt className="w-5 h-5" aria-hidden="true" />;
  if (icon === 'compass') return <Compass className="w-5 h-5" aria-hidden="true" />;
  if (icon === 'users') return <Users className="w-5 h-5" aria-hidden="true" />;
  return <ShieldCheck className="w-5 h-5" aria-hidden="true" />;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  landing,
  siteContent,
  trips,
  testimonials,
  whySectionRef,
  onSearchSubmit,
  onSelectTrip,
  onGoToCatalog,
  onGoToGallery,
}) => {
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [durationRange, setDurationRange] = useState<string>('all');

  const durationOptions =
    siteContent.durationRanges && siteContent.durationRanges.length > 0
      ? siteContent.durationRanges
      : DEFAULT_DURATION_RANGES;

  const popularTrips = trips.filter((t) => t.featured).slice(0, 4);
  const displayTrips = popularTrips.length > 0 ? popularTrips : trips.slice(0, 4);
  const uniqueDestinations = Array.from(new Set(trips.map((t) => t.destination)));

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit({ destination, date, durationRange });
  };

  return (
    <div className="bg-[#F6F5F0]">
      {/* Configurable Promo Banner (non-sticky, controlled from Admin CMS) */}
      {landing.promoActive && (
        <div className="bg-[#1B3B2B] text-[#F6F5F0] border-b border-[#234B37]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-center">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#F6D3B8]">
              <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {landing.promoBadge}
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-white/30">·</span>
            <span className="text-[#F6F5F0]/90">{landing.promoText}</span>
            {landing.promoCode && (
              <>
                <span aria-hidden="true" className="hidden sm:inline text-white/30">·</span>
                <span className="font-mono text-xs font-semibold tracking-wider text-white bg-white/15 px-2 py-0.5 rounded">
                  Kode: {landing.promoCode}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1. IMMERSIVE HERO SECTION + QUICK SEARCH BAR */}
      <section className="relative overflow-hidden bg-[#132A1E]">
        <div className="absolute inset-0">
          <ResilientImage
            src={landing.heroImage}
            alt={`Ekspedisi alam Nusantara bersama ${siteContent.brandName}`}
            className="w-full h-full object-cover object-center opacity-80"
            fallbackTitle={siteContent.brandName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F2319] via-[#0F2319]/65 to-[#0F2319]/60" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-16 lg:pt-28 lg:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl"
          >
            <p className="text-xs sm:text-sm font-semibold text-[#F6D3B8] tracking-wide mb-3">
              {siteContent.heroKicker}
            </p>
            <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.1] tracking-tight text-balance">
              {landing.heroHeadline}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#F6F5F0]/85 leading-relaxed max-w-2xl">
              {landing.heroSubheadline}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onGoToCatalog}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors cursor-pointer"
              >
                <span>{landing.heroCtaText}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onGoToGallery}
                className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors cursor-pointer"
              >
                <span>{siteContent.heroSecondaryCtaText}</span>
              </button>
            </div>
          </motion.div>

          {/* Quick Search Bar (Destinasi, Tanggal, Durasi) */}
          <motion.form
            onSubmit={handleQuickSearch}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Pencarian Cepat Paket Trip"
            className="mt-12 bg-white rounded-xl border border-[#E2DFD5] shadow-xl p-4 sm:p-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4">
                <label
                  htmlFor="hero-destination"
                  className="block text-xs font-semibold text-[#526058] mb-1.5"
                >
                  {siteContent.searchDestinationLabel || 'Destinasi Tujuan'}
                </label>
                <div className="relative">
                  <MapPin
                    className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    id="hero-destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="">
                      {siteContent.searchAllDestinationsLabel || 'Semua Destinasi'}
                    </option>
                    {uniqueDestinations.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="hero-date"
                  className="block text-xs font-semibold text-[#526058] mb-1.5"
                >
                  {siteContent.searchDateLabel || 'Bulan / Tanggal Berangkat'}
                </label>
                <div className="relative">
                  <Calendar
                    className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label
                  htmlFor="hero-duration"
                  className="block text-xs font-semibold text-[#526058] mb-1.5"
                >
                  {siteContent.searchDurationLabel || 'Durasi Perjalanan'}
                </label>
                <div className="relative">
                  <Compass
                    className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    id="hero-duration"
                    value={durationRange}
                    onChange={(e) => setDurationRange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                  >
                    <option value="all">
                      {siteContent.searchAllDurationsLabel || 'Semua Durasi'}
                    </option>
                    {durationOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>{siteContent.searchButtonText || 'Cari Trip'}</span>
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      </section>

      {/* 2. DESTINASI POPULER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold text-[#C85A32] tracking-wide mb-1.5">
              {siteContent.popularKicker}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#17231D] tracking-tight text-balance">
              {siteContent.popularTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B3B2B] hover:text-[#C85A32] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{siteContent.popularViewAllText || 'Lihat Semua Paket'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayTrips.map((trip) => (
            <article
              key={trip.id}
              className="group bg-white rounded-xl border border-[#E2DFD5] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-1"
            >
              <button
                type="button"
                onClick={() => onSelectTrip(trip)}
                className="text-left flex flex-col flex-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C85A32]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#EDEBE4]">
                  <ResilientImage
                    src={trip.coverImage}
                    alt={trip.title}
                    fallbackTitle={trip.destination}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-[#526058]">
                      <span>{trip.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{trip.durationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[#17231D] font-medium tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#C85A32] text-[#C85A32]" aria-hidden="true" />
                        {trip.rating.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-[#17231D] group-hover:text-[#1B3B2B] leading-snug line-clamp-2">
                      {trip.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#526058]">
                      {trip.destination}, {trip.region}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E2DFD5] flex items-baseline justify-between">
                    <span className="text-xs text-[#526058]">
                      {siteContent.popularPricePrefix || 'Mulai dari'}
                    </span>
                    <span className="text-base font-bold text-[#C85A32] tabular-nums">
                      {formatIDR(trip.pricePerPerson)}
                    </span>
                  </div>
                </div>
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* 3. MENGAPA MEMILIH KAMI? (Keunggulan - sepenuhnya dapat diedit di Admin) */}
      <section
        ref={whySectionRef}
        id="keunggulan"
        className="bg-white border-y border-[#E2DFD5]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold text-[#C85A32] tracking-wide mb-2">
                {siteContent.whyKicker}
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#17231D] tracking-tight text-balance">
                {siteContent.whyTitle}
              </h2>
              <p className="mt-4 text-base text-[#526058] leading-relaxed">
                {siteContent.whyDescription}
              </p>

              {/* Adjacent Proof Strip */}
              <div className="mt-8 pt-8 border-t border-[#E2DFD5] grid grid-cols-3 gap-4">
                {siteContent.whyMetrics.map((metric, idx) => (
                  <div key={idx}>
                    <p className="text-2xl font-bold text-[#1B3B2B] font-display tabular-nums">
                      {metric.value}
                    </p>
                    <p className="text-xs text-[#526058] mt-1">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 divide-y divide-[#E2DFD5] border-t lg:border-t-0 border-[#E2DFD5]">
              {siteContent.whyItems.map((item) => (
                <div key={item.id} className="py-6 first:pt-0 last:pb-0 flex items-start gap-5">
                  <div className="w-11 h-11 rounded-lg bg-[#1B3B2B] text-white flex items-center justify-center shrink-0">
                    {renderWhyIcon(item.icon)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#17231D]">{item.title}</h3>
                    <p className="mt-1.5 text-sm text-[#526058] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. TESTIMONI & REVIEW PELANGGAN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold text-[#C85A32] tracking-wide mb-1.5">
            {siteContent.testimonialsKicker}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#17231D] tracking-tight text-balance">
            {siteContent.testimonialsTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <blockquote
              key={item.id}
              className="bg-white rounded-xl border border-[#E2DFD5] p-6 flex flex-col justify-between"
            >
              <div>
                <div
                  className="flex items-center gap-1 text-[#C85A32] mb-4"
                  aria-label={`Rating ${item.rating} dari 5`}
                >
                  {Array.from({ length: item.rating }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-[#C85A32]" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-sm text-[#17231D] leading-relaxed">"{item.quote}"</p>
              </div>

              <footer className="mt-6 pt-4 border-t border-[#E2DFD5]">
                <p className="text-sm font-bold text-[#17231D]">{item.name}</p>
                <p className="text-xs text-[#526058] mt-0.5">
                  {item.role} · {item.date}
                </p>
                <p className="text-xs font-medium text-[#1B3B2B] mt-1">
                  Trip: {item.tripName}
                </p>
              </footer>
            </blockquote>
          ))}
        </div>

        {/* Bottom Conversion Strip */}
        <div className="mt-14 bg-[#1B3B2B] rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <h3 className="text-xl sm:text-2xl font-bold text-white font-display">
              {siteContent.bottomCtaTitle}
            </h3>
            <p className="mt-2 text-sm text-[#F6F5F0]/80">
              {siteContent.bottomCtaSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{siteContent.bottomCtaButtonText}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};
