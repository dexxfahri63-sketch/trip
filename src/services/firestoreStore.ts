import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  BookingLead,
  GalleryItem,
  LandingSettings,
  LeadStatus,
  SiteContent,
  StoreDatabase,
  Testimonial,
  TourGuide,
  TripPackage,
} from '../types/trip';
import {
  db,
  FIREBASE_PROJECT_ID,
  FIRESTORE_DATABASE_ID,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';

function clampString(val: unknown, maxLen: number): string {
  const s = typeof val === 'string' ? val : String(val ?? '');
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeId(raw: string, prefix: string): string {
  const clean = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return clean || `${prefix}-${Date.now()}`;
}

export function formatFirestoreQuotaNotice(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.includes('Quota exceeded')) {
    return `Kuota harian gratis Firestore tercapai dan akan direset besok. Detail/upgrade: https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore/databases/${FIRESTORE_DATABASE_ID}/data?openUpgradeDialog=true`;
  }
  return null;
}

export function sanitizeTripForFirestore(trip: TripPackage): TripPackage {
  const id = sanitizeId(trip.id, 'trip');
  const difficulty =
    trip.difficulty === 'Santai' ||
    trip.difficulty === 'Menengah' ||
    trip.difficulty === 'Menantang'
      ? trip.difficulty
      : 'Menengah';

  return {
    id,
    slug: clampString(trip.slug || id, 160),
    title: clampString(trip.title || 'Paket Trip', 200),
    destination: clampString(trip.destination || 'Indonesia', 160),
    region: clampString(trip.region || '', 160),
    category: clampString(trip.category || 'Mountain', 80),
    durationDays: Math.min(60, Math.max(1, Number(trip.durationDays) || 1)),
    durationLabel: clampString(trip.durationLabel || '1 Hari', 80),
    pricePerPerson: Math.min(500000000, Math.max(0, Number(trip.pricePerPerson) || 0)),
    rating: Math.min(5, Math.max(0, Number(trip.rating) || 4.9)),
    reviewCount: Math.min(100000, Math.max(0, Number(trip.reviewCount) || 0)),
    difficulty,
    maxParticipants: Math.min(200, Math.max(1, Number(trip.maxParticipants) || 12)),
    nextDepartures: (Array.isArray(trip.nextDepartures) ? trip.nextDepartures : [])
      .slice(0, 24)
      .map((d) => clampString(d, 40)),
    featured: Boolean(trip.featured),
    shortDescription: clampString(trip.shortDescription || '', 2000),
    coverImage: clampString(trip.coverImage || '', 450000),
    galleryImages: (Array.isArray(trip.galleryImages) ? trip.galleryImages : [])
      .slice(0, 8)
      .map((img) => clampString(img, 450000)),
    meetingPoint: {
      location: clampString(trip.meetingPoint?.location || '', 240),
      time: clampString(trip.meetingPoint?.time || '', 60),
      notes: clampString(trip.meetingPoint?.notes || '', 600),
    },
    included: (Array.isArray(trip.included) ? trip.included : [])
      .slice(0, 40)
      .map((s) => clampString(s, 300)),
    excluded: (Array.isArray(trip.excluded) ? trip.excluded : [])
      .slice(0, 40)
      .map((s) => clampString(s, 300)),
    itinerary: (Array.isArray(trip.itinerary) ? trip.itinerary : [])
      .slice(0, 30)
      .map((day, idx) => ({
        day: Number(day.day) || idx + 1,
        title: clampString(day.title || `Hari ${idx + 1}`, 200),
        activities: (Array.isArray(day.activities) ? day.activities : [])
          .slice(0, 20)
          .map((a) => clampString(a, 300)),
        meals: clampString(day.meals || '', 120),
      })),
  };
}

export function sanitizeGuideForFirestore(guide: TourGuide): TourGuide {
  const id = sanitizeId(guide.id, 'guide');
  return {
    id,
    name: clampString(guide.name || 'Tour Guide', 120),
    specialty: clampString(guide.specialty || 'Pendamping Lapangan', 200),
    certification: clampString(guide.certification || '', 240),
    experienceYears: Math.min(80, Math.max(0, Number(guide.experienceYears) || 1)),
    tripsLed: Math.min(10000, Math.max(0, Number(guide.tripsLed) || 1)),
    bio: clampString(guide.bio || '', 1500),
  };
}

export function sanitizeGalleryForFirestore(item: GalleryItem): GalleryItem {
  const id = sanitizeId(item.id, 'gal');
  const aspectHint =
    item.aspectHint === 'portrait' ||
    item.aspectHint === 'landscape' ||
    item.aspectHint === 'square'
      ? item.aspectHint
      : 'landscape';

  return {
    id,
    title: clampString(item.title || 'Dokumentasi Trip', 200),
    caption: clampString(item.caption || '', 1500),
    destination: clampString(item.destination || 'Indonesia', 160),
    guideId: clampString(item.guideId || 'guide-default', 128),
    guideName: clampString(item.guideName || 'Tim Guide', 120),
    mediaType: item.mediaType === 'video' ? 'video' : 'photo',
    mediaUrl: clampString(item.mediaUrl || '', 450000),
    capturedDate: clampString(item.capturedDate || new Date().toISOString().slice(0, 10), 40),
    aspectHint,
  };
}

export function sanitizeTestimonialForFirestore(t: Testimonial): Testimonial {
  const id = sanitizeId(t.id, 'testi');
  return {
    id,
    name: clampString(t.name || 'Peserta', 120),
    role: clampString(t.role || '', 160),
    tripName: clampString(t.tripName || '', 200),
    rating: Math.min(5, Math.max(1, Number(t.rating) || 5)),
    quote: clampString(t.quote || '-', 1500),
    date: clampString(t.date || '', 60),
  };
}

export function sanitizeLandingForFirestore(landing: LandingSettings): LandingSettings {
  return {
    heroHeadline: clampString(landing.heroHeadline || 'DexxDigital Open Trip', 240),
    heroSubheadline: clampString(landing.heroSubheadline || '', 600),
    heroImage: clampString(landing.heroImage || '', 450000),
    heroCtaText: clampString(landing.heroCtaText || 'Jelajahi Paket Trip', 100),
    promoActive: Boolean(landing.promoActive),
    promoBadge: clampString(landing.promoBadge || '', 100),
    promoText: clampString(landing.promoText || '', 300),
    promoCode: clampString(landing.promoCode || '', 60),
    whatsappNumber: clampString(landing.whatsappNumber || '6281290008811', 30),
  };
}

export function sanitizeSiteContentForFirestore(sc: SiteContent): SiteContent {
  return {
    brandName: clampString(sc.brandName || 'DexxDigital', 120),
    headerCtaText: clampString(sc.headerCtaText || 'Pesan Trip', 80),
    navHomeLabel: clampString(sc.navHomeLabel || 'Beranda', 60),
    navCatalogLabel: clampString(sc.navCatalogLabel || 'Katalog Trip', 60),
    navGalleryLabel: clampString(sc.navGalleryLabel || 'Galeri Guide', 60),
    navWhyLabel: clampString(sc.navWhyLabel || 'Keunggulan', 60),
    heroKicker: clampString(sc.heroKicker || '', 200),
    heroSecondaryCtaText: clampString(sc.heroSecondaryCtaText || '', 100),
    searchDestinationLabel: clampString(sc.searchDestinationLabel || 'Destinasi Tujuan', 80),
    searchAllDestinationsLabel: clampString(
      sc.searchAllDestinationsLabel || 'Semua Destinasi',
      80
    ),
    searchDateLabel: clampString(sc.searchDateLabel || 'Bulan / Tanggal Berangkat', 80),
    searchDurationLabel: clampString(sc.searchDurationLabel || 'Durasi Perjalanan', 80),
    searchAllDurationsLabel: clampString(
      sc.searchAllDurationsLabel || 'Semua Durasi',
      80
    ),
    searchButtonText: clampString(sc.searchButtonText || 'Cari Trip', 60),
    popularKicker: clampString(sc.popularKicker || '', 120),
    popularTitle: clampString(sc.popularTitle || '', 200),
    popularViewAllText: clampString(sc.popularViewAllText || 'Lihat Semua Paket', 80),
    popularPricePrefix: clampString(sc.popularPricePrefix || 'Mulai dari', 60),
    whyKicker: clampString(sc.whyKicker || '', 120),
    whyTitle: clampString(sc.whyTitle || '', 200),
    whyDescription: clampString(sc.whyDescription || '', 600),
    whyMetrics: (Array.isArray(sc.whyMetrics) ? sc.whyMetrics : []).slice(0, 10),
    whyItems: (Array.isArray(sc.whyItems) ? sc.whyItems : []).slice(0, 20),
    testimonialsKicker: clampString(sc.testimonialsKicker || '', 120),
    testimonialsTitle: clampString(sc.testimonialsTitle || '', 200),
    bottomCtaTitle: clampString(sc.bottomCtaTitle || '', 200),
    bottomCtaSubtitle: clampString(sc.bottomCtaSubtitle || '', 400),
    bottomCtaButtonText: clampString(sc.bottomCtaButtonText || '', 100),
    catalogKicker: clampString(sc.catalogKicker || '', 120),
    catalogTitle: clampString(sc.catalogTitle || '', 200),
    catalogSubtitle: clampString(sc.catalogSubtitle || '', 500),
    catalogAllCategoriesLabel: clampString(sc.catalogAllCategoriesLabel || 'Semua', 60),
    catalogSearchPlaceholder: clampString(
      sc.catalogSearchPlaceholder || 'Cari gunung, pulau, atau kota...',
      120
    ),
    catalogPriceFilterLabel: clampString(
      sc.catalogPriceFilterLabel || 'Rentang Harga',
      80
    ),
    catalogAllPricesLabel: clampString(sc.catalogAllPricesLabel || 'Semua Harga', 80),
    catalogDurationFilterLabel: clampString(
      sc.catalogDurationFilterLabel || 'Durasi Trip',
      80
    ),
    catalogDateFilterLabel: clampString(
      sc.catalogDateFilterLabel || 'Bulan Keberangkatan',
      80
    ),
    catalogSortLabel: clampString(sc.catalogSortLabel || 'Urutkan', 80),
    catalogCardPriceLabel: clampString(
      sc.catalogCardPriceLabel || 'Harga per peserta',
      80
    ),
    catalogCardButtonText: clampString(sc.catalogCardButtonText || 'Detail Trip', 60),
    catalogEmptyTitle: clampString(
      sc.catalogEmptyTitle || 'Tidak Ada Paket yang Sesuai Filter',
      160
    ),
    catalogEmptySubtitle: clampString(
      sc.catalogEmptySubtitle ||
        'Coba ubah rentang harga, kategori, atau bulan keberangkatan untuk melihat jadwal trip lainnya.',
      300
    ),
    priceRanges: (Array.isArray(sc.priceRanges) ? sc.priceRanges : []).slice(0, 20),
    durationRanges: (Array.isArray(sc.durationRanges) ? sc.durationRanges : []).slice(0, 20),
    detailBackText: clampString(sc.detailBackText || 'Kembali ke Katalog Trip', 80),
    detailSummaryTitle: clampString(sc.detailSummaryTitle || 'Ringkasan Perjalanan', 120),
    detailItineraryTitle: clampString(sc.detailItineraryTitle || 'Itinerary Harian', 120),
    detailFacilitiesTitle: clampString(
      sc.detailFacilitiesTitle || 'Fasilitas Termasuk & Tidak Termasuk',
      140
    ),
    detailIncludedTitle: clampString(
      sc.detailIncludedTitle || 'Termasuk dalam Paket (Included)',
      120
    ),
    detailExcludedTitle: clampString(
      sc.detailExcludedTitle || 'Di Luar Paket (Excluded)',
      120
    ),
    detailMeetingPointTitle: clampString(
      sc.detailMeetingPointTitle || 'Informasi Meeting Point',
      120
    ),
    detailBookingCtaText: clampString(sc.detailBookingCtaText || 'Pesan Sekarang', 80),
    detailWhatsappCtaText: clampString(sc.detailWhatsappCtaText || 'Book via WhatsApp', 80),
    galleryKicker: clampString(sc.galleryKicker || '', 120),
    galleryTitle: clampString(sc.galleryTitle || '', 200),
    gallerySubtitle: clampString(sc.gallerySubtitle || '', 500),
    galleryGuidesTitle: clampString(
      sc.galleryGuidesTitle || 'Tim Tour Guide Bersertifikat',
      140
    ),
    galleryDestFilterLabel: clampString(
      sc.galleryDestFilterLabel || 'Filter Destinasi',
      80
    ),
    galleryGuideFilterLabel: clampString(
      sc.galleryGuideFilterLabel || 'Filter Tour Guide',
      80
    ),
    footerDescription: clampString(sc.footerDescription || '', 500),
    footerNavTitle: clampString(sc.footerNavTitle || 'Navigasi', 80),
    footerContactTitle: clampString(sc.footerContactTitle || 'Kontak Basecamp', 80),
    basecampAddress: clampString(sc.basecampAddress || '', 300),
    contactEmail: clampString(sc.contactEmail || '', 160),
    copyrightText: clampString(sc.copyrightText || '', 240),
    tripCategories: (Array.isArray(sc.tripCategories) ? sc.tripCategories : [])
      .slice(0, 30)
      .map((c) => clampString(c, 80)),
  };
}

export interface PublicFirestorePatch {
  trips?: TripPackage[];
  guides?: TourGuide[];
  gallery?: GalleryItem[];
  testimonials?: Testimonial[];
  landing?: LandingSettings;
  siteContent?: SiteContent;
}

export function subscribePublicFirestoreStore(
  onPatch: (patch: PublicFirestorePatch) => void,
  onSyncMeta?: (meta: { hasAnyDoc: boolean }) => void
): () => void {
  const unsubscribers: Unsubscribe[] = [];
  let hasTripsDoc = false;
  let hasContentDoc = false;

  const notifyMeta = () => {
    onSyncMeta?.({ hasAnyDoc: hasTripsDoc || hasContentDoc });
  };

  unsubscribers.push(
    onSnapshot(
      collection(db, 'trips'),
      (snap) => {
        if (!snap.empty) {
          hasTripsDoc = true;
          onPatch({ trips: snap.docs.map((d) => d.data() as TripPackage) });
        }
        notifyMeta();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'trips');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, 'guides'),
      (snap) => {
        if (!snap.empty) {
          onPatch({ guides: snap.docs.map((d) => d.data() as TourGuide) });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'guides');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, 'gallery'),
      (snap) => {
        if (!snap.empty) {
          onPatch({ gallery: snap.docs.map((d) => d.data() as GalleryItem) });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'gallery');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, 'testimonials'),
      (snap) => {
        if (!snap.empty) {
          onPatch({ testimonials: snap.docs.map((d) => d.data() as Testimonial) });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'testimonials');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      doc(db, 'siteSettings', 'landing'),
      (snap) => {
        if (snap.exists()) {
          onPatch({ landing: snap.data() as LandingSettings });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'siteSettings/landing');
      }
    )
  );

  unsubscribers.push(
    onSnapshot(
      doc(db, 'siteSettings', 'content'),
      (snap) => {
        if (snap.exists()) {
          hasContentDoc = true;
          onPatch({ siteContent: snap.data() as SiteContent });
        }
        notifyMeta();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'siteSettings/content');
      }
    )
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}

export function subscribeLeadsFromFirestore(
  onLeads: (leads: BookingLead[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'leads'),
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<BookingLead, 'createdAt'> & {
            createdAt?: Timestamp | string;
          };
          const createdAtStr =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : typeof data.createdAt === 'string'
                ? data.createdAt
                : new Date().toISOString();
          return {
            ...data,
            id: d.id,
            createdAt: createdAtStr,
          } as BookingLead;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onLeads(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    }
  );
}

export async function isFirestoreStoreSeeded(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, 'trips'));
    return !snap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'trips');
  }
}

