import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MotionConfig } from 'motion/react';
import type { BookingLead, StoreDatabase, TripPackage } from './types/trip';
import { INITIAL_STORE_DATA } from './data/seedData';
import type { TripFilterCriteria } from './utils/tripLogic';
import {
  ADMIN_EMAIL,
  auth,
  db,
  googleProvider,
  testFirestoreConnection,
} from './lib/firebase';
import {
  isFirestoreStoreSeeded,
  seedStoreToFirestore,
  subscribeLeadsFromFirestore,
  subscribePublicFirestoreStore,
} from './services/firestoreStore';
import { Navbar, type AppView } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { CatalogPage } from './components/CatalogPage';
import { TripDetailPage } from './components/TripDetailPage';
import { GalleryPage } from './components/GalleryPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AdminLoginGate } from './components/AdminLoginGate';

const ADMIN_TOKEN_KEY = 'dexxdigital_admin_token';

function mergeSiteContent(
  base: StoreDatabase['siteContent'],
  incoming?: Partial<StoreDatabase['siteContent']>
): StoreDatabase['siteContent'] {
  return {
    ...base,
    ...(incoming || {}),
    priceRanges:
      incoming?.priceRanges && incoming.priceRanges.length > 0
        ? incoming.priceRanges
        : base.priceRanges,
    durationRanges:
      incoming?.durationRanges && incoming.durationRanges.length > 0
        ? incoming.durationRanges
        : base.durationRanges,
    tripCategories:
      incoming?.tripCategories && incoming.tripCategories.length > 0
        ? incoming.tripCategories
        : base.tripCategories,
  };
}

