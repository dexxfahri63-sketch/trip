import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Camera,
  Check,
  Cloud,
  Download,
  Edit3,
  FileText,
  Inbox,
  KeyRound,
  LayoutTemplate,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  BookingLead,
  ClientLogoItem,
  DifficultyLevel,
  DurationRangeOption,
  GalleryItem,
  GroupDiscountTier,
  ItineraryDay,
  LandingSettings,
  LeadStatus,
  MediaType,
  PriceRangeOption,
  SiteContent,
  StoreDatabase,
  Testimonial,
  TourGuide,
  TripPackage,
  WhyChooseItem,
  WhyIconKey,
} from '../types/trip';
import {
  DEFAULT_DURATION_RANGES,
  DEFAULT_GROUP_DISCOUNTS,
  DEFAULT_PRICE_RANGES,
  buildWhatsAppBookingUrl,
  formatIDR,
  getAvailableTripCategories,
  slugifyTripTitle,
  validatePinChangeInput,
} from '../utils/tripLogic';
import { FIREBASE_PROJECT_ID } from '../lib/firebase';
import {
  deleteGalleryItemFromFirestore,
  deleteGuideFromFirestore,
  deleteLeadFromFirestore,
  deleteTestimonialFromFirestore,
  deleteTripFromFirestore,
  formatFirestoreQuotaNotice,
  saveGalleryItemToFirestore,
  saveGuideToFirestore,
  saveLandingToFirestore,
  saveSiteContentToFirestore,
  saveTestimonialToFirestore,
  saveTripToFirestore,
  seedStoreToFirestore,
  updateLeadStatusInFirestore,
} from '../services/firestoreStore';
import { ResilientImage } from './ResilientImage';