export async function seedStoreToFirestore(store: StoreDatabase): Promise<void> {
  const batch = writeBatch(db);

  for (const trip of store.trips) {
    const clean = sanitizeTripForFirestore(trip);
    batch.set(doc(db, 'trips', clean.id), clean);
  }
  for (const guide of store.guides) {
    const clean = sanitizeGuideForFirestore(guide);
    batch.set(doc(db, 'guides', clean.id), clean);
  }
  for (const item of store.gallery) {
    const clean = sanitizeGalleryForFirestore(item);
    batch.set(doc(db, 'gallery', clean.id), clean);
  }
  for (const testi of store.testimonials) {
    const clean = sanitizeTestimonialForFirestore(testi);
    batch.set(doc(db, 'testimonials', clean.id), clean);
  }
  batch.set(
    doc(db, 'siteSettings', 'landing'),
    sanitizeLandingForFirestore(store.landing)
  );
  batch.set(
    doc(db, 'siteSettings', 'content'),
    sanitizeSiteContentForFirestore(store.siteContent)
  );

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-seed');
  }
}

export async function saveTripToFirestore(trip: TripPackage): Promise<TripPackage> {
  const clean = sanitizeTripForFirestore(trip);
  const path = `trips/${clean.id}`;
  try {
    await setDoc(doc(db, 'trips', clean.id), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTripFromFirestore(tripId: string): Promise<void> {
  const path = `trips/${tripId}`;
  try {
    await deleteDoc(doc(db, 'trips', tripId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveGuideToFirestore(guide: TourGuide): Promise<TourGuide> {
  const clean = sanitizeGuideForFirestore(guide);
  const path = `guides/${clean.id}`;
  try {
    await setDoc(doc(db, 'guides', clean.id), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGuideFromFirestore(guideId: string): Promise<void> {
  const path = `guides/${guideId}`;
  try {
    await deleteDoc(doc(db, 'guides', guideId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveGalleryItemToFirestore(item: GalleryItem): Promise<GalleryItem> {
  const clean = sanitizeGalleryForFirestore(item);
  const path = `gallery/${clean.id}`;
  try {
    await setDoc(doc(db, 'gallery', clean.id), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGalleryItemFromFirestore(itemId: string): Promise<void> {
  const path = `gallery/${itemId}`;
  try {
    await deleteDoc(doc(db, 'gallery', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTestimonialToFirestore(t: Testimonial): Promise<Testimonial> {
  const clean = sanitizeTestimonialForFirestore(t);
  const path = `testimonials/${clean.id}`;
  try {
    await setDoc(doc(db, 'testimonials', clean.id), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTestimonialFromFirestore(id: string): Promise<void> {
  const path = `testimonials/${id}`;
  try {
    await deleteDoc(doc(db, 'testimonials', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveLandingToFirestore(
  landing: LandingSettings
): Promise<LandingSettings> {
  const clean = sanitizeLandingForFirestore(landing);
  const path = 'siteSettings/landing';
  try {
    await setDoc(doc(db, 'siteSettings', 'landing'), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSiteContentToFirestore(
  siteContent: SiteContent
): Promise<SiteContent> {
  const clean = sanitizeSiteContentForFirestore(siteContent);
  const path = 'siteSettings/content';
  try {
    await setDoc(doc(db, 'siteSettings', 'content'), clean);
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createLeadInFirestore(input: {
  id: string;
  tripId: string;
  tripTitle: string;
  customerName: string;
  whatsapp: string;
  email: string;
  departureDate: string;
  participants: number;
  totalEstimatedPrice: number;
  notes: string;
}): Promise<BookingLead> {
  const cleanId = sanitizeId(input.id, 'lead');
  const path = `leads/${cleanId}`;
  const payload = {
    id: cleanId,
    tripId: clampString(input.tripId || 'custom', 128),
    tripTitle: clampString(input.tripTitle || 'Open Trip', 200),
    customerName: clampString(input.customerName.trim(), 120),
    whatsapp: clampString(input.whatsapp.trim(), 30),
    email: clampString((input.email || '').trim(), 120),
    departureDate: clampString(input.departureDate || '', 40),
    participants: Math.min(30, Math.max(1, Number(input.participants) || 1)),
    totalEstimatedPrice: Math.min(
      2000000000,
      Math.max(0, Number(input.totalEstimatedPrice) || 0)
    ),
    notes: clampString((input.notes || '').trim(), 1000),
    status: 'Baru' as LeadStatus,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'leads', cleanId), payload);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLeadStatusInFirestore(
  leadId: string,
  status: LeadStatus
): Promise<void> {
  const path = `leads/${leadId}`;
  try {
    await updateDoc(doc(db, 'leads', leadId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  const path = `leads/${leadId}`;
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