export default function App() {
  const [store, setStore] = useState<StoreDatabase>(INITIAL_STORE_DATA);
  const storeRef = useRef<StoreDatabase>(INITIAL_STORE_DATA);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [catalogFilters, setCatalogFilters] = useState<TripFilterCriteria>({
    query: '',
    destination: '',
    date: '',
    category: 'Semua',
    priceRange: 'all',
    durationRange: 'all',
    sortBy: 'popular',
  });

  const whySectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // 1. Test Firestore connectivity & track Firebase Auth readiness
  useEffect(() => {
    testFirestoreConnection().catch(() => {});

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setIsFirebaseAdmin(false);
        setAuthReady(true);
        return;
      }

      let adminOk = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);
      if (!adminOk) {
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          adminOk = adminDoc.exists();
        } catch {
          adminOk = false;
        }
      }
      setIsFirebaseAdmin(adminOk);
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  // 2. Load local fallback store + subscribe to real-time Cloud Firestore public collections
  useEffect(() => {
    let active = true;

    fetch('/api/store')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load store');
        return res.json() as Promise<StoreDatabase>;
      })
      .then((data) => {
        if (active) {
          setStore((prev) => ({
            ...prev,
            ...data,
            siteContent: mergeSiteContent(INITIAL_STORE_DATA.siteContent, data.siteContent),
          }));
        }
      })
      .catch(() => {
        // Keep seeded initial data if server unavailable
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubPublic = subscribePublicFirestoreStore((patch) => {
      if (!active) return;
      setStore((prev) => ({
        ...prev,
        ...(patch.trips ? { trips: patch.trips } : {}),
        ...(patch.guides ? { guides: patch.guides } : {}),
        ...(patch.gallery ? { gallery: patch.gallery } : {}),
        ...(patch.testimonials ? { testimonials: patch.testimonials } : {}),
        ...(patch.landing ? { landing: { ...prev.landing, ...patch.landing } } : {}),
        ...(patch.siteContent
          ? {
              siteContent: mergeSiteContent(
                INITIAL_STORE_DATA.siteContent,
                patch.siteContent
              ),
            }
          : {}),
      }));
    });

    return () => {
      active = false;
      unsubPublic();
    };
  }, []);

  // 3. Auto-seed Firestore if empty once admin signs in with Google + listen to protected leads
  useEffect(() => {
    if (!authReady || !isFirebaseAdmin) return;

    let active = true;
    isFirestoreStoreSeeded()
      .then(async (seeded) => {
        if (active && !seeded) {
          await seedStoreToFirestore(storeRef.current);
        }
      })
      .catch(() => {});

    const unsubLeads = subscribeLeadsFromFirestore((leads) => {
      if (active) {
        setStore((prev) => ({ ...prev, leads }));
      }
    });

    return () => {
      active = false;
      unsubLeads();
    };
  }, [authReady, isFirebaseAdmin]);

  useEffect(() => {
    if (store.siteContent.brandName) {
      document.title = `${store.siteContent.brandName} — Open Trip & Tour Operator Nusantara`;
    }
  }, [store.siteContent.brandName]);

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch {
      // Ignore storage errors
    }
  };

  const handleConnectGoogleAdmin = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    let allowed = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);
    if (!allowed) {
      try {
        const snap = await getDoc(doc(db, 'admins', user.uid));
        allowed = snap.exists();
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      await signOut(auth).catch(() => {});
      throw new Error(
        `Akun ${user.email || ''} bukan admin terdaftar (${ADMIN_EMAIL}).`
      );
    }
    setFirebaseUser(user);
    setIsFirebaseAdmin(true);
    const seeded = await isFirestoreStoreSeeded().catch(() => false);
    if (!seeded) {
      await seedStoreToFirestore(storeRef.current);
    }
  };

  const handleAdminLogout = () => {
    if (adminToken) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      }).catch(() => {});
    }
    if (firebaseUser) {
      signOut(auth).catch(() => {});
    }
    setAdminToken('');
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
    navigateTo('landing');
  };

  const handleAuthExpired = () => {
    setAdminToken('');
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleSelectTrip = (trip: TripPackage) => {
    setSelectedTripId(trip.id);
    navigateTo('detail');
  };

  const handleQuickSearch = (filters: {
    destination: string;
    date: string;
    durationRange: string;
  }) => {
    setCatalogFilters({
      query: '',
      destination: filters.destination,
      date: filters.date,
      category: 'Semua',
      priceRange: 'all',
      durationRange: filters.durationRange,
      sortBy: 'popular',
    });
    navigateTo('catalog');
  };

  const handleLeadSubmitted = (newLead: BookingLead) => {
    setStore((prev) => ({
      ...prev,
      leads: [newLead, ...prev.leads.filter((l) => l.id !== newLead.id)],
    }));
  };

  const selectedTrip =
    store.trips.find((t) => t.id === selectedTripId) || store.trips[0];

  const isAdminUnlocked = Boolean(adminToken || isFirebaseAdmin);

  if (currentView === 'admin') {
    if (!isAdminUnlocked) {
      return (
        <MotionConfig reducedMotion="user">
          <AdminLoginGate
            brandName={store.siteContent.brandName}
            onSuccess={handleAdminLoginSuccess}
            onGoogleSuccess={() => {
              setIsFirebaseAdmin(true);
            }}
            onCancel={() => navigateTo('landing')}
          />
        </MotionConfig>
      );
    }

    return (
      <MotionConfig reducedMotion="user">
        <AdminDashboardPage
          store={store}
          adminToken={adminToken}
          isFirebaseAdmin={isFirebaseAdmin}
          firebaseEmail={firebaseUser?.email || null}
          onConnectGoogleAdmin={handleConnectGoogleAdmin}
          onExitAdmin={() => navigateTo('landing')}
          onLogout={handleAdminLogout}
          onAuthExpired={handleAuthExpired}
          onStoreChange={setStore}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#F6F5F0] text-[#17231D]">
        <Navbar
          brandName={store.siteContent.brandName}
          headerCtaText={store.siteContent.headerCtaText}
          navHomeLabel={store.siteContent.navHomeLabel}
          navCatalogLabel={store.siteContent.navCatalogLabel}
          navGalleryLabel={store.siteContent.navGalleryLabel}
          navWhyLabel={store.siteContent.navWhyLabel}
          currentView={currentView}
          onNavigate={navigateTo}
          onScrollToWhy={() => {
            whySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        <main className="flex-1">
          {loading && store.trips.length === 0 ? (
            <div className="max-w-7xl mx-auto px-6 py-24 text-center text-sm text-[#526058]">
              Memuat katalog perjalanan {store.siteContent.brandName}...
            </div>
          ) : currentView === 'landing' ? (
            <LandingPage
              landing={store.landing}
              siteContent={store.siteContent}
              trips={store.trips}
              testimonials={store.testimonials}
              whySectionRef={whySectionRef}
              onSearchSubmit={handleQuickSearch}
              onSelectTrip={handleSelectTrip}
              onGoToCatalog={() => navigateTo('catalog')}
              onGoToGallery={() => navigateTo('gallery')}
            />
          ) : currentView === 'catalog' ? (
            <CatalogPage
              trips={store.trips}
              siteContent={store.siteContent}
              filters={catalogFilters}
              onFiltersChange={setCatalogFilters}
              onSelectTrip={handleSelectTrip}
            />
          ) : currentView === 'detail' && selectedTrip ? (
            <TripDetailPage
              trip={selectedTrip}
              siteContent={store.siteContent}
              whatsappNumber={store.landing.whatsappNumber}
              onBack={() => navigateTo('catalog')}
              onLeadSubmitted={handleLeadSubmitted}
            />
          ) : (
            <GalleryPage
              gallery={store.gallery}
              guides={store.guides}
              siteContent={store.siteContent}
            />
          )}
        </main>

        <Footer
          whatsappNumber={store.landing.whatsappNumber}
          siteContent={store.siteContent}
          onNavigate={navigateTo}
        />
      </div>
    </MotionConfig>
  );
}