function normalizeSiteContentDraft(sc: SiteContent): SiteContent {
  return {
    ...sc,
    brandLogoUrl: sc.brandLogoUrl || '/logo-dexxdigital.svg',
    clientsKicker: sc.clientsKicker || 'Dipercaya Klien & Mitra Ekspedisi',
    clientsTitle:
      sc.clientsTitle || 'Komunitas & Perusahaan yang Telah Berangkat Bersama Kami',
    clientLogos: Array.isArray(sc.clientLogos) ? structuredClone(sc.clientLogos) : [],
    priceRanges:
      sc.priceRanges && sc.priceRanges.length > 0
        ? structuredClone(sc.priceRanges)
        : structuredClone(DEFAULT_PRICE_RANGES),
    durationRanges:
      sc.durationRanges && sc.durationRanges.length > 0
        ? structuredClone(sc.durationRanges)
        : structuredClone(DEFAULT_DURATION_RANGES),
    groupDiscounts:
      sc.groupDiscounts !== undefined
        ? structuredClone(sc.groupDiscounts)
        : structuredClone(DEFAULT_GROUP_DISCOUNTS),
  };
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) {
        reject(new Error('File gambar kosong.'));
        return;
      }
      // Compress raster photos (> 200 KB) so documents stay safely under Firestore 1 MB / 450 KB rule limits
      if (file.size <= 200 * 1024 || file.type === 'image/svg+xml') {
        resolve(rawUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let compressed = canvas.toDataURL('image/jpeg', 0.78);
        if (compressed.length > 430000) {
          compressed = canvas.toDataURL('image/jpeg', 0.62);
        }
        resolve(compressed);
      };
      img.onerror = () => resolve(rawUrl);
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

type AdminTab =
  | 'leads'
  | 'trips'
  | 'gallery'
  | 'guides_testi'
  | 'site_content'
  | 'landing'
  | 'security';

interface AdminDashboardPageProps {
  store: StoreDatabase;
  adminToken: string;
  isFirebaseAdmin: boolean;
  firebaseEmail: string | null;
  onConnectGoogleAdmin: () => Promise<void>;
  onExitAdmin: () => void;
  onLogout: () => void;
  onAuthExpired: () => void;
  onStoreChange: React.Dispatch<React.SetStateAction<StoreDatabase>>;
}

const LEAD_STATUSES: LeadStatus[] = [
  'Baru',
  'Dihubungi',
  'Confirmed',
  'Selesai',
  'Dibatalkan',
];

const STATUS_STYLE: Record<LeadStatus, string> = {
  Baru: 'bg-amber-50 text-amber-800 border-amber-200',
  Dihubungi: 'bg-sky-50 text-sky-800 border-sky-200',
  Confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Selesai: 'bg-[#EDEBE4] text-[#17231D] border-[#E2DFD5]',
  Dibatalkan: 'bg-red-50 text-red-700 border-red-200',
};

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  store,
  adminToken,
  isFirebaseAdmin,
  firebaseEmail,
  onConnectGoogleAdmin,
  onExitAdmin,
  onLogout,
  onAuthExpired,
  onStoreChange,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('leads');
  const [notice, setNotice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // Leads filters
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'Semua' | LeadStatus>('Semua');

  // Trip Editor Modal & Category Management state
  const [editingTrip, setEditingTrip] = useState<TripPackage | null>(null);
  const [isNewTrip, setIsNewTrip] = useState(false);
  const [newGalleryPhotoUrl, setNewGalleryPhotoUrl] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [savingCategories, setSavingCategories] = useState(false);

  const availableCategories = getAvailableTripCategories(
    store.trips,
    store.siteContent.tripCategories
  );

  // Gallery Form state
  const [galleryFormOpen, setGalleryFormOpen] = useState(false);
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [galTitle, setGalTitle] = useState('');
  const [galCaption, setGalCaption] = useState('');
  const [galDestination, setGalDestination] = useState('Gunung Rinjani');
  const [galGuideId, setGalGuideId] = useState(store.guides[0]?.id || 'guide-raka');
  const [galMediaType, setGalMediaType] = useState<MediaType>('photo');
  const [galMediaUrl, setGalMediaUrl] = useState('');
  const [galAspect, setGalAspect] = useState<'portrait' | 'landscape'>('landscape');

  // Guide Form state
  const [guideFormOpen, setGuideFormOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<TourGuide | null>(null);

  // Testimonial Form state
  const [testiFormOpen, setTestiFormOpen] = useState(false);
  const [editingTesti, setEditingTesti] = useState<Testimonial | null>(null);

  // Landing Settings Form state
  const [landingDraft, setLandingDraft] = useState<LandingSettings>(store.landing);
  const [savingLanding, setSavingLanding] = useState(false);

  // SiteContent Form state (Semua Teks Web, Katalog, Harga, Durasi, Keunggulan, Kontak Basecamp)
  const [siteDraft, setSiteDraft] = useState<SiteContent>(() =>
    normalizeSiteContentDraft(store.siteContent)
  );
  const [savingSite, setSavingSite] = useState(false);

  // Security PIN Change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-token': adminToken,
  });

  const handleFetchError = async (res: Response, fallbackMsg: string) => {
    if (res.status === 401) {
      onAuthExpired();
      throw new Error('Sesi pengelola berakhir. Silakan masuk ulang.');
    }
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || fallbackMsg);
  };

  // Load private leads list from local server when PIN token is present
  useEffect(() => {
    if (!adminToken) return;
    let active = true;
    fetch('/api/leads', { headers: { 'x-admin-token': adminToken } })
      .then(async (res) => {
        if (res.status === 401) {
          onAuthExpired();
          return null;
        }
        if (!res.ok) return null;
        return res.json() as Promise<BookingLead[]>;
      })
      .then((leads) => {
        if (active && leads && !isFirebaseAdmin) {
          onStoreChange((prev) => ({ ...prev, leads }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, isFirebaseAdmin]);

  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setErrorMsg('');
    setNotice(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setNotice('');
      toastTimerRef.current = null;
    }, 3500);
  };

  const showError = (msg: string) => {
    setNotice('');
    setErrorMsg(msg);
  };

  const extractErrorMessage = (err: unknown, fallback: string) => {
    const quota = formatFirestoreQuotaNotice(err);
    if (quota) return quota;
    return err instanceof Error ? err.message : fallback;
  };

  const handleConnectGoogleClick = async () => {
    setConnectingGoogle(true);
    setErrorMsg('');
    try {
      await onConnectGoogleAdmin();
      showToast(`Terhubung ke Google Admin. Sinkronisasi Cloud Firestore (${FIREBASE_PROJECT_ID}) aktif.`);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Gagal menghubungkan akun Google Admin.');
      if (!msg.includes('popup-closed-by-user')) {
        showError(msg);
      }
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleSyncAllToFirebase = async () => {
    if (!isFirebaseAdmin) {
      await handleConnectGoogleClick();
      return;
    }
    setSyncingFirebase(true);
    try {
      await seedStoreToFirestore(store);
      showToast(`Seluruh katalog, galeri, guide, testimoni & pengaturan disinkronkan ke Firebase (${FIREBASE_PROJECT_ID}).`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyinkronkan data ke Firebase.'));
    } finally {
      setSyncingFirebase(false);
    }
  };

  // --- LEADS HANDLERS ---
  const filteredLeads = store.leads.filter((lead) => {
    const matchStatus =
      leadStatusFilter === 'Semua' || lead.status === leadStatusFilter;
    const q = leadSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      lead.customerName.toLowerCase().includes(q) ||
      lead.tripTitle.toLowerCase().includes(q) ||
      lead.whatsapp.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleUpdateLeadStatus = async (leadId: string, status: LeadStatus) => {
    try {
      if (isFirebaseAdmin) {
        await updateLeadStatusInFirestore(leadId, status);
      }
      let updatedLead = store.leads.find((l) => l.id === leadId);
      if (adminToken) {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status }),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal memperbarui status pesanan.');
        } else if (res.ok) {
          updatedLead = (await res.json()) as BookingLead;
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId ? { ...(updatedLead || l), status } : l
        ),
      }));
      showToast(
        `Status pesanan ${updatedLead?.customerName || leadId} diubah ke ${status}.`
      );
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal memperbarui status.'));
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      if (isFirebaseAdmin) {
        await deleteLeadFromFirestore(leadId);
      }
      if (adminToken) {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus pesanan.');
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        leads: prev.leads.filter((l) => l.id !== leadId),
      }));
      showToast('Data pesanan dihapus.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus data.'));
    }
  };

  const handleExportLeadsCsv = () => {
    const header = [
      'ID',
      'Nama Pelanggan',
      'WhatsApp',
      'Email',
      'Paket Trip',
      'Tanggal Berangkat',
      'Peserta',
      'Estimasi Total',
      'Status',
      'Catatan',
    ];
    const rows = filteredLeads.map((l) => [
      l.id,
      l.customerName,
      l.whatsapp,
      l.email,
      l.tripTitle,
      l.departureDate,
      String(l.participants),
      String(l.totalEstimatedPrice),
      l.status,
      l.notes.replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dexxdigital-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- TRIP CRUD & CATEGORY HANDLERS ---
  const openCreateTrip = () => {
    setIsNewTrip(true);
    setNewGalleryPhotoUrl('');
    setEditingTrip({
      id: '',
      slug: '',
      title: '',
      destination: '',
      region: '',
      category: '',
      durationDays: 3,
      durationLabel: '3 Hari 2 Malam',
      pricePerPerson: 2250000,
      rating: 4.9,
      reviewCount: 1,
      difficulty: 'Menengah',
      maxParticipants: 12,
      nextDepartures: ['2026-12-20'],
      featured: true,
      shortDescription: '',
      coverImage: '',
      galleryImages: [],
      meetingPoint: {
        location: '',
        time: '07:00 WIB',
        notes: '',
      },
      included: ['Tour guide bersertifikat', 'Transportasi lokal'],
      excluded: ['Tiket pesawat PP'],
      itinerary: [
        {
          day: 1,
          title: 'Kedatangan & Briefing Tim',
          activities: ['Penjemputan di meeting point', 'Persiapan peralatan'],
          meals: 'Makan Malam',
        },
      ],
    });
  };

  const openEditTrip = (trip: TripPackage) => {
    setIsNewTrip(false);
    setNewGalleryPhotoUrl('');
    setEditingTrip(structuredClone(trip));
  };

  const handleTripCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTrip) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setEditingTrip((prev) => {
        if (!prev) return prev;
        const others = prev.galleryImages.filter(
          (img) => img !== prev.coverImage && img !== dataUrl
        );
        return {
          ...prev,
          coverImage: dataUrl,
          galleryImages: [dataUrl, ...others],
        };
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memuat foto sampul.');
    } finally {
      e.target.value = '';
    }
  };

  const handleTripGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTrip) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setEditingTrip((prev) =>
        prev ? { ...prev, galleryImages: [...prev.galleryImages, dataUrl] } : prev
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memuat foto galeri.');
    } finally {
      e.target.value = '';
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setLandingDraft((prev) => ({ ...prev, heroImage: dataUrl }));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memuat gambar hero.');
    } finally {
      e.target.value = '';
    }
  };

  const handleAddCategoryPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryInput.trim();
    if (!clean) return;
    if (availableCategories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      showError(`Kategori "${clean}" sudah tersedia.`);
      return;
    }
    const nextCategories = [...availableCategories, clean];
    setSavingCategories(true);
    try {
      const nextSiteContent: SiteContent = {
        ...store.siteContent,
        tripCategories: nextCategories,
      };
      let saved: SiteContent = nextSiteContent;
      if (isFirebaseAdmin) {
        saved = await saveSiteContentToFirestore(nextSiteContent);
      }
      if (adminToken) {
        const res = await fetch('/api/site-content', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menambahkan kategori.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as SiteContent;
        }
      }
      onStoreChange((prev) => ({ ...prev, siteContent: saved }));
      setSiteDraft(normalizeSiteContentDraft(saved));
      setNewCategoryInput('');
      showToast(`Kategori "${clean}" ditambahkan ke daftar.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan kategori.'));
    } finally {
      setSavingCategories(false);
    }
  };

  const handleRemoveCategoryPreset = async (catToRemove: string) => {
    const isUsedByTrip = store.trips.some(
      (t) => t.category.trim().toLowerCase() === catToRemove.trim().toLowerCase()
    );
    if (isUsedByTrip) {
      showError(
        `Kategori "${catToRemove}" sedang dipakai oleh paket trip. Ubah kategori paket tersebut terlebih dahulu sebelum menghapus.`
      );
      return;
    }
    if (availableCategories.length <= 1) {
      showError('Minimal harus tersedia 1 kategori trip.');
      return;
    }
    const nextCategories = availableCategories.filter(
      (c) => c.toLowerCase() !== catToRemove.toLowerCase()
    );
    setSavingCategories(true);
    try {
      const nextSiteContent: SiteContent = {
        ...store.siteContent,
        tripCategories: nextCategories,
      };
      let saved: SiteContent = nextSiteContent;
      if (isFirebaseAdmin) {
        saved = await saveSiteContentToFirestore(nextSiteContent);
      }
      if (adminToken) {
        const res = await fetch('/api/site-content', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus kategori.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as SiteContent;
        }
      }
      onStoreChange((prev) => ({ ...prev, siteContent: saved }));
      setSiteDraft(normalizeSiteContentDraft(saved));
      showToast(`Kategori "${catToRemove}" dihapus.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus kategori.'));
    } finally {
      setSavingCategories(false);
    }
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip) return;

    const finalCategory = editingTrip.category.trim();

    if (!editingTrip.title.trim() || !editingTrip.destination.trim() || !finalCategory) {
      showError('Nama paket, destinasi, dan kategori trip wajib diisi.');
      return;
    }

    const coverUrl = editingTrip.coverImage.trim();
    const mergedGallery =
      editingTrip.galleryImages.length > 0
        ? coverUrl && !editingTrip.galleryImages.includes(coverUrl)
          ? [coverUrl, ...editingTrip.galleryImages]
          : editingTrip.galleryImages
        : coverUrl
          ? [coverUrl]
          : [];

    const tripId = isNewTrip ? editingTrip.id || `trip-${Date.now()}` : editingTrip.id;
    const payload: TripPackage = {
      ...editingTrip,
      id: tripId,
      category: finalCategory,
      coverImage: coverUrl,
      slug: editingTrip.slug || slugifyTripTitle(editingTrip.title),
      galleryImages: mergedGallery,
    };

    try {
      let saved: TripPackage = payload;
      if (isFirebaseAdmin) {
        saved = await saveTripToFirestore(payload);
      }
      if (adminToken) {
        const url = isNewTrip ? '/api/trips' : `/api/trips/${tripId}`;
        const method = isNewTrip ? 'POST' : 'PUT';
        const res = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan paket trip.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as TripPackage;
        }
      }

      const nextTrips = isNewTrip
        ? [saved, ...store.trips.filter((t) => t.id !== saved.id)]
        : store.trips.map((t) => (t.id === saved.id ? saved : t));

      const currentCats = store.siteContent.tripCategories || availableCategories;
      const hasCat = currentCats.some(
        (c) => c.toLowerCase() === saved.category.toLowerCase()
      );
      const nextSiteContent = hasCat
        ? store.siteContent
        : {
            ...store.siteContent,
            tripCategories: [...currentCats, saved.category],
          };

      if (!hasCat && isFirebaseAdmin) {
        await saveSiteContentToFirestore(nextSiteContent);
      }

      onStoreChange((prev) => ({ ...prev, trips: nextTrips, siteContent: nextSiteContent }));
      setSiteDraft(normalizeSiteContentDraft(nextSiteContent));
      setEditingTrip(null);
      showToast(
        isNewTrip
          ? `Paket "${saved.title}" berhasil ditambahkan.`
          : `Paket "${saved.title}" diperbarui.`
      );
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan paket.'));
    }
  };

  const handleToggleFeaturedTrip = async (trip: TripPackage) => {
    try {
      const updatedPayload: TripPackage = { ...trip, featured: !trip.featured };
      let saved: TripPackage = updatedPayload;
      if (isFirebaseAdmin) {
        saved = await saveTripToFirestore(updatedPayload);
      }
      if (adminToken) {
        const res = await fetch(`/api/trips/${trip.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ featured: !trip.featured }),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal memperbarui status populer.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as TripPackage;
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        trips: prev.trips.map((t) => (t.id === saved.id ? saved : t)),
      }));
      showToast(`Status populer "${saved.title}" diperbarui.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal memperbarui.'));
    }
  };

  const handleDeleteTrip = async (trip: TripPackage) => {
    try {
      if (isFirebaseAdmin) {
        await deleteTripFromFirestore(trip.id);
      }
      if (adminToken) {
        const res = await fetch(`/api/trips/${trip.id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus paket trip.');
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        trips: prev.trips.filter((t) => t.id !== trip.id),
      }));
      showToast(`Paket "${trip.title}" dihapus dari katalog.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus.'));
    }
  };

  // --- GALLERY HANDLERS ---
  const openCreateGallery = () => {
    setEditingGalleryId(null);
    setGalTitle('');
    setGalCaption('');
    setGalDestination('Gunung Rinjani');
    setGalGuideId(store.guides[0]?.id || 'guide-raka');
    setGalMediaType('photo');
    setGalMediaUrl('');
    setGalAspect('portrait');
    setGalleryFormOpen(true);
  };

  const openEditGallery = (item: GalleryItem) => {
    setEditingGalleryId(item.id);
    setGalTitle(item.title);
    setGalCaption(item.caption);
    setGalDestination(item.destination);
    setGalGuideId(item.guideId);
    setGalMediaType(item.mediaType);
    setGalMediaUrl(item.mediaUrl);
    setGalAspect(item.aspectHint === 'portrait' ? 'portrait' : 'landscape');
    setGalleryFormOpen(true);
  };

  const handleGalleryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setGalMediaUrl(dataUrl);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal membaca file gambar.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galTitle.trim() || !galDestination.trim()) {
      showError('Judul dokumentasi dan destinasi wajib diisi.');
      return;
    }

    try {
      const existing = editingGalleryId
        ? store.gallery.find((g) => g.id === editingGalleryId)
        : undefined;
      const guide = store.guides.find((g) => g.id === galGuideId);
      const galId = editingGalleryId || `gal-${Date.now()}`;
      const payload: GalleryItem = {
        id: galId,
        title: galTitle.trim(),
        caption: galCaption.trim(),
        destination: galDestination.trim(),
        guideId: galGuideId,
        guideName: guide?.name || existing?.guideName || 'Tim Guide DexxDigital',
        mediaType: galMediaType,
        mediaUrl:
          galMediaUrl ||
          existing?.mediaUrl ||
          '/src/assets/images/guide_action_summit_1794756902427.jpg',
        capturedDate: existing?.capturedDate || new Date().toISOString().slice(0, 10),
        aspectHint: galAspect,
      };

      let saved: GalleryItem = payload;
      if (isFirebaseAdmin) {
        saved = await saveGalleryItemToFirestore(payload);
      }
      if (adminToken) {
        const url = editingGalleryId
          ? `/api/gallery/${editingGalleryId}`
          : '/api/gallery';
        const method = editingGalleryId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan dokumentasi galeri.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as GalleryItem;
        }
      }

      onStoreChange((prev) => ({
        ...prev,
        gallery: editingGalleryId
          ? prev.gallery.map((g) => (g.id === saved.id ? saved : g))
          : [saved, ...prev.gallery.filter((g) => g.id !== saved.id)],
      }));
      setGalleryFormOpen(false);
      showToast('Dokumentasi galeri berhasil disimpan.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan galeri.'));
    }
  };

  const handleDeleteGallery = async (id: string) => {
    try {
      if (isFirebaseAdmin) {
        await deleteGalleryItemFromFirestore(id);
      }
      if (adminToken) {
        const res = await fetch(`/api/gallery/${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus item galeri.');
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        gallery: prev.gallery.filter((g) => g.id !== id),
      }));
      showToast('Dokumentasi galeri dihapus.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus.'));
    }
  };

  // --- GUIDES & TESTIMONIALS HANDLERS ---
  const openCreateGuide = () => {
    setEditingGuide({
      id: '',
      name: '',
      specialty: '',
      certification: '',
      experienceYears: 4,
      tripsLed: 25,
      bio: '',
      photoUrl: '',
    });
    setGuideFormOpen(true);
  };

  const handleGuidePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingGuide) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setEditingGuide({ ...editingGuide, photoUrl: dataUrl });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal membaca foto tour guide.');
    } finally {
      e.target.value = '';
    }
  };

  const handleBrandLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setSiteDraft((prev) => ({ ...prev, brandLogoUrl: dataUrl }));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal membaca file logo brand.');
    } finally {
      e.target.value = '';
    }
  };

  const handleClientLogoUpload = async (
    clientId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setSiteDraft((prev) => ({
        ...prev,
        clientLogos: (prev.clientLogos || []).map((c) =>
          c.id === clientId ? { ...c, logoUrl: dataUrl } : c
        ),
      }));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal membaca file logo klien.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuide || !editingGuide.name.trim() || !editingGuide.specialty.trim()) {
      showError('Nama dan spesialisasi Tour Guide wajib diisi.');
      return;
    }
    try {
      const isNew = !editingGuide.id;
      const guideId = isNew ? `guide-${Date.now()}` : editingGuide.id;
      const payload: TourGuide = {
        ...editingGuide,
        id: guideId,
        name: editingGuide.name.trim(),
        specialty: editingGuide.specialty.trim(),
        certification: (editingGuide.certification || 'Sertifikasi Resmi HPI/APGI').trim(),
      };

      let saved: TourGuide = payload;
      if (isFirebaseAdmin) {
        saved = await saveGuideToFirestore(payload);
      }
      if (adminToken) {
        const url = isNew ? '/api/guides' : `/api/guides/${guideId}`;
        const method = isNew ? 'POST' : 'PUT';
        const res = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan Tour Guide.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as TourGuide;
        }
      }

      onStoreChange((prev) => ({
        ...prev,
        guides: isNew
          ? [...prev.guides, saved]
          : prev.guides.map((g) => (g.id === saved.id ? saved : g)),
        gallery: prev.gallery.map((item) =>
          item.guideId === saved.id ? { ...item, guideName: saved.name } : item
        ),
      }));
      setGuideFormOpen(false);
      setEditingGuide(null);
      showToast(`Profil Tour Guide "${saved.name}" disimpan.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan Tour Guide.'));
    }
  };

  const handleDeleteGuide = async (id: string) => {
    try {
      if (isFirebaseAdmin) {
        await deleteGuideFromFirestore(id);
      }
      if (adminToken) {
        const res = await fetch(`/api/guides/${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus Tour Guide.');
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        guides: prev.guides.filter((g) => g.id !== id),
      }));
      showToast('Profil Tour Guide dihapus.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus.'));
    }
  };

  const openCreateTesti = () => {
    setEditingTesti({
      id: '',
      name: '',
      role: '',
      tripName: store.trips[0]?.title || '',
      rating: 5,
      quote: '',
      date: 'November 2026',
    });
    setTestiFormOpen(true);
  };

  const handleSaveTesti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTesti || !editingTesti.name.trim() || !editingTesti.quote.trim()) {
      showError('Nama pelanggan dan kutipan testimoni wajib diisi.');
      return;
    }
    try {
      const isNew = !editingTesti.id;
      const testiId = isNew ? `testi-${Date.now()}` : editingTesti.id;
      const payload: Testimonial = {
        ...editingTesti,
        id: testiId,
        name: editingTesti.name.trim(),
        role: (editingTesti.role || 'Peserta Open Trip').trim(),
        tripName: (editingTesti.tripName || 'Open Trip Nusantara').trim(),
        quote: editingTesti.quote.trim(),
      };

      let saved: Testimonial = payload;
      if (isFirebaseAdmin) {
        saved = await saveTestimonialToFirestore(payload);
      }
      if (adminToken) {
        const url = isNew ? '/api/testimonials' : `/api/testimonials/${testiId}`;
        const method = isNew ? 'POST' : 'PUT';
        const res = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan testimoni.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as Testimonial;
        }
      }

      onStoreChange((prev) => ({
        ...prev,
        testimonials: isNew
          ? [saved, ...prev.testimonials.filter((t) => t.id !== saved.id)]
          : prev.testimonials.map((t) => (t.id === saved.id ? saved : t)),
      }));
      setTestiFormOpen(false);
      setEditingTesti(null);
      showToast(`Testimoni dari "${saved.name}" disimpan.`);
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan testimoni.'));
    }
  };

  const handleDeleteTesti = async (id: string) => {
    try {
      if (isFirebaseAdmin) {
        await deleteTestimonialFromFirestore(id);
      }
      if (adminToken) {
        const res = await fetch(`/api/testimonials/${id}`, {
          method: 'DELETE',
          headers: { 'x-admin-token': adminToken },
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menghapus testimoni.');
        }
      }
      onStoreChange((prev) => ({
        ...prev,
        testimonials: prev.testimonials.filter((t) => t.id !== id),
      }));
      showToast('Testimoni dihapus.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menghapus.'));
    }
  };

  // --- LANDING BANNER HANDLERS ---
  const handleSaveLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLanding(true);
    try {
      let saved: LandingSettings = landingDraft;
      if (isFirebaseAdmin) {
        saved = await saveLandingToFirestore(landingDraft);
      }
      if (adminToken) {
        const res = await fetch('/api/landing', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan pengaturan banner.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as LandingSettings;
        }
      }
      onStoreChange((prev) => ({ ...prev, landing: saved }));
      showToast('Pengaturan Hero & Banner Promosi disimpan.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan.'));
    } finally {
      setSavingLanding(false);
    }
  };

  // --- SITE CONTENT (KATALOG, HARGA, DURASI, KEUNGGULAN, BERANDA, KONTAK BASECAMP, FOOTER) HANDLERS ---
  const handleSaveSiteContent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPriceRanges = (siteDraft.priceRanges || [])
      .filter((r) => r.label.trim().length > 0)
      .map((r) => ({
        ...r,
        label: r.label.trim(),
      }));
    const cleanedDurationRanges = (siteDraft.durationRanges || [])
      .filter((d) => d.label.trim().length > 0)
      .map((d) => ({
        ...d,
        label: d.label.trim(),
      }));

    if (cleanedPriceRanges.length === 0) {
      showError('Minimal harus ada 1 opsi rentang harga dengan label yang valid.');
      return;
    }
    if (cleanedDurationRanges.length === 0) {
      showError('Minimal harus ada 1 opsi durasi trip dengan label yang valid.');
      return;
    }

    const cleanedGroupDiscounts = (siteDraft.groupDiscounts || [])
      .map((tier, idx) => ({
        id: (tier.id || `grp-${idx + 1}-${Date.now()}`).trim(),
        minParticipants: Math.min(100, Math.max(2, Math.floor(Number(tier.minParticipants) || 2))),
        discountPercent: Math.min(90, Math.max(1, Math.round(Number(tier.discountPercent) || 5))),
        label: (tier.label || '').trim(),
      }))
      .sort((a, b) => a.minParticipants - b.minParticipants);

    setSavingSite(true);
    try {
      const payload: SiteContent = {
        ...siteDraft,
        priceRanges: cleanedPriceRanges,
        durationRanges: cleanedDurationRanges,
        groupDiscounts: cleanedGroupDiscounts,
      };
      let saved: SiteContent = payload;
      if (isFirebaseAdmin) {
        saved = await saveSiteContentToFirestore(payload);
      }
      if (adminToken) {
        const res = await fetch('/api/site-content', {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(saved),
        });
        if (!res.ok && !isFirebaseAdmin) {
          await handleFetchError(res, 'Gagal menyimpan konten website.');
        } else if (res.ok && !isFirebaseAdmin) {
          saved = (await res.json()) as SiteContent;
        }
      }
      onStoreChange((prev) => ({ ...prev, siteContent: saved }));
      setSiteDraft(normalizeSiteContentDraft(saved));
      showToast('Seluruh teks web, katalog, rentang harga, durasi & kontak diperbarui.');
    } catch (err) {
      showError(extractErrorMessage(err, 'Gagal menyimpan konten.'));
    } finally {
      setSavingSite(false);
    }
  };

  // --- SECURITY PIN / PASSWORD HANDLER ---
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) {
      showError(
        'Untuk mengubah PIN/kata sandi lokal, masuk terlebih dahulu menggunakan PIN/kata sandi pengelola.'
      );
      return;
    }
    const validation = validatePinChangeInput({
      currentPin,
      newPin,
      confirmPin,
    });
    if (!validation.valid) {
      const firstErr = Object.values(validation.errors)[0];
      showError(firstErr);
      return;
    }

    setSavingPin(true);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) await handleFetchError(res, 'Gagal mengubah PIN/kata sandi.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      showToast('PIN / kata sandi pengelola berhasil diperbarui.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal memperbarui PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  const tabTitles: Record<AdminTab, string> = {
    leads: 'Pesanan & Leads Pelanggan',
    trips: 'Manajemen Paket Trip',
    gallery: 'Manajemen Galeri Tour Guide',
    guides_testi: 'Tim Guide & Testimoni Pelanggan',
    site_content: 'Konten Web, Katalog, Harga & Durasi Trip',
    landing: 'Hero & Banner Promosi',
    security: 'Keamanan & Kata Sandi Pengelola',
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <aside className="w-full lg:w-64 bg-[#132A1E] text-[#F6F5F0] shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#1B3B2B]">
        <div>
          <div className="px-6 py-5 border-b border-white/10">
            <p className="text-lg font-bold tracking-tight font-display text-white">
              {store.siteContent.brandName}
            </p>
            <p className="text-xs text-[#F6F5F0]/65 mt-0.5">Panel Manajemen Terproteksi</p>
          </div>

          <nav aria-label="Menu Admin CMS" className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('leads')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Inbox className="w-4 h-4" aria-hidden="true" />
                <span>Pesanan & Leads</span>
              </span>
              <span className="text-xs font-mono tabular-nums opacity-85">
                {store.leads.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'trips'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <MapIcon className="w-4 h-4" aria-hidden="true" />
                <span>Paket Trip</span>
              </span>
              <span className="text-xs font-mono tabular-nums opacity-85">
                {store.trips.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'gallery'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Galeri Guide</span>
              </span>
              <span className="text-xs font-mono tabular-nums opacity-85">
                {store.gallery.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guides_testi')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'guides_testi'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Award className="w-4 h-4" aria-hidden="true" />
                <span>Guide & Testimoni</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSiteDraft(normalizeSiteContentDraft(store.siteContent));
                setActiveTab('site_content');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'site_content'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>Teks Web & Katalog</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLandingDraft(store.landing);
                setActiveTab('landing');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'landing'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <LayoutTemplate className="w-4 h-4" aria-hidden="true" />
                <span>Banner & Promosi</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-[#C85A32] text-white'
                  : 'text-[#F6F5F0]/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>Keamanan & PIN</span>
              </span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke Website Publik</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-[#F6F5F0]/75 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Kunci & Keluar Panel</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Breadcrumb Bar */}
        <header className="bg-white border-b border-[#E2DFD5] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#526058]">
              {store.siteContent.brandName} / Panel Pengelola /{' '}
              <span className="text-[#17231D] font-medium">{tabTitles[activeTab]}</span>
            </p>
            <h1 className="text-xl font-bold text-[#17231D] mt-0.5">{tabTitles[activeTab]}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isFirebaseAdmin ? (
              <button
                type="button"
                onClick={handleSyncAllToFirebase}
                disabled={syncingFirebase}
                title={`Terhubung sebagai ${firebaseEmail || 'Admin Google'} (${FIREBASE_PROJECT_ID})`}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#1B3B2B] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncingFirebase ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>
                  {syncingFirebase
                    ? 'Menyinkronkan...'
                    : `Sinkronkan Semua ke Firebase (${FIREBASE_PROJECT_ID})`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogleClick}
                disabled={connectingGoogle}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#17231D] bg-[#F6F5F0] hover:bg-[#EDEBE4] border border-[#E2DFD5] rounded-lg cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <Cloud className="w-4 h-4 text-[#C85A32]" aria-hidden="true" />
                <span>
                  {connectingGoogle
                    ? 'Menghubungkan Google...'
                    : 'Hubungkan Google untuk Sync Firebase'}
                </span>
              </button>
            )}
            {activeTab === 'leads' && (
              <button
                type="button"
                onClick={handleExportLeadsCsv}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1B3B2B] bg-[#F6F5F0] hover:bg-[#EDEBE4] border border-[#E2DFD5] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Unduh CSV</span>
              </button>
            )}
            {activeTab === 'trips' && (
              <button
                type="button"
                onClick={openCreateTrip}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Tambah Paket Trip</span>
              </button>
            )}
            {activeTab === 'gallery' && (
              <button
                type="button"
                onClick={openCreateGallery}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Upload Dokumentasi</span>
              </button>
            )}
          </div>
        </header>

        {/* Feedback Banners */}
        {(notice || errorMsg) && (
          <div className="px-6 pt-4">
            {notice && (
              <div
                role="status"
                className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {notice}
                </span>
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  aria-label="Tutup notifikasi"
                  className="cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {errorMsg && (
              <div
                role="alert"
                className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-center justify-between"
              >
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg('')}
                  aria-label="Tutup pesan error"
                  className="cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Viewport */}
        <main className="p-6 flex-1 space-y-6">
          {/* TAB 1: LEADS & BOOKINGS */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E2DFD5] p-4">
                  <p className="text-xs text-[#526058]">Total Leads Masuk</p>
                  <p className="text-2xl font-bold text-[#17231D] tabular-nums mt-1">
                    {store.leads.length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E2DFD5] p-4">
                  <p className="text-xs text-[#526058]">Menunggu Follow-up</p>
                  <p className="text-2xl font-bold text-[#C85A32] tabular-nums mt-1">
                    {store.leads.filter((l) => l.status === 'Baru').length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E2DFD5] p-4">
                  <p className="text-xs text-[#526058]">Pesanan Terkonfirmasi</p>
                  <p className="text-2xl font-bold text-[#1B3B2B] tabular-nums mt-1">
                    {store.leads.filter((l) => l.status === 'Confirmed').length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E2DFD5] p-4">
                  <p className="text-xs text-[#526058]">Estimasi Nilai Pipeline</p>
                  <p className="text-lg sm:text-xl font-bold text-[#17231D] tabular-nums mt-1">
                    {formatIDR(
                      store.leads
                        .filter((l) => l.status !== 'Dibatalkan')
                        .reduce((acc, l) => acc + l.totalEstimatedPrice, 0)
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E2DFD5] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search
                    className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    aria-label="Cari pesanan atau nama pelanggan"
                    placeholder="Cari nama pelanggan, trip, atau WA..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="lead-status-filter" className="text-xs text-[#526058]">
                    Status:
                  </label>
                  <select
                    id="lead-status-filter"
                    value={leadStatusFilter}
                    onChange={(e) =>
                      setLeadStatusFilter(e.target.value as 'Semua' | LeadStatus)
                    }
                    className="px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  >
                    <option value="Semua">Semua Status</option>
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E2DFD5] overflow-hidden">
                {filteredLeads.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[#526058]">
                    Belum ada data pesanan yang cocok dengan pencarian Anda.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#E2DFD5] bg-[#F6F5F0]/70 text-xs font-semibold text-[#526058]">
                          <th className="py-3 px-4">Pelanggan</th>
                          <th className="py-3 px-4">Paket Trip</th>
                          <th className="py-3 px-4">Keberangkatan</th>
                          <th className="py-3 px-4 text-right">Peserta</th>
                          <th className="py-3 px-4 text-right">Estimasi Total</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2DFD5] text-sm">
                        {filteredLeads.map((lead) => {
                          const waUrl = buildWhatsAppBookingUrl(lead.whatsapp, {
                            tripTitle: lead.tripTitle,
                            customerName: lead.customerName,
                            departureDate: lead.departureDate,
                            participants: lead.participants,
                            totalEstimatedPrice: lead.totalEstimatedPrice,
                            notes: lead.notes,
                          });

                          return (
                            <tr key={lead.id} className="hover:bg-[#F6F5F0]/50">
                              <td className="py-3.5 px-4 align-top">
                                <p className="font-semibold text-[#17231D]">
                                  {lead.customerName}
                                </p>
                                <p className="text-xs text-[#526058] font-mono tabular-nums mt-0.5">
                                  {lead.whatsapp}
                                </p>
                                {lead.notes && (
                                  <p className="text-xs text-[#526058] mt-1 max-w-xs line-clamp-2">
                                    Catatan: {lead.notes}
                                  </p>
                                )}
                              </td>
                              <td className="py-3.5 px-4 align-top font-medium text-[#17231D]">
                                {lead.tripTitle}
                              </td>
                              <td className="py-3.5 px-4 align-top font-mono text-xs text-[#17231D] tabular-nums whitespace-nowrap">
                                {lead.departureDate || '-'}
                              </td>
                              <td className="py-3.5 px-4 align-top text-right tabular-nums font-medium">
                                {lead.participants} org
                              </td>
                              <td className="py-3.5 px-4 align-top text-right tabular-nums font-semibold text-[#17231D] whitespace-nowrap">
                                {formatIDR(lead.totalEstimatedPrice)}
                              </td>
                              <td className="py-3.5 px-4 align-top">
                                <select
                                  aria-label={`Ubah status pesanan ${lead.customerName}`}
                                  value={lead.status}
                                  onChange={(e) =>
                                    handleUpdateLeadStatus(
                                      lead.id,
                                      e.target.value as LeadStatus
                                    )
                                  }
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer ${STATUS_STYLE[lead.status]}`}
                                >
                                  {LEAD_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Hubungi ${lead.customerName} via WhatsApp`}
                                    className="p-2 rounded-lg text-[#1B3B2B] hover:bg-[#EDEBE4] transition-colors"
                                    title="Balas via WhatsApp"
                                  >
                                    <MessageCircle className="w-4 h-4" aria-hidden="true" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLead(lead.id)}
                                    aria-label={`Hapus pesanan ${lead.customerName}`}
                                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Hapus Pesanan"
                                  >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRIPS CRUD + CATEGORY MANAGER */}
          {activeTab === 'trips' && (
            <div className="space-y-5">
              {/* Kelola Kategori Trip */}
              <div
                data-testid="category-manager"
                className="bg-white rounded-xl border border-[#E2DFD5] p-5 space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#17231D]">
                      Kelola Pilihan Kategori Trip
                    </h2>
                    <p className="text-xs text-[#526058] mt-0.5">
                      Tambahkan kategori sesuai jenis perjalanan Anda (misal: Camping, Rafting,
                      Honeymoon, Kuliner). Kategori otomatis muncul di filter katalog publik.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAddCategoryPreset}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <input
                      id="new-category-input"
                      type="text"
                      aria-label="Nama kategori trip baru"
                      placeholder="Ketik kategori baru..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="px-3 py-1.5 text-xs sm:text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B] w-48"
                    />
                    <button
                      type="submit"
                      disabled={savingCategories || !newCategoryInput.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tambah Kategori</span>
                    </button>
                  </form>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {availableCategories.map((cat) => {
                    const usedCount = store.trips.filter(
                      (t) => t.category.trim().toLowerCase() === cat.toLowerCase()
                    ).length;
                    return (
                      <div
                        key={cat}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] text-xs font-semibold text-[#17231D]"
                      >
                        <span>{cat}</span>
                        <span className="text-[11px] font-mono text-[#526058] tabular-nums">
                          ({usedCount})
                        </span>
                        {usedCount === 0 && availableCategories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategoryPreset(cat)}
                            aria-label={`Hapus kategori ${cat}`}
                            className="text-[#526058] hover:text-red-600 cursor-pointer"
                            title="Hapus kategori"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E2DFD5] overflow-hidden">
                {store.trips.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-[#526058]">Belum ada paket trip.</p>
                  <button
                    type="button"
                    onClick={openCreateTrip}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#C85A32] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Paket Pertama</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E2DFD5] bg-[#F6F5F0]/70 text-xs font-semibold text-[#526058]">
                        <th className="py-3 px-4">Paket Perjalanan</th>
                        <th className="py-3 px-4">Kategori</th>
                        <th className="py-3 px-4">Durasi</th>
                        <th className="py-3 px-4 text-right">Harga</th>
                        <th className="py-3 px-4">Populer</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2DFD5] text-sm">
                      {store.trips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-[#F6F5F0]/50">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-10 rounded-md overflow-hidden bg-[#EDEBE4] shrink-0">
                                <ResilientImage
                                  src={trip.coverImage}
                                  alt={trip.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <p className="font-semibold text-[#17231D]">{trip.title}</p>
                                <p className="text-xs text-[#526058]">
                                  {trip.destination}, {trip.region}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-[#1B3B2B]">
                            {trip.category}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#526058] tabular-nums">
                            {trip.durationLabel}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-[#17231D] tabular-nums whitespace-nowrap">
                            {formatIDR(trip.pricePerPerson)}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleFeaturedTrip(trip)}
                              aria-label={`Ubah status populer ${trip.title}`}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                                trip.featured
                                  ? 'bg-[#C85A32]/10 text-[#C85A32] border-[#C85A32]/30'
                                  : 'bg-[#F6F5F0] text-[#526058] border-[#E2DFD5]'
                              }`}
                            >
                              <Star
                                className={`w-3 h-3 ${trip.featured ? 'fill-[#C85A32]' : ''}`}
                                aria-hidden="true"
                              />
                              <span>{trip.featured ? 'Populer' : 'Standar'}</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditTrip(trip)}
                                aria-label={`Edit paket ${trip.title}`}
                                className="p-2 rounded-lg text-[#1B3B2B] hover:bg-[#EDEBE4] cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTrip(trip)}
                                aria-label={`Hapus paket ${trip.title}`}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </div>
          )}

          {/* TAB 3: GALLERY MANAGEMENT */}
          {activeTab === 'gallery' && (
            <div className="space-y-6">
              {galleryFormOpen && (
                <form
                  onSubmit={handleSaveGallery}
                  className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-[#E2DFD5] pb-3">
                    <h2 className="text-base font-bold text-[#17231D]">
                      {editingGalleryId ? 'Edit Dokumentasi Galeri' : 'Tambah Dokumentasi Baru'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setGalleryFormOpen(false)}
                      aria-label="Tutup formulir galeri"
                      className="p-1 text-[#526058] hover:text-[#17231D] cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="gal-title"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Judul Dokumentasi
                      </label>
                      <input
                        id="gal-title"
                        type="text"
                        required
                        value={galTitle}
                        onChange={(e) => setGalTitle(e.target.value)}
                        placeholder="Contoh: Briefing Summit Sembalun"
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="gal-dest"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Nama Destinasi
                      </label>
                      <input
                        id="gal-dest"
                        type="text"
                        required
                        value={galDestination}
                        onChange={(e) => setGalDestination(e.target.value)}
                        placeholder="Contoh: Gunung Rinjani"
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="gal-guide"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Assign ke Tour Guide
                      </label>
                      <select
                        id="gal-guide"
                        value={galGuideId}
                        onChange={(e) => setGalGuideId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                      >
                        {store.guides.map((g: TourGuide) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.specialty})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="gal-type"
                          className="block text-xs font-semibold text-[#526058] mb-1.5"
                        >
                          Tipe Media
                        </label>
                        <select
                          id="gal-type"
                          value={galMediaType}
                          onChange={(e) => setGalMediaType(e.target.value as MediaType)}
                          className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                        >
                          <option value="photo">Foto</option>
                          <option value="video">Video Reel</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="gal-aspect"
                          className="block text-xs font-semibold text-[#526058] mb-1.5"
                        >
                          Rasio Tampilan
                        </label>
                        <select
                          id="gal-aspect"
                          value={galAspect}
                          onChange={(e) =>
                            setGalAspect(e.target.value as 'portrait' | 'landscape')
                          }
                          className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                        >
                          <option value="landscape">Landscape (4:3)</option>
                          <option value="portrait">Portrait (3:4)</option>
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-[#F6F5F0] border border-[#E2DFD5]">
                      <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5]">
                        <ResilientImage
                          src={galMediaUrl}
                          alt={galTitle || 'Preview Dokumentasi'}
                          fallbackTitle="Preview Foto"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="sm:col-span-8 space-y-3">
                        <div>
                          <label
                            htmlFor="gal-upload"
                            className="block text-xs font-semibold text-[#526058] mb-1.5"
                          >
                            Upload File Gambar Sendiri
                          </label>
                          <input
                            id="gal-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleGalleryFileUpload}
                            className="w-full text-xs text-[#526058] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#E2DFD5] file:text-xs file:font-semibold file:bg-white file:text-[#17231D] hover:file:bg-[#EDEBE4]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="gal-media-url"
                            className="block text-xs font-semibold text-[#526058] mb-1.5"
                          >
                            Atau Ketik / Tempel URL Gambar Sendiri
                          </label>
                          <input
                            id="gal-media-url"
                            type="text"
                            value={galMediaUrl.startsWith('data:') ? '' : galMediaUrl}
                            onChange={(e) => setGalMediaUrl(e.target.value)}
                            placeholder={
                              galMediaUrl.startsWith('data:')
                                ? 'Foto lokal telah diupload (ketik/tempel URL baru untuk mengganti)'
                                : 'https://contoh.com/foto-dokumentasi.jpg'
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="gal-caption"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Deskripsi / Cerita Lapangan
                      </label>
                      <textarea
                        id="gal-caption"
                        rows={2}
                        value={galCaption}
                        onChange={(e) => setGalCaption(e.target.value)}
                        placeholder="Ceritakan aksi tour guide atau momen di foto ini..."
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setGalleryFormOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-[#526058] hover:text-[#17231D] cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                    >
                      Simpan Dokumentasi
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {store.gallery.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#E2DFD5] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-[#EDEBE4]">
                        <ResilientImage
                          src={item.mediaUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-[#526058]">
                          {item.mediaType === 'video' ? 'Video Reel' : 'Foto'} ·{' '}
                          {item.destination}
                        </p>
                        <h3 className="text-sm font-bold text-[#17231D] mt-1">{item.title}</h3>
                        <p className="text-xs font-medium text-[#1B3B2B] mt-2">
                          Guide: {item.guideName}
                        </p>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-[#E2DFD5] flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditGallery(item)}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1B3B2B] hover:bg-[#F6F5F0] rounded-md cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGallery(item.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TOUR GUIDES & TESTIMONIALS CRUD */}
          {activeTab === 'guides_testi' && (
            <div className="space-y-8">
              {/* Section A: Tour Guides */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DFD5] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#17231D]">
                      Daftar Tour Guide Bersertifikat
                    </h2>
                    <p className="text-xs text-[#526058]">
                      Ditampilkan di halaman Galeri Guide dan pilihan assignment dokumentasi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateGuide}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tambah Tour Guide</span>
                  </button>
                </div>

                {guideFormOpen && editingGuide && (
                  <form
                    onSubmit={handleSaveGuide}
                    className="bg-[#F6F5F0] rounded-xl border border-[#E2DFD5] p-5 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="guide-name"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Nama Tour Guide
                        </label>
                        <input
                          id="guide-name"
                          type="text"
                          required
                          value={editingGuide.name}
                          onChange={(e) =>
                            setEditingGuide({ ...editingGuide, name: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="guide-spec"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Spesialisasi
                        </label>
                        <input
                          id="guide-spec"
                          type="text"
                          required
                          value={editingGuide.specialty}
                          onChange={(e) =>
                            setEditingGuide({ ...editingGuide, specialty: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="guide-cert"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Sertifikasi
                        </label>
                        <input
                          id="guide-cert"
                          type="text"
                          value={editingGuide.certification}
                          onChange={(e) =>
                            setEditingGuide({
                              ...editingGuide,
                              certification: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="guide-exp"
                            className="block text-xs font-semibold text-[#526058] mb-1"
                          >
                            Pengalaman (Thn)
                          </label>
                          <input
                            id="guide-exp"
                            type="number"
                            min={1}
                            value={editingGuide.experienceYears}
                            onChange={(e) =>
                              setEditingGuide({
                                ...editingGuide,
                                experienceYears: Number(e.target.value) || 1,
                              })
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="guide-trips"
                            className="block text-xs font-semibold text-[#526058] mb-1"
                          >
                            Jumlah Trip
                          </label>
                          <input
                            id="guide-trips"
                            type="number"
                            min={1}
                            value={editingGuide.tripsLed}
                            onChange={(e) =>
                              setEditingGuide({
                                ...editingGuide,
                                tripsLed: Number(e.target.value) || 1,
                              })
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                        />
                        </div>
                      </div>
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4 rounded-xl bg-white border border-[#E2DFD5]">
                        <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5]">
                          <ResilientImage
                            src={editingGuide.photoUrl || ''}
                            alt={editingGuide.name || 'Preview Foto Guide'}
                            fallbackTitle="Foto Guide"
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div className="sm:col-span-8 space-y-2.5">
                          <div>
                            <label
                              htmlFor="guide-photo-upload"
                              className="block text-xs font-semibold text-[#526058] mb-1"
                            >
                              Upload Foto Tour Guide
                            </label>
                            <input
                              id="guide-photo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleGuidePhotoUpload}
                              className="w-full text-xs text-[#526058] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E2DFD5] file:text-xs file:font-semibold file:bg-[#F6F5F0] file:text-[#17231D] hover:file:bg-[#EDEBE4]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="guide-photo-url"
                              className="block text-xs font-semibold text-[#526058] mb-1"
                            >
                              Atau Ketik / Tempel URL Foto Tour Guide
                            </label>
                            <input
                              id="guide-photo-url"
                              type="text"
                              value={
                                (editingGuide.photoUrl || '').startsWith('data:')
                                  ? ''
                                  : editingGuide.photoUrl || ''
                              }
                              onChange={(e) =>
                                setEditingGuide({
                                  ...editingGuide,
                                  photoUrl: e.target.value,
                                })
                              }
                              placeholder={
                                (editingGuide.photoUrl || '').startsWith('data:')
                                  ? 'Foto lokal telah diupload (tempel URL baru untuk mengganti)'
                                  : 'https://contoh.com/foto-guide.jpg'
                              }
                              className="w-full px-3 py-1.5 text-xs bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="guide-bio"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Bio Singkat Tour Guide
                        </label>
                        <textarea
                          id="guide-bio"
                          rows={2}
                          value={editingGuide.bio}
                          onChange={(e) =>
                            setEditingGuide({ ...editingGuide, bio: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGuideFormOpen(false);
                          setEditingGuide(null);
                        }}
                        className="px-4 py-2 text-xs font-medium text-[#526058] cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] rounded-lg cursor-pointer"
                      >
                        Simpan Guide
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {store.guides.map((guide) => (
                    <div
                      key={guide.id}
                      className="p-4 rounded-lg border border-[#E2DFD5] bg-[#F6F5F0]/50 flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5] shrink-0">
                          <ResilientImage
                            src={guide.photoUrl || ''}
                            alt={guide.name}
                            fallbackTitle={guide.name}
                            className="w-full h-full object-cover object-top"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#17231D]">{guide.name}</p>
                          <p className="text-xs text-[#526058] mt-0.5">{guide.specialty}</p>
                          <p className="text-xs text-[#1B3B2B] mt-1">
                            {guide.certification} · {guide.experienceYears} thn · {guide.tripsLed} trip
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGuide(structuredClone(guide));
                            setGuideFormOpen(true);
                          }}
                          aria-label={`Edit guide ${guide.name}`}
                          className="p-1.5 text-[#1B3B2B] hover:bg-white rounded cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuide(guide.id)}
                          aria-label={`Hapus guide ${guide.name}`}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section B: Testimonials */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DFD5] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#17231D]">
                      Daftar Testimoni & Review Pelanggan
                    </h2>
                    <p className="text-xs text-[#526058]">
                      Kelola kutipan review terverifikasi di Landing Page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateTesti}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tambah Testimoni</span>
                  </button>
                </div>

                {testiFormOpen && editingTesti && (
                  <form
                    onSubmit={handleSaveTesti}
                    className="bg-[#F6F5F0] rounded-xl border border-[#E2DFD5] p-5 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="testi-name"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Nama Pelanggan
                        </label>
                        <input
                          id="testi-name"
                          type="text"
                          required
                          value={editingTesti.name}
                          onChange={(e) =>
                            setEditingTesti({ ...editingTesti, name: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="testi-role"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Profesi & Kota
                        </label>
                        <input
                          id="testi-role"
                          type="text"
                          value={editingTesti.role}
                          onChange={(e) =>
                            setEditingTesti({ ...editingTesti, role: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="testi-trip"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Paket Trip yang Diikuti
                        </label>
                        <input
                          id="testi-trip"
                          type="text"
                          value={editingTesti.tripName}
                          onChange={(e) =>
                            setEditingTesti({ ...editingTesti, tripName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="testi-date"
                            className="block text-xs font-semibold text-[#526058] mb-1"
                          >
                            Bulan & Tahun
                          </label>
                          <input
                            id="testi-date"
                            type="text"
                            value={editingTesti.date}
                            onChange={(e) =>
                              setEditingTesti({ ...editingTesti, date: e.target.value })
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="testi-rating"
                            className="block text-xs font-semibold text-[#526058] mb-1"
                          >
                            Rating (1–5)
                          </label>
                          <input
                            id="testi-rating"
                            type="number"
                            min={1}
                            max={5}
                            value={editingTesti.rating}
                            onChange={(e) =>
                              setEditingTesti({
                                ...editingTesti,
                                rating: Math.min(5, Math.max(1, Number(e.target.value) || 5)),
                              })
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="testi-quote"
                          className="block text-xs font-semibold text-[#526058] mb-1"
                        >
                          Kutipan Ulasan
                        </label>
                        <textarea
                          id="testi-quote"
                          rows={2}
                          required
                          value={editingTesti.quote}
                          onChange={(e) =>
                            setEditingTesti({ ...editingTesti, quote: e.target.value })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTestiFormOpen(false);
                          setEditingTesti(null);
                        }}
                        className="px-4 py-2 text-xs font-medium text-[#526058] cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#C85A32] rounded-lg cursor-pointer"
                      >
                        Simpan Testimoni
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {store.testimonials.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 rounded-lg border border-[#E2DFD5] bg-[#F6F5F0]/50 flex items-start justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#17231D]">
                          {t.name}{' '}
                          <span className="text-xs font-normal text-[#526058]">
                            · {t.role} · {t.date}
                          </span>
                        </p>
                        <p className="text-xs text-[#1B3B2B] mt-0.5">Trip: {t.tripName}</p>
                        <p className="text-xs text-[#526058] mt-1.5 italic">"{t.quote}"</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTesti(structuredClone(t));
                            setTestiFormOpen(true);
                          }}
                          aria-label={`Edit testimoni ${t.name}`}
                          className="p-1.5 text-[#1B3B2B] hover:bg-white rounded cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTesti(t.id)}
                          aria-label={`Hapus testimoni ${t.name}`}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB 5: SITE CONTENT (NAVIGASI, SEARCH, KATALOG, HARGA, DURASI, KEUNGGULAN, KONTAK, DETAIL, GALERI) */}
          {activeTab === 'site_content' && (
            <form onSubmit={handleSaveSiteContent} className="space-y-6 max-w-5xl">
              {/* 1. Identitas Brand, Navigasi Header, Search Bar & Destinasi Populer */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-5">
                <h2 className="text-base font-bold text-[#17231D] border-b border-[#E2DFD5] pb-3">
                  1. Identitas Brand, Menu Navigasi, Search Bar & Beranda
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sc-brand"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Nama Brand / Operator
                    </label>
                    <input
                      id="sc-brand"
                      type="text"
                      value={siteDraft.brandName}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, brandName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-header-cta"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Tombol Utama Header
                    </label>
                    <input
                      id="sc-header-cta"
                      type="text"
                      value={siteDraft.headerCtaText}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, headerCtaText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  {/* Brand Logo & Browser Tab Favicon */}
                  <div className="sm:col-span-2 p-4 rounded-xl bg-[#F6F5F0] border border-[#E2DFD5] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#17231D]">
                          File Logo Brand & Favicon Tab Browser
                        </p>
                        <p className="text-[11px] text-[#526058]">
                          Tampil di Header, Footer, Ikon Tab Browser, dan tersedia sebagai file unduhan untuk perkenalan klien.
                        </p>
                      </div>
                      <a
                        href={siteDraft.brandLogoUrl || '/logo-dexxdigital.svg'}
                        download="logo-dexxdigital.svg"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B3B2B] bg-white border border-[#E2DFD5] hover:border-[#1B3B2B] rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Unduh File Logo</span>
                      </a>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      <div className="sm:col-span-3 h-20 rounded-lg bg-white border border-[#E2DFD5] flex items-center justify-center p-2">
                        <img
                          src={siteDraft.brandLogoUrl || '/logo-dexxdigital.svg'}
                          alt="Preview Logo Brand"
                          className="h-14 w-14 object-contain"
                        />
                      </div>
                      <div className="sm:col-span-9 space-y-2">
                        <input
                          id="sc-brand-logo-upload"
                          type="file"
                          accept="image/*,.svg"
                          onChange={handleBrandLogoUpload}
                          className="w-full text-xs text-[#526058] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E2DFD5] file:text-xs file:font-semibold file:bg-white file:text-[#17231D] hover:file:bg-[#EDEBE4]"
                        />
                        <input
                          id="sc-brand-logo-url"
                          type="text"
                          value={
                            (siteDraft.brandLogoUrl || '').startsWith('data:')
                              ? ''
                              : siteDraft.brandLogoUrl || ''
                          }
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, brandLogoUrl: e.target.value })
                          }
                          placeholder={
                            (siteDraft.brandLogoUrl || '').startsWith('data:')
                              ? 'File logo baru telah diupload'
                              : '/logo-dexxdigital.svg'
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Client & Partner Logos CRUD */}
                  <div className="sm:col-span-2 p-4 rounded-xl bg-[#F6F5F0] border border-[#E2DFD5] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#17231D]">
                          Logo Klien & Mitra (Perkenalan Client di Beranda)
                        </p>
                        <p className="text-[11px] text-[#526058]">
                          Upload file SVG/PNG logo klien atau mitra perusahaan yang ditampilkan di halaman beranda.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newClient: ClientLogoItem = {
                            id: `client-${Date.now()}`,
                            name: 'Mitra Ekspedisi Baru',
                            sector: 'Partner',
                            logoUrl: '/logos/nusantara-outdoor.svg',
                          };
                          setSiteDraft({
                            ...siteDraft,
                            clientLogos: [...(siteDraft.clientLogos || []), newClient],
                          });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B3B2B] hover:text-[#C85A32] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Tambah Logo Klien</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="sc-clients-kicker"
                          className="block text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          Kicker Bagian Klien
                        </label>
                        <input
                          id="sc-clients-kicker"
                          type="text"
                          value={siteDraft.clientsKicker || ''}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, clientsKicker: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="sc-clients-title"
                          className="block text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          Judul Bagian Klien
                        </label>
                        <input
                          id="sc-clients-title"
                          type="text"
                          value={siteDraft.clientsTitle || ''}
                          onChange={(e) =>
                            setSiteDraft({ ...siteDraft, clientsTitle: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(siteDraft.clientLogos || []).map((client, cIdx) => (
                        <div
                          key={client.id}
                          className="p-3 rounded-lg bg-white border border-[#E2DFD5] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              aria-label={`Nama klien ${cIdx + 1}`}
                              value={client.name}
                              onChange={(e) => {
                                const updated = [...(siteDraft.clientLogos || [])];
                                updated[cIdx] = { ...client, name: e.target.value };
                                setSiteDraft({ ...siteDraft, clientLogos: updated });
                              }}
                              className="flex-1 px-2 py-1 text-xs font-semibold bg-[#F6F5F0] border border-[#E2DFD5] rounded"
                            />
                            <button
                              type="button"
                              aria-label={`Hapus logo ${client.name}`}
                              onClick={() =>
                                setSiteDraft({
                                  ...siteDraft,
                                  clientLogos: (siteDraft.clientLogos || []).filter(
                                    (c) => c.id !== client.id
                                  ),
                                })
                              }
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-12 rounded border border-[#E2DFD5] bg-[#F6F5F0]/60 flex items-center justify-center p-1 shrink-0">
                              <ResilientImage
                                src={client.logoUrl}
                                alt={client.name}
                                fallbackTitle={client.name}
                                className="h-9 w-auto max-w-full object-contain"
                              />
                            </div>
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <input
                                type="file"
                                accept="image/*,.svg"
                                aria-label={`Upload file logo ${client.name}`}
                                onChange={(e) => handleClientLogoUpload(client.id, e)}
                                className="w-full text-[11px] text-[#526058] file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-[#E2DFD5] file:text-[11px] file:font-semibold file:bg-[#F6F5F0]"
                              />
                              <input
                                type="text"
                                aria-label={`Path atau URL logo ${client.name}`}
                                value={
                                  client.logoUrl.startsWith('data:') ? '' : client.logoUrl
                                }
                                onChange={(e) => {
                                  const updated = [...(siteDraft.clientLogos || [])];
                                  updated[cIdx] = { ...client, logoUrl: e.target.value };
                                  setSiteDraft({ ...siteDraft, clientLogos: updated });
                                }}
                                placeholder={
                                  client.logoUrl.startsWith('data:')
                                    ? 'File logo terupload'
                                    : '/logos/nama-file.svg'
                                }
                                className="w-full px-2 py-1 text-[11px] bg-[#F6F5F0] border border-[#E2DFD5] rounded"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="sc-nav-home"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Menu Navigasi: Beranda
                    </label>
                    <input
                      id="sc-nav-home"
                      type="text"
                      value={siteDraft.navHomeLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, navHomeLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-nav-catalog"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Menu Navigasi: Katalog Trip
                    </label>
                    <input
                      id="sc-nav-catalog"
                      type="text"
                      value={siteDraft.navCatalogLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, navCatalogLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-nav-gallery"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Menu Navigasi: Galeri Guide
                    </label>
                    <input
                      id="sc-nav-gallery"
                      type="text"
                      value={siteDraft.navGalleryLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, navGalleryLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-nav-why"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Menu Navigasi: Keunggulan
                    </label>
                    <input
                      id="sc-nav-why"
                      type="text"
                      value={siteDraft.navWhyLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, navWhyLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-hero-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Teks Kicker Atas Hero
                    </label>
                    <input
                      id="sc-hero-kicker"
                      type="text"
                      value={siteDraft.heroKicker}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, heroKicker: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-hero-sec-cta"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Tombol Sekunder Hero
                    </label>
                    <input
                      id="sc-hero-sec-cta"
                      type="text"
                      value={siteDraft.heroSecondaryCtaText}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          heroSecondaryCtaText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-dest"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Search Hero: Destinasi
                    </label>
                    <input
                      id="sc-search-dest"
                      type="text"
                      value={siteDraft.searchDestinationLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          searchDestinationLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-all-dest"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Opsi Default Destinasi (Semua)
                    </label>
                    <input
                      id="sc-search-all-dest"
                      type="text"
                      value={siteDraft.searchAllDestinationsLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          searchAllDestinationsLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-date"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Search Hero: Tanggal Berangkat
                    </label>
                    <input
                      id="sc-search-date"
                      type="text"
                      value={siteDraft.searchDateLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, searchDateLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-dur"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Search Hero: Durasi Perjalanan
                    </label>
                    <input
                      id="sc-search-dur"
                      type="text"
                      value={siteDraft.searchDurationLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          searchDurationLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-all-dur"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Opsi Default Durasi (Semua)
                    </label>
                    <input
                      id="sc-search-all-dur"
                      type="text"
                      value={siteDraft.searchAllDurationsLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          searchAllDurationsLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-search-btn"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Teks Tombol Search Bar Hero
                    </label>
                    <input
                      id="sc-search-btn"
                      type="text"
                      value={siteDraft.searchButtonText || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, searchButtonText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-pop-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Kicker Section Destinasi Populer
                    </label>
                    <input
                      id="sc-pop-kicker"
                      type="text"
                      value={siteDraft.popularKicker}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, popularKicker: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-pop-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Section Destinasi Populer
                    </label>
                    <input
                      id="sc-pop-title"
                      type="text"
                      value={siteDraft.popularTitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, popularTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-pop-viewall"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Link "Lihat Semua Paket" di Beranda
                    </label>
                    <input
                      id="sc-pop-viewall"
                      type="text"
                      value={siteDraft.popularViewAllText || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          popularViewAllText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-pop-prefix"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Awalan Harga Kartu Populer
                    </label>
                    <input
                      id="sc-pop-prefix"
                      type="text"
                      value={siteDraft.popularPricePrefix || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          popularPricePrefix: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>
              </section>

              {/* 2. Section Keunggulan ("Mengapa Memilih Kami?") */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-[#E2DFD5] pb-3">
                  <h2 className="text-base font-bold text-[#17231D]">
                    2. Bagian Keunggulan ("Mengapa Memilih Kami?")
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const newWhy: WhyChooseItem = {
                        id: `why-${Date.now()}`,
                        title: `0${siteDraft.whyItems.length + 1}. Keunggulan Baru`,
                        description: 'Deskripsi keunggulan layanan Anda.',
                        icon: 'compass',
                      };
                      setSiteDraft({
                        ...siteDraft,
                        whyItems: [...siteDraft.whyItems, newWhy],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B3B2B] hover:text-[#C85A32] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Poin Keunggulan</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sc-why-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Kicker Keunggulan
                    </label>
                    <input
                      id="sc-why-kicker"
                      type="text"
                      value={siteDraft.whyKicker}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, whyKicker: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-why-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Utama Keunggulan
                    </label>
                    <input
                      id="sc-why-title"
                      type="text"
                      value={siteDraft.whyTitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, whyTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-why-desc"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Deskripsi Pengantar Keunggulan
                    </label>
                    <textarea
                      id="sc-why-desc"
                      rows={2}
                      value={siteDraft.whyDescription}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, whyDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>

                {/* 3 Proof Metrics */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#526058]">
                    3 Angka Statistik Rekam Jejak
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {siteDraft.whyMetrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] space-y-2"
                      >
                        <input
                          type="text"
                          aria-label={`Nilai metrik ${idx + 1}`}
                          value={m.value}
                          onChange={(e) => {
                            const updated = [...siteDraft.whyMetrics];
                            updated[idx] = { ...m, value: e.target.value };
                            setSiteDraft({ ...siteDraft, whyMetrics: updated });
                          }}
                          className="w-full px-2.5 py-1.5 text-sm font-bold bg-white border border-[#E2DFD5] rounded"
                        />
                        <input
                          type="text"
                          aria-label={`Label metrik ${idx + 1}`}
                          value={m.label}
                          onChange={(e) => {
                            const updated = [...siteDraft.whyMetrics];
                            updated[idx] = { ...m, label: e.target.value };
                            setSiteDraft({ ...siteDraft, whyMetrics: updated });
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable Why Items */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#526058]">
                    Daftar Poin Keunggulan
                  </p>
                  {siteDraft.whyItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1B3B2B]">
                          Poin Keunggulan #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Ikon poin ${idx + 1}`}
                            value={item.icon}
                            onChange={(e) => {
                              const updated = [...siteDraft.whyItems];
                              updated[idx] = {
                                ...item,
                                icon: e.target.value as WhyIconKey,
                              };
                              setSiteDraft({ ...siteDraft, whyItems: updated });
                            }}
                            className="px-2 py-1 text-xs bg-white border border-[#E2DFD5] rounded"
                          >
                            <option value="shield">Ikon Keamanan (Perisai)</option>
                            <option value="award">Ikon Sertifikat (Medali)</option>
                            <option value="receipt">Ikon Transparansi (Struk)</option>
                            <option value="compass">Ikon Ekspedisi (Kompas)</option>
                            <option value="users">Ikon Tim (Grup)</option>
                          </select>
                          {siteDraft.whyItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSiteDraft({
                                  ...siteDraft,
                                  whyItems: siteDraft.whyItems.filter((_, i) => i !== idx),
                                })
                              }
                              className="text-xs text-red-600 hover:underline cursor-pointer"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        aria-label={`Judul keunggulan ${idx + 1}`}
                        value={item.title}
                        onChange={(e) => {
                          const updated = [...siteDraft.whyItems];
                          updated[idx] = { ...item, title: e.target.value };
                          setSiteDraft({ ...siteDraft, whyItems: updated });
                        }}
                        className="w-full px-3 py-2 text-sm font-semibold bg-white border border-[#E2DFD5] rounded-lg"
                      />
                      <textarea
                        rows={2}
                        aria-label={`Deskripsi keunggulan ${idx + 1}`}
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...siteDraft.whyItems];
                          updated[idx] = { ...item, description: e.target.value };
                          setSiteDraft({ ...siteDraft, whyItems: updated });
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Katalog Trip, Rentang Harga & Opsi Durasi Trip */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-6">
                <h2 className="text-base font-bold text-[#17231D] border-b border-[#E2DFD5] pb-3">
                  3. Pengaturan Katalog Trip, Rentang Harga & Durasi Trip Publik
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sc-cat-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Kicker Halaman Katalog Trip
                    </label>
                    <input
                      id="sc-cat-kicker"
                      type="text"
                      value={siteDraft.catalogKicker}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, catalogKicker: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Halaman Katalog Trip
                    </label>
                    <input
                      id="sc-cat-title"
                      type="text"
                      value={siteDraft.catalogTitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, catalogTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-cat-sub"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Subjudul Halaman Katalog Trip
                    </label>
                    <input
                      id="sc-cat-sub"
                      type="text"
                      value={siteDraft.catalogSubtitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, catalogSubtitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-all-tab"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Tab Kategori "Semua"
                    </label>
                    <input
                      id="sc-cat-all-tab"
                      type="text"
                      value={siteDraft.catalogAllCategoriesLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogAllCategoriesLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-search-ph"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Placeholder Kolom Cari Katalog
                    </label>
                    <input
                      id="sc-cat-search-ph"
                      type="text"
                      value={siteDraft.catalogSearchPlaceholder || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogSearchPlaceholder: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-price-lbl"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Filter Rentang Harga
                    </label>
                    <input
                      id="sc-cat-price-lbl"
                      type="text"
                      value={siteDraft.catalogPriceFilterLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogPriceFilterLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-all-prices"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Opsi Default Harga ("Semua Harga")
                    </label>
                    <input
                      id="sc-cat-all-prices"
                      type="text"
                      value={siteDraft.catalogAllPricesLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogAllPricesLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-dur-lbl"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Filter Durasi Trip
                    </label>
                    <input
                      id="sc-cat-dur-lbl"
                      type="text"
                      value={siteDraft.catalogDurationFilterLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogDurationFilterLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-date-lbl"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Filter Bulan Keberangkatan
                    </label>
                    <input
                      id="sc-cat-date-lbl"
                      type="text"
                      value={siteDraft.catalogDateFilterLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogDateFilterLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-sort-lbl"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Urutkan Katalog
                    </label>
                    <input
                      id="sc-cat-sort-lbl"
                      type="text"
                      value={siteDraft.catalogSortLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogSortLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-card-price"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Harga Kartu ("Harga per peserta")
                    </label>
                    <input
                      id="sc-cat-card-price"
                      type="text"
                      value={siteDraft.catalogCardPriceLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogCardPriceLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-card-btn"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Teks Tombol Kartu ("Detail Trip")
                    </label>
                    <input
                      id="sc-cat-card-btn"
                      type="text"
                      value={siteDraft.catalogCardButtonText || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogCardButtonText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-cat-empty-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Saat Filter Katalog Kosong
                    </label>
                    <input
                      id="sc-cat-empty-title"
                      type="text"
                      value={siteDraft.catalogEmptyTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogEmptyTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-cat-empty-sub"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Subjudul Saat Filter Katalog Kosong
                    </label>
                    <input
                      id="sc-cat-empty-sub"
                      type="text"
                      value={siteDraft.catalogEmptySubtitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          catalogEmptySubtitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>

                {/* Daftar Rentang Harga Dinamis */}
                <div className="pt-4 border-t border-[#E2DFD5] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#17231D]">
                        Opsi Filter Rentang Harga
                      </h3>
                      <p className="text-xs text-[#526058]">
                        Atur pilihan harga pada halaman Katalog Trip. Kosongkan batas min/maks jika tidak dibatasi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextPrice: PriceRangeOption = {
                          id: `price-${Date.now()}`,
                          label: 'Rentang Harga Baru',
                          minPrice: null,
                          maxPrice: null,
                        };
                        setSiteDraft({
                          ...siteDraft,
                          priceRanges: [...(siteDraft.priceRanges || []), nextPrice],
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tambah Rentang Harga</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {(siteDraft.priceRanges || []).map((range, idx) => (
                      <div
                        key={range.id}
                        className="p-3 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                      >
                        <div className="sm:col-span-5">
                          <label
                            htmlFor={`pr-label-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Label Pilihan Harga #{idx + 1}
                          </label>
                          <input
                            id={`pr-label-${idx}`}
                            type="text"
                            value={range.label}
                            onChange={(e) => {
                              const updated = [...(siteDraft.priceRanges || [])];
                              updated[idx] = { ...range, label: e.target.value };
                              setSiteDraft({ ...siteDraft, priceRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`pr-min-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Harga Min (IDR)
                          </label>
                          <input
                            id={`pr-min-${idx}`}
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Tanpa batas"
                            value={range.minPrice ?? ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const updated = [...(siteDraft.priceRanges || [])];
                              updated[idx] = {
                                ...range,
                                minPrice: val === '' ? null : Math.max(0, Number(val)),
                              };
                              setSiteDraft({ ...siteDraft, priceRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`pr-max-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Harga Maks (IDR)
                          </label>
                          <input
                            id={`pr-max-${idx}`}
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Tanpa batas"
                            value={range.maxPrice ?? ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const updated = [...(siteDraft.priceRanges || [])];
                              updated[idx] = {
                                ...range,
                                maxPrice: val === '' ? null : Math.max(0, Number(val)),
                              };
                              setSiteDraft({ ...siteDraft, priceRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {(siteDraft.priceRanges || []).length > 1 && (
                            <button
                              type="button"
                              aria-label={`Hapus rentang harga ${range.label}`}
                              onClick={() =>
                                setSiteDraft({
                                  ...siteDraft,
                                  priceRanges: (siteDraft.priceRanges || []).filter(
                                    (_, i) => i !== idx
                                  ),
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daftar Opsi Durasi Trip Dinamis */}
                <div className="pt-4 border-t border-[#E2DFD5] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#17231D]">
                        Opsi Filter Durasi Trip (Beranda & Katalog)
                      </h3>
                      <p className="text-xs text-[#526058]">
                        Atur pilihan durasi hari pada Search Bar Beranda dan filter Katalog Trip.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextDur: DurationRangeOption = {
                          id: `dur-${Date.now()}`,
                          label: 'Durasi Baru',
                          minDays: 1,
                          maxDays: null,
                        };
                        setSiteDraft({
                          ...siteDraft,
                          durationRanges: [...(siteDraft.durationRanges || []), nextDur],
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tambah Opsi Durasi</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {(siteDraft.durationRanges || []).map((dur, idx) => (
                      <div
                        key={dur.id}
                        className="p-3 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                      >
                        <div className="sm:col-span-5">
                          <label
                            htmlFor={`dur-label-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Label Durasi #{idx + 1}
                          </label>
                          <input
                            id={`dur-label-${idx}`}
                            type="text"
                            value={dur.label}
                            onChange={(e) => {
                              const updated = [...(siteDraft.durationRanges || [])];
                              updated[idx] = { ...dur, label: e.target.value };
                              setSiteDraft({ ...siteDraft, durationRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`dur-min-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Min Hari
                          </label>
                          <input
                            id={`dur-min-${idx}`}
                            type="number"
                            min={1}
                            placeholder="Tanpa batas"
                            value={dur.minDays ?? ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const updated = [...(siteDraft.durationRanges || [])];
                              updated[idx] = {
                                ...dur,
                                minDays: val === '' ? null : Math.max(1, Number(val)),
                              };
                              setSiteDraft({ ...siteDraft, durationRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label
                            htmlFor={`dur-max-${idx}`}
                            className="block text-[11px] font-semibold text-[#526058] mb-1"
                          >
                            Maks Hari
                          </label>
                          <input
                            id={`dur-max-${idx}`}
                            type="number"
                            min={1}
                            placeholder="Tanpa batas"
                            value={dur.maxDays ?? ''}
                            onChange={(e) => {
                              const val = e.target.value.trim();
                              const updated = [...(siteDraft.durationRanges || [])];
                              updated[idx] = {
                                ...dur,
                                maxDays: val === '' ? null : Math.max(1, Number(val)),
                              };
                              setSiteDraft({ ...siteDraft, durationRanges: updated });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {(siteDraft.durationRanges || []).length > 1 && (
                            <button
                              type="button"
                              aria-label={`Hapus durasi ${dur.label}`}
                              onClick={() =>
                                setSiteDraft({
                                  ...siteDraft,
                                  durationRanges: (siteDraft.durationRanges || []).filter(
                                    (_, i) => i !== idx
                                  ),
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diskon Rombongan Otomatis (Jumlah Peserta) */}
                <div className="pt-4 border-t border-[#E2DFD5] space-y-3" data-testid="admin-group-discount-section">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#17231D]">
                        Diskon Rombongan Otomatis (Berdasarkan Jumlah Orang)
                      </h3>
                      <p className="text-xs text-[#526058]">
                        Atur jumlah peserta minimal untuk mendapatkan harga lebih murah secara otomatis di halaman detail paket (contoh: 5+ orang diskon 10%, 10+ orang diskon 15%).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = siteDraft.groupDiscounts || [];
                        const highestMin = existing.reduce(
                          (max, item) => Math.max(max, item.minParticipants),
                          0
                        );
                        const nextMin = highestMin > 0 ? Math.min(100, highestMin + 5) : 5;
                        const nextTier: GroupDiscountTier = {
                          id: `grp-${Date.now()}`,
                          minParticipants: nextMin,
                          discountPercent: 10,
                          label: `Hemat Rombongan ${nextMin}+ Org`,
                        };
                        setSiteDraft({
                          ...siteDraft,
                          groupDiscounts: [...existing, nextTier],
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Tambah Aturan Diskon</span>
                    </button>
                  </div>

                  {(siteDraft.groupDiscounts || []).length === 0 ? (
                    <p className="text-xs text-[#526058] italic bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg p-3">
                      Belum ada aturan diskon rombongan aktif. Klik &quot;Tambah Aturan Diskon&quot; untuk mengaktifkan potongan harga grup.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {(siteDraft.groupDiscounts || []).map((tier, idx) => (
                        <div
                          key={tier.id}
                          className="p-3 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                        >
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`grp-min-${idx}`}
                              className="block text-[11px] font-semibold text-[#526058] mb-1"
                            >
                              Minimal Peserta (Orang)
                            </label>
                            <input
                              id={`grp-min-${idx}`}
                              type="number"
                              min={2}
                              max={100}
                              value={tier.minParticipants || ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val =
                                  raw === ''
                                    ? 0
                                    : Math.min(100, Math.max(0, Math.floor(Number(raw) || 0)));
                                const updated = [...(siteDraft.groupDiscounts || [])];
                                updated[idx] = { ...tier, minParticipants: val };
                                setSiteDraft({ ...siteDraft, groupDiscounts: updated });
                              }}
                              onBlur={() => {
                                if (tier.minParticipants < 2) {
                                  const updated = [...(siteDraft.groupDiscounts || [])];
                                  updated[idx] = { ...tier, minParticipants: 2 };
                                  setSiteDraft({ ...siteDraft, groupDiscounts: updated });
                                }
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`grp-pct-${idx}`}
                              className="block text-[11px] font-semibold text-[#526058] mb-1"
                            >
                              Diskon (%)
                            </label>
                            <input
                              id={`grp-pct-${idx}`}
                              type="number"
                              min={1}
                              max={90}
                              value={tier.discountPercent || ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val =
                                  raw === ''
                                    ? 0
                                    : Math.min(90, Math.max(0, Math.round(Number(raw) || 0)));
                                const updated = [...(siteDraft.groupDiscounts || [])];
                                updated[idx] = { ...tier, discountPercent: val };
                                setSiteDraft({ ...siteDraft, groupDiscounts: updated });
                              }}
                              onBlur={() => {
                                if (tier.discountPercent < 1) {
                                  const updated = [...(siteDraft.groupDiscounts || [])];
                                  updated[idx] = { ...tier, discountPercent: 1 };
                                  setSiteDraft({ ...siteDraft, groupDiscounts: updated });
                                }
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg tabular-nums"
                            />
                          </div>
                          <div className="sm:col-span-5">
                            <label
                              htmlFor={`grp-label-${idx}`}
                              className="block text-[11px] font-semibold text-[#526058] mb-1"
                            >
                              Label Keterangan (Opsional)
                            </label>
                            <input
                              id={`grp-label-${idx}`}
                              type="text"
                              placeholder="Contoh: Hemat Rombongan Kecil"
                              value={tier.label || ''}
                              onChange={(e) => {
                                const updated = [...(siteDraft.groupDiscounts || [])];
                                updated[idx] = { ...tier, label: e.target.value };
                                setSiteDraft({ ...siteDraft, groupDiscounts: updated });
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              aria-label={`Hapus diskon ${tier.minParticipants} orang`}
                              onClick={() =>
                                setSiteDraft({
                                  ...siteDraft,
                                  groupDiscounts: (siteDraft.groupDiscounts || []).filter(
                                    (_, i) => i !== idx
                                  ),
                                })
                              }
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 4. Testimoni, CTA Penutup, Halaman Detail Trip & Galeri */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-4">
                <h2 className="text-base font-bold text-[#17231D] border-b border-[#E2DFD5] pb-3">
                  4. Testimoni, CTA Penutup, Halaman Detail Trip & Galeri Guide
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sc-testi-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Kicker Section Testimoni
                    </label>
                    <input
                      id="sc-testi-kicker"
                      type="text"
                      value={siteDraft.testimonialsKicker}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          testimonialsKicker: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-testi-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Section Testimoni
                    </label>
                    <input
                      id="sc-testi-title"
                      type="text"
                      value={siteDraft.testimonialsTitle}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          testimonialsTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-bcta-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Kotak CTA Bawah
                    </label>
                    <input
                      id="sc-bcta-title"
                      type="text"
                      value={siteDraft.bottomCtaTitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, bottomCtaTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-bcta-btn"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Teks Tombol CTA Bawah
                    </label>
                    <input
                      id="sc-bcta-btn"
                      type="text"
                      value={siteDraft.bottomCtaButtonText}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          bottomCtaButtonText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-bcta-sub"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Subjudul Kotak CTA Bawah
                    </label>
                    <input
                      id="sc-bcta-sub"
                      type="text"
                      value={siteDraft.bottomCtaSubtitle}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          bottomCtaSubtitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="sc-gal-kicker"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Kicker Halaman Galeri Guide
                    </label>
                    <input
                      id="sc-gal-kicker"
                      type="text"
                      value={siteDraft.galleryKicker}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, galleryKicker: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-gal-title"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Halaman Galeri Guide
                    </label>
                    <input
                      id="sc-gal-title"
                      type="text"
                      value={siteDraft.galleryTitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, galleryTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-gal-sub"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Subjudul Halaman Galeri Guide
                    </label>
                    <input
                      id="sc-gal-sub"
                      type="text"
                      value={siteDraft.gallerySubtitle}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, gallerySubtitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-gal-guides"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Section Daftar Tour Guide
                    </label>
                    <input
                      id="sc-gal-guides"
                      type="text"
                      value={siteDraft.galleryGuidesTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, galleryGuidesTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-gal-dest"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Filter Destinasi Galeri
                    </label>
                    <input
                      id="sc-gal-dest"
                      type="text"
                      value={siteDraft.galleryDestFilterLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          galleryDestFilterLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-gal-guide-lbl"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Label Filter Tour Guide Galeri
                    </label>
                    <input
                      id="sc-gal-guide-lbl"
                      type="text"
                      value={siteDraft.galleryGuideFilterLabel || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          galleryGuideFilterLabel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-back"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Teks Tombol Kembali
                    </label>
                    <input
                      id="sc-det-back"
                      type="text"
                      value={siteDraft.detailBackText || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, detailBackText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-summary"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Judul Ringkasan
                    </label>
                    <input
                      id="sc-det-summary"
                      type="text"
                      value={siteDraft.detailSummaryTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, detailSummaryTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-itin"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Judul Itinerary
                    </label>
                    <input
                      id="sc-det-itin"
                      type="text"
                      value={siteDraft.detailItineraryTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailItineraryTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-fac"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Judul Fasilitas
                    </label>
                    <input
                      id="sc-det-fac"
                      type="text"
                      value={siteDraft.detailFacilitiesTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailFacilitiesTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-inc"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Subjudul Included
                    </label>
                    <input
                      id="sc-det-inc"
                      type="text"
                      value={siteDraft.detailIncludedTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailIncludedTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-exc"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Subjudul Excluded
                    </label>
                    <input
                      id="sc-det-exc"
                      type="text"
                      value={siteDraft.detailExcludedTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailExcludedTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-mp"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Judul Meeting Point
                    </label>
                    <input
                      id="sc-det-mp"
                      type="text"
                      value={siteDraft.detailMeetingPointTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailMeetingPointTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-cta"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Tombol Pesan Sekarang
                    </label>
                    <input
                      id="sc-det-cta"
                      type="text"
                      value={siteDraft.detailBookingCtaText || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailBookingCtaText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-det-wa"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Detail Trip: Tombol Book via WhatsApp
                    </label>
                    <input
                      id="sc-det-wa"
                      type="text"
                      value={siteDraft.detailWhatsappCtaText || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          detailWhatsappCtaText: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>
              </section>

              {/* 5. Kontak Basecamp & Footer */}
              <section className="bg-white rounded-xl border border-[#E2DFD5] p-6 space-y-4">
                <h2 className="text-base font-bold text-[#17231D] border-b border-[#E2DFD5] pb-3">
                  5. Kontak Basecamp & Informasi Footer
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="sc-footer-nav"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Kolom Navigasi Footer
                    </label>
                    <input
                      id="sc-footer-nav"
                      type="text"
                      value={siteDraft.footerNavTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, footerNavTitle: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-footer-contact"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Judul Kolom Kontak Basecamp Footer
                    </label>
                    <input
                      id="sc-footer-contact"
                      type="text"
                      value={siteDraft.footerContactTitle || ''}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          footerContactTitle: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-basecamp"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Alamat Basecamp
                    </label>
                    <input
                      id="sc-basecamp"
                      type="text"
                      value={siteDraft.basecampAddress}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, basecampAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-email"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Email Resmi Basecamp
                    </label>
                    <input
                      id="sc-email"
                      type="email"
                      value={siteDraft.contactEmail}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, contactEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="sc-copyright"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Teks Hak Cipta (Copyright)
                    </label>
                    <input
                      id="sc-copyright"
                      type="text"
                      value={siteDraft.copyrightText}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, copyrightText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sc-footer-desc"
                      className="block text-xs font-semibold text-[#526058] mb-1"
                    >
                      Deskripsi Singkat Operator di Footer
                    </label>
                    <textarea
                      id="sc-footer-desc"
                      rows={2}
                      value={siteDraft.footerDescription}
                      onChange={(e) =>
                        setSiteDraft({ ...siteDraft, footerDescription: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingSite}
                  className="px-6 py-3 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors cursor-pointer"
                >
                  {savingSite ? 'Menyimpan...' : 'Simpan Semua Konten Website'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 6: LANDING BANNER & PROMO SETTINGS */}
          {activeTab === 'landing' && (
            <form
              onSubmit={handleSaveLanding}
              className="bg-white rounded-xl border border-[#E2DFD5] p-6 max-w-3xl space-y-6"
            >
              <div>
                <h2 className="text-base font-bold text-[#17231D]">
                  Pengaturan Hero & Banner Promosi Landing Page
                </h2>
                <p className="text-xs text-[#526058] mt-1">
                  Perubahan di sini langsung tampil pada halaman beranda publik.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="land-headline"
                    className="block text-xs font-semibold text-[#526058] mb-1.5"
                  >
                    Headline Utama Hero
                  </label>
                  <input
                    id="land-headline"
                    type="text"
                    required
                    value={landingDraft.heroHeadline}
                    onChange={(e) =>
                      setLandingDraft({ ...landingDraft, heroHeadline: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="land-subheadline"
                    className="block text-xs font-semibold text-[#526058] mb-1.5"
                  >
                    Subheadline Hero
                  </label>
                  <textarea
                    id="land-subheadline"
                    rows={3}
                    value={landingDraft.heroSubheadline}
                    onChange={(e) =>
                      setLandingDraft({ ...landingDraft, heroSubheadline: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="land-cta"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Teks Tombol Utama Hero
                    </label>
                    <input
                      id="land-cta"
                      type="text"
                      value={landingDraft.heroCtaText}
                      onChange={(e) =>
                        setLandingDraft({ ...landingDraft, heroCtaText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="land-wa"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Nomor WhatsApp Operator (628xxx)
                    </label>
                    <input
                      id="land-wa"
                      type="text"
                      value={landingDraft.whatsappNumber}
                      onChange={(e) =>
                        setLandingDraft({ ...landingDraft, whatsappNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-xl bg-[#F6F5F0] border border-[#E2DFD5]">
                  <p className="text-xs font-bold text-[#17231D]">Visual Background Hero</p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-4 aspect-[16/10] rounded-lg overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5]">
                      <ResilientImage
                        src={landingDraft.heroImage}
                        alt="Preview Hero"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="sm:col-span-8 space-y-2.5">
                      <div>
                        <label
                          htmlFor="land-hero-upload"
                          className="block text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          Upload Foto Hero Sendiri
                        </label>
                        <input
                          id="land-hero-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleHeroImageUpload}
                          className="w-full text-xs text-[#526058] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E2DFD5] file:text-xs file:font-semibold file:bg-white file:text-[#17231D] hover:file:bg-[#EDEBE4]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="land-hero-url"
                          className="block text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          Atau Ketik / Tempel URL Gambar Hero
                        </label>
                        <input
                          id="land-hero-url"
                          type="text"
                          value={
                            landingDraft.heroImage.startsWith('data:')
                              ? ''
                              : landingDraft.heroImage
                          }
                          onChange={(e) =>
                            setLandingDraft({ ...landingDraft, heroImage: e.target.value })
                          }
                          placeholder={
                            landingDraft.heroImage.startsWith('data:')
                              ? 'Foto lokal terupload (ketik/tempel URL baru untuk mengganti)'
                              : 'https://contoh.com/hero.jpg'
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2DFD5] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#17231D]">
                        Banner Promosi Aktif
                      </p>
                      <p className="text-xs text-[#526058]">
                        Tampilkan strip promo di bagian atas Landing Page
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={landingDraft.promoActive}
                        onChange={(e) =>
                          setLandingDraft({
                            ...landingDraft,
                            promoActive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 accent-[#C85A32]"
                      />
                      <span className="text-sm font-semibold text-[#17231D]">
                        {landingDraft.promoActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="promo-badge"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Label Promo
                      </label>
                      <input
                        id="promo-badge"
                        type="text"
                        value={landingDraft.promoBadge}
                        onChange={(e) =>
                          setLandingDraft({ ...landingDraft, promoBadge: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="promo-code"
                        className="block text-xs font-semibold text-[#526058] mb-1.5"
                      >
                        Kode Voucher
                      </label>
                      <input
                        id="promo-code"
                        type="text"
                        value={landingDraft.promoCode}
                        onChange={(e) =>
                          setLandingDraft({ ...landingDraft, promoCode: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="promo-text"
                      className="block text-xs font-semibold text-[#526058] mb-1.5"
                    >
                      Teks Penawaran Promosi
                    </label>
                    <input
                      id="promo-text"
                      type="text"
                      value={landingDraft.promoText}
                      onChange={(e) =>
                        setLandingDraft({ ...landingDraft, promoText: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2DFD5] flex justify-end">
                <button
                  type="submit"
                  disabled={savingLanding}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg transition-colors cursor-pointer"
                >
                  {savingLanding ? 'Menyimpan...' : 'Simpan Pengaturan Banner'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 7: SECURITY & PIN MANAGEMENT */}
          {activeTab === 'security' && (
            <form
              onSubmit={handleChangePin}
              className="bg-white rounded-xl border border-[#E2DFD5] p-6 max-w-xl space-y-5"
            >
              <div>
                <h2 className="text-base font-bold text-[#17231D]">
                  Ubah PIN atau Kata Sandi Pengelola
                </h2>
                <p className="text-xs text-[#526058] mt-1">
                  Gunakan kombinasi angka PIN atau kata sandi minimal 4 karakter untuk melindungi
                  panel manajemen ini.
                </p>
                <div className="mt-3 p-3.5 rounded-lg bg-[#F6F5F0] border border-[#E2DFD5] text-xs text-[#17231D] space-y-1">
                  <p className="font-semibold text-[#1B3B2B]">Cara Membuka Panel Rahasia:</p>
                  <p>
                    • <strong>HP / Layar Sentuh:</strong> Ketuk teks{' '}
                    <span className="font-mono font-semibold">© 2026</span> di baris paling bawah footer.
                  </p>
                  <p>
                    • <strong>Komputer / Keyboard:</strong> Tekan kombinasi{' '}
                    <span className="font-mono font-semibold">Ctrl + Shift + 8 + 9</span>.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="sec-current-pin"
                    className="block text-xs font-semibold text-[#526058] mb-1.5"
                  >
                    PIN / Kata Sandi Saat Ini
                  </label>
                  <input
                    id="sec-current-pin"
                    type="password"
                    required
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sec-new-pin"
                    className="block text-xs font-semibold text-[#526058] mb-1.5"
                  >
                    PIN / Kata Sandi Baru (Min. 4 karakter)
                  </label>
                  <input
                    id="sec-new-pin"
                    type="password"
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sec-confirm-pin"
                    className="block text-xs font-semibold text-[#526058] mb-1.5"
                  >
                    Konfirmasi PIN / Kata Sandi Baru
                  </label>
                  <input
                    id="sec-confirm-pin"
                    type="password"
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2DFD5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {!adminToken && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Untuk mengubah kata sandi akses lokal, masuk terlebih dahulu menggunakan PIN/kata sandi saat ini.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={savingPin || !adminToken}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1B3B2B] hover:bg-[#132A1E] disabled:opacity-50 rounded-lg transition-colors cursor-pointer sm:ml-auto"
                >
                  {savingPin ? 'Menyimpan...' : 'Perbarui PIN / Kata Sandi'}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* TRIP CREATE / EDIT MODAL */}
      {editingTrip && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isNewTrip ? 'Tambah Paket Trip Baru' : `Edit ${editingTrip.title}`}
          className="fixed inset-0 z-50 bg-[#0F2319]/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveTrip}
            className="bg-white rounded-2xl border border-[#E2DFD5] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-[#E2DFD5] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#17231D]">
                {isNewTrip ? 'Tambah Paket Trip Baru' : `Edit Paket: ${editingTrip.title}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                aria-label="Tutup modal paket trip"
                className="p-1.5 text-[#526058] hover:text-[#17231D] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="trip-title"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Judul Paket Trip
                  </label>
                  <input
                    id="trip-title"
                    type="text"
                    required
                    value={editingTrip.title}
                    onChange={(e) =>
                      setEditingTrip({ ...editingTrip, title: e.target.value })
                    }
                    placeholder="Contoh: Ekspedisi Gunung Prau Dieng"
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-dest"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Destinasi
                  </label>
                  <input
                    id="trip-dest"
                    type="text"
                    required
                    value={editingTrip.destination}
                    onChange={(e) =>
                      setEditingTrip({ ...editingTrip, destination: e.target.value })
                    }
                    placeholder="Contoh: Dieng Plateau"
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-region"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Provinsi / Wilayah
                  </label>
                  <input
                    id="trip-region"
                    type="text"
                    value={editingTrip.region}
                    onChange={(e) =>
                      setEditingTrip({ ...editingTrip, region: e.target.value })
                    }
                    placeholder="Contoh: Jawa Tengah"
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-cat"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Kategori Trip
                  </label>
                  <input
                    id="trip-cat"
                    type="text"
                    required
                    list="trip-cat-suggestions"
                    value={editingTrip.category}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        category: e.target.value,
                      })
                    }
                    placeholder="Ketik kategori, misal: Camping, Mountain, Rafting..."
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                  />
                  <datalist id="trip-cat-suggestions">
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="trip-diff"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Tingkat Kesulitan
                  </label>
                  <select
                    id="trip-diff"
                    value={editingTrip.difficulty}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        difficulty: e.target.value as DifficultyLevel,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  >
                    <option value="Santai">Santai</option>
                    <option value="Menengah">Menengah</option>
                    <option value="Menantang">Menantang</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="trip-days"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Durasi (Hari)
                  </label>
                  <input
                    id="trip-days"
                    type="number"
                    min={1}
                    max={30}
                    value={editingTrip.durationDays || ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setEditingTrip({
                          ...editingTrip,
                          durationDays: 0,
                          durationLabel: '1 Hari',
                        });
                        return;
                      }
                      const d = Math.min(30, Math.max(0, Math.floor(Number(raw) || 0)));
                      const safeD = Math.max(1, d);
                      setEditingTrip({
                        ...editingTrip,
                        durationDays: d,
                        durationLabel: safeD > 1 ? `${safeD} Hari ${safeD - 1} Malam` : '1 Hari',
                      });
                    }}
                    onBlur={() => {
                      if (editingTrip.durationDays < 1) {
                        setEditingTrip({
                          ...editingTrip,
                          durationDays: 1,
                          durationLabel: '1 Hari',
                        });
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-price"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Harga per Peserta (IDR)
                  </label>
                  <input
                    id="trip-price"
                    type="number"
                    min={0}
                    step={1}
                    value={editingTrip.pricePerPerson}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        pricePerPerson: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg tabular-nums"
                  />
                </div>

                {/* Foto Sampul Paket (Upload Sendiri atau Ketik/Tempel URL Sendiri) */}
                <div className="sm:col-span-2 p-4 rounded-xl bg-[#F6F5F0] border border-[#E2DFD5] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#17231D]">
                      Foto Sampul Paket
                    </span>
                    {editingTrip.coverImage.startsWith('data:') && (
                      <span className="text-[11px] font-semibold text-[#1B3B2B]">
                        Foto dari perangkat Anda aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className="sm:col-span-5 aspect-[4/3] rounded-lg overflow-hidden bg-[#EDEBE4] border border-[#E2DFD5]">
                      <ResilientImage
                        src={editingTrip.coverImage}
                        alt={editingTrip.title || 'Preview Foto Sampul'}
                        fallbackTitle="Preview Sampul"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="sm:col-span-7 space-y-3">
                      <div>
                        <label
                          htmlFor="trip-cover-upload"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#C85A32]" aria-hidden="true" />
                          <span>Upload Foto Sampul dari Perangkat</span>
                        </label>
                        <input
                          id="trip-cover-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleTripCoverUpload}
                          className="w-full text-xs text-[#526058] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#E2DFD5] file:text-xs file:font-semibold file:bg-white file:text-[#17231D] hover:file:bg-[#EDEBE4]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="trip-cover-url"
                          className="block text-[11px] font-semibold text-[#526058] mb-1"
                        >
                          Atau Ketik / Tempel Link URL Gambar Sendiri
                        </label>
                        <input
                          id="trip-cover-url"
                          type="text"
                          value={
                            editingTrip.coverImage.startsWith('data:')
                              ? ''
                              : editingTrip.coverImage
                          }
                          onChange={(e) => {
                            const nextUrl = e.target.value;
                            setEditingTrip((prev) => {
                              if (!prev) return prev;
                              const others = prev.galleryImages.filter(
                                (img) => img !== prev.coverImage
                              );
                              return {
                                ...prev,
                                coverImage: nextUrl,
                                galleryImages: nextUrl ? [nextUrl, ...others] : others,
                              };
                            });
                          }}
                          placeholder={
                            editingTrip.coverImage.startsWith('data:')
                              ? 'Foto upload aktif — ketik/tempel URL untuk mengganti'
                              : 'https://contoh.com/foto-paket.jpg'
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Foto Galeri Tambahan untuk Halaman Detail Trip */}
                  <div className="pt-3 border-t border-[#E2DFD5] space-y-2">
                    <span className="block text-[11px] font-semibold text-[#526058]">
                      Foto Galeri Detail Paket ({editingTrip.galleryImages.length} foto)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {editingTrip.galleryImages.map((imgUrl, idx) => (
                        <div
                          key={`${imgUrl.slice(0, 32)}-${idx}`}
                          className="relative w-16 h-12 rounded-md overflow-hidden border border-[#E2DFD5] bg-white group"
                        >
                          <ResilientImage
                            src={imgUrl}
                            alt={`Galeri ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {editingTrip.galleryImages.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Hapus foto galeri ${idx + 1}`}
                              onClick={() =>
                                setEditingTrip((prev) => {
                                  if (!prev) return prev;
                                  const nextImgs = prev.galleryImages.filter((_, i) => i !== idx);
                                  return {
                                    ...prev,
                                    coverImage:
                                      prev.coverImage === imgUrl
                                        ? nextImgs[0] || ''
                                        : prev.coverImage,
                                    galleryImages: nextImgs,
                                  };
                                })
                              }
                              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white opacity-90 hover:bg-red-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <label
                        htmlFor="trip-gallery-upload"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B3B2B] bg-white border border-[#E2DFD5] rounded-lg hover:bg-[#EDEBE4] cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Upload Foto Tambahan</span>
                        <input
                          id="trip-gallery-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleTripGalleryUpload}
                          className="sr-only"
                        />
                      </label>
                      <div className="flex flex-1 gap-1.5">
                        <input
                          type="text"
                          aria-label="URL foto galeri tambahan"
                          value={newGalleryPhotoUrl}
                          onChange={(e) => setNewGalleryPhotoUrl(e.target.value)}
                          placeholder="Atau tambah URL foto galeri..."
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = newGalleryPhotoUrl.trim();
                            if (!url) return;
                            setEditingTrip({
                              ...editingTrip,
                              galleryImages: [...editingTrip.galleryImages, url],
                            });
                            setNewGalleryPhotoUrl('');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1B3B2B] rounded-lg cursor-pointer shrink-0"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="trip-departures"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Jadwal Berangkat (pisah koma YYYY-MM-DD)
                  </label>
                  <input
                    id="trip-departures"
                    type="text"
                    value={editingTrip.nextDepartures.join(', ')}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        nextDepartures: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="trip-desc"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Deskripsi Singkat
                  </label>
                  <textarea
                    id="trip-desc"
                    rows={2}
                    value={editingTrip.shortDescription}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        shortDescription: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-mp-loc"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Lokasi Meeting Point
                  </label>
                  <input
                    id="trip-mp-loc"
                    type="text"
                    value={editingTrip.meetingPoint.location}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        meetingPoint: {
                          ...editingTrip.meetingPoint,
                          location: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-mp-time"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Waktu Meeting Point
                  </label>
                  <input
                    id="trip-mp-time"
                    type="text"
                    value={editingTrip.meetingPoint.time}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        meetingPoint: {
                          ...editingTrip.meetingPoint,
                          time: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-included"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Fasilitas Included (1 item per baris)
                  </label>
                  <textarea
                    id="trip-included"
                    rows={3}
                    value={editingTrip.included.join('\n')}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        included: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-excluded"
                    className="block text-xs font-semibold text-[#526058] mb-1"
                  >
                    Fasilitas Excluded (1 item per baris)
                  </label>
                  <textarea
                    id="trip-excluded"
                    rows={3}
                    value={editingTrip.excluded.join('\n')}
                    onChange={(e) =>
                      setEditingTrip({
                        ...editingTrip,
                        excluded: e.target.value
                          .split('\n')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg"
                  />
                </div>
              </div>

              {/* Itinerary Builder */}
              <div className="pt-4 border-t border-[#E2DFD5] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#17231D]">Itinerary Harian</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDay: ItineraryDay = {
                        day: editingTrip.itinerary.length + 1,
                        title: `Hari ke-${editingTrip.itinerary.length + 1}`,
                        activities: ['Aktivitas utama hari ini'],
                        meals: 'Sarapan & Makan Siang',
                      };
                      setEditingTrip({
                        ...editingTrip,
                        itinerary: [...editingTrip.itinerary, nextDay],
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B3B2B] hover:text-[#C85A32] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Hari</span>
                  </button>
                </div>

                {editingTrip.itinerary.map((dayItem, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F6F5F0] rounded-lg border border-[#E2DFD5] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#C85A32]">
                        Day {dayItem.day}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTrip({
                            ...editingTrip,
                            itinerary: editingTrip.itinerary
                              .filter((_, i) => i !== idx)
                              .map((d, newIdx) => ({ ...d, day: newIdx + 1 })),
                          })
                        }
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus Hari
                      </button>
                    </div>
                    <input
                      type="text"
                      value={dayItem.title}
                      onChange={(e) => {
                        const updated = [...editingTrip.itinerary];
                        updated[idx] = { ...dayItem, title: e.target.value };
                        setEditingTrip({ ...editingTrip, itinerary: updated });
                      }}
                      placeholder="Judul kegiatan hari ini"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded"
                    />
                    <textarea
                      rows={2}
                      value={dayItem.activities.join('\n')}
                      onChange={(e) => {
                        const updated = [...editingTrip.itinerary];
                        updated[idx] = {
                          ...dayItem,
                          activities: e.target.value.split('\n').filter(Boolean),
                        };
                        setEditingTrip({ ...editingTrip, itinerary: updated });
                      }}
                      placeholder="Daftar aktivitas (1 aktivitas per baris)"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2DFD5] rounded"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E2DFD5] bg-[#F6F5F0]/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTrip(null)}
                className="px-4 py-2 text-sm font-medium text-[#526058] hover:text-[#17231D] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] rounded-lg cursor-pointer"
              >
                Simpan Paket Trip
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
