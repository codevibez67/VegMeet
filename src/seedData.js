// ============================================================================
// SEED DATA
// ----------------------------------------------------------------------------
// Language-neutral mock data for the prototype. Item identifiers here (e.g.
// "onion") are keys, never translated display strings - display names are
// resolved per-locale via i18n item_<id> keys. Prices/weather/schemes are
// mocked with realistic static/generated data; wiring a real mandi price API
// or weather API is explicitly out of scope for this prototype (see README).
// ============================================================================

const CATEGORIES = [
  { id: 'vegetables', items: ['onion', 'tomato', 'potato'] },
  { id: 'fruits', items: ['banana', 'mango', 'apple'] },
  { id: 'livestock', items: ['goat', 'cow', 'poultry'] },
];

const ITEM_META = {
  onion: { category: 'vegetables', hasPrice: true, basePrice: 1850 },
  tomato: { category: 'vegetables', hasPrice: true, basePrice: 2200 },
  potato: { category: 'vegetables', hasPrice: true, basePrice: 1400 },
  banana: { category: 'fruits', hasPrice: true, basePrice: 1600 },
  mango: { category: 'fruits', hasPrice: true, basePrice: 4200 },
  apple: { category: 'fruits', hasPrice: true, basePrice: 9800 },
  goat: { category: 'livestock', hasPrice: false },
  cow: { category: 'livestock', hasPrice: false },
  poultry: { category: 'livestock', hasPrice: false },
};

const NEARBY_MARKETS = ['Chennai', 'Vellore', 'Villupuram'];

// Quality grades a listing/lot can be assigned. Neutral codes only - display
// labels are resolved per-locale via i18n grade_<code> keys.
const GRADES = ['A', 'B', 'C'];

// Mock logistics arrangements an order can be assigned. Neutral codes only -
// display labels are resolved per-locale via i18n logistics_<code> keys.
const LOGISTICS_OPTIONS = ['farmer_delivers', 'fpo_collection', 'buyer_pickup'];

// Grievance categories. Neutral codes only - display labels resolved via
// i18n grievance_cat_<code> keys.
const GRIEVANCE_CATEGORIES = ['quality', 'payment', 'delivery', 'other'];

// Farmer Producer Organisations (mock registry - no real KYC/registration).
const FPOS = [
  { id: 'fpo1', name: 'Green Valley FPO', location: 'Chennai region' },
  { id: 'fpo2', name: 'Krishna Farmers Producer Co.', location: 'Vellore region' },
  { id: 'fpo3', name: 'Sunrise Agri FPO', location: 'Villupuram region' },
];

function getFPO(id) {
  return FPOS.find((f) => f.id === id) || null;
}

// -----------------------------------------------------------------------
// User profiles (channel-agnostic - keyed by the same session phone used by
// both the Button Phone channel and the Smartphone/Web channel).
// -----------------------------------------------------------------------
const FARMER_PROFILES = {}; // phone -> { fpoId }
const BUYER_PROFILES = {}; // phone -> { verified, businessType, businessName }

function getFarmerProfile(phone) {
  if (!FARMER_PROFILES[phone]) FARMER_PROFILES[phone] = { fpoId: null, verified: false };
  return FARMER_PROFILES[phone];
}

// A couple of seed farmers are pre-marked as verified sellers so the buyer
// "verified sellers only" filter has something to demonstrate immediately.
FARMER_PROFILES['seed-Farmer Ravi'] = { fpoId: 'fpo1', verified: true };
FARMER_PROFILES['seed-Farmer Meena'] = { fpoId: 'fpo1', verified: true };

function getBuyerProfile(phone) {
  if (!BUYER_PROFILES[phone]) {
    BUYER_PROFILES[phone] = { verified: false, businessType: null, businessName: null };
  }
  return BUYER_PROFILES[phone];
}

