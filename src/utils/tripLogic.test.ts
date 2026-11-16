import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppBookingUrl,
  calculateTotalPrice,
  filterGalleryItems,
  filterTrips,
  formatIDR,
  getAvailableTripCategories,
  slugifyTripTitle,
  validateBookingInput,
  validatePinChangeInput,
} from './tripLogic';
import type { GalleryItem, TripPackage } from '../types/trip';

const sampleTrips: TripPackage[] = [
  {
    id: 't1',
    slug: 'rinjani-3d2n',
    title: 'Ekspedisi Puncak Rinjani via Sembalun',
    destination: 'Gunung Rinjani',
    region: 'Lombok, NTB',
    category: 'Mountain',
    durationDays: 3,
    durationLabel: '3 Hari 2 Malam',
    pricePerPerson: 2650000,
    rating: 4.9,
    reviewCount: 124,
    difficulty: 'Menantang',
    maxParticipants: 12,
    nextDepartures: ['2026-12-10', '2026-12-24'],
    featured: true,
    shortDescription: 'Pendakian kawah Segara Anak dan puncak 3.726 mdpl.',
    coverImage: '/img/rinjani.jpg',
    galleryImages: ['/img/rinjani.jpg'],
    meetingPoint: {
      location: 'Bandara Internasional Lombok (LOP)',
      time: '08:00 WITA',
      notes: 'Penjemputan grup tepat waktu.',
    },
    included: ['Guide APGI', 'Porter tim'],
    excluded: ['Tiket pesawat'],
    itinerary: [
      {
        day: 1,
        title: 'Sembalun ke Plawangan',
        activities: ['Registrasi TNGR', 'Trekking Pos 1-3'],
        meals: 'Makan Siang & Malam',
      },
    ],
  },
  {
    id: 't2',
    slug: 'komodo-sailing-3d2n',
    title: 'Phinisi Sailing Komodo & Padar',
    destination: 'Labuan Bajo',
    region: 'NTT',
    category: 'Island',
    durationDays: 3,
    durationLabel: '3 Hari 2 Malam',
    pricePerPerson: 4200000,
    rating: 4.95,
    reviewCount: 98,
    difficulty: 'Santai',
    maxParticipants: 16,
    nextDepartures: ['2026-12-18'],
    featured: true,
    shortDescription: 'Berlayar di Taman Nasional Komodo.',
    coverImage: '/img/komodo.jpg',
    galleryImages: ['/img/komodo.jpg'],
    meetingPoint: {
      location: 'Pelabuhan Labuan Bajo',
      time: '09:30 WITA',
      notes: 'Briefing keselamatan di dermaga.',
    },
    included: ['Kapal Phinisi AC'],
    excluded: ['Tiket Taman Nasional'],
    itinerary: [],
  },
  {
    id: 't3',
    slug: 'bandung-highland-2d1n',
    title: 'Jelajah Heritage & Kebun Teh Ciwidey',
    destination: 'Bandung',
    region: 'Jawa Barat',
    category: 'City Tour',
    durationDays: 2,
    durationLabel: '2 Hari 1 Malam',
    pricePerPerson: 1450000,
    rating: 4.8,
    reviewCount: 64,
    difficulty: 'Santai',
    maxParticipants: 15,
    nextDepartures: ['2026-11-28'],
    featured: false,
    shortDescription: 'Eksplorasi arsitektur Braga dan lembah teh Ciwidey.',
    coverImage: '/img/bandung.jpg',
    galleryImages: ['/img/bandung.jpg'],
    meetingPoint: {
      location: 'Stasiun Bandung',
      time: '07:30 WIB',
      notes: 'Titik kumpul pintu utara.',
    },
    included: ['Transportasi HiAce'],
    excluded: ['Pengeluaran pribadi'],
    itinerary: [],
  },
];

const sampleGallery: GalleryItem[] = [
  {
    id: 'g1',
    title: 'Briefing Pagi Plawangan',
    caption: 'Guide memeriksa perlengkapan sebelum summit attack.',
    destination: 'Gunung Rinjani',
    guideId: 'guide-1',
    guideName: 'Raka Pratama',
    mediaType: 'photo',
    mediaUrl: '/img/g1.jpg',
    capturedDate: '2026-10-12',
    aspectHint: 'portrait',
  },
  {
    id: 'g2',
    title: 'Snorkeling Briefing Komodo',
    caption: 'Persiapan alat snorkeling di dek Phinisi.',
    destination: 'Labuan Bajo',
    guideId: 'guide-2',
    guideName: 'Bagus Mahendra',
    mediaType: 'video',
    mediaUrl: '/img/g2.jpg',
    capturedDate: '2026-10-20',
    aspectHint: 'landscape',
  },
];

test('formatIDR formats Indonesian Rupiah without decimals', () => {
  const formatted = formatIDR(2650000);
  assert.match(formatted, /2\.650\.000/);
  assert.match(formatted, /Rp/);
});

test('calculateTotalPrice applies participants and discount accurately', () => {
  assert.equal(calculateTotalPrice(1500000, 3, 0), 4500000);
  assert.equal(calculateTotalPrice(2000000, 2, 10), 3600000);
  assert.equal(calculateTotalPrice(1000000, 0, 0), 1000000);
});

