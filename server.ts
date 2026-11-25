import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_STORE_DATA } from './src/data/seedData.ts';
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
} from './src/types/trip.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const DEFAULT_ADMIN_PIN = process.env.ADMIN_PIN || 'admin123';

interface PersistedStore extends StoreDatabase {
  adminPinHash?: string;
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(`dexxdigital:${pin}`).digest('hex');
}

const activeAdminTokens = new Set<string>();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.header('x-admin-token');
  if (!token || !activeAdminTokens.has(token)) {
    res.status(401).json({ error: 'Sesi pengelola tidak valid atau sudah kedaluwarsa.' });
    return;
  }
  next();
}

function ensureStore(): PersistedStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: PersistedStore = {
      ...structuredClone(INITIAL_STORE_DATA),
      adminPinHash: hashPin(DEFAULT_ADMIN_PIN),
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedStore>;
    if (!parsed.trips || !parsed.landing || !parsed.gallery || !parsed.leads) {
      throw new Error('Invalid store structure');
    }
    let mutated = false;
    const rawGuides = parsed.guides || structuredClone(INITIAL_STORE_DATA.guides);
    const enrichedGuides = rawGuides.map((g) => {
      if (g.photoUrl) return g;
      const seedMatch = INITIAL_STORE_DATA.guides.find((sg) => sg.id === g.id);
      if (seedMatch?.photoUrl) {
        mutated = true;
        return { ...g, photoUrl: seedMatch.photoUrl };
      }
      return g;
    });

    const merged: PersistedStore = {
      trips: parsed.trips,
      guides: enrichedGuides,
      gallery: parsed.gallery,
      landing: { ...INITIAL_STORE_DATA.landing, ...parsed.landing },
      siteContent: {
        ...INITIAL_STORE_DATA.siteContent,
        ...(parsed.siteContent || {}),
        brandLogoUrl:
          parsed.siteContent?.brandLogoUrl || INITIAL_STORE_DATA.siteContent.brandLogoUrl,
        clientLogos:
          parsed.siteContent?.clientLogos !== undefined
            ? parsed.siteContent.clientLogos
            : INITIAL_STORE_DATA.siteContent.clientLogos,
        tripCategories:
          parsed.siteContent?.tripCategories && parsed.siteContent.tripCategories.length > 0
            ? parsed.siteContent.tripCategories
            : INITIAL_STORE_DATA.siteContent.tripCategories,
        priceRanges:
          parsed.siteContent?.priceRanges && parsed.siteContent.priceRanges.length > 0
            ? parsed.siteContent.priceRanges
            : INITIAL_STORE_DATA.siteContent.priceRanges,
        durationRanges:
          parsed.siteContent?.durationRanges && parsed.siteContent.durationRanges.length > 0
            ? parsed.siteContent.durationRanges
            : INITIAL_STORE_DATA.siteContent.durationRanges,
        groupDiscounts:
          parsed.siteContent?.groupDiscounts !== undefined
            ? parsed.siteContent.groupDiscounts
            : INITIAL_STORE_DATA.siteContent.groupDiscounts,
      },
      leads: parsed.leads,
      testimonials:
        parsed.testimonials || structuredClone(INITIAL_STORE_DATA.testimonials),
      adminPinHash: parsed.adminPinHash || hashPin(DEFAULT_ADMIN_PIN),
    };
    if (
      !parsed.siteContent ||
      !parsed.adminPinHash ||
      !parsed.siteContent.tripCategories ||
      !parsed.siteContent.priceRanges ||
      !parsed.siteContent.durationRanges ||
      parsed.siteContent.groupDiscounts === undefined ||
      !parsed.siteContent.brandLogoUrl ||
      !parsed.siteContent.clientLogos
    ) {
      mutated = true;
    }
    if (mutated) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    }
    return merged;
  } catch {
    const fallback: PersistedStore = {
      ...structuredClone(INITIAL_STORE_DATA),
      adminPinHash: hashPin(DEFAULT_ADMIN_PIN),
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveStore(data: PersistedStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function sanitizePublicStore(store: PersistedStore): StoreDatabase {
  return {
    trips: store.trips,
    guides: store.guides,
    gallery: store.gallery,
    landing: store.landing,
    siteContent: store.siteContent,
    leads: [],
    testimonials: store.testimonials,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  ensureStore();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Public site snapshot (excludes admin credentials & customer leads PII)
  app.get('/api/store', (_req, res) => {
    const store = ensureStore();
    res.json(sanitizePublicStore(store));
  });

  // --- ADMIN AUTHENTICATION ---
  app.post('/api/admin/login', (req, res) => {
    const { pinOrPassword } = req.body as { pinOrPassword?: string };
    if (!pinOrPassword || typeof pinOrPassword !== 'string') {
      res.status(400).json({ error: 'PIN atau kata sandi wajib diisi.' });
      return;
    }
    const store = ensureStore();
    const expectedHash = store.adminPinHash || hashPin(DEFAULT_ADMIN_PIN);
    if (hashPin(pinOrPassword.trim()) !== expectedHash) {
      res.status(401).json({ error: 'PIN atau kata sandi salah. Silakan coba lagi.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    activeAdminTokens.add(token);
    res.json({ token });
  });

  app.get('/api/admin/verify', requireAdmin, (_req, res) => {
    res.json({ valid: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    const token = req.header('x-admin-token');
    if (token) activeAdminTokens.delete(token);
    res.json({ ok: true });
  });

  app.put('/api/admin/security', requireAdmin, (req, res) => {
    const { currentPin, newPin } = req.body as {
      currentPin?: string;
      newPin?: string;
    };
    const store = ensureStore();
    const expectedHash = store.adminPinHash || hashPin(DEFAULT_ADMIN_PIN);
    if (!currentPin || hashPin(currentPin.trim()) !== expectedHash) {
      res.status(401).json({ error: 'PIN / kata sandi saat ini tidak cocok.' });
      return;
    }
    if (!newPin || newPin.trim().length < 4) {
      res.status(400).json({ error: 'PIN / kata sandi baru minimal 4 karakter.' });
      return;
    }
    store.adminPinHash = hashPin(newPin.trim());
    saveStore(store);
    res.json({ ok: true });
  });

  // --- TRIPS CRUD (Protected) ---
  app.get('/api/trips', (_req, res) => {
    const store = ensureStore();
    res.json(store.trips);
  });

  app.post('/api/trips', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<TripPackage>;
    if (!payload.title || !payload.destination || !payload.category) {
      res.status(400).json({ error: 'Judul, destinasi, dan kategori wajib diisi.' });
      return;
    }

    const rawId =
      typeof payload.id === 'string' && payload.id.trim()
        ? payload.id.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
        : '';
    const id = rawId || `trip-${Date.now()}`;
    const cleanCategory = payload.category.trim();
    const currentCats =
      store.siteContent.tripCategories || INITIAL_STORE_DATA.siteContent.tripCategories || [];
    if (!currentCats.some((c) => c.toLowerCase() === cleanCategory.toLowerCase())) {
      store.siteContent.tripCategories = [...currentCats, cleanCategory];
    }

    const newTrip: TripPackage = {
      id,
      slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: payload.title.trim(),
      destination: payload.destination.trim(),
      region: (payload.region || 'Indonesia').trim(),
      category: cleanCategory,
      durationDays: Math.min(60, Math.max(1, Math.floor(Number(payload.durationDays) || 2))),
      durationLabel:
        payload.durationLabel ||
        `${Math.min(60, Math.max(1, Math.floor(Number(payload.durationDays) || 2)))} Hari`,
      pricePerPerson: Math.min(500000000, Math.max(0, Number(payload.pricePerPerson) || 1500000)),
      rating: Number(payload.rating) || 4.9,
      reviewCount: Number(payload.reviewCount) || 1,
      difficulty: payload.difficulty || 'Menengah',
      maxParticipants: Number(payload.maxParticipants) || 12,
      nextDepartures:
        Array.isArray(payload.nextDepartures) && payload.nextDepartures.length > 0
          ? payload.nextDepartures
          : ['2026-12-20'],
      featured: Boolean(payload.featured),
      shortDescription: (payload.shortDescription || '').trim(),
      coverImage:
        payload.coverImage || '/src/assets/images/hero_rinjani_expedition_1794756899898.jpg',
      galleryImages:
        Array.isArray(payload.galleryImages) && payload.galleryImages.length > 0
          ? payload.galleryImages
          : [payload.coverImage || '/src/assets/images/hero_rinjani_expedition_1794756899898.jpg'],
      meetingPoint: payload.meetingPoint || {
        location: 'Titik Kumpul Utama',
        time: '07:00 WIB',
        notes: 'Detail titik kumpul diinformasikan oleh tour leader H-2.',
      },
      included: Array.isArray(payload.included) ? payload.included : [],
      excluded: Array.isArray(payload.excluded) ? payload.excluded : [],
      itinerary: Array.isArray(payload.itinerary) ? payload.itinerary : [],
    };

    store.trips.unshift(newTrip);
    saveStore(store);
    res.status(201).json(newTrip);
  });

  app.put('/api/trips/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const idx = store.trips.findIndex((t) => t.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Paket trip tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<TripPackage>;
    const updatedCategory = body.category ? body.category.trim() : store.trips[idx].category;
    const currentCats =
      store.siteContent.tripCategories || INITIAL_STORE_DATA.siteContent.tripCategories || [];
    if (
      updatedCategory &&
      !currentCats.some((c) => c.toLowerCase() === updatedCategory.toLowerCase())
    ) {
      store.siteContent.tripCategories = [...currentCats, updatedCategory];
    }

    const updated: TripPackage = {
      ...store.trips[idx],
      ...body,
      category: updatedCategory,
      id,
    };
    store.trips[idx] = updated;
    saveStore(store);
    res.json(updated);
  });

  app.delete('/api/trips/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const before = store.trips.length;
    store.trips = store.trips.filter((t) => t.id !== id);
    if (store.trips.length === before) {
      res.status(404).json({ error: 'Paket trip tidak ditemukan.' });
      return;
    }
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // --- GALLERY CRUD (Protected) ---
  app.post('/api/gallery', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<GalleryItem>;
    if (!payload.title || !payload.destination || !payload.guideId) {
      res.status(400).json({ error: 'Judul, destinasi, dan tour guide wajib diisi.' });
      return;
    }
    const guide = store.guides.find((g) => g.id === payload.guideId);
    const newItem: GalleryItem = {
      id: payload.id || `gal-${Date.now()}`,
      title: payload.title.trim(),
      caption: (payload.caption || '').trim(),
      destination: payload.destination.trim(),
      guideId: payload.guideId,
      guideName: guide?.name || payload.guideName || 'Tim Guide DexxDigital',
      mediaType: payload.mediaType === 'video' ? 'video' : 'photo',
      mediaUrl: payload.mediaUrl || '/src/assets/images/guide_action_summit_1794756902427.jpg',
      capturedDate: payload.capturedDate || new Date().toISOString().slice(0, 10),
      aspectHint: payload.aspectHint || 'landscape',
    };
    store.gallery.unshift(newItem);
    saveStore(store);
    res.status(201).json(newItem);
  });

  app.put('/api/gallery/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const idx = store.gallery.findIndex((g) => g.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Item galeri tidak ditemukan.' });
      return;
    }
    const payload = req.body as Partial<GalleryItem>;
    const guide = payload.guideId
      ? store.guides.find((g) => g.id === payload.guideId)
      : undefined;

    store.gallery[idx] = {
      ...store.gallery[idx],
      ...payload,
      guideName: guide?.name || payload.guideName || store.gallery[idx].guideName,
      id,
    };
    saveStore(store);
    res.json(store.gallery[idx]);
  });

  app.delete('/api/gallery/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    store.gallery = store.gallery.filter((g) => g.id !== id);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // --- LANDING & SITE CONTENT SETTINGS (Protected) ---
  app.put('/api/landing', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<LandingSettings>;
    store.landing = {
      ...store.landing,
      ...payload,
    };
    saveStore(store);
    res.json(store.landing);
  });

  app.put('/api/site-content', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<SiteContent>;
    store.siteContent = {
      ...store.siteContent,
      ...payload,
    };
    saveStore(store);
    res.json(store.siteContent);
  });

  // --- TOUR GUIDES CRUD (Protected) ---
  app.post('/api/guides', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<TourGuide>;
    if (!payload.name || !payload.specialty) {
      res.status(400).json({ error: 'Nama dan spesialisasi guide wajib diisi.' });
      return;
    }
    const newGuide: TourGuide = {
      id: payload.id || `guide-${Date.now()}`,
      name: payload.name.trim(),
      specialty: payload.specialty.trim(),
      certification: (payload.certification || 'Sertifikasi Resmi HPI/APGI').trim(),
      experienceYears: Number(payload.experienceYears) || 3,
      tripsLed: Number(payload.tripsLed) || 10,
      bio: (payload.bio || '').trim(),
      photoUrl: (payload.photoUrl || '').trim(),
    };
    store.guides.push(newGuide);
    saveStore(store);
    res.status(201).json(newGuide);
  });

  app.put('/api/guides/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const idx = store.guides.findIndex((g) => g.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Tour guide tidak ditemukan.' });
      return;
    }
    const updated: TourGuide = {
      ...store.guides[idx],
      ...(req.body as Partial<TourGuide>),
      id,
    };
    store.guides[idx] = updated;
    // Sync guideName in gallery items assigned to this guide
    store.gallery = store.gallery.map((item) =>
      item.guideId === id ? { ...item, guideName: updated.name } : item
    );
    saveStore(store);
    res.json(updated);
  });

  app.delete('/api/guides/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    store.guides = store.guides.filter((g) => g.id !== id);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // --- TESTIMONIALS CRUD (Protected) ---
  app.post('/api/testimonials', requireAdmin, (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<Testimonial>;
    if (!payload.name || !payload.quote) {
      res.status(400).json({ error: 'Nama dan kutipan testimoni wajib diisi.' });
      return;
    }
    const newTesti: Testimonial = {
      id: payload.id || `testi-${Date.now()}`,
      name: payload.name.trim(),
      role: (payload.role || 'Peserta Open Trip').trim(),
      tripName: (payload.tripName || 'Open Trip Nusantara').trim(),
      rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
      quote: payload.quote.trim(),
      date: (payload.date || 'November 2026').trim(),
    };
    store.testimonials.unshift(newTesti);
    saveStore(store);
    res.status(201).json(newTesti);
  });

  app.put('/api/testimonials/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const idx = store.testimonials.findIndex((t) => t.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Testimoni tidak ditemukan.' });
      return;
    }
    store.testimonials[idx] = {
      ...store.testimonials[idx],
      ...(req.body as Partial<Testimonial>),
      id,
    };
    saveStore(store);
    res.json(store.testimonials[idx]);
  });

  app.delete('/api/testimonials/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    store.testimonials = store.testimonials.filter((t) => t.id !== id);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  // --- LEADS / BOOKINGS ---
  app.get('/api/leads', requireAdmin, (_req, res) => {
    const store = ensureStore();
    res.json(store.leads);
  });

  app.post('/api/leads', (req, res) => {
    const store = ensureStore();
    const payload = req.body as Partial<BookingLead>;
    if (!payload.customerName || !payload.whatsapp || !payload.tripTitle) {
      res.status(400).json({ error: 'Nama, WhatsApp, dan paket trip wajib diisi.' });
      return;
    }

    const rawLeadId =
      typeof payload.id === 'string' && payload.id.trim()
        ? payload.id.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
        : '';
    const newLead: BookingLead = {
      id: rawLeadId || `lead-${Date.now()}`,
      tripId: String(payload.tripId || 'custom').slice(0, 128),
      tripTitle: String(payload.tripTitle).trim().slice(0, 200),
      customerName: payload.customerName.trim().slice(0, 120),
      whatsapp: payload.whatsapp.trim().slice(0, 30),
      email: String(payload.email || '').trim().slice(0, 120),
      departureDate: String(payload.departureDate || '').trim().slice(0, 40),
      participants: Math.min(30, Math.max(1, Math.floor(Number(payload.participants) || 1))),
      totalEstimatedPrice: Math.min(
        2000000000,
        Math.max(0, Math.round(Number(payload.totalEstimatedPrice) || 0))
      ),
      notes: String(payload.notes || '').trim().slice(0, 1000),
      status: 'Baru',
      createdAt: new Date().toISOString(),
    };

    store.leads.unshift(newLead);
    saveStore(store);
    res.status(201).json(newLead);
  });

  app.patch('/api/leads/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    const { status } = req.body as { status?: LeadStatus };
    const idx = store.leads.findIndex((l) => l.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data pesanan tidak ditemukan.' });
      return;
    }
    if (status) {
      store.leads[idx].status = status;
    }
    saveStore(store);
    res.json(store.leads[idx]);
  });

  app.delete('/api/leads/:id', requireAdmin, (req, res) => {
    const store = ensureStore();
    const { id } = req.params;
    store.leads = store.leads.filter((l) => l.id !== id);
    saveStore(store);
    res.json({ deleted: true, id });
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // Vite middleware in dev, static serving in production
  const distPath = path.join(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' &&
      fs.existsSync(path.join(distPath, 'index.html')));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`DexxDigital server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
