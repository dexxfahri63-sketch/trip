import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MotionConfig } from 'motion/react';
import type { BookingLead, StoreDatabase, TripPackage } from './types/trip';
import { INITIAL_STORE_DATA } from './data/seedData';
import { resolveAssetUrl } from './utils/assetMap';
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
    brandLogoUrl: incoming?.brandLogoUrl || base.brandLogoUrl,
    clientLogos:
      incoming?.clientLogos !== undefined ? incoming.clientLogos : base.clientLogos,
    priceRanges:
      incoming?.priceRanges && incoming.priceRanges.length > 0
        ? incoming.priceRanges
        : base.priceRanges,
    durationRanges:
      incoming?.durationRanges && incoming.durationRanges.length > 0
        ? incoming.durationRanges
        : base.durationRanges,
    groupDiscounts:
      incoming?.groupDiscounts !== undefined
        ? incoming.groupDiscounts
        : base.groupDiscounts,
    tripCategories:
      incoming?.tripCategories && incoming.tripCategories.length > 0
        ? incoming.tripCategories
        : base.tripCategories,
  };
}

function mergeGuidesWithDefaults(
  guides: StoreDatabase['guides']
): StoreDatabase['guides'] {
  return guides.map((g) => {
    if (g.photoUrl) return g;
    const seedMatch = INITIAL_STORE_DATA.guides.find((sg) => sg.id === g.id);
    return seedMatch?.photoUrl ? { ...g, photoUrl: seedMatch.photoUrl } : g;
  });
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
    console.info('[DexxDigital:App:AuthEffect] Initializing Firestore connectivity check & Firebase Auth listener', {
      adminEmailConfigured: Boolean(ADMIN_EMAIL),
    });

    testFirestoreConnection()
      .then(() => {
        console.info('[DexxDigital:App:AuthEffect] Firestore connectivity test completed');
      })
      .catch((err) => {
        console.warn('[DexxDigital:App:AuthEffect] Firestore connectivity test failed:', err);
      });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      console.info('[DexxDigital:App:AuthEffect] onAuthStateChanged fired:', {
        authenticated: Boolean(user),
        uid: user?.uid || null,
        email: user?.email || null,
        emailVerified: user?.emailVerified ?? false,
      });

      setFirebaseUser(user);
      if (!user) {
        setIsFirebaseAdmin(false);
        setAuthReady(true);
        console.info('[DexxDigital:App:AuthEffect] Auth ready (signed out)', {
          authReady: true,
          isFirebaseAdmin: false,
        });
        return;
      }

      let adminOk = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);
      let verificationSource = adminOk ? 'email_allowlist' : 'none';

      if (!adminOk) {
        try {
          console.info('[DexxDigital:App:AuthEffect] Checking Firestore admins collection for uid:', user.uid);
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          adminOk = adminDoc.exists();
          if (adminOk) {
            verificationSource = 'firestore_admins_doc';
          }
        } catch (err) {
          console.warn('[DexxDigital:App:AuthEffect] Failed checking Firestore admins doc:', err);
          adminOk = false;
        }
      }

      setIsFirebaseAdmin(adminOk);
      setAuthReady(true);
      console.info('[DexxDigital:App:AuthEffect] Auth ready (signed in)', {
        authReady: true,
        isFirebaseAdmin: adminOk,
        verificationSource,
      });
    });

    return () => {
      console.info('[DexxDigital:App:AuthEffect] Cleaning up Firebase Auth listener');
      unsubAuth();
    };
  }, []);

  // 2. Load local fallback store + subscribe to real-time Cloud Firestore public collections
  useEffect(() => {
    let active = true;
    console.info('[DexxDigital:App:StoreInitEffect] Starting /api/store fetch and Firestore public store subscription');

    fetch('/api/store')
      .then((res) => {
        console.info('[DexxDigital:App:StoreInitEffect] /api/store response received:', {
          status: res.status,
          ok: res.ok,
        });
        if (!res.ok) throw new Error(`Failed to load store (HTTP ${res.status})`);
        return res.json() as Promise<StoreDatabase>;
      })
      .then((data) => {
        if (!active) {
          console.info('[DexxDigital:App:StoreInitEffect] Ignoring /api/store payload because effect unmounted');
          return;
        }
        console.info('[DexxDigital:App:StoreInitEffect] Applying /api/store data:', {
          trips: data.trips?.length ?? 0,
          guides: data.guides?.length ?? 0,
          gallery: data.gallery?.length ?? 0,
          testimonials: data.testimonials?.length ?? 0,
        });
        setStore((prev) => ({
          ...prev,
          ...data,
          guides: mergeGuidesWithDefaults(data.guides || prev.guides),
          siteContent: mergeSiteContent(INITIAL_STORE_DATA.siteContent, data.siteContent),
        }));
      })
      .catch((err) => {
        console.warn(
          '[DexxDigital:App:StoreInitEffect] /api/store unavailable, keeping seeded initial data:',
          err
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          console.info('[DexxDigital:App:StoreInitEffect] Initial loading state cleared (loading=false)');
        }
      });

    const unsubPublic = subscribePublicFirestoreStore((patch) => {
      if (!active) return;
      console.info('[DexxDigital:App:StoreInitEffect] Firestore public snapshot patch received:', {
        updatedKeys: Object.keys(patch),
        trips: patch.trips?.length,
        guides: patch.guides?.length,
        gallery: patch.gallery?.length,
        testimonials: patch.testimonials?.length,
      });
      setStore((prev) => ({
        ...prev,
        ...(patch.trips ? { trips: patch.trips } : {}),
        ...(patch.guides ? { guides: mergeGuidesWithDefaults(patch.guides) } : {}),
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
      console.info('[DexxDigital:App:StoreInitEffect] Unsubscribing Firestore public store listeners');
      active = false;
      unsubPublic();
    };
  }, []);

  // 3. Auto-seed Firestore if empty once admin signs in with Google + listen to protected leads
  useEffect(() => {
    console.info('[DexxDigital:App:AdminSyncEffect] Evaluating admin Firestore sync readiness:', {
      authReady,
      isFirebaseAdmin,
    });
    if (!authReady || !isFirebaseAdmin) {
      return;
    }

    let active = true;
    isFirestoreStoreSeeded()
      .then(async (seeded) => {
        console.info('[DexxDigital:App:AdminSyncEffect] Firestore seed check complete:', { seeded, active });
        if (active && !seeded) {
          console.info('[DexxDigital:App:AdminSyncEffect] Firestore empty; auto-seeding initial store...');
          await seedStoreToFirestore(storeRef.current);
          console.info('[DexxDigital:App:AdminSyncEffect] Auto-seed completed successfully');
        }
      })
      .catch((err) => {
        console.warn('[DexxDigital:App:AdminSyncEffect] Firestore seed check/auto-seed failed:', err);
      });

    console.info('[DexxDigital:App:AdminSyncEffect] Subscribing to protected Firestore leads collection');
    const unsubLeads = subscribeLeadsFromFirestore((leads) => {
      if (active) {
        console.info('[DexxDigital:App:AdminSyncEffect] Protected leads snapshot updated:', {
          leadsCount: leads.length,
        });
        setStore((prev) => ({ ...prev, leads }));
      }
    });

    return () => {
      console.info('[DexxDigital:App:AdminSyncEffect] Unsubscribing protected leads listener');
      active = false;
      unsubLeads();
    };
  }, [authReady, isFirebaseAdmin]);

  useEffect(() => {
    if (store.siteContent.brandName) {
      const nextTitle = `${store.siteContent.brandName} — Open Trip & Tour Operator Nusantara`;
      document.title = nextTitle;
      console.info('[DexxDigital:App:BrandingEffect] Document title synced:', nextTitle);
    }
  }, [store.siteContent.brandName]);

  // Sync browser tab favicon dynamically if brandLogoUrl is customized
  useEffect(() => {
    const iconHref = store.siteContent.brandLogoUrl
      ? resolveAssetUrl(store.siteContent.brandLogoUrl)
      : '/favicon.svg';
    const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    if (links.length > 0) {
      links.forEach((link) => {
        link.href = iconHref;
      });
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = iconHref;
      document.head.appendChild(link);
    }
    console.info('[DexxDigital:App:FaviconEffect] Browser favicon synced:', {
      iconHref,
      updatedExistingLinks: links.length,
    });
  }, [store.siteContent.brandLogoUrl]);

  // Hidden desktop shortcut: Ctrl + Shift + 89 (supports simultaneous 8+9 or sequential 8 then 9)
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastDigit8AtRef = useRef<number>(0);

  useEffect(() => {
    console.info('[DexxDigital:App:ShortcutEffect] Registering Ctrl+Shift+89 admin shortcut listeners');
    const isEightKey = (e: KeyboardEvent) =>
      e.code === 'Digit8' || e.key === '8' || e.key === '*';
    const isNineKey = (e: KeyboardEvent) =>
      e.code === 'Digit9' || e.key === '9' || e.key === '(';

    const onKeyDown = (e: KeyboardEvent) => {
      const eight = isEightKey(e);
      const nine = isNineKey(e);

      if (eight) pressedKeysRef.current.add('8');
      if (nine) pressedKeysRef.current.add('9');

      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const now = Date.now();
        if (eight) {
          lastDigit8AtRef.current = now;
        }
        const simultaneous =
          pressedKeysRef.current.has('8') && pressedKeysRef.current.has('9');
        const sequential = nine && now - lastDigit8AtRef.current <= 1500;

        if (simultaneous || sequential) {
          e.preventDefault();
          lastDigit8AtRef.current = 0;
          pressedKeysRef.current.clear();
          console.info('[DexxDigital:App:ShortcutEffect] Hidden admin shortcut activated, navigating to admin view');
          setCurrentView('admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isEightKey(e)) pressedKeysRef.current.delete('8');
      if (isNineKey(e)) pressedKeysRef.current.delete('9');
      if (!e.ctrlKey && !e.shiftKey) {
        pressedKeysRef.current.clear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      console.info('[DexxDigital:App:ShortcutEffect] Removing admin shortcut listeners');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

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
          brandLogoUrl={store.siteContent.brandLogoUrl}
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
              key={selectedTrip.id}
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
