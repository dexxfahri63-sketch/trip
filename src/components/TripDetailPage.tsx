import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Percent,
  Plus,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import type { BookingLead, SiteContent, TripPackage } from '../types/trip';
import {
  buildWhatsAppBookingUrl,
  calculateGroupPricing,
  calculateTotalPrice,
  formatIDR,
  validateBookingInput,
} from '../utils/tripLogic';
import { createLeadInFirestore } from '../services/firestoreStore';
import { ResilientImage } from './ResilientImage';

interface TripDetailPageProps {
  trip: TripPackage;
  siteContent: SiteContent;
  whatsappNumber: string;
  onBack: () => void;
  onLeadSubmitted: (lead: BookingLead) => void;
}

export const TripDetailPage: React.FC<TripDetailPageProps> = ({
  trip,
  siteContent,
  whatsappNumber,
  onBack,
  onLeadSubmitted,
}) => {
  const allPhotos =
    trip.galleryImages.length > 0 ? trip.galleryImages : [trip.coverImage];
  const [selectedPhoto, setSelectedPhoto] = useState(allPhotos[0]);
  const activePhoto = allPhotos.includes(selectedPhoto) ? selectedPhoto : allPhotos[0];
  const [expandedDays, setExpandedDays] = useState<number[]>(
    trip.itinerary.length > 0 ? [trip.itinerary[0].day] : []
  );

  // Booking Form State
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const departureOptions =
    trip.nextDepartures.length > 0 ? trip.nextDepartures : ['2026-12-20'];
  const [departureDate, setDepartureDate] = useState(departureOptions[0]);
  const [participants, setParticipants] = useState(() =>
    Math.min(2, Math.max(1, trip.maxParticipants || 2))
  );
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedLead, setSubmittedLead] = useState<BookingLead | null>(null);

  const groupPricing = calculateGroupPricing(
    trip.pricePerPerson,
    participants,
    siteContent.groupDiscounts
  );
  const highestTierMin = Math.max(
    0,
    ...groupPricing.tiers.map((tier) => tier.minParticipants)
  );
  const maxSelectableParticipants = Math.min(
    30,
    Math.max(trip.maxParticipants, highestTierMin)
  );
  const totalEstimatedPrice = groupPricing.totalPrice;

  const toggleDay = (dayNumber: number) => {
    setExpandedDays((prev) =>
      prev.includes(dayNumber)
        ? prev.filter((d) => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const validation = validateBookingInput({
      customerName,
      whatsapp,
      email,
      departureDate,
      participants,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const leadId = `lead-${Date.now()}`;
      let created: BookingLead | null = null;

      try {
        created = await createLeadInFirestore({
          id: leadId,
          tripId: trip.id,
          tripTitle: trip.title,
          customerName,
          whatsapp,
          email,
          departureDate,
          participants,
          totalEstimatedPrice,
          notes,
        });
      } catch (fsErr) {
        console.warn('Firestore lead create failed:', fsErr);
      }

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: leadId,
            tripId: trip.id,
            tripTitle: trip.title,
            customerName,
            whatsapp,
            email,
            departureDate,
            participants,
            totalEstimatedPrice,
            notes,
          }),
        });
        if (response.ok) {
          const serverLead = (await response.json()) as BookingLead;
          if (!created) {
            created = serverLead;
          }
        }
      } catch {
        // Fallback already handled if Firestore succeeded
      }

      if (!created) {
        throw new Error('Gagal menyimpan pemesanan.');
      }

      setSubmittedLead(created);
      onLeadSubmitted(created);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Terjadi kendala saat mengirim pemesanan.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const directWaUrl = buildWhatsAppBookingUrl(whatsappNumber, {
    tripTitle: trip.title,
    customerName: submittedLead?.customerName || customerName || 'Calon Peserta',
    departureDate: submittedLead?.departureDate || departureDate,
    participants: submittedLead?.participants || participants,
    totalEstimatedPrice: submittedLead?.totalEstimatedPrice || totalEstimatedPrice,
    discountPercent: groupPricing.discountPercent,
    notes: submittedLead?.notes || notes,
  });

  return (
    <div className="bg-[#F6F5F0] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Breadcrumb */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B3B2B] hover:text-[#C85A32] transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{siteContent.detailBackText || 'Kembali ke Katalog Trip'}</span>
        </button>

        {/* Title & Metadata Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#526058]">
            <span className="font-semibold text-[#C85A32]">{trip.category}</span>
            <span aria-hidden="true">·</span>
            <span>
              {trip.destination}, {trip.region}
            </span>
            <span aria-hidden="true">·</span>
            <span>{trip.durationLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#17231D] tabular-nums">
              <Star className="w-4 h-4 fill-[#C85A32] text-[#C85A32]" aria-hidden="true" />
              {trip.rating.toFixed(2)} ({trip.reviewCount} ulasan)
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-[#17231D] tracking-tight text-balance">
            {trip.title}
          </h1>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Content Column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Photo Gallery */}
            <div className="space-y-3">
              <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5]">
                <ResilientImage
                  src={activePhoto}
                  alt={`${trip.title} - foto utama`}
                  fallbackTitle={trip.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {allPhotos.length > 1 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {allPhotos.map((imgUrl, idx) => (
                    <button
                      key={`${imgUrl}-${idx}`}
                      type="button"
                      onClick={() => setSelectedPhoto(imgUrl)}
                      aria-label={`Pilih foto galeri ${idx + 1}`}
                      className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        activePhoto === imgUrl
                          ? 'border-[#C85A32]'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <ResilientImage
                        src={imgUrl}
                        alt={`${trip.title} thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Key Specifications Strip */}
            <div className="bg-white rounded-xl border border-[#E2DFD5] p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-[#526058]">Durasi</p>
                <p className="mt-1 text-sm font-bold text-[#17231D] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#1B3B2B]" aria-hidden="true" />
                  {trip.durationLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#526058]">Tingkat Medan</p>
                <p className="mt-1 text-sm font-bold text-[#17231D]">{trip.difficulty}</p>
              </div>
              <div>
                <p className="text-xs text-[#526058]">Kapasitas Grup</p>
                <p className="mt-1 text-sm font-bold text-[#17231D] flex items-center gap-1.5 tabular-nums">
                  <Users className="w-4 h-4 text-[#1B3B2B]" aria-hidden="true" />
                  Maks. {trip.maxParticipants} org
                </p>
              </div>
              <div>
                <p className="text-xs text-[#526058]">Kategori</p>
                <p className="mt-1 text-sm font-bold text-[#17231D]">{trip.category}</p>
              </div>
            </div>

            {/* Description */}
            <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#17231D] mb-3">
                {siteContent.detailSummaryTitle || 'Ringkasan Perjalanan'}
              </h2>
              <p className="text-base text-[#526058] leading-relaxed">
                {trip.shortDescription}
              </p>
            </section>

            {/* Daily Itinerary */}
            <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#17231D] mb-5">
                {siteContent.detailItineraryTitle || 'Itinerary Harian'}
              </h2>
              {trip.itinerary.length === 0 ? (
                <p className="text-sm text-[#526058]">
                  Jadwal detail akan dibagikan oleh tim tour leader setelah konfirmasi kuota.
                </p>
              ) : (
                <div className="divide-y divide-[#E2DFD5] border-y border-[#E2DFD5]">
                  {trip.itinerary.map((dayItem) => {
                    const isOpen = expandedDays.includes(dayItem.day);
                    return (
                      <div key={dayItem.day} className="py-4">
                        <button
                          type="button"
                          onClick={() => toggleDay(dayItem.day)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center justify-between gap-4 text-left cursor-pointer py-1"
                        >
                          <div>
                            <span className="text-xs font-mono font-semibold text-[#C85A32]">
                              Day {dayItem.day}
                            </span>
                            <h3 className="text-base font-bold text-[#17231D] mt-0.5">
                              {dayItem.title}
                            </h3>
                          </div>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-[#526058] shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-[#526058] shrink-0" aria-hidden="true" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="mt-3 pl-4 space-y-2">
                            <ul className="space-y-1.5 list-disc list-inside text-sm text-[#526058]">
                              {dayItem.activities.map((act, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {act}
                                </li>
                              ))}
                            </ul>
                            {dayItem.meals && (
                              <p className="text-xs font-medium text-[#1B3B2B] pt-1">
                                Konsumsi termasuk: {dayItem.meals}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Included / Excluded Facilities */}
            <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#17231D] mb-6">
                {siteContent.detailFacilitiesTitle || 'Fasilitas Termasuk & Tidak Termasuk'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3B2B] mb-3">
                    {siteContent.detailIncludedTitle || 'Termasuk dalam Paket (Included)'}
                  </h3>
                  <ul className="space-y-2.5">
                    {trip.included.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-[#17231D]">
                        <CheckCircle2
                          className="w-4 h-4 text-[#1B3B2B] mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#526058] mb-3">
                    {siteContent.detailExcludedTitle || 'Di Luar Paket (Excluded)'}
                  </h3>
                  <ul className="space-y-2.5">
                    {trip.excluded.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-[#526058]">
                        <XCircle
                          className="w-4 h-4 text-[#C85A32] mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Meeting Point Info */}
            <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 sm:p-8">
              <h2 className="text-xl font-bold text-[#17231D] mb-4">
                {siteContent.detailMeetingPointTitle || 'Informasi Meeting Point'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F6F5F0] rounded-lg p-5 border border-[#E2DFD5]">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#C85A32] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#526058]">Lokasi Kumpul</p>
                    <p className="text-sm font-bold text-[#17231D] mt-0.5">
                      {trip.meetingPoint.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#1B3B2B] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-[#526058]">Waktu Berkumpul</p>
                    <p className="text-sm font-bold text-[#17231D] mt-0.5 tabular-nums">
                      {trip.meetingPoint.time}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-[#526058] leading-relaxed">
                {trip.meetingPoint.notes}
              </p>
            </section>
          </div>

          {/* Right Sticky Booking & WhatsApp Conversion Panel */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-xl border border-[#E2DFD5] p-6">
              <div className="pb-5 border-b border-[#E2DFD5]">
                <p className="text-xs text-[#526058]">
                  {siteContent.catalogCardPriceLabel || 'Harga per peserta'}
                </p>
                {groupPricing.discountPercent > 0 ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-3xl font-bold text-[#1B3B2B] font-display tabular-nums">
                        {formatIDR(groupPricing.discountedUnitPrice)}
                      </p>
                      <span className="text-sm text-[#526058] line-through tabular-nums">
                        {formatIDR(trip.pricePerPerson)}
                      </span>
                    </div>
                    <p
                      data-testid="active-group-discount-badge"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B3B2B] bg-[#1B3B2B]/10 border border-[#1B3B2B]/20 rounded-md px-2 py-1"
                    >
                      <Percent className="w-3.5 h-3.5 text-[#C85A32]" aria-hidden="true" />
                      <span>
                        Diskon Rombongan {groupPricing.discountPercent}% aktif (
                        {groupPricing.appliedTier?.minParticipants}+ orang)
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-[#C85A32] font-display tabular-nums mt-1">
                    {formatIDR(trip.pricePerPerson)}
                  </p>
                )}

                {groupPricing.tiers.length > 0 && (
                  <div
                    data-testid="group-discount-tiers-box"
                    className="mt-4 p-3 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] space-y-1.5"
                  >
                    <p className="text-[11px] font-bold text-[#1B3B2B] uppercase tracking-wide">
                      Harga Spesial Rombongan
                    </p>
                    <ul className="space-y-1">
                      {groupPricing.tiers.map((tier) => {
                        const isApplied = groupPricing.appliedTier?.id === tier.id;
                        const discountedSingle = calculateTotalPrice(
                          trip.pricePerPerson,
                          1,
                          tier.discountPercent
                        );
                        return (
                          <li
                            key={tier.id}
                            className={`flex items-center justify-between gap-2 text-xs tabular-nums ${
                              isApplied
                                ? 'font-bold text-[#1B3B2B]'
                                : 'text-[#526058]'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {isApplied && (
                                <CheckCircle2
                                  className="w-3.5 h-3.5 text-[#1B3B2B] shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {tier.minParticipants}+ orang · Diskon {tier.discountPercent}%
                              </span>
                            </span>
                            <span className="font-semibold text-[#17231D]">
                              {formatIDR(discountedSingle)}/org
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {groupPricing.nextTier && (
                      <p className="text-[11px] text-[#C85A32] font-medium pt-0.5">
                        Tambah {groupPricing.nextTier.minParticipants - participants} orang lagi
                        untuk diskon {groupPricing.nextTier.discountPercent}%.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {submittedLead ? (
                <div className="py-6 space-y-4" data-testid="booking-success-panel">
                  <div className="p-4 rounded-lg bg-[#1B3B2B]/10 border border-[#1B3B2B]/20">
                    <div className="flex items-center gap-2 text-[#1B3B2B] font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span>Permintaan Booking Tersimpan</span>
                    </div>
                    <p className="mt-2 text-xs text-[#17231D] leading-relaxed">
                      Terima kasih, <strong>{submittedLead.customerName}</strong>. Data reservasi
                      untuk <strong>{submittedLead.participants} peserta</strong> pada tanggal{' '}
                      <span className="font-mono">{submittedLead.departureDate}</span> telah masuk
                      ke sistem kami.
                    </p>
                  </div>

                  <a
                    href={directWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Konfirmasi via WhatsApp Sekarang</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setSubmittedLead(null)}
                    className="w-full py-2 text-xs font-semibold text-[#526058] hover:text-[#17231D] cursor-pointer"
                  >
                    Buat Reservasi Tambahan
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="pt-5 space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="booking-date"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Pilih Jadwal Keberangkatan
                    </label>
                    <div className="relative">
                      <Calendar
                        className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <select
                        id="booking-date"
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B] tabular-nums"
                      >
                        {departureOptions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.departureDate && (
                      <p className="mt-1 text-xs text-red-600">{errors.departureDate}</p>
                    )}
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-[#526058] mb-1.5">
                      Jumlah Peserta
                    </span>
                    <div className="flex items-center justify-between bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setParticipants((p) => Math.max(1, p - 1))}
                        aria-label="Kurangi jumlah peserta"
                        className="p-1.5 rounded-md hover:bg-white text-[#1B3B2B] cursor-pointer"
                      >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span
                        className="text-sm font-bold text-[#17231D] tabular-nums"
                        data-testid="participant-count"
                      >
                        {participants} Orang
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setParticipants((p) => Math.min(maxSelectableParticipants, p + 1))
                        }
                        aria-label="Tambah jumlah peserta"
                        className="p-1.5 rounded-md hover:bg-white text-[#1B3B2B] cursor-pointer"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    {participants > trip.maxParticipants && (
                      <p className="mt-1 text-[11px] text-[#526058]">
                        Peserta di atas kuota reguler ({trip.maxParticipants} org) akan dijadwalkan
                        sebagai rombongan khusus oleh tim kami.
                      </p>
                    )}
                    {errors.participants && (
                      <p className="mt-1 text-xs text-red-600">{errors.participants}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-name"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Nama Lengkap
                    </label>
                    <input
                      id="booking-name"
                      type="text"
                      required
                      placeholder="Contoh: Nadia Kartika"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                    />
                    {errors.customerName && (
                      <p className="mt-1 text-xs text-red-600">{errors.customerName}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-wa"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Nomor WhatsApp Aktif
                    </label>
                    <input
                      id="booking-wa"
                      type="tel"
                      required
                      placeholder="0812xxxxxxxx"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B] tabular-nums"
                    />
                    {errors.whatsapp && (
                      <p className="mt-1 text-xs text-red-600">{errors.whatsapp}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-email"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Email (Opsional)
                    </label>
                    <input
                      id="booking-email"
                      type="email"
                      placeholder="nama@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="booking-notes"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Catatan Kebutuhan Khusus
                    </label>
                    <textarea
                      id="booking-notes"
                      rows={2}
                      placeholder="Contoh: Request sewa alat atau preferensi makanan"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm text-[#17231D] bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                    />
                  </div>

                  <div className="pt-3 border-t border-[#E2DFD5] space-y-1.5">
                    {groupPricing.discountPercent > 0 && (
                      <>
                        <div className="flex items-center justify-between text-xs text-[#526058]">
                          <span>Subtotal Normal ({participants} org)</span>
                          <span className="line-through tabular-nums">
                            {formatIDR(groupPricing.originalSubtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold text-[#1B3B2B]">
                          <span>Diskon Rombongan (-{groupPricing.discountPercent}%)</span>
                          <span className="tabular-nums">
                            -{formatIDR(groupPricing.discountAmount)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#526058]">Estimasi Total</span>
                      <span
                        data-testid="booking-total-price"
                        className="text-lg font-bold text-[#17231D] tabular-nums"
                      >
                        {formatIDR(totalEstimatedPrice)}
                      </span>
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>
                      {submitting
                        ? 'Mengirim...'
                        : siteContent.detailBookingCtaText || 'Pesan Sekarang'}
                    </span>
                  </button>

                  <a
                    href={directWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#1B3B2B] bg-[#F6F5F0] hover:bg-[#EDEBE4] border border-[#E2DFD5] rounded-lg transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    <span>{siteContent.detailWhatsappCtaText || 'Book via WhatsApp'}</span>
                  </a>
                </form>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