// Deterministic pseudo-random generator so demo data is stable across
// restarts (no external randomness/services needed).
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 14 days of realistic mock daily price data, generated from a base price
// with a small deterministic trend + noise (not hardcoded chart output).
function generatePriceHistory(itemId, basePrice) {
  const rand = seededRandom(basePrice + itemId.length * 17);
  const history = [];
  let price = basePrice * 0.92;
  const today = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const drift = (rand() - 0.45) * (basePrice * 0.015);
    price = Math.max(basePrice * 0.7, price + drift);
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    history.push({
      date: d.toISOString().slice(5, 10), // MM-DD
      price: Math.round(price),
    });
  }
  return history;
}

const PRICE_HISTORY = {};
Object.keys(ITEM_META).forEach((itemId) => {
  const meta = ITEM_META[itemId];
  if (meta.hasPrice) {
    PRICE_HISTORY[itemId] = generatePriceHistory(itemId, meta.basePrice);
  }
});

// Mock price variants across nearby markets for "Compare Nearby Markets".
const NEARBY_MARKET_PRICES = {};
Object.keys(ITEM_META).forEach((itemId) => {
  const meta = ITEM_META[itemId];
  if (!meta.hasPrice) return;
  const rand = seededRandom(meta.basePrice * 3 + itemId.length);
  NEARBY_MARKET_PRICES[itemId] = NEARBY_MARKETS.map((market) => ({
    market,
    price: Math.round(meta.basePrice * (0.94 + rand() * 0.12)),
  }));
});

function currentPrice(itemId) {
  const hist = PRICE_HISTORY[itemId];
  return hist ? hist[hist.length - 1].price : null;
}

// -----------------------------------------------------------------------
// Listings (Sell/Buy)
// -----------------------------------------------------------------------
let listingSeq = 100;
function nextListingId() {
  listingSeq += 1;
  return String(listingSeq);
}

const LISTINGS = []; // { id, farmerId, farmerLabel, location, category, item, qty, grade, price, availability, status, fpoId, offers: [] }

function seedListing(item, farmerLabel, location, qty, priceOffset, availability, grade, fpoId) {
  const base = currentPrice(item) || 0;
  LISTINGS.push({
    id: nextListingId(),
    farmerId: `seed-${farmerLabel}`,
    farmerLabel,
    location,
    category: ITEM_META[item].category,
    item,
    qty,
    grade: grade || 'B',
    fpoId: fpoId || null,
    price: base ? Math.round(base * priceOffset) : 0,
    availability, // 'now' | '3days' | 'week'
    status: 'active', // active | offer | sold
    offers: [],
  });
}

seedListing('onion', 'Farmer Ravi', 'Chennai', 180, 0.97, 'now', 'A', 'fpo1');
seedListing('onion', 'Farmer Lakshmi', 'Vellore', 220, 1.02, '3days', 'B', null);
seedListing('onion', 'Farmer Suresh', 'Villupuram', 300, 0.95, 'week', 'C', 'fpo3');
seedListing('tomato', 'Farmer Meena', 'Chennai', 140, 1.0, 'now', 'A', 'fpo1');
seedListing('tomato', 'Farmer Kumar', 'Vellore', 160, 0.98, '3days', 'B', null);
seedListing('potato', 'Farmer Devi', 'Villupuram', 250, 1.01, 'now', 'B', null);
seedListing('banana', 'Farmer Arjun', 'Chennai', 90, 1.0, 'now', 'A', null);
seedListing('mango', 'Farmer Priya', 'Vellore', 60, 1.05, '3days', 'B', 'fpo2');
seedListing('apple', 'Farmer Balan', 'Chennai', 40, 0.99, 'week', 'B', null);

let offerSeq = 500;
function nextOfferId() {
  offerSeq += 1;
  return String(offerSeq);
}

// Pre-seed one incoming buyer offer so "My Orders" / "My Listings -> View
// offers" is demoable without needing a second session first.
LISTINGS[0].status = 'offer';
LISTINGS[0].offers.push({
  id: nextOfferId(),
  buyerId: 'seed-buyer-1',
  buyerLabel: 'Buyer Anand Traders',
  amount: Math.round(LISTINGS[0].price * 0.95),
  status: 'pending', // pending | accepted | countered | rejected
});

