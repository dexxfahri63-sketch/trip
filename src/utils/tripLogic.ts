import type {
  DurationRangeOption,
  GalleryItem,
  GroupDiscountTier,
  PriceRangeOption,
  TripCategory,
  TripPackage,
} from '../types/trip';

export const DEFAULT_TRIP_CATEGORIES = ['Mountain', 'Island', 'City Tour'];

export const DEFAULT_PRICE_RANGES: PriceRangeOption[] = [
  { id: 'under2m', label: 'Di bawah Rp 2.000.000', minPrice: null, maxPrice: 1999999 },
  { id: '2to5m', label: 'Rp 2.000.000 – Rp 5.000.000', minPrice: 2000000, maxPrice: 5000000 },
  { id: 'over5m', label: 'Di atas Rp 5.000.000', minPrice: 5000001, maxPrice: null },
];

export const DEFAULT_DURATION_RANGES: DurationRangeOption[] = [
  { id: '1to2', label: '1 – 2 Hari', minDays: 1, maxDays: 2 },
  { id: '3to4', label: '3 – 4 Hari', minDays: 3, maxDays: 4 },
  { id: '5plus', label: '5+ Hari', minDays: 5, maxDays: null },
];

export const DEFAULT_GROUP_DISCOUNTS: GroupDiscountTier[] = [
  { id: 'grp-5', minParticipants: 5, discountPercent: 10, label: 'Hemat Rombongan Kecil' },
  { id: 'grp-10', minParticipants: 10, discountPercent: 15, label: 'Hemat Rombongan Besar' },
];

export const RECENT_SEARCHES_STORAGE_KEY = 'dexxdigital_recent_searches';

export function getAvailableTripCategories(
  trips: TripPackage[],
  configuredCategories?: string[]
): string[] {
  const base =
    Array.isArray(configuredCategories) && configuredCategories.length > 0
      ? configuredCategories
      : DEFAULT_TRIP_CATEGORIES;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of [...base, ...trips.map((t) => t.category)]) {
    const clean = (raw || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

export interface TripFilterCriteria {
  query?: string;
  destination?: string;
  date?: string;
  category?: 'Semua' | TripCategory;
  priceRange?: string;
  durationRange?: string;
  sortBy?: 'popular' | 'price-asc' | 'price-desc' | 'rating';
}

export interface BookingValidationInput {
  customerName: string;
  whatsapp: string;
  email?: string;
  departureDate: string;
  participants: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function calculateTotalPrice(
  pricePerPerson: number,
  participants: number,
  discountPercent = 0
): number {
  const safePrice = Math.max(0, pricePerPerson);
  const safePax = Math.max(1, Math.floor(participants));
  const safeDiscount = Math.min(100, Math.max(0, discountPercent));
  const subtotal = safePrice * safePax;
  return Math.round(subtotal * (1 - safeDiscount / 100));
}

export function normalizeGroupDiscountTiers(
  tiers?: GroupDiscountTier[]
): GroupDiscountTier[] {
  const source = tiers === undefined ? DEFAULT_GROUP_DISCOUNTS : tiers;
  if (!Array.isArray(source)) return [];

  const byThreshold = new Map<number, GroupDiscountTier>();
  for (let i = 0; i < source.length; i += 1) {
    const raw = source[i];
    if (!raw) continue;
    const minPax = Math.floor(Number(raw.minParticipants));
    const discPct = Math.round(Number(raw.discountPercent));
    if (!Number.isFinite(minPax) || minPax < 2 || !Number.isFinite(discPct) || discPct <= 0) {
      continue;
    }
    const clampedMin = Math.min(100, minPax);
    const clampedDisc = Math.min(90, Math.max(1, discPct));
    const existing = byThreshold.get(clampedMin);
    if (!existing || clampedDisc > existing.discountPercent) {
      byThreshold.set(clampedMin, {
        id: (raw.id || `grp-${clampedMin}-${i}`).trim(),
        minParticipants: clampedMin,
        discountPercent: clampedDisc,
        label: (raw.label || '').trim(),
      });
    }
  }

  return Array.from(byThreshold.values()).sort(
    (a, b) => a.minParticipants - b.minParticipants
  );
}

export function resolveGroupDiscount(
  participants: number,
  tiers?: GroupDiscountTier[]
): {
  appliedTier: GroupDiscountTier | null;
  discountPercent: number;
  nextTier: GroupDiscountTier | null;
  tiers: GroupDiscountTier[];
} {
  const normalized = normalizeGroupDiscountTiers(tiers);
  const safePax = Math.max(1, Math.floor(Number(participants) || 1));

  let appliedTier: GroupDiscountTier | null = null;
  let nextTier: GroupDiscountTier | null = null;

  for (const tier of normalized) {
    if (safePax >= tier.minParticipants) {
      appliedTier = tier;
    } else if (!nextTier) {
      nextTier = tier;
    }
  }

  return {
    appliedTier,
    discountPercent: appliedTier ? appliedTier.discountPercent : 0,
    nextTier,
    tiers: normalized,
  };
}

export function calculateGroupPricing(
  pricePerPerson: number,
  participants: number,
  tiers?: GroupDiscountTier[]
): {
  unitPrice: number;
  originalSubtotal: number;
  discountPercent: number;
  discountAmount: number;
  totalPrice: number;
  discountedUnitPrice: number;
  appliedTier: GroupDiscountTier | null;
  nextTier: GroupDiscountTier | null;
  tiers: GroupDiscountTier[];
} {
  const safePrice = Math.max(0, Number(pricePerPerson) || 0);
  const safePax = Math.max(1, Math.floor(Number(participants) || 1));
  const originalSubtotal = Math.round(safePrice * safePax);
  const { appliedTier, discountPercent, nextTier, tiers: normalizedTiers } =
    resolveGroupDiscount(safePax, tiers);
  const totalPrice = calculateTotalPrice(safePrice, safePax, discountPercent);
  const discountAmount = Math.max(0, originalSubtotal - totalPrice);
  const discountedUnitPrice = Math.round(totalPrice / safePax);

  return {
    unitPrice: safePrice,
    originalSubtotal,
    discountPercent,
    discountAmount,
    totalPrice,
    discountedUnitPrice,
    appliedTier,
    nextTier,
    tiers: normalizedTiers,
  };
}

export function addRecentSearchQuery(
  existing: string[],
  query: string,
  limit = 3
): string[] {
  const clean = (query || '').trim();
  if (!clean) return existing.slice(0, limit);
  const deduped = existing.filter(
    (item) => item.trim().toLowerCase() !== clean.toLowerCase()
  );
  return [clean, ...deduped].slice(0, Math.max(1, limit));
}

export function loadRecentSearches(
  storageKey = RECENT_SEARCHES_STORAGE_KEY,
  limit = 3
): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const clean = item.trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
      }
      if (result.length >= limit) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function saveRecentSearches(
  queries: string[],
  storageKey = RECENT_SEARCHES_STORAGE_KEY,
  limit = 3
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = queries
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, limit);
    window.localStorage.setItem(storageKey, JSON.stringify(clean));
  } catch {
    // Ignore storage quota or SSR access errors
  }
}

