import { useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import type { BookingLead, StoreDatabase, TripPackage } from './types/trip';
import { INITIAL_STORE_DATA } from './data/seedData';
import type { TripFilterCriteria } from './utils/tripLogic';
import { Navbar, type AppView } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { CatalogPage } from './components/CatalogPage';
import { TripDetailPage } from './components/TripDetailPage';
import { GalleryPage } from './components/GalleryPage';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { AdminLoginGate } from './components/AdminLoginGate';

const ADMIN_TOKEN_KEY = 'dexxdigital_admin_token';

export default function App() {
  const [store, setStore] = useState<StoreDatabase>(INITIAL_STORE_DATA);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
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
    let active = true;
    fetch('/api/store')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load store');
        return res.json() as Promise<StoreDatabase>;
      })
      .then((data) => {
        if (active) {
          setStore({
            ...INITIAL_STORE_DATA,
            ...data,
            siteContent: {
              ...INITIAL_STORE_DATA.siteContent,
              ...(data.siteContent || {}),
              priceRanges:
                data.siteContent?.priceRanges && data.siteContent.priceRanges.length > 0
                  ? data.siteContent.priceRanges
                  : INITIAL_STORE_DATA.siteContent.priceRanges,
              durationRanges:
                data.siteContent?.durationRanges &&
                data.siteContent.durationRanges.length > 0
                  ? data.siteContent.durationRanges
                  : INITIAL_STORE_DATA.siteContent.durationRanges,
            },
          });
        }
      })
      .catch(() => {
        // Keep seeded initial data if server unavailable
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

  const handleAdminLogout = () => {
    if (adminToken) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      }).catch(() => {});
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
      leads: [newLead, ...prev.leads],
    }));
  };

  const selectedTrip =
    store.trips.find((t) => t.id === selectedTripId) || store.trips[0];

  if (currentView === 'admin') {
    if (!adminToken) {
      return (
        <MotionConfig reducedMotion="user">
          <AdminLoginGate
            brandName={store.siteContent.brandName}
            onSuccess={handleAdminLoginSuccess}
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