test('filterTrips filters by category, price range, duration, and date month', () => {
  const mountain = filterTrips(sampleTrips, { category: 'Mountain' });
  assert.equal(mountain.length, 1);
  assert.equal(mountain[0].id, 't1');

  const under2m = filterTrips(sampleTrips, { priceRange: 'under2m' });
  assert.equal(under2m.length, 1);
  assert.equal(under2m[0].id, 't3');

  const decTrips = filterTrips(sampleTrips, { date: '2026-12-01' });
  assert.equal(decTrips.length, 2);

  const sortedAsc = filterTrips(sampleTrips, { sortBy: 'price-asc' });
  assert.deepEqual(
    sortedAsc.map((t) => t.id),
    ['t3', 't1', 't2']
  );
});

test('filterGalleryItems filters by destination and guideId', () => {
  assert.equal(filterGalleryItems(sampleGallery, 'Semua', 'Semua').length, 2);
  const byGuide = filterGalleryItems(sampleGallery, 'Semua', 'guide-2');
  assert.equal(byGuide.length, 1);
  assert.equal(byGuide[0].id, 'g2');
  const byDest = filterGalleryItems(sampleGallery, 'Gunung Rinjani', 'Semua');
  assert.equal(byDest.length, 1);
  assert.equal(byDest[0].id, 'g1');
});

test('validateBookingInput catches missing or invalid fields', () => {
  const invalid = validateBookingInput({
    customerName: 'A',
    whatsapp: '123',
    email: 'not-an-email',
    departureDate: '',
    participants: 0,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.customerName);
  assert.ok(invalid.errors.whatsapp);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.departureDate);
  assert.ok(invalid.errors.participants);

  const valid = validateBookingInput({
    customerName: 'Nadia Kartika',
    whatsapp: '081234567890',
    email: 'nadia@example.com',
    departureDate: '2026-12-10',
    participants: 2,
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('buildWhatsAppBookingUrl formats Indonesian country code and encoded payload', () => {
  const url = buildWhatsAppBookingUrl('0812-3456-7890', {
    tripTitle: 'Ekspedisi Rinjani',
    customerName: 'Budi',
    departureDate: '2026-12-10',
    participants: 2,
    totalEstimatedPrice: 5300000,
    notes: 'Vegetarian',
  });
  assert.ok(url.startsWith('https://wa.me/6281234567890?text='));
  assert.ok(url.includes(encodeURIComponent('Ekspedisi Rinjani')));
  assert.ok(url.includes(encodeURIComponent('Vegetarian')));
});

test('slugifyTripTitle produces clean URL slug', () => {
  assert.equal(
    slugifyTripTitle('Open Trip Bromo & Kawah Ijen!'),
    'open-trip-bromo-kawah-ijen'
  );
});

test('validatePinChangeInput validates minimum length and confirmation match', () => {
  const mismatch = validatePinChangeInput({
    currentPin: 'dexx2026',
    newPin: '123456',
    confirmPin: '654321',
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.confirmPin);

  const tooShort = validatePinChangeInput({
    currentPin: 'dexx2026',
    newPin: '12',
    confirmPin: '12',
  });
  assert.equal(tooShort.valid, false);
  assert.ok(tooShort.errors.newPin);

  const ok = validatePinChangeInput({
    currentPin: 'dexx2026',
    newPin: 'rahasia99',
    confirmPin: 'rahasia99',
  });
  assert.equal(ok.valid, true);
});

test('getAvailableTripCategories merges configured presets and custom trip categories without duplicates', () => {
  const withCustom: TripPackage[] = [
    ...sampleTrips,
    {
      ...sampleTrips[0],
      id: 't4',
      category: 'Camping & Glamping',
    },
    {
      ...sampleTrips[0],
      id: 't5',
      category: 'mountain',
    },
  ];
  const cats = getAvailableTripCategories(withCustom, ['Mountain', 'Island', 'City Tour', 'Kuliner']);
  assert.deepEqual(cats, ['Mountain', 'Island', 'City Tour', 'Kuliner', 'Camping & Glamping']);

  const filtered = filterTrips(withCustom, { category: 'camping & glamping' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 't4');
});

test('filterTrips filters accurately using custom configured priceRanges and durationRanges', () => {
  const customConfig = {
    priceRanges: [
      { id: 'budget', label: 'Hemat <= 2jt', minPrice: null, maxPrice: 2000000 },
      { id: 'mid', label: 'Menengah 2.1jt - 3jt', minPrice: 2100000, maxPrice: 3000000 },
    ],
    durationRanges: [
      { id: 'short', label: '2 Hari', minDays: 2, maxDays: 2 },
    ],
  };

  const budgetTrips = filterTrips(sampleTrips, { priceRange: 'budget' }, customConfig);
  assert.deepEqual(
    budgetTrips.map((t) => t.id),
    ['t3']
  );

  const midTrips = filterTrips(sampleTrips, { priceRange: 'mid' }, customConfig);
  assert.deepEqual(
    midTrips.map((t) => t.id),
    ['t1']
  );

  const twoDayTrips = filterTrips(sampleTrips, { durationRange: 'short' }, customConfig);
  assert.deepEqual(
    twoDayTrips.map((t) => t.id),
    ['t3']
  );
});