export function clearRecentSearches(
  storageKey = RECENT_SEARCHES_STORAGE_KEY
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage access errors
  }
}

export function filterTrips(
  trips: TripPackage[],
  criteria: TripFilterCriteria,
  rangeConfig?: {
    priceRanges?: PriceRangeOption[];
    durationRanges?: DurationRangeOption[];
  }
): TripPackage[] {
  const q = (criteria.query || '').trim().toLowerCase();
  const dest = (criteria.destination || '').trim().toLowerCase();
  const dateFilter = (criteria.date || '').trim();
  const category = criteria.category || 'Semua';
  const priceRangeId = criteria.priceRange || 'all';
  const durationRangeId = criteria.durationRange || 'all';
  const sortBy = criteria.sortBy || 'popular';

  const priceRanges =
    rangeConfig?.priceRanges && rangeConfig.priceRanges.length > 0
      ? rangeConfig.priceRanges
      : DEFAULT_PRICE_RANGES;
  const durationRanges =
    rangeConfig?.durationRanges && rangeConfig.durationRanges.length > 0
      ? rangeConfig.durationRanges
      : DEFAULT_DURATION_RANGES;

  const activePrice =
    priceRangeId !== 'all' ? priceRanges.find((p) => p.id === priceRangeId) : undefined;
  const activeDuration =
    durationRangeId !== 'all'
      ? durationRanges.find((d) => d.id === durationRangeId)
      : undefined;

  const filtered = trips.filter((trip) => {
    if (q) {
      const haystack = `${trip.title} ${trip.destination} ${trip.region} ${trip.shortDescription}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (dest && dest !== 'semua') {
      const destHaystack = `${trip.destination} ${trip.region} ${trip.title}`.toLowerCase();
      if (!destHaystack.includes(dest)) return false;
    }

    if (dateFilter) {
      const targetMonth = dateFilter.slice(0, 7);
      const hasMatchingDeparture = trip.nextDepartures.some(
        (d) => d === dateFilter || d.startsWith(targetMonth)
      );
      if (!hasMatchingDeparture) return false;
    }

    if (
      category !== 'Semua' &&
      trip.category.trim().toLowerCase() !== category.trim().toLowerCase()
    ) {
      return false;
    }

    if (activePrice) {
      if (activePrice.minPrice != null && trip.pricePerPerson < activePrice.minPrice) {
        return false;
      }
      if (activePrice.maxPrice != null && trip.pricePerPerson > activePrice.maxPrice) {
        return false;
      }
    }

    if (activeDuration) {
      if (activeDuration.minDays != null && trip.durationDays < activeDuration.minDays) {
        return false;
      }
      if (activeDuration.maxDays != null && trip.durationDays > activeDuration.maxDays) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  if (sortBy === 'price-asc') {
    sorted.sort((a, b) => a.pricePerPerson - b.pricePerPerson);
  } else if (sortBy === 'price-desc') {
    sorted.sort((a, b) => b.pricePerPerson - a.pricePerPerson);
  } else if (sortBy === 'rating') {
    sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  } else {
    sorted.sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        b.reviewCount - a.reviewCount
    );
  }

  return sorted;
}

export function filterGalleryItems(
  items: GalleryItem[],
  destinationFilter: string,
  guideFilter: string
): GalleryItem[] {
  return items.filter((item) => {
    const matchDest =
      !destinationFilter ||
      destinationFilter === 'Semua' ||
      item.destination.toLowerCase() === destinationFilter.toLowerCase();
    const matchGuide =
      !guideFilter ||
      guideFilter === 'Semua' ||
      item.guideId === guideFilter ||
      item.guideName.toLowerCase() === guideFilter.toLowerCase();
    return matchDest && matchGuide;
  });
}

export function validateBookingInput(
  input: BookingValidationInput
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.customerName = 'Nama lengkap minimal 2 karakter.';
  }

  const digits = (input.whatsapp || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    errors.whatsapp = 'Nomor WhatsApp harus berisi 9–15 digit angka.';
  }

  if (input.email && input.email.trim().length > 0) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim());
    if (!emailOk) {
      errors.email = 'Format alamat email tidak valid.';
    }
  }

  if (!input.departureDate || input.departureDate.trim().length === 0) {
    errors.departureDate = 'Pilih tanggal keberangkatan terlebih dahulu.';
  }

  if (!Number.isFinite(input.participants) || input.participants < 1 || input.participants > 30) {
    errors.participants = 'Jumlah peserta antara 1 sampai 30 orang.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildWhatsAppBookingUrl(
  operatorPhone: string,
  params: {
    tripTitle: string;
    customerName: string;
    departureDate: string;
    participants: number;
    totalEstimatedPrice: number;
    discountPercent?: number;
    notes?: string;
  }
): string {
  const cleanPhone = operatorPhone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('0')
    ? `62${cleanPhone.slice(1)}`
    : cleanPhone;

  const lines = [
    `Halo Tim DexxDigital, saya ingin memesan paket Open Trip:`,
    `- Paket: ${params.tripTitle}`,
    `- Nama: ${params.customerName}`,
    `- Tanggal Keberangkatan: ${params.departureDate}`,
    `- Jumlah Peserta: ${params.participants} orang`,
  ];

  if (params.discountPercent && params.discountPercent > 0) {
    lines.push(`- Diskon Rombongan: Hemat ${params.discountPercent}%`);
  }

  lines.push(`- Estimasi Total: ${formatIDR(params.totalEstimatedPrice)}`);

  if (params.notes && params.notes.trim()) {
    lines.push(`- Catatan: ${params.notes.trim()}`);
  }

  lines.push('Mohon informasi ketersediaan kuota dan instruksi pembayaran. Terima kasih.');

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function slugifyTripTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function validatePinChangeInput(input: {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.currentPin || input.currentPin.trim().length === 0) {
    errors.currentPin = 'PIN atau kata sandi saat ini wajib diisi.';
  }

  if (!input.newPin || input.newPin.trim().length < 4) {
    errors.newPin = 'PIN atau kata sandi baru minimal 4 karakter.';
  }

  if (input.newPin !== input.confirmPin) {
    errors.confirmPin = 'Konfirmasi PIN atau kata sandi baru tidak cocok.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function splitCopyrightTrigger(copyrightText: string): {
  triggerText: string;
  restText: string;
} {
  const clean = (copyrightText || '').trim();
  if (!clean) {
    return {
      triggerText: '© 2026',
      restText: ' DexxDigital Open Trip & Tour Operator.',
    };
  }
  const match = clean.match(/^(©\s*\d{4})(.*)$/);
  if (match) {
    return {
      triggerText: match[1],
      restText: match[2],
    };
  }
  return {
    triggerText: '© 2026',
    restText: ` ${clean}`,
  };
}

