import React, { useEffect, useState } from 'react';
import { Award, Camera, Pause, Play, RotateCcw, Video, X } from 'lucide-react';
import type { GalleryItem, SiteContent, TourGuide } from '../types/trip';
import { filterGalleryItems } from '../utils/tripLogic';
import { ResilientImage } from './ResilientImage';

interface GalleryPageProps {
  gallery: GalleryItem[];
  guides: TourGuide[];
  siteContent: SiteContent;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  gallery,
  guides,
  siteContent,
}) => {
  const [destinationFilter, setDestinationFilter] = useState('Semua');
  const [guideFilter, setGuideFilter] = useState('Semua');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const uniqueDestinations = [
    'Semua',
    ...Array.from(new Set(gallery.map((g) => g.destination))),
  ];

  const filteredItems = filterGalleryItems(
    gallery,
    destinationFilter,
    guideFilter
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="bg-[#F6F5F0] min-h-screen">
      {/* Header */}
      <div className="bg-[#1B3B2B] text-white border-b border-[#234B37]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-xs font-semibold text-[#DB724B] tracking-wide mb-2">
            {siteContent.galleryKicker}
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-balance">
            {siteContent.galleryTitle}
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#F6F5F0]/80 max-w-2xl">
            {siteContent.gallerySubtitle}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Guide Roster Row */}
        <section aria-label="Profil Tim Tour Guide">
          <h2 className="text-lg font-bold text-[#17231D] mb-4">
            {siteContent.galleryGuidesTitle || 'Tim Tour Guide Bersertifikat'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {guides.map((guide) => {
              const isSelected = guideFilter === guide.id;
              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() =>
                    setGuideFilter((prev) => (prev === guide.id ? 'Semua' : guide.id))
                  }
                  className={`text-left rounded-xl border overflow-hidden flex flex-col transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-[#1B3B2B] text-white border-[#1B3B2B] shadow-md'
                      : 'bg-white text-[#17231D] border-[#E2DFD5] hover:border-[#1B3B2B]'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#EDEBE4] relative">
                    <ResilientImage
                      src={guide.photoUrl || ''}
                      alt={`Foto profil Tour Guide ${guide.name}`}
                      fallbackTitle={guide.name}
                      className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold font-display">{guide.name}</h3>
                        <Award
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isSelected ? 'text-[#DB724B]' : 'text-[#C85A32]'
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <p
                        className={`text-xs font-medium mt-0.5 ${
                          isSelected ? 'text-[#F6D3B8]' : 'text-[#C85A32]'
                        }`}
                      >
                        {guide.specialty}
                      </p>
                      <p
                        className={`text-[11px] mt-1.5 leading-relaxed line-clamp-2 ${
                          isSelected ? 'text-[#F6F5F0]/80' : 'text-[#526058]'
                        }`}
                      >
                        {guide.certification}
                      </p>
                    </div>
                    <div
                      className={`mt-3 pt-3 border-t text-xs flex items-center gap-2 tabular-nums ${
                        isSelected
                          ? 'border-white/15 text-[#F6F5F0]/90'
                          : 'border-[#E2DFD5] text-[#526058]'
                      }`}
                    >
                      <span>{guide.experienceYears} thn pengalaman</span>
                      <span aria-hidden="true">·</span>
                      <span>{guide.tripsLed} trip</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter Controls */}
        <div className="bg-white rounded-xl border border-[#E2DFD5] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label
                htmlFor="gallery-dest-filter"
                className="block text-xs font-semibold text-[#526058] mb-1"
              >
                {siteContent.galleryDestFilterLabel || 'Filter Destinasi'}
              </label>
              <select
                id="gallery-dest-filter"
                value={destinationFilter}
                onChange={(e) => setDestinationFilter(e.target.value)}
                className="px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              >
                {uniqueDestinations.map((dest) => (
                  <option key={dest} value={dest}>
                    {dest}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="gallery-guide-filter"
                className="block text-xs font-semibold text-[#526058] mb-1"
              >
                {siteContent.galleryGuideFilterLabel || 'Filter Tour Guide'}
              </label>
              <select
                id="gallery-guide-filter"
                value={guideFilter}
                onChange={(e) => setGuideFilter(e.target.value)}
                className="px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              >
                <option value="Semua">Semua Tour Guide</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#526058]">
            <span className="tabular-nums">
              Menampilkan <strong className="text-[#17231D]">{filteredItems.length}</strong>{' '}
              dokumentasi
            </span>
            {(destinationFilter !== 'Semua' || guideFilter !== 'Semua') && (
              <button
                type="button"
                onClick={() => {
                  setDestinationFilter('Semua');
                  setGuideFilter('Semua');
                }}
                className="inline-flex items-center gap-1 font-semibold text-[#C85A32] hover:text-[#B44B25] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Aesthetic Masonry Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2DFD5] p-12 text-center">
            <Camera className="w-10 h-10 text-[#526058] mx-auto mb-3" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[#17231D]">
              Belum Ada Dokumentasi untuk Kombinasi Filter Ini
            </h3>
            <p className="mt-1.5 text-sm text-[#526058]">
              Pilih destinasi atau tour guide lain untuk melihat dokumentasi ekspedisi.
            </p>
          </div>
        ) : (
          <div
            data-testid="gallery-masonry-grid"
            className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6"
          >
            {filteredItems.map((item) => (
              <figure
                key={item.id}
                className="break-inside-avoid bg-white rounded-xl border border-[#E2DFD5] overflow-hidden group"
              >
                <button
                  type="button"
                  onClick={() => {
                    setVideoPlaying(false);
                    setLightboxItem(item);
                  }}
                  aria-label={`Buka dokumentasi ${item.title}`}
                  className="w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C85A32]"
                >
                  <div
                    className={`relative w-full overflow-hidden bg-[#EDEBE4] ${
                      item.aspectHint === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'
                    }`}
                  >
                    <ResilientImage
                      src={item.mediaUrl}
                      alt={item.title}
                      fallbackTitle={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {item.mediaType === 'video' && (
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-[#C85A32] text-white flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 ml-0.5 fill-white" aria-hidden="true" />
                        </span>
                      </div>
                    )}
                  </div>

                  <figcaption className="p-5">
                    <div className="flex items-center gap-2 text-xs text-[#526058]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1B3B2B]">
                        {item.mediaType === 'video' ? (
                          <Video className="w-3.5 h-3.5 text-[#C85A32]" aria-hidden="true" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-[#1B3B2B]" aria-hidden="true" />
                        )}
                        {item.mediaType === 'video' ? 'Video Reel' : 'Foto'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.destination}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.capturedDate}</span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-[#17231D]">{item.title}</h3>
                    <p className="mt-1.5 text-xs text-[#526058] leading-relaxed">
                      {item.caption}
                    </p>
                    <p className="mt-3 pt-3 border-t border-[#E2DFD5] text-xs font-medium text-[#1B3B2B]">
                      Tour Guide: {item.guideName}
                    </p>
                  </figcaption>
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxItem.title}
          className="fixed inset-0 z-50 bg-[#0F2319]/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden border border-[#E2DFD5] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DFD5]">
              <div>
                <p className="text-xs text-[#526058]">
                  {lightboxItem.destination} · Guide: {lightboxItem.guideName} ·{' '}
                  <span className="tabular-nums">{lightboxItem.capturedDate}</span>
                </p>
                <h2 className="text-lg font-bold text-[#17231D]">{lightboxItem.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="Tutup lightbox dokumentasi"
                className="p-2 rounded-lg text-[#526058] hover:text-[#17231D] hover:bg-[#F6F5F0] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-[#0F2319] max-h-[65vh] flex items-center justify-center overflow-hidden relative">
              <div
                className={`transition-transform duration-[4000ms] ease-out ${
                  lightboxItem.mediaType === 'video' && videoPlaying ? 'scale-110' : 'scale-100'
                }`}
              >
                <ResilientImage
                  src={lightboxItem.mediaUrl}
                  alt={lightboxItem.title}
                  className="max-h-[65vh] w-auto object-contain"
                />
              </div>
              {lightboxItem.mediaType === 'video' && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/75 text-white text-xs px-4 py-2.5 rounded-lg flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setVideoPlaying((p) => !p)}
                    className="inline-flex items-center gap-2 font-semibold text-white hover:text-[#F6D3B8] cursor-pointer"
                  >
                    {videoPlaying ? (
                      <Pause className="w-4 h-4 text-[#DB724B] fill-[#DB724B]" aria-hidden="true" />
                    ) : (
                      <Play className="w-4 h-4 text-[#DB724B] fill-[#DB724B]" aria-hidden="true" />
                    )}
                    <span>
                      {videoPlaying ? 'Jeda Reel Lapangan' : 'Putar Reel Lapangan'} (
                      {lightboxItem.destination})
                    </span>
                  </button>
                  <span className="font-mono text-[#F6F5F0]/75">
                    {videoPlaying ? 'MEMUTAR · 00:18' : 'HD 1080p'}
                  </span>
                </div>
              )}
            </div>

            <div className="p-6">
              <p className="text-sm text-[#526058] leading-relaxed">{lightboxItem.caption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
