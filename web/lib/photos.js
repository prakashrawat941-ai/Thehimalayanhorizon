// Photos for the public pages.
// - Wikimedia Commons files: free licences (checked on each file page, Nov 2026). Credit is required and is
//   shown by <PhotoCredits>. Local WebP copies are resized from the credited originals and have an emergency fallback.
// - THH photos: supplied by the owner for the site (web/public/img/thh).
// To replace a photo with an owned one later, change `src` and remove `credit`.

const lic = {
  bysa4: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  bysa3: ['CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  bysa2: ['CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  by2: ['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
};
const commons = (file) => `https://commons.wikimedia.org/wiki/File:${file}`;
const credit = (file, author, l) => ({ title: file.replace(/_/g, ' '), author, license: l[0], licenseUrl: l[1], page: commons(file) });
const THH = { owner: true };

export const PHOTOS = {
  hero: {
    src: '/img/commons/hero.webp',
    fallback: '/img/cab/road-hero-1200.webp', alt: ['Panchachuli peaks seen from Pithoragarh', 'पिथौरागढ़ से दिखती पंचाचूली चोटियाँ'],
    credit: credit('Panchachuli_Peaks.jpg', 'Mukul.pandey07', lic.bysa4),
  },
  munsiyari: {
    src: '/img/commons/munsiyari.webp',
    fallback: '/img/places/munsiyari.jpg', credit: credit('Panchuli_peak_from_munsiyari_-_panoramio_(2).jpg', 'Vipin Vasudeva', lic.bysa3),
  },
  almora: {
    src: '/img/commons/almora.webp',
    fallback: '/img/places/almora.jpg', credit: credit('Almora_Uttarakhand.jpg', 'SureshChandraPandey', lic.bysa4),
  },
  jageshwar: {
    src: '/img/commons/jageshwar.webp',
    fallback: '/img/places/jageshwar.jpg', credit: credit('Jageshwar_Dham_Temple,_Almora_91.jpg', 'FarEnd2018', lic.bysa4),
  },
  binsar: {
    src: '/img/commons/binsar.webp',
    fallback: '/img/places/binsar.jpg', credit: credit('Binsar,_a_view_of_Kumaon_Himalayas.jpg', 'solarshakti', lic.by2),
  },
  village: {
    src: '/img/commons/village.webp',
    fallback: '/img/home/c-walk.jpg', alt: ['Terrace fields and a Kumaoni house in a small village', 'छोटे गाँव में सीढ़ीदार खेत और कुमाऊँनी घर'],
    credit: credit('Terrace_farming_in_a_small_himalayan_village(binsar_wild_life_sanctury).jpg', 'Rajborah123', lic.bysa4),
  },
  kumaon: {
    src: '/img/commons/kumaon.webp',
    fallback: '/img/home/hero.jpg', credit: credit('Landscape_of_Kumaon.jpg', 'Harshit SR', lic.bysa4),
  },
  spring: {
    src: '/img/commons/spring.webp',
    fallback: '/img/cab/road-hero-1200.webp', credit: credit('Way_to_Jageshwar_Temple_Almora.jpg', 'Chauhans87', lic.bysa4),
  },
  summer: {
    src: '/img/commons/summer.webp',
    fallback: '/img/home/s-summer.jpg', credit: credit('A_view_of_a_village_near_Almora_district_of_Uttarakhand,_north_India.jpg', 'Raja Harjai', lic.bysa2),
  },
  monsoon: {
    src: '/img/commons/monsoon.webp',
    fallback: '/img/home/s-monsoon.jpg', credit: credit('Valley_of_flowers_national_park,_Uttarakhand,_India_03_(edit).jpg', 'Rohit Sharma (derivative: UnpetitproleX)', lic.bysa4),
  },
  winter: {
    src: '/img/commons/winter.webp',
    fallback: '/img/home/s-winter.jpg', credit: credit('Auli_Lake.jpg', 'ArmouredCyborg', lic.bysa4),
  },
  autumn: { src: '/img/thh/nanda-devi.webp', ...THH },
  workBalcony: { src: '/img/thh/work-balcony.webp', fallback: '/img/home/work.jpg', ...THH },
  workValley: { src: '/img/thh/work-valley.webp', ...THH },
  workBreakfast: { src: '/img/thh/work-breakfast.webp', ...THH },
  thali: { src: '/img/thh/food-thali.webp', fallback: '/img/home/c-food.jpg', ...THH },
  aipan: { src: '/img/thh/aipan-ganesh.webp', ...THH },
  aipanPlate: { src: '/img/thh/aipan-plate.webp', fallback: '/img/home/c-craft.jpg', ...THH },
  doli: { src: '/img/thh/devta-doli.webp', ...THH },
  bells: { src: '/img/thh/temple-bells.webp', ...THH },
  walk: { src: '/img/home/c-walk.jpg', ...THH },
};

// Fallback theme photo by CMS theme slug. Unknown slugs use generated art.
export const THEME_PHOTO = {
  'village-life': 'village', 'work-from-mountain': 'workBalcony', 'treks-nature': 'spring',
  spiritual: 'jageshwar', 'local-food': 'thali', 'wildlife-birding': 'binsar',
};

// Bundled place photos by location slug, used when the CMS row has no image.
export const PLACE_PHOTO = { munsiyari: 'munsiyari', almora: 'almora', jageshwar: 'jageshwar', binsar: 'binsar' };
