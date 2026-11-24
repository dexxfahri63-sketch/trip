import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Compass,
  History,
  RotateCcw,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { SiteContent, TripPackage } from '../types/trip';
import {
  addRecentSearchQuery,
  clearRecentSearches,
  DEFAULT_DURATION_RANGES,
  DEFAULT_PRICE_RANGES,
  filterTrips,
  formatIDR,
  getAvailableTripCategories,
  loadRecentSearches,
  saveRecentSearches,
  type TripFilterCriteria,
} from '../utils/tripLogic';
import { ResilientImage } from './ResilientImage';

interface CatalogPageProps {
  trips: TripPackage[];
  siteContent: SiteContent;
  filters: TripFilterCriteria;
  onFiltersChange: (next: TripFilterCriteria) => void;
  onSelectTrip: (trip: TripPackage) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  trips,
  siteContent,
  filters,
  onFiltersChange,
  onSelectTrip,
}) => {
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches()
  );
  const currentSearchText = filters.query || filters.destination || '';

  const commitRecentSearch = (rawQuery: string) => {
    const clean = (rawQuery || '').trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = addRecentSearchQuery(prev, clean, 3);
      saveRecentSearches(next);
      return next;
    });
  };

  // Record meaningful search queries after user pauses typing (or arrives from Hero quick search)
  useEffect(() => {
    const clean = currentSearchText.trim();
    if (clean.length < 3) return;
    const timer = window.setTimeout(() => {
      commitRecentSearch(clean);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [currentSearchText]);

  const handleApplyRecentSearch = (term: string) => {
    onFiltersChange({
      ...filters,
      query: term,
      destination: '',
    });
    commitRecentSearch(term);
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    clearRecentSearches();
  };

  const categories = [
    'Semua',
    ...getAvailableTripCategories(trips, siteContent.tripCategories),
  ];
  const priceRanges =
    siteContent.priceRanges && siteContent.priceRanges.length > 0
      ? siteContent.priceRanges
      : DEFAULT_PRICE_RANGES;
  const durationRanges =
    siteContent.durationRanges && siteContent.durationRanges.length > 0
      ? siteContent.durationRanges
      : DEFAULT_DURATION_RANGES;

  const filteredTrips = filterTrips(trips, filters, {
    priceRanges,
    durationRanges,
  });

  const hasActiveFilters =
    Boolean(filters.query) ||
    Boolean(filters.destination) ||
    Boolean(filters.date) ||
    (filters.category && filters.category !== 'Semua') ||
    (filters.priceRange && filters.priceRange !== 'all') ||
    (filters.durationRange && filters.durationRange !== 'all');

  const handleReset = () => {
    onFiltersChange({
      query: '',
      destination: '',
      date: '',
      category: 'Semua',
      priceRange: 'all',
      durationRange: 'all',
      sortBy: 'popular',
    });
  };

  return (
    <div className="bg-[#F6F5F0] min-h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="bg-[#1B3B2B] text-white border-b border-[#234B37]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-xs font-semibold text-[#DB724B] tracking-wide mb-2">
            {siteContent.catalogKicker}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance">
            {siteContent.catalogTitle}
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#F6F5F0]/80 max-w-2xl">
            {siteContent.catalogSubtitle}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Filter Control Bar */}
        <div className="bg-white rounded-xl border border-[#E2DFD5] p-5 mb-8 space-y-5">
          {/* Category Segmented Tabs + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filter Kategori Trip"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F6F5F0] rounded-lg border border-[#E2DFD5]"
            >
              {categories.map((cat) => {
                const active = (filters.category || 'Semua') === cat;
                const displayLabel =
                  cat === 'Semua'
                    ? siteContent.catalogAllCategoriesLabel || 'Semua'
                    : cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onFiltersChange({ ...filters, category: cat })}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#1B3B2B] text-white'
                        : 'text-[#526058] hover:text-[#17231D]'
                    }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitRecentSearch(currentSearchText);
              }}
              className="flex items-center gap-2 w-full lg:w-96"
            >
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Cari destinasi atau nama paket"
                  placeholder={
                    siteContent.catalogSearchPlaceholder || 'Cari gunung, pulau, atau kota...'
                  }
                  value={currentSearchText}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      query: e.target.value,
                      destination: '',
                    })
                  }
                  className="w-full pl-9 pr-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cari
              </button>
            </form>
          </div>

          {recentSearches.length > 0 && (
            <div
              data-testid="recent-searches-bar"
              className="flex flex-wrap items-center gap-2 pt-1"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#526058]">
                <History className="w-3.5 h-3.5 text-[#1B3B2B]" aria-hidden="true" />
                <span>Pencarian Terakhir:</span>
              </span>
              {recentSearches.map((term) => {
                const isActive =
                  currentSearchText.trim().toLowerCase() === term.toLowerCase();
                return (
                  <button
                    key={term.toLowerCase()}
                    type="button"
                    onClick={() => handleApplyRecentSearch(term)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                        : 'bg-[#F6F5F0] text-[#17231D] border-[#E2DFD5] hover:border-[#1B3B2B] hover:bg-[#EDEBE4]'
                    }`}
                  >
                    {term}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleClearRecentSearches}
                aria-label="Hapus riwayat pencarian"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#526058] hover:text-[#C85A32] cursor-pointer"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>
          )}

          {/* Secondary Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#E2DFD5]">
            <div>
              <label
                htmlFor="filter-price"
                className="block text-xs font-semibold text-[#526058] mb-1.5"
              >
                {siteContent.catalogPriceFilterLabel || 'Rentang Harga'}
              </label>
              <select
                id="filter-price"
                value={filters.priceRange || 'all'}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    priceRange: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="all">{siteContent.catalogAllPricesLabel || 'Semua Harga'}</option>
                {priceRanges.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-duration"
                className="block text-xs font-semibold text-[#526058] mb-1.5"
              >
                {siteContent.catalogDurationFilterLabel || 'Durasi Trip'}
              </label>
              <select
                id="filter-duration"
                value={filters.durationRange || 'all'}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    durationRange: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="all">
                  {siteContent.searchAllDurationsLabel || 'Semua Durasi'}
                </option>
                {durationRanges.map((dr) => (
                  <option key={dr.id} value={dr.id}>
                    {dr.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-date"
                className="block text-xs font-semibold text-[#526058] mb-1.5"
              >
                {siteContent.catalogDateFilterLabel || 'Bulan Keberangkatan'}
              </label>
              <input
                id="filter-date"
                type="month"
                value={filters.date ? filters.date.slice(0, 7) : ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    date: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              />
            </div>

            <div>
              <label
                htmlFor="filter-sort"
                className="block text-xs font-semibold text-[#526058] mb-1.5"
              >
                {siteContent.catalogSortLabel || 'Urutkan'}
              </label>
              <select
                id="filter-sort"
                value={filters.sortBy || 'popular'}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    sortBy: e.target.value as TripFilterCriteria['sortBy'],
                  })
                }
                className="w-full px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="popular">Paling Populer</option>
                <option value="price-asc">Harga Terendah</option>
                <option value="price-desc">Harga Tertinggi</option>
                <option value="rating">Rating Tertinggi</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-[#526058]">
            <span className="tabular-nums">
              Menampilkan <strong className="text-[#17231D]">{filteredTrips.length}</strong> dari{' '}
              {trips.length} paket perjalanan
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] hover:text-[#B44B25] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Grid or Empty State */}
        {filteredTrips.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2DFD5] p-12 text-center">
            <Compass className="w-10 h-10 text-[#526058] mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#17231D]">
              {siteContent.catalogEmptyTitle || 'Tidak Ada Paket yang Sesuai Filter'}
            </h2>
            <p className="mt-1.5 text-sm text-[#526058] max-w-md mx-auto">
              {siteContent.catalogEmptySubtitle ||
                'Coba ubah rentang harga, kategori, atau bulan keberangkatan untuk melihat jadwal trip lainnya.'}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Tampilkan Semua Paket</span>
            </button>
          </div>
        ) : (
          <div
            data-testid="catalog-trip-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredTrips.map((trip) => (
              <motion.article
                key={trip.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="group bg-white rounded-xl border border-[#E2DFD5] overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1"
              >
                <div>
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#EDEBE4]">
                    <ResilientImage
                      src={trip.coverImage}
                      alt={trip.title}
                      fallbackTitle={trip.destination}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-2 text-xs text-[#526058]">
                      <span className="font-semibold text-[#1B3B2B]">{trip.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{trip.durationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{trip.difficulty}</span>
                    </div>

                    <h2 className="mt-2 text-lg font-bold text-[#17231D] leading-snug">
                      {trip.title}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-[#526058]">
                      {trip.destination}, {trip.region}
                    </p>
                    <p className="mt-3 text-sm text-[#526058] line-clamp-2 leading-relaxed">
                      {trip.shortDescription}
                    </p>

                    <div className="mt-4 flex items-center gap-4 text-xs text-[#526058]">
                      <span className="inline-flex items-center gap-1 text-[#17231D] font-semibold tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#C85A32] text-[#C85A32]" aria-hidden="true" />
                        {trip.rating.toFixed(2)} ({trip.reviewCount})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="w-3.5 h-3.5" aria-hidden="true" />
                        Maks. {trip.maxParticipants} peserta
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-[#F6F5F0]/60 border-t border-[#E2DFD5] flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] text-[#526058]">
                      {siteContent.catalogCardPriceLabel || 'Harga per peserta'}
                    </p>
                    <p className="text-lg font-bold text-[#C85A32] tabular-nums">
                      {formatIDR(trip.pricePerPerson)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTrip(trip)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>{siteContent.catalogCardButtonText || 'Detail Trip'}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
