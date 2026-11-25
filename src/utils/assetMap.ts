import heroRinjani from '../assets/images/hero_rinjani_expedition_1794756899898.jpg';
import tripBromo from '../assets/images/trip_bromo_sunrise_1794756899184.jpg';
import tripKomodo from '../assets/images/trip_komodo_island_1794756900496.jpg';
import tripPenida from '../assets/images/trip_nusa_penida_1794756900703.jpg';
import tripBandung from '../assets/images/trip_bandung_heritage_1794756900870.jpg';
import guideSummit from '../assets/images/guide_action_summit_1794756902427.jpg';
import guideOcean from '../assets/images/guide_action_ocean_1794756902658.jpg';
import guideCamp from '../assets/images/guide_action_camp_1794756903075.jpg';
import guidePortraitRaka from '../assets/images/guide_portrait_raka_1795012889559.jpg';
import guidePortraitBagus from '../assets/images/guide_portrait_bagus_1795012890204.jpg';
import guidePortraitSinta from '../assets/images/guide_portrait_sinta_1795012890977.jpg';
import guidePortraitDewi from '../assets/images/guide_portrait_dewi_1795012890280.jpg';

const ASSET_MAP: Record<string, string> = {
  '/src/assets/images/hero_rinjani_expedition_1794756899898.jpg': heroRinjani,
  '/src/assets/images/trip_bromo_sunrise_1794756899184.jpg': tripBromo,
  '/src/assets/images/trip_komodo_island_1794756900496.jpg': tripKomodo,
  '/src/assets/images/trip_nusa_penida_1794756900703.jpg': tripPenida,
  '/src/assets/images/trip_bandung_heritage_1794756900870.jpg': tripBandung,
  '/src/assets/images/guide_action_summit_1794756902427.jpg': guideSummit,
  '/src/assets/images/guide_action_ocean_1794756902658.jpg': guideOcean,
  '/src/assets/images/guide_action_camp_1794756903075.jpg': guideCamp,
  '/src/assets/images/guide_portrait_raka_1795012889559.jpg': guidePortraitRaka,
  '/src/assets/images/guide_portrait_bagus_1795012890204.jpg': guidePortraitBagus,
  '/src/assets/images/guide_portrait_sinta_1795012890977.jpg': guidePortraitSinta,
  '/src/assets/images/guide_portrait_dewi_1795012890280.jpg': guidePortraitDewi,
};

export const AVAILABLE_ASSET_OPTIONS = [
  {
    label: 'Ekspedisi Rinjani Golden Hour',
    value: '/src/assets/images/hero_rinjani_expedition_1794756899898.jpg',
  },
  {
    label: 'Kaldera Bromo Sunrise',
    value: '/src/assets/images/trip_bromo_sunrise_1794756899184.jpg',
  },
  {
    label: 'Pulau Padar & Phinisi Komodo',
    value: '/src/assets/images/trip_komodo_island_1794756900496.jpg',
  },
  {
    label: 'Tebing Nusa Penida Bali',
    value: '/src/assets/images/trip_nusa_penida_1794756900703.jpg',
  },
  {
    label: 'Kebun Teh Ciwidey Bandung',
    value: '/src/assets/images/trip_bandung_heritage_1794756900870.jpg',
  },
  {
    label: 'Aksi Guide Jalur Puncak',
    value: '/src/assets/images/guide_action_summit_1794756902427.jpg',
  },
  {
    label: 'Briefing Guide di Kapal Phinisi',
    value: '/src/assets/images/guide_action_ocean_1794756902658.jpg',
  },
  {
    label: 'Suasana Basecamp Hutan Pinus',
    value: '/src/assets/images/guide_action_camp_1794756903075.jpg',
  },
];

export function resolveAssetUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return heroRinjani;
  return ASSET_MAP[pathOrUrl] ?? pathOrUrl;
}