// -----------------------------------------------------------------------
// Group Sale pools ("Lots") - a graded, optionally FPO-backed pooled batch
// that lets smallholders meet a buyer's bulk minimum together. Same object
// is what the web channel calls a "Lot".
// -----------------------------------------------------------------------
const GROUP_SALE_POOLS = {
  onion: {
    item: 'onion',
    grade: 'B',
    fpoId: 'fpo1',
    targetQty: 1000,
    totalQty: 800,
    participants: [
      { farmerLabel: 'Farmer Ganesh', qty: 350 },
      { farmerLabel: 'Farmer Meera', qty: 450 },
    ],
  },
};

function getOrCreatePool(item) {
  if (!GROUP_SALE_POOLS[item]) {
    GROUP_SALE_POOLS[item] = { item, grade: 'B', fpoId: null, targetQty: 1000, totalQty: 0, participants: [] };
  }
  return GROUP_SALE_POOLS[item];
}

// -----------------------------------------------------------------------
// Bulk sourcing requests (Buy -> Request Bulk Sourcing)
// -----------------------------------------------------------------------
const BULK_REQUESTS = []; // { id, item, qty, buyerId, matchedPoolQty }
let bulkSeq = 700;
function nextBulkId() {
  bulkSeq += 1;
  return String(bulkSeq);
}

// -----------------------------------------------------------------------
// Orders (unified tracking for both farmer & buyer sides)
// -----------------------------------------------------------------------
const ORDERS = []; // { id, listingId, item, qty, price, farmerId, buyerId, status, deliveryStatus }
let orderSeq = 900;
function nextOrderId() {
  orderSeq += 1;
  return String(orderSeq);
}

function createOrderFromOffer(listing, offer) {
  const order = {
    id: nextOrderId(),
    listingId: listing.id,
    item: listing.item,
    qty: listing.qty,
    price: offer.amount,
    farmerId: listing.farmerId,
    buyerId: offer.buyerId,
    buyerLabel: offer.buyerLabel,
    farmerLabel: listing.farmerLabel,
    status: 'confirmed',
    deliveryStatus: 'preparing', // preparing | ready | completed
    paymentStatus: 'pending', // pending | paid
    logistics: null, // null | one of LOGISTICS_OPTIONS
  };
  ORDERS.push(order);
  return order;
}

// -----------------------------------------------------------------------
// Grievances - always tied to an order. SMS channel can only pick a
// category (no free text); the web channel additionally allows an optional
// detail note.
// -----------------------------------------------------------------------
const GRIEVANCES = []; // { id, phone, orderId, category, detail, status }
let grievanceSeq = 300;
function nextGrievanceId() {
  grievanceSeq += 1;
  return String(grievanceSeq);
}

// -----------------------------------------------------------------------
// Weather-based advisory (mock rule engine, not a real weather API)
// -----------------------------------------------------------------------
const MOCK_WEATHER = { rainInDays: 2, condition: 'rain' };

function getWeatherAdvisoryKey() {
  if (MOCK_WEATHER.condition === 'rain' && MOCK_WEATHER.rainInDays <= 3) {
    return { key: 'weather_rain_warning', params: { days: MOCK_WEATHER.rainInDays } };
  }
  return { key: 'weather_clear', params: {} };
}

module.exports = {
  CATEGORIES,
  ITEM_META,
  NEARBY_MARKETS,
  PRICE_HISTORY,
  NEARBY_MARKET_PRICES,
  currentPrice,
  LISTINGS,
  nextListingId,
  nextOfferId,
  GROUP_SALE_POOLS,
  getOrCreatePool,
  BULK_REQUESTS,
  nextBulkId,
  ORDERS,
  nextOrderId,
  createOrderFromOffer,
  getWeatherAdvisoryKey,
  MOCK_WEATHER,
  GRADES,
  LOGISTICS_OPTIONS,
  GRIEVANCE_CATEGORIES,
  FPOS,
  getFPO,
  FARMER_PROFILES,
  BUYER_PROFILES,
  getFarmerProfile,
  getBuyerProfile,
  GRIEVANCES,
  nextGrievanceId,
};
