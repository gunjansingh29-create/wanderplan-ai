/**
 * WanderPlan AI — Database Seed Script
 * Run: npx prisma db seed   (configure in package.json)
 *
 * Contents:
 *   • 30 test users with varied profiles
 *   • 100 popular destinations across all continents
 *   • 500 sample POIs with hobby tags
 *   • 5 complete sample trips in different planning stages
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function uuid() {
  return crypto.randomUUID();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. USERS (30 test accounts)
// ════════════════════════════════════════════════════════════════════════════

const HOBBY_POOL = [
  "hiking", "photography", "cooking", "scuba_diving", "surfing", "yoga",
  "cycling", "rock_climbing", "skiing", "birdwatching", "painting",
  "wine_tasting", "history", "archaeology", "live_music", "street_art",
  "kayaking", "meditation", "running", "dance", "fishing", "gardening",
];

const INTEREST_POOL = [
  "architecture", "local_cuisine", "nightlife", "museums", "wildlife",
  "beaches", "mountains", "temples", "markets", "festivals",
  "ancient_ruins", "modern_art", "street_food", "adventure_sports",
  "wellness", "luxury_spas", "vineyards", "craft_breweries",
];

const DIETARY_OPTIONS = [
  "vegetarian", "vegan", "gluten_free", "halal", "kosher",
  "lactose_free", "nut_free", "pescatarian",
];

const userDefs = [
  // Solo travelers (5)
  { first: "Alex",    last: "Chen",      style: "solo",      fitness: "high",     budget: "moderate", diet: ["vegetarian"] },
  { first: "Priya",   last: "Sharma",    style: "solo",      fitness: "athletic", budget: "budget",   diet: [] },
  { first: "Marcus",  last: "Johnson",   style: "solo",      fitness: "moderate", budget: "premium",  diet: ["gluten_free"] },
  { first: "Yuki",    last: "Tanaka",    style: "solo",      fitness: "high",     budget: "moderate", diet: [] },
  { first: "Elena",   last: "Popov",     style: "solo",      fitness: "moderate", budget: "budget",   diet: ["vegan"] },
  // Couples (5)
  { first: "James",   last: "Wilson",    style: "couple",    fitness: "moderate", budget: "premium",  diet: [] },
  { first: "Sarah",   last: "Wilson",    style: "couple",    fitness: "moderate", budget: "premium",  diet: ["lactose_free"] },
  { first: "Carlos",  last: "Rivera",    style: "couple",    fitness: "high",     budget: "moderate", diet: [] },
  { first: "Ana",     last: "Rivera",    style: "couple",    fitness: "high",     budget: "moderate", diet: ["pescatarian"] },
  { first: "Kenji",   last: "Nakamura",  style: "couple",    fitness: "athletic", budget: "luxury",   diet: [] },
  // Families (5)
  { first: "David",   last: "Thompson",  style: "family",    fitness: "moderate", budget: "moderate", diet: [] },
  { first: "Lisa",    last: "Thompson",  style: "family",    fitness: "low",      budget: "moderate", diet: ["nut_free"] },
  { first: "Ahmed",   last: "Hassan",    style: "family",    fitness: "moderate", budget: "budget",   diet: ["halal"] },
  { first: "Fatima",  last: "Hassan",    style: "family",    fitness: "low",      budget: "budget",   diet: ["halal"] },
  { first: "Michael", last: "Brown",     style: "family",    fitness: "moderate", budget: "premium",  diet: [] },
  // Adventure travelers (5)
  { first: "Jake",    last: "Morrison",  style: "adventure", fitness: "athletic", budget: "moderate", diet: [] },
  { first: "Zara",    last: "Okafor",    style: "adventure", fitness: "athletic", budget: "budget",   diet: ["vegan"] },
  { first: "Liam",    last: "O'Brien",   style: "adventure", fitness: "high",     budget: "moderate", diet: [] },
  { first: "Sofia",   last: "Gutierrez", style: "adventure", fitness: "high",     budget: "budget",   diet: ["vegetarian"] },
  { first: "Raj",     last: "Patel",     style: "adventure", fitness: "athletic", budget: "premium",  diet: [] },
  // Luxury travelers (5)
  { first: "Victoria",last: "Sterling",  style: "luxury",    fitness: "moderate", budget: "luxury",   diet: [] },
  { first: "Richard", last: "Sterling",  style: "luxury",    fitness: "low",      budget: "luxury",   diet: [] },
  { first: "Isabelle",last: "Fontaine",  style: "luxury",    fitness: "moderate", budget: "luxury",   diet: ["gluten_free"] },
  { first: "Hans",    last: "Mueller",   style: "luxury",    fitness: "moderate", budget: "luxury",   diet: [] },
  { first: "Mei",     last: "Lin",       style: "luxury",    fitness: "moderate", budget: "luxury",   diet: ["pescatarian"] },
  // Group travelers (5)
  { first: "Tyler",   last: "Adams",     style: "group",     fitness: "moderate", budget: "budget",   diet: [] },
  { first: "Olivia",  last: "Scott",     style: "group",     fitness: "moderate", budget: "moderate", diet: ["vegetarian"] },
  { first: "Ethan",   last: "Kim",       style: "group",     fitness: "high",     budget: "moderate", diet: [] },
  { first: "Chloe",   last: "Martin",    style: "group",     fitness: "low",      budget: "budget",   diet: [] },
  { first: "Noah",    last: "Garcia",    style: "group",     fitness: "moderate", budget: "moderate", diet: ["kosher"] },
];

// ════════════════════════════════════════════════════════════════════════════
// 2. DESTINATIONS (100 across all continents)
// ════════════════════════════════════════════════════════════════════════════

const destinations = [
  // EUROPE (25)
  { name: "Paris",             country: "France",        lat: 48.8566,   lng: 2.3522,    months: [4,5,6,9,10] },
  { name: "Barcelona",        country: "Spain",         lat: 41.3874,   lng: 2.1686,    months: [5,6,9,10] },
  { name: "Rome",             country: "Italy",         lat: 41.9028,   lng: 12.4964,   months: [4,5,9,10] },
  { name: "Santorini",        country: "Greece",        lat: 36.3932,   lng: 25.4615,   months: [5,6,9,10] },
  { name: "Amsterdam",        country: "Netherlands",   lat: 52.3676,   lng: 4.9041,    months: [4,5,6,7,8,9] },
  { name: "Prague",           country: "Czech Republic",lat: 50.0755,   lng: 14.4378,   months: [5,6,9,10] },
  { name: "London",           country: "United Kingdom",lat: 51.5074,   lng: -0.1278,   months: [5,6,7,8,9] },
  { name: "Reykjavik",        country: "Iceland",       lat: 64.1466,   lng: -21.9426,  months: [6,7,8] },
  { name: "Dubrovnik",        country: "Croatia",       lat: 42.6507,   lng: 18.0944,   months: [5,6,9,10] },
  { name: "Vienna",           country: "Austria",       lat: 48.2082,   lng: 16.3738,   months: [4,5,6,9,10] },
  { name: "Zurich",           country: "Switzerland",   lat: 47.3769,   lng: 8.5417,    months: [6,7,8,9] },
  { name: "Edinburgh",        country: "United Kingdom",lat: 55.9533,   lng: -3.1883,   months: [5,6,7,8] },
  { name: "Lisbon",           country: "Portugal",      lat: 38.7223,   lng: -9.1393,   months: [3,4,5,9,10,11] },
  { name: "Copenhagen",       country: "Denmark",       lat: 55.6761,   lng: 12.5683,   months: [5,6,7,8] },
  { name: "Budapest",         country: "Hungary",       lat: 47.4979,   lng: 19.0402,   months: [4,5,6,9,10] },
  { name: "Istanbul",         country: "Turkey",        lat: 41.0082,   lng: 28.9784,   months: [4,5,9,10,11] },
  { name: "Bergen",           country: "Norway",        lat: 60.3913,   lng: 5.3221,    months: [6,7,8] },
  { name: "Florence",         country: "Italy",         lat: 43.7696,   lng: 11.2558,   months: [4,5,6,9,10] },
  { name: "Munich",           country: "Germany",       lat: 48.1351,   lng: 11.5820,   months: [5,6,7,8,9] },
  { name: "Amalfi Coast",     country: "Italy",         lat: 40.6340,   lng: 14.6027,   months: [5,6,9,10] },
  { name: "Bruges",           country: "Belgium",       lat: 51.2094,   lng: 3.2247,    months: [4,5,6,9] },
  { name: "Helsinki",         country: "Finland",       lat: 60.1699,   lng: 24.9384,   months: [6,7,8] },
  { name: "Krakow",           country: "Poland",        lat: 50.0647,   lng: 19.9450,   months: [5,6,7,8,9] },
  { name: "Seville",          country: "Spain",         lat: 37.3891,   lng: -5.9845,   months: [3,4,5,10,11] },
  { name: "Cinque Terre",     country: "Italy",         lat: 44.1461,   lng: 9.6439,    months: [5,6,9,10] },
  // ASIA (25)
  { name: "Tokyo",            country: "Japan",         lat: 35.6762,   lng: 139.6503,  months: [3,4,10,11] },
  { name: "Bali",             country: "Indonesia",     lat: -8.3405,   lng: 115.0920,  months: [4,5,6,7,8,9] },
  { name: "Bangkok",          country: "Thailand",      lat: 13.7563,   lng: 100.5018,  months: [11,12,1,2,3] },
  { name: "Kyoto",            country: "Japan",         lat: 35.0116,   lng: 135.7681,  months: [3,4,10,11] },
  { name: "Singapore",        country: "Singapore",     lat: 1.3521,    lng: 103.8198,  months: [2,3,4,5,6,7] },
  { name: "Hanoi",            country: "Vietnam",       lat: 21.0278,   lng: 105.8342,  months: [9,10,11,3,4] },
  { name: "Seoul",            country: "South Korea",   lat: 37.5665,   lng: 126.9780,  months: [3,4,5,9,10] },
  { name: "Jaipur",           country: "India",         lat: 26.9124,   lng: 75.7873,   months: [10,11,12,1,2,3] },
  { name: "Siem Reap",        country: "Cambodia",      lat: 13.3671,   lng: 103.8448,  months: [11,12,1,2,3] },
  { name: "Maldives",         country: "Maldives",      lat: 3.2028,    lng: 73.2207,   months: [12,1,2,3,4] },
  { name: "Hong Kong",        country: "China",         lat: 22.3193,   lng: 114.1694,  months: [10,11,12] },
  { name: "Kathmandu",        country: "Nepal",         lat: 27.7172,   lng: 85.3240,   months: [3,4,5,10,11] },
  { name: "Phuket",           country: "Thailand",      lat: 7.8804,    lng: 98.3923,   months: [11,12,1,2,3,4] },
  { name: "Luang Prabang",    country: "Laos",          lat: 19.8843,   lng: 102.1350,  months: [10,11,12,1,2] },
  { name: "Petra",            country: "Jordan",        lat: 30.3285,   lng: 35.4444,   months: [3,4,5,10,11] },
  { name: "Udaipur",          country: "India",         lat: 24.5854,   lng: 73.7125,   months: [10,11,12,1,2] },
  { name: "Borneo",           country: "Malaysia",      lat: 4.5353,    lng: 114.7277,  months: [3,4,5,9,10] },
  { name: "Sri Lanka",        country: "Sri Lanka",     lat: 7.8731,    lng: 80.7718,   months: [1,2,3,7,8] },
  { name: "Zhangjiajie",      country: "China",         lat: 29.1169,   lng: 110.4791,  months: [4,5,9,10] },
  { name: "Bhutan",           country: "Bhutan",        lat: 27.5142,   lng: 90.4336,   months: [3,4,5,9,10,11] },
  { name: "Ha Long Bay",      country: "Vietnam",       lat: 20.9101,   lng: 107.1839,  months: [10,11,3,4] },
  { name: "Lhasa",            country: "China",         lat: 29.6500,   lng: 91.1000,   months: [5,6,7,8,9] },
  { name: "Taipei",           country: "Taiwan",        lat: 25.0330,   lng: 121.5654,  months: [3,4,5,10,11] },
  { name: "Goa",              country: "India",         lat: 15.2993,   lng: 74.1240,   months: [11,12,1,2,3] },
  { name: "Chiang Mai",       country: "Thailand",      lat: 18.7883,   lng: 98.9853,   months: [11,12,1,2] },
  // NORTH AMERICA (12)
  { name: "New York City",    country: "USA",           lat: 40.7128,   lng: -74.0060,  months: [4,5,6,9,10] },
  { name: "Banff",            country: "Canada",        lat: 51.1784,   lng: -115.5708, months: [6,7,8,9,1,2] },
  { name: "Cancun",           country: "Mexico",        lat: 21.1619,   lng: -86.8515,  months: [12,1,2,3,4] },
  { name: "San Francisco",    country: "USA",           lat: 37.7749,   lng: -122.4194, months: [9,10,11] },
  { name: "Hawaii",           country: "USA",           lat: 19.8968,   lng: -155.5828, months: [4,5,9,10,11] },
  { name: "Costa Rica",       country: "Costa Rica",    lat: 9.7489,    lng: -83.7534,  months: [12,1,2,3,4] },
  { name: "Vancouver",        country: "Canada",        lat: 49.2827,   lng: -123.1207, months: [6,7,8,9] },
  { name: "Havana",           country: "Cuba",          lat: 23.1136,   lng: -82.3666,  months: [11,12,1,2,3,4] },
  { name: "Oaxaca",           country: "Mexico",        lat: 17.0732,   lng: -96.7266,  months: [10,11,12,3,4] },
  { name: "Grand Canyon",     country: "USA",           lat: 36.1069,   lng: -112.1129, months: [3,4,5,9,10] },
  { name: "Nashville",        country: "USA",           lat: 36.1627,   lng: -86.7816,  months: [4,5,9,10] },
  { name: "Quebec City",      country: "Canada",        lat: 46.8139,   lng: -71.2080,  months: [6,7,8,9,12] },
  // SOUTH AMERICA (10)
  { name: "Machu Picchu",     country: "Peru",          lat: -13.1631,  lng: -72.5450,  months: [5,6,7,8,9] },
  { name: "Rio de Janeiro",   country: "Brazil",        lat: -22.9068,  lng: -43.1729,  months: [5,6,7,8,9] },
  { name: "Buenos Aires",     country: "Argentina",     lat: -34.6037,  lng: -58.3816,  months: [3,4,5,10,11] },
  { name: "Cartagena",        country: "Colombia",      lat: 10.3910,   lng: -75.5364,  months: [12,1,2,3,4] },
  { name: "Galapagos Islands",country: "Ecuador",       lat: -0.9538,   lng: -90.9656,  months: [6,7,8,9,12,1] },
  { name: "Patagonia",        country: "Argentina",     lat: -50.3406,  lng: -72.2639,  months: [11,12,1,2,3] },
  { name: "Bogota",           country: "Colombia",      lat: 4.7110,    lng: -74.0721,  months: [12,1,2,3] },
  { name: "Santiago",         country: "Chile",         lat: -33.4489,  lng: -70.6693,  months: [10,11,12,3,4] },
  { name: "Cusco",            country: "Peru",          lat: -13.5319,  lng: -71.9675,  months: [5,6,7,8,9] },
  { name: "Medellín",         country: "Colombia",      lat: 6.2442,    lng: -75.5812,  months: [12,1,2,6,7] },
  // AFRICA (13)
  { name: "Cape Town",        country: "South Africa",  lat: -33.9249,  lng: 18.4241,   months: [10,11,12,1,2,3] },
  { name: "Marrakech",        country: "Morocco",       lat: 31.6295,   lng: -7.9811,   months: [3,4,5,10,11] },
  { name: "Serengeti",        country: "Tanzania",      lat: -2.3333,   lng: 34.8333,   months: [6,7,8,9,1,2] },
  { name: "Victoria Falls",   country: "Zimbabwe",      lat: -17.9243,  lng: 25.8572,   months: [4,5,8,9] },
  { name: "Zanzibar",         country: "Tanzania",      lat: -6.1659,   lng: 39.2026,   months: [6,7,8,9,12,1,2] },
  { name: "Cairo",            country: "Egypt",         lat: 30.0444,   lng: 31.2357,   months: [10,11,12,1,2,3] },
  { name: "Kruger Park",      country: "South Africa",  lat: -24.0167,  lng: 31.4833,   months: [5,6,7,8,9] },
  { name: "Madagascar",       country: "Madagascar",    lat: -18.7669,  lng: 46.8691,   months: [4,5,9,10,11] },
  { name: "Mauritius",        country: "Mauritius",     lat: -20.3484,  lng: 57.5522,   months: [5,6,7,8,9,10,11] },
  { name: "Fes",              country: "Morocco",       lat: 34.0181,   lng: -5.0078,   months: [3,4,5,10,11] },
  { name: "Nairobi",          country: "Kenya",         lat: -1.2921,   lng: 36.8219,   months: [1,2,6,7,8,9] },
  { name: "Luxor",            country: "Egypt",         lat: 25.6872,   lng: 32.6396,   months: [10,11,12,1,2,3] },
  { name: "Seychelles",       country: "Seychelles",    lat: -4.6796,   lng: 55.4920,   months: [4,5,10,11] },
  // OCEANIA (10)
  { name: "Sydney",           country: "Australia",     lat: -33.8688,  lng: 151.2093,  months: [10,11,12,3,4] },
  { name: "Queenstown",       country: "New Zealand",   lat: -45.0312,  lng: 168.6626,  months: [12,1,2,3,6,7,8] },
  { name: "Great Barrier Reef",country:"Australia",     lat: -18.2871,  lng: 147.6992,  months: [6,7,8,9,10] },
  { name: "Fiji",             country: "Fiji",          lat: -17.7134,  lng: 178.0650,  months: [5,6,7,8,9,10] },
  { name: "Melbourne",        country: "Australia",     lat: -37.8136,  lng: 144.9631,  months: [10,11,12,3,4] },
  { name: "Rotorua",          country: "New Zealand",   lat: -38.1368,  lng: 176.2497,  months: [12,1,2,3] },
  { name: "Tasmania",         country: "Australia",     lat: -42.0409,  lng: 146.8087,  months: [12,1,2,3] },
  { name: "Bora Bora",        country: "French Polynesia",lat:-16.5004, lng: -151.7415, months: [5,6,7,8,9,10] },
  { name: "Uluru",            country: "Australia",     lat: -25.3444,  lng: 131.0369,  months: [5,6,7,8,9] },
  { name: "Auckland",         country: "New Zealand",   lat: -36.8485,  lng: 174.7633,  months: [12,1,2,3,4] },
  // ANTARCTICA (5)
  { name: "Antarctic Peninsula",country:"Antarctica",   lat: -63.5000,  lng: -57.0000,  months: [11,12,1,2] },
  { name: "South Georgia Island",country:"South Georgia",lat:-54.2500, lng: -36.7500,  months: [11,12,1,2] },
  { name: "Ross Island",      country: "Antarctica",    lat: -77.5000,  lng: 168.0000,  months: [1,2] },
  { name: "Falkland Islands", country: "Falkland Islands",lat:-51.7963,lng: -59.5236,  months: [10,11,12,1,2,3] },
  { name: "Deception Island", country: "Antarctica",    lat: -62.9500,  lng: -60.6333,  months: [12,1,2] },
];

// ════════════════════════════════════════════════════════════════════════════
// 3. POI TEMPLATES (5 per destination → 500 total)
// ════════════════════════════════════════════════════════════════════════════

const POI_TEMPLATES = {
  attraction: [
    { suffix: "Landmark Tour",           hobbies: ["photography", "history"],      dur: 2.0, cost: 25 },
    { suffix: "Observation Deck",        hobbies: ["photography"],                 dur: 1.5, cost: 20 },
    { suffix: "Historic Quarter Walk",   hobbies: ["history", "archaeology"],      dur: 3.0, cost: 0  },
  ],
  activity: [
    { suffix: "Guided Adventure",        hobbies: ["hiking", "rock_climbing"],     dur: 4.0, cost: 80 },
    { suffix: "Water Sports Center",     hobbies: ["surfing", "kayaking", "scuba_diving"], dur: 3.0, cost: 65 },
    { suffix: "Cycling Tour",            hobbies: ["cycling", "photography"],      dur: 3.0, cost: 45 },
  ],
  nature: [
    { suffix: "Nature Reserve Hike",     hobbies: ["hiking", "birdwatching"],      dur: 4.0, cost: 15 },
    { suffix: "Botanical Gardens",       hobbies: ["gardening", "photography"],    dur: 2.0, cost: 12 },
  ],
  culture: [
    { suffix: "National Museum",         hobbies: ["history", "painting"],         dur: 3.0, cost: 18 },
    { suffix: "Traditional Craft Workshop", hobbies: ["painting", "cooking"],      dur: 2.5, cost: 55 },
    { suffix: "Street Art Tour",         hobbies: ["street_art", "photography"],   dur: 2.0, cost: 30 },
  ],
  food: [
    { suffix: "Food Market Tour",        hobbies: ["cooking", "wine_tasting"],     dur: 3.0, cost: 40 },
    { suffix: "Cooking Class",           hobbies: ["cooking"],                     dur: 3.5, cost: 75 },
  ],
  nightlife: [
    { suffix: "Live Music Venue",        hobbies: ["live_music", "dance"],         dur: 3.0, cost: 35 },
  ],
  shopping: [
    { suffix: "Artisan Market",          hobbies: ["painting", "photography"],     dur: 2.0, cost: 0  },
  ],
  relaxation: [
    { suffix: "Wellness Spa",            hobbies: ["yoga", "meditation"],          dur: 2.5, cost: 90 },
    { suffix: "Sunset Viewpoint",        hobbies: ["photography", "meditation"],   dur: 1.0, cost: 0  },
  ],
};

function generatePOIs(dest, tripId) {
  const pois = [];
  const categories = Object.keys(POI_TEMPLATES);
  // Pick 5 POIs per destination from different categories
  const selectedCats = pickN(categories, 5);
  for (const cat of selectedCats) {
    const templates = POI_TEMPLATES[cat];
    const tmpl = pick(templates);
    pois.push({
      id: uuid(),
      tripId,
      name: `${dest.name} ${tmpl.suffix}`,
      destination: dest.name,
      category: cat,
      matchedHobbies: tmpl.hobbies,
      estimatedDurationHours: tmpl.dur,
      costEstimate: tmpl.cost * (0.8 + Math.random() * 0.4),
      currency: "USD",
      rating: randomBetween(3.5, 5.0),
      reviewCount: Math.floor(Math.random() * 5000) + 50,
      approved: Math.random() > 0.3,
    });
  }
  return pois;
}

// ════════════════════════════════════════════════════════════════════════════
// 4. SAMPLE TRIPS (5 in different stages)
// ════════════════════════════════════════════════════════════════════════════

const tripDefs = [
  {
    name: "Japan Cherry Blossom Adventure",
    status: "completed",
    members: [0, 3, 7],  // indexes into userDefs
    destinations: ["Tokyo", "Kyoto"],
    days: 10,
    budget: 200,
  },
  {
    name: "European Honeymoon",
    status: "confirmed",
    members: [5, 6],
    destinations: ["Paris", "Santorini", "Amalfi Coast"],
    days: 14,
    budget: 350,
  },
  {
    name: "Family Safari & Beach",
    status: "budgeting",
    members: [10, 11, 14],
    destinations: ["Serengeti", "Zanzibar"],
    days: 12,
    budget: 250,
  },
  {
    name: "South America Backpacking",
    status: "bucket_list",
    members: [15, 16, 17, 18],
    destinations: ["Machu Picchu", "Rio de Janeiro", "Patagonia", "Galapagos Islands"],
    days: 21,
    budget: 100,
  },
  {
    name: "Luxury Maldives Retreat",
    status: "planning",
    members: [20, 21, 23, 24],
    destinations: ["Maldives"],
    days: 7,
    budget: 800,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("🌱 Seeding WanderPlan AI database …\n");

  // ── 1. Create Users + Profiles ──────────────────────────────────────
  console.log("  Creating 30 users …");
  const users = [];
  for (let i = 0; i < userDefs.length; i++) {
    const d = userDefs[i];
    const user = await prisma.user.create({
      data: {
        email: `${d.first.toLowerCase()}.${d.last.toLowerCase()}@wanderplan-test.com`,
        passwordHash: "$2b$12$testhashedpassword000000000000000000000000000000",
        firstName: d.first,
        lastName: d.last,
        authProvider: "local",
        role: i === 0 ? "admin" : (i < 5 ? "premium" : "user"),
        emailVerified: true,
        profile: {
          create: {
            travelStyle: d.style,
            hobbies: pickN(HOBBY_POOL, 4 + Math.floor(Math.random() * 4)),
            interests: pickN(INTEREST_POOL, 3 + Math.floor(Math.random() * 5)),
            dietaryRestrictions: d.diet,
            fitnessLevel: d.fitness,
            budgetPreference: d.budget,
            preferredCurrency: "USD",
            preferredLanguage: "en",
          },
        },
      },
    });
    users.push(user);
  }
  console.log(`  ✓ ${users.length} users created`);

  // ── 2. Create Trips ─────────────────────────────────────────────────
  console.log("  Creating 5 sample trips …");
  for (const td of tripDefs) {
    const organizer = users[td.members[0]];
    const trip = await prisma.trip.create({
      data: {
        name: td.name,
        status: td.status,
        createdBy: organizer.id,
      },
    });

    // Add members
    for (let mi = 0; mi < td.members.length; mi++) {
      const memberUser = users[td.members[mi]];
      await prisma.tripMember.create({
        data: {
          tripId: trip.id,
          userId: memberUser.id,
          role: mi === 0 ? "organizer" : "member",
          invitationStatus: "accepted",
          availabilityStart: new Date("2025-06-01"),
          availabilityEnd: new Date("2025-06-30"),
        },
      });
    }

    // Add bucket list items from trip destinations
    const tripDests = destinations.filter((d) => td.destinations.includes(d.name));
    for (const dest of tripDests) {
      await prisma.bucketListItem.create({
        data: {
          tripId: trip.id,
          destinationName: dest.name,
          country: dest.country,
          suggestedBy: organizer.id,
          latitude: dest.lat,
          longitude: dest.lng,
          votesUp: Math.floor(Math.random() * td.members.length) + 1,
          votesDown: Math.floor(Math.random() * 2),
          rankScore: randomBetween(3.0, 5.0),
          bestTravelMonths: dest.months,
        },
      });
    }

    // Add POIs (5 per destination)
    const allPois = tripDests.flatMap((d) => generatePOIs(d, trip.id));
    for (const poi of allPois) {
      await prisma.pointOfInterest.create({
        data: {
          tripId: poi.tripId,
          name: poi.name,
          destination: poi.destination,
          category: poi.category,
          matchedHobbies: poi.matchedHobbies,
          estimatedDurationHours: poi.estimatedDurationHours,
          costEstimate: poi.costEstimate,
          currency: poi.currency,
          rating: poi.rating,
          reviewCount: poi.reviewCount,
          approved: poi.approved,
        },
      });
    }

    // Add budget
    await prisma.tripBudget.create({
      data: {
        tripId: trip.id,
        dailyBudget: td.budget,
        currency: "USD",
        totalDays: td.days,
        flightsAllocated: td.budget * td.days * 0.25,
        staysAllocated: td.budget * td.days * 0.30,
        foodAllocated: td.budget * td.days * 0.20,
        activitiesAllocated: td.budget * td.days * 0.15,
        bufferAllocated: td.budget * td.days * 0.10,
      },
    });

    // Add itinerary days for confirmed / completed trips
    if (["confirmed", "completed", "active"].includes(td.status)) {
      const startDate = new Date("2025-07-01");
      for (let day = 1; day <= td.days; day++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + day - 1);
        const itDay = await prisma.itineraryDay.create({
          data: {
            tripId: trip.id,
            dayNumber: day,
            date: dayDate,
            theme: day === 1 ? "Arrival & Orientation" : day === td.days ? "Departure Day" : `Exploration Day ${day}`,
          },
        });

        // Add 4-6 items per day
        const itemCount = 4 + Math.floor(Math.random() * 3);
        for (let si = 0; si < itemCount; si++) {
          const types = ["activity", "meal", "transfer", "rest"];
          await prisma.itineraryItem.create({
            data: {
              dayId: itDay.id,
              startTime: `${8 + si * 2}:00`,
              endTime: `${9 + si * 2}:30`,
              itemType: types[si % types.length],
              title: `${types[si % types.length].charAt(0).toUpperCase() + types[si % types.length].slice(1)} ${si + 1}`,
              location: tripDests[si % tripDests.length]?.name || "TBD",
              costEstimate: randomBetween(0, 80),
              sortOrder: si,
            },
          });
        }
      }
    }

    console.log(`  ✓ Trip "${td.name}" (${td.status}) — ${tripDests.length} destinations, ${allPois.length} POIs`);
  }

  // ── 3. Fill remaining destinations as bucket-list on Trip 4 ─────────
  console.log("  Adding 100 destinations as global seed data …");
  const globalTrip = await prisma.trip.findFirst({ where: { name: "South America Backpacking" } });
  if (globalTrip) {
    const existingDests = new Set(td => td.destinations);
    let added = 0;
    for (const dest of destinations) {
      const exists = await prisma.bucketListItem.findFirst({
        where: { tripId: globalTrip.id, destinationName: dest.name },
      });
      if (!exists && added < 50) {
        await prisma.bucketListItem.create({
          data: {
            tripId: globalTrip.id,
            destinationName: dest.name,
            country: dest.country,
            latitude: dest.lat,
            longitude: dest.lng,
            bestTravelMonths: dest.months,
            rankScore: randomBetween(1.0, 4.0),
          },
        });
        added++;
      }
    }
    console.log(`  ✓ ${added} additional destinations seeded`);
  }

  // ── 4. Analytics seed data ──────────────────────────────────────────
  console.log("  Generating analytics events …");
  const screens = ["home", "trip_planner", "search", "itinerary", "budget", "settings", "profile"];
  const eventTypes = ["page_view", "click", "search", "filter_applied", "booking_started", "share"];
  let eventCount = 0;
  for (const user of users.slice(0, 10)) {
    for (let e = 0; e < 50; e++) {
      await prisma.analyticsEvent.create({
        data: {
          userId: user.id,
          screenName: pick(screens),
          eventType: pick(eventTypes),
          eventData: {
            session_id: uuid(),
            duration_ms: Math.floor(Math.random() * 30000),
            device: pick(["ios", "android", "web"]),
          },
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 86400000)),
        },
      });
      eventCount++;
    }
  }
  console.log(`  ✓ ${eventCount} analytics events created`);

  console.log("\n🌱 Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
