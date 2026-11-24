export type TripCategory = string;

export type DifficultyLevel = 'Santai' | 'Menengah' | 'Menantang';

export type MediaType = 'photo' | 'video';

export type LeadStatus = 'Baru' | 'Dihubungi' | 'Confirmed' | 'Selesai' | 'Dibatalkan';

export type WhyIconKey = 'shield' | 'award' | 'receipt' | 'compass' | 'users';

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
  meals: string;
}

export interface TripPackage {
  id: string;
  slug: string;
  title: string;
  destination: string;
  region: string;
  category: TripCategory;
  durationDays: number;
  durationLabel: string;
  pricePerPerson: number;
  rating: number;
  reviewCount: number;
  difficulty: DifficultyLevel;
  maxParticipants: number;
  nextDepartures: string[];
  featured: boolean;
  shortDescription: string;
  coverImage: string;
  galleryImages: string[];
  meetingPoint: {
    location: string;
    time: string;
    notes: string;
  };
  included: string[];
  excluded: string[];
  itinerary: ItineraryDay[];
}

export interface TourGuide {
  id: string;
  name: string;
  specialty: string;
  certification: string;
  experienceYears: number;
  tripsLed: number;
  bio: string;
  photoUrl?: string;
}

export interface ClientLogoItem {
  id: string;
  name: string;
  sector?: string;
  logoUrl: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  destination: string;
  guideId: string;
  guideName: string;
  mediaType: MediaType;
  mediaUrl: string;
  capturedDate: string;
  aspectHint: 'portrait' | 'landscape' | 'square';
}

export interface LandingSettings {
  heroHeadline: string;
  heroSubheadline: string;
  heroImage: string;
  heroCtaText: string;
  promoActive: boolean;
  promoBadge: string;
  promoText: string;
  promoCode: string;
  whatsappNumber: string;
}

export interface WhyChooseItem {
  id: string;
  title: string;
  description: string;
  icon: WhyIconKey;
}

export interface ProofMetric {
  value: string;
  label: string;
}

export interface PriceRangeOption {
  id: string;
  label: string;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface DurationRangeOption {
  id: string;
  label: string;
  minDays?: number | null;
  maxDays?: number | null;
}

export interface GroupDiscountTier {
  id: string;
  minParticipants: number;
  discountPercent: number;
  label?: string;
}

export interface SiteContent {
  brandName: string;
  brandLogoUrl?: string;
  headerCtaText: string;
  navHomeLabel?: string;
  navCatalogLabel?: string;
  navGalleryLabel?: string;
  navWhyLabel?: string;
  heroKicker: string;
  heroSecondaryCtaText: string;
  clientsKicker?: string;
  clientsTitle?: string;
  clientLogos?: ClientLogoItem[];
  searchDestinationLabel?: string;
  searchAllDestinationsLabel?: string;
  searchDateLabel?: string;
  searchDurationLabel?: string;
  searchAllDurationsLabel?: string;
  searchButtonText?: string;
  popularKicker: string;
  popularTitle: string;
  popularViewAllText?: string;
  popularPricePrefix?: string;
  whyKicker: string;
  whyTitle: string;
  whyDescription: string;
  whyMetrics: ProofMetric[];
  whyItems: WhyChooseItem[];
  testimonialsKicker: string;
  testimonialsTitle: string;
  bottomCtaTitle: string;
  bottomCtaSubtitle: string;
  bottomCtaButtonText: string;
  catalogKicker: string;
  catalogTitle: string;
  catalogSubtitle: string;
  catalogAllCategoriesLabel?: string;
  catalogSearchPlaceholder?: string;
  catalogPriceFilterLabel?: string;
  catalogAllPricesLabel?: string;
  catalogDurationFilterLabel?: string;
  catalogDateFilterLabel?: string;
  catalogSortLabel?: string;
  catalogCardPriceLabel?: string;
  catalogCardButtonText?: string;
  catalogEmptyTitle?: string;
  catalogEmptySubtitle?: string;
  priceRanges?: PriceRangeOption[];
  durationRanges?: DurationRangeOption[];
  groupDiscounts?: GroupDiscountTier[];
  detailBackText?: string;
  detailSummaryTitle?: string;
  detailItineraryTitle?: string;
  detailFacilitiesTitle?: string;
  detailIncludedTitle?: string;
  detailExcludedTitle?: string;
  detailMeetingPointTitle?: string;
  detailBookingCtaText?: string;
  detailWhatsappCtaText?: string;
  galleryKicker: string;
  galleryTitle: string;
  gallerySubtitle: string;
  galleryGuidesTitle?: string;
  galleryDestFilterLabel?: string;
  galleryGuideFilterLabel?: string;
  footerDescription: string;
  footerNavTitle?: string;
  footerContactTitle?: string;
  basecampAddress: string;
  contactEmail: string;
  copyrightText: string;
  tripCategories?: string[];
}

export interface BookingLead {
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
  status: LeadStatus;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  tripName: string;
  rating: number;
  quote: string;
  date: string;
}

export interface StoreDatabase {
  trips: TripPackage[];
  guides: TourGuide[];
  gallery: GalleryItem[];
  landing: LandingSettings;
  siteContent: SiteContent;
  leads: BookingLead[];
  testimonials: Testimonial[];
}
