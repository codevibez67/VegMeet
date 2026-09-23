// ============================================================================
// CORE (shared backend service layer)
// ----------------------------------------------------------------------------
// Channel-agnostic domain logic: listings, offers, orders, FPOs, buyer
// verification, grading, group-sale "lots", logistics, payment status and
// grievances. Both the Button Phone channel (src/transitions.js, digit-
// driven) and the Smartphone/Web channel (src/webApi.js, JSON-driven) call
// ONLY these functions to read/write data - neither channel touches
// seedData.js arrays directly. This is what makes a listing created on the
// web dashboard immediately visible/interactable from the SMS simulator and
// vice versa: both sit on the exact same in-memory store.
//
// Every function here works with plain, language-neutral values (ids,
// codes, numbers) and returns plain data - it never produces display text.
// Text/label resolution stays in screens.js (SMS) and the web frontend JS.
// ============================================================================

const seed = require('./seedData');

function requireListing(listingId) {
  const listing = seed.LISTINGS.find((l) => l.id === listingId);
  if (!listing) throw new Error('Listing not found');
  return listing;
}

function requireOrder(orderId) {
  const order = seed.ORDERS.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found');
  return order;
}

// -------------------- Catalog / Market --------------------
function categories() {
  return seed.CATEGORIES;
}

function itemsByCategory(categoryId) {
  const cat = seed.CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.items : [];
}

function itemMeta(itemId) {
  return seed.ITEM_META[itemId];
}

function currentPrice(itemId) {
  return seed.currentPrice(itemId);
}

function todaysPrices() {
  return Object.keys(seed.ITEM_META)
    .filter((id) => seed.ITEM_META[id].hasPrice)
    .map((id) => ({ item: id, price: seed.currentPrice(id) }));
}

function priceHistory(itemId) {
  return seed.PRICE_HISTORY[itemId] || [];
}

function nearbyMarketPrices(itemId) {
  return seed.NEARBY_MARKET_PRICES[itemId] || [];
}

function weatherAdvisory() {
  return seed.getWeatherAdvisoryKey();
}

function logisticsOptions() {
  return seed.LOGISTICS_OPTIONS;
}

function grades() {
  return seed.GRADES;
}

function grievanceCategories() {
  return seed.GRIEVANCE_CATEGORIES;
}

// -------------------- FPO --------------------
function listFPOs() {
  return seed.FPOS;
}

function getFarmerProfile(phone) {
  return seed.getFarmerProfile(phone);
}

function joinFPO(phone, fpoId) {
  const fpo = seed.getFPO(fpoId);
  if (!fpo) throw new Error('Unknown FPO');
  const profile = seed.getFarmerProfile(phone);
  profile.fpoId = fpoId;
  return profile;
}

function leaveFPO(phone) {
  const profile = seed.getFarmerProfile(phone);
  profile.fpoId = null;
  return profile;
}

function toggleSellerVerified(phone) {
  const profile = seed.getFarmerProfile(phone);
  profile.verified = !profile.verified;
  return profile;
}

// -------------------- Buyer verification --------------------
function getBuyerProfile(phone) {
  return seed.getBuyerProfile(phone);
}

function verifyBuyer(phone, businessType, businessName) {
  const profile = seed.getBuyerProfile(phone);
  profile.verified = true;
  profile.businessType = businessType;
  profile.businessName = businessName || `Buyer ${phone}`;
  return profile;
}

// -------------------- Listings --------------------
function decorateListing(listing) {
  const fpo = listing.fpoId ? seed.getFPO(listing.fpoId) : null;
  const farmerProfile = seed.getFarmerProfile(listing.farmerId);
  return { ...listing, fpo, sellerVerified: !!farmerProfile.verified };
}

function listActiveListings(filters) {
  const f = filters || {};
  let items = seed.LISTINGS.filter((l) => l.status !== 'sold' && !l.cancelled);
  if (f.item) items = items.filter((l) => l.item === f.item);
  if (f.category) items = items.filter((l) => l.category === f.category);
  if (f.grade) items = items.filter((l) => l.grade === f.grade);
  if (f.availability) items = items.filter((l) => l.availability === f.availability);
  if (f.fpoOnly) items = items.filter((l) => !!l.fpoId);
  if (f.priceMin !== undefined && f.priceMin !== null) items = items.filter((l) => l.price >= f.priceMin);
  if (f.priceMax !== undefined && f.priceMax !== null) items = items.filter((l) => l.price <= f.priceMax);
  let decorated = items.map(decorateListing);
  if (f.verifiedOnly) decorated = decorated.filter((l) => l.sellerVerified);
  if (f.sort === 'price_asc') decorated = [...decorated].sort((a, b) => a.price - b.price);
  else if (f.sort === 'nearest') decorated = [...decorated].sort((a, b) => a.location.localeCompare(b.location));
  return decorated;
}

function getListing(listingId) {
  return decorateListing(requireListing(listingId));
}

function createListing({ farmerId, farmerLabel, location, item, qty, grade, price, availability }) {
  const profile = seed.getFarmerProfile(farmerId);
  const listing = {
    id: seed.nextListingId(),
    farmerId,
    farmerLabel: farmerLabel || `Farmer ${farmerId}`,
    location: location || 'Your Village',
    category: seed.ITEM_META[item].category,
    item,
    qty,
    grade: grade || 'B',
    fpoId: profile.fpoId || null,
    price,
    availability,
    status: 'active',
    offers: [],
  };
  seed.LISTINGS.push(listing);
  return listing;
}

function myListings(phone) {
  return seed.LISTINGS.filter((l) => l.farmerId === phone).map(decorateListing);
}

function cancelListing(listingId, requesterId) {
  const listing = requireListing(listingId);
  if (listing.farmerId !== requesterId) throw new Error('Not your listing');
  listing.status = 'sold';
  listing.cancelled = true;
  return listing;
}

// -------------------- Offers --------------------
function offersForListing(listingId) {
  const listing = requireListing(listingId);
  return listing.offers;
}

function makeOffer({ listingId, buyerId, buyerLabel, amount }) {
  const listing = requireListing(listingId);
  const offer = {
    id: seed.nextOfferId(),
    buyerId,
    buyerLabel: buyerLabel || `Buyer ${buyerId}`,
    amount: amount !== undefined && amount !== null ? amount : listing.price,
    status: 'pending',
  };
  listing.offers.push(offer);
  if (listing.status === 'active') listing.status = 'offer';
  return offer;
}

function acceptOffer({ listingId, offerId }) {
  const listing = requireListing(listingId);
  const offer = listing.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Offer not found');
  offer.status = 'accepted';
  listing.status = 'sold';
  return seed.createOrderFromOffer(listing, offer);
}

function counterOffer({ listingId, offerId, amount }) {
  const listing = requireListing(listingId);
  const offer = listing.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Offer not found');
  offer.amount = amount;
  offer.status = 'countered';
  return offer;
}

function rejectOffer({ listingId, offerId }) {
  const listing = requireListing(listingId);
  const offer = listing.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Offer not found');
  offer.status = 'rejected';
  if (!listing.offers.some((o) => o.status === 'pending' || o.status === 'countered')) {
    listing.status = 'active';
  }
  return offer;
}

// -------------------- Orders --------------------
function myOrderRows(phone) {
  const rows = [];
  seed.ORDERS.filter((o) => o.farmerId === phone || o.buyerId === phone).forEach((o) => {
    rows.push({ type: 'order', id: o.id, item: o.item, qty: o.qty, price: o.price, status: 'confirmed' });
  });
  seed.LISTINGS.filter((l) => l.farmerId === phone).forEach((l) => {
    l.offers
      .filter((of) => of.status === 'pending' || of.status === 'countered')
      .forEach((of) => {
        rows.push({ type: 'received_offer', id: of.id, listingId: l.id, item: l.item, qty: l.qty, price: of.amount, status: of.status });
      });
  });
  seed.LISTINGS.filter((l) => l.farmerId !== phone).forEach((l) => {
    l.offers
      .filter((of) => of.buyerId === phone && (of.status === 'pending' || of.status === 'countered'))
      .forEach((of) => {
        rows.push({ type: 'sent_offer', id: of.id, listingId: l.id, item: l.item, qty: l.qty, price: of.amount, status: of.status });
      });
  });
  return rows;
}

function getOrder(orderId) {
  return requireOrder(orderId);
}

function updateDeliveryStatus(orderId, status) {
  const order = requireOrder(orderId);
  order.deliveryStatus = status;
  return order;
}

function updatePaymentStatus(orderId, status) {
  const order = requireOrder(orderId);
  order.paymentStatus = status;
  return order;
}

function setLogistics(orderId, option) {
  const order = requireOrder(orderId);
  order.logistics = option;
  return order;
}

// -------------------- Group Sale / Lots --------------------
function getLot(item) {
  return seed.getOrCreatePool(item);
}

function allLots() {
  return Object.values(seed.GROUP_SALE_POOLS);
}

function joinLot(phone, item, qty) {
  const pool = seed.getOrCreatePool(item);
  pool.totalQty += qty;
  pool.participants.push({ farmerLabel: `Farmer ${phone}`, qty });
  return pool;
}

function requestBulkSourcing(phone, item, qty) {
  const pool = seed.GROUP_SALE_POOLS[item];
  const request = { id: seed.nextBulkId(), item, qty, buyerId: phone };
  seed.BULK_REQUESTS.push(request);
  const matched = !!(pool && pool.totalQty >= qty);
  return { request, matched, pooledQty: pool ? pool.totalQty : 0 };
}

// -------------------- Grievances --------------------
function fileGrievance({ phone, orderId, category, detail }) {
  const grievance = {
    id: seed.nextGrievanceId(),
    phone,
    orderId,
    category,
    detail: detail || null,
    status: 'open',
  };
  seed.GRIEVANCES.push(grievance);
  return grievance;
}

function myGrievances(phone) {
  return seed.GRIEVANCES.filter((g) => g.phone === phone);
}

module.exports = {
  categories,
  itemsByCategory,
  itemMeta,
  currentPrice,
  todaysPrices,
  priceHistory,
  nearbyMarketPrices,
  weatherAdvisory,
  logisticsOptions,
  grades,
  grievanceCategories,
  listFPOs,
  getFarmerProfile,
  joinFPO,
  leaveFPO,
  toggleSellerVerified,
  getBuyerProfile,
  verifyBuyer,
  listActiveListings,
  getListing,
  createListing,
  myListings,
  cancelListing,
  offersForListing,
  makeOffer,
  acceptOffer,
  counterOffer,
  rejectOffer,
  myOrderRows,
  getOrder,
  updateDeliveryStatus,
  updatePaymentStatus,
  setLogistics,
  getLot,
  allLots,
  joinLot,
  requestBulkSourcing,
  fileGrievance,
  myGrievances,
};
