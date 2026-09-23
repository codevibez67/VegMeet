// ============================================================================
// TRANSITIONS (state-machine layer - Button Phone channel)
// ----------------------------------------------------------------------------
// 100% language-agnostic. Only works with language-neutral keys (item ids,
// state ids, status codes) plus raw digits typed by the user. Never contains
// a hardcoded English string - anything shown to the user is produced by
// screens.render(), which resolves text via i18n from the session's locale.
//
// All reads/writes to shared data (listings, offers, orders, FPOs, buyer
// verification, lots, grievances) go through src/core.js - the SAME service
// layer the Smartphone/Web channel's REST routes (src/webApi.js) use. That
// shared core is what makes a listing created on the web dashboard visible
// and interactable from this SMS simulator, and vice versa.
//
// Input model: menu screens accept exactly one digit (0-9) matching a listed
// option. A small number of dedicated "numeric input" screens (enter
// quantity / price / offer amount) accept a short run of digits parsed as an
// integer - still digits only, never letters or script, so feature-phone
// users only ever press number keys.
// ============================================================================

const { t } = require('./i18n');
const { getLanguagePage, totalLanguagePages } = require('./languages');
const { render } = require('./screens');
const core = require('./core');
const { CATEGORIES, ITEM_META, GRADES, LOGISTICS_OPTIONS, GRIEVANCE_CATEGORIES, FPOS } = require('./seedData');

function digit(input) {
  if (!/^\d+$/.test(input)) return null;
  return parseInt(input, 10);
}

function goto(session, state, ctxPatch) {
  session.state = state;
  if (ctxPatch) Object.assign(session.ctx, ctxPatch);
}

function flash(session, key, params) {
  session.ctx.flash = t(session.lang, key, params);
}

function invalidOption(session) {
  const lang = session.lang || 'en';
  session.ctx.flash = t(lang, 'invalid_option');
}

function findCategoryItems(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  return cat ? cat.items : [];
}

function refreshOrderRows(session) {
  session.ctx.myOrderRows = core.myOrderRows(session.phone);
}

// ----------------------------------------------------------------------
// State handlers: (session, input) -> void (mutate session in place)
// ----------------------------------------------------------------------
const HANDLERS = {};

HANDLERS.LANG_SELECT = (session, input) => {
  const page = session.langPage || 0;
  const langs = getLanguagePage(page);
  const n = digit(input);
  const hasMore = page + 1 < totalLanguagePages();
  if (n !== null && n >= 1 && n <= langs.length) {
    session.lang = langs[n - 1].code;
    goto(session, 'MAIN_MENU');
    return;
  }
  if (n === 9 && hasMore) {
    session.langPage = page + 1;
    return;
  }
  if (n === 0 && page > 0) {
    session.langPage = page - 1;
    return;
  }
  session.ctx.flash = t('en', 'invalid_option');
};

HANDLERS.MAIN_MENU = (session, input) => {
  const n = digit(input);
  switch (n) {
    case 0:
      session.langPage = 0;
      goto(session, 'LANG_SELECT');
      break;
    case 1:
      goto(session, 'SELL_CATEGORY');
      break;
    case 2:
      goto(session, 'BUY_CATEGORY');
      break;
    case 3:
      goto(session, 'MY_LISTINGS');
      break;
    case 4:
      refreshOrderRows(session);
      goto(session, 'MY_ORDERS');
      break;
    case 5:
      goto(session, 'MARKET_INFO');
      break;
    case 6:
      session.ctx.myGrievanceRows = core.myGrievances(session.phone);
      goto(session, 'MY_GRIEVANCES');
      break;
    case 7:
      goto(session, 'PROFILE');
      break;
    case 8:
      goto(session, 'HELP');
      break;
    default:
      invalidOption(session);
  }
};

// -------------------- PROFILE (FPO + buyer verification) --------------------
HANDLERS.PROFILE = (session, input) => {
  const n = digit(input);
  if (n === 1) goto(session, 'PROFILE_FPO_SELECT');
  else if (n === 2) goto(session, 'PROFILE_VERIFY_TYPE');
  else if (n === 3) {
    const profile = core.toggleSellerVerified(session.phone);
    flash(session, 'seller_verified_toggled_msg', { status: t(session.lang, profile.verified ? 'verified_yes' : 'verified_no') });
  } else if (n === 0) goto(session, 'MAIN_MENU');
  else invalidOption(session);
};

HANDLERS.PROFILE_FPO_SELECT = (session, input) => {
  const n = digit(input);
  if (n >= 1 && n <= FPOS.length) {
    const fpo = core.joinFPO(session.phone, FPOS[n - 1].id);
    flash(session, 'fpo_joined_msg', { fpo: FPOS[n - 1].name });
    goto(session, 'PROFILE');
  } else if (n === FPOS.length + 1) {
    core.leaveFPO(session.phone);
    flash(session, 'fpo_left_msg');
    goto(session, 'PROFILE');
  } else if (n === 0) {
    goto(session, 'PROFILE');
  } else {
    invalidOption(session);
  }
};

const BUSINESS_TYPES = ['trader', 'retailer', 'exporter', 'processor'];
HANDLERS.PROFILE_VERIFY_TYPE = (session, input) => {
  const n = digit(input);
  if (n >= 1 && n <= BUSINESS_TYPES.length) {
    core.verifyBuyer(session.phone, BUSINESS_TYPES[n - 1]);
    flash(session, 'verification_done_msg');
    goto(session, 'PROFILE');
  } else if (n === 0) {
    goto(session, 'PROFILE');
  } else {
    invalidOption(session);
  }
};

// -------------------- SELL --------------------
HANDLERS.SELL_CATEGORY = (session, input) => {
  const n = digit(input);
  const cats = ['vegetables', 'fruits', 'livestock'];
  if (n >= 1 && n <= 3) {
    goto(session, 'SELL_ITEM', { category: cats[n - 1] });
  } else if (n === 4) {
    goto(session, 'MAIN_MENU');
  } else {
    invalidOption(session);
  }
};

HANDLERS.SELL_ITEM = (session, input) => {
  const items = findCategoryItems(session.ctx.category);
  const n = digit(input);
  if (n >= 1 && n <= items.length) {
    goto(session, 'SELL_ACTION', { item: items[n - 1] });
  } else if (n === items.length + 1) {
    goto(session, 'SELL_CATEGORY');
  } else {
    invalidOption(session);
  }
};

HANDLERS.SELL_ACTION = (session, input) => {
  const item = session.ctx.item;
  const hasPrice = ITEM_META[item].hasPrice;
  const n = digit(input);
  const order = ['current_price'];
  if (hasPrice) order.push('price_graph', 'best_time', 'compare_markets');
  order.push('list_item');
  if (hasPrice) order.push('group_sale');
  order.push('back');
  const choice = order[n - 1];
  switch (choice) {
    case 'current_price':
      goto(session, 'SELL_CURRENT_PRICE');
      break;
    case 'price_graph':
      goto(session, 'SELL_PRICE_GRAPH');
      break;
    case 'best_time':
      goto(session, 'SELL_BEST_TIME');
      break;
    case 'compare_markets':
      goto(session, 'SELL_COMPARE_MARKETS');
      break;
    case 'list_item':
      goto(session, 'SELL_LIST_QTY', { listingDraft: {} });
      break;
    case 'group_sale':
      core.getLot(item);
      goto(session, 'SELL_GROUP_SALE_STATUS');
      break;
    case 'back':
      goto(session, 'SELL_ITEM');
      break;
    default:
      invalidOption(session);
  }
};

HANDLERS.SELL_CURRENT_PRICE = (session, input) => {
  if (digit(input) === 0) goto(session, 'SELL_ACTION');
  else invalidOption(session);
};
HANDLERS.SELL_PRICE_GRAPH = HANDLERS.SELL_CURRENT_PRICE;
HANDLERS.SELL_BEST_TIME = HANDLERS.SELL_CURRENT_PRICE;
HANDLERS.SELL_COMPARE_MARKETS = HANDLERS.SELL_CURRENT_PRICE;

HANDLERS.SELL_GROUP_SALE_STATUS = (session, input) => {
  const n = digit(input);
  if (n === 1) {
    goto(session, 'SELL_GROUP_SALE_QTY');
  } else if (n === 0) {
    goto(session, 'SELL_ACTION');
  } else {
    invalidOption(session);
  }
};

HANDLERS.SELL_GROUP_SALE_QTY = (session, input) => {
  const qty = digit(input);
  if (qty === null || qty <= 0) {
    invalidOption(session);
    return;
  }
  const pool = core.joinLot(session.phone, session.ctx.item, qty);
  flash(session, 'group_sale_joined', { qty, newTotal: pool.totalQty });
  goto(session, 'SELL_ACTION');
};

HANDLERS.SELL_LIST_QTY = (session, input) => {
  const qty = digit(input);
  if (qty === null || qty <= 0) {
    invalidOption(session);
    return;
  }
  session.ctx.listingDraft.qty = qty;
  goto(session, 'SELL_LIST_GRADE');
};

HANDLERS.SELL_LIST_GRADE = (session, input) => {
  const n = digit(input);
  if (n >= 1 && n <= GRADES.length) {
    session.ctx.listingDraft.grade = GRADES[n - 1];
    goto(session, 'SELL_LIST_PRICE_CHOICE');
  } else {
    invalidOption(session);
  }
};

HANDLERS.SELL_LIST_PRICE_CHOICE = (session, input) => {
  const n = digit(input);
  if (n === 1) {
    session.ctx.listingDraft.price = core.currentPrice(session.ctx.item) || 0;
    goto(session, 'SELL_LIST_AVAILABILITY');
  } else if (n === 2) {
    goto(session, 'SELL_LIST_PRICE_CUSTOM');
  } else {
    invalidOption(session);
  }
};

HANDLERS.SELL_LIST_PRICE_CUSTOM = (session, input) => {
  const price = digit(input);
  if (price === null || price <= 0) {
    invalidOption(session);
    return;
  }
  session.ctx.listingDraft.price = price;
  goto(session, 'SELL_LIST_AVAILABILITY');
};

HANDLERS.SELL_LIST_AVAILABILITY = (session, input) => {
  const n = digit(input);
  const map = { 1: 'now', 2: '3days', 3: 'week' };
  if (!map[n]) {
    invalidOption(session);
    return;
  }
  const draft = session.ctx.listingDraft;
  draft.availability = map[n];
  const listing = core.createListing({
    farmerId: session.phone,
    farmerLabel: `Farmer ${session.phone}`,
    location: 'Your Village',
    item: session.ctx.item,
    qty: draft.qty,
    grade: draft.grade,
    price: draft.price,
    availability: draft.availability,
  });
  flash(session, 'list_confirm', {
    id: listing.id,
    item: t(session.lang, `item_${listing.item}`),
    qty: listing.qty,
    price: listing.price,
    availability: t(session.lang, `list_avail_${listing.availability}`),
  });
  session.ctx.listingDraft = {};
  goto(session, 'SELL_ACTION');
};

// -------------------- BUY --------------------
HANDLERS.BUY_CATEGORY = (session, input) => {
  const n = digit(input);
  const cats = ['vegetables', 'fruits', 'livestock'];
  if (n >= 1 && n <= 3) {
    goto(session, 'BUY_ITEM', { category: cats[n - 1] });
  } else if (n === 4) {
    goto(session, 'MAIN_MENU');
  } else {
    invalidOption(session);
  }
};

HANDLERS.BUY_ITEM = (session, input) => {
  const items = findCategoryItems(session.ctx.category);
  const n = digit(input);
  if (n >= 1 && n <= items.length) {
    goto(session, 'BUY_ACTION', { item: items[n - 1] });
  } else if (n === items.length + 1) {
    goto(session, 'BUY_CATEGORY');
  } else {
    invalidOption(session);
  }
};

HANDLERS.BUY_ACTION = (session, input) => {
  const n = digit(input);
  switch (n) {
    case 1: {
      // Capped at 8 (not 3) so listings created via the web channel remain
      // reachable from SMS once more than a handful exist for an item -
      // the same pagination-friendly cap used by Filter Listings below.
      const ids = core.listActiveListings({ item: session.ctx.item }).slice(0, 8).map((l) => l.id);
      goto(session, 'BUY_LISTINGS_VIEW', { listingResultIds: ids });
      break;
    }
    case 2:
      goto(session, 'BUY_FILTER_CHOICE');
      break;
    case 3: {
      const ids = core.listActiveListings({ item: session.ctx.item }).slice(0, 8).map((l) => l.id);
      goto(session, 'BUY_PLACE_OFFER_SELECT', { listingResultIds: ids });
      break;
    }
    case 4:
      goto(session, 'BUY_BULK_QTY');
      break;
    case 5:
      goto(session, 'BUY_ITEM');
      break;
    default:
      invalidOption(session);
  }
};

HANDLERS.BUY_LISTINGS_VIEW = (session, input) => {
  if (digit(input) === 0) goto(session, 'BUY_ACTION');
  else invalidOption(session);
};

HANDLERS.BUY_FILTER_CHOICE = (session, input) => {
  const n = digit(input);
  let filters = { item: session.ctx.item };
  if (n === 1) filters.sort = 'price_asc';
  else if (n === 2) filters.sort = 'nearest';
  else if (n === 3) filters.availability = 'now';
  else if (n === 0) {
    goto(session, 'BUY_ACTION');
    return;
  } else {
    invalidOption(session);
    return;
  }
  const ids = core.listActiveListings(filters).slice(0, 8).map((l) => l.id);
  goto(session, 'BUY_LISTINGS_VIEW', { listingResultIds: ids });
};

HANDLERS.BUY_PLACE_OFFER_SELECT = (session, input) => {
  const n = digit(input);
  const ids = session.ctx.listingResultIds || [];
  if (n === 0) {
    goto(session, 'BUY_ACTION');
    return;
  }
  if (n >= 1 && n <= ids.length) {
    goto(session, 'BUY_PLACE_OFFER_ACTION', { selectedListingId: ids[n - 1] });
  } else {
    invalidOption(session);
  }
};

HANDLERS.BUY_PLACE_OFFER_ACTION = (session, input) => {
  const n = digit(input);
  const listing = core.getListing(session.ctx.selectedListingId);
  if (n === 1) {
    core.makeOffer({ listingId: listing.id, buyerId: session.phone, amount: listing.price });
    flash(session, 'offer_placed');
    goto(session, 'BUY_ACTION');
  } else if (n === 2) {
    goto(session, 'BUY_OFFER_AMOUNT');
  } else if (n === 0) {
    goto(session, 'BUY_PLACE_OFFER_SELECT');
  } else {
    invalidOption(session);
  }
};

HANDLERS.BUY_OFFER_AMOUNT = (session, input) => {
  const amount = digit(input);
  if (amount === null || amount <= 0) {
    invalidOption(session);
    return;
  }
  core.makeOffer({ listingId: session.ctx.selectedListingId, buyerId: session.phone, amount });
  flash(session, 'offer_placed');
  goto(session, 'BUY_ACTION');
};

HANDLERS.BUY_BULK_QTY = (session, input) => {
  const qty = digit(input);
  if (qty === null || qty <= 0) {
    invalidOption(session);
    return;
  }
  const item = session.ctx.item;
  const { matched, pooledQty } = core.requestBulkSourcing(session.phone, item, qty);
  if (matched) {
    flash(session, 'bulk_matched', { qty: pooledQty, item: t(session.lang, `item_${item}`) });
  } else {
    flash(session, 'bulk_open', { qty, item: t(session.lang, `item_${item}`) });
  }
  goto(session, 'BUY_ACTION');
};

// -------------------- MY LISTINGS --------------------
HANDLERS.MY_LISTINGS = (session, input) => {
  const n = digit(input);
  if (n === 0) {
    goto(session, 'MAIN_MENU');
    return;
  }
  const mine = core.myListings(session.phone);
  if (n >= 1 && n <= mine.length) {
    goto(session, 'MY_LISTING_DETAIL', { selectedListingId: mine[n - 1].id });
  } else {
    invalidOption(session);
  }
};

HANDLERS.MY_LISTING_DETAIL = (session, input) => {
  const n = digit(input);
  if (n === 1) {
    goto(session, 'MY_LISTING_OFFERS');
  } else if (n === 2) {
    const listing = core.cancelListing(session.ctx.selectedListingId, session.phone);
    flash(session, 'my_listing_cancelled', { id: listing.id });
    goto(session, 'MY_LISTINGS');
  } else if (n === 0) {
    goto(session, 'MY_LISTINGS');
  } else {
    invalidOption(session);
  }
};

HANDLERS.MY_LISTING_OFFERS = (session, input) => {
  const n = digit(input);
  if (n === 0) {
    goto(session, 'MY_LISTING_DETAIL');
    return;
  }
  const offers = core.offersForListing(session.ctx.selectedListingId).filter((o) => o.status === 'pending' || o.status === 'countered');
  if (n >= 1 && n <= offers.length) {
    goto(session, 'MY_LISTING_OFFER_ACTION', { selectedOfferId: offers[n - 1].id, offerReturnState: 'MY_LISTING_OFFERS' });
  } else {
    invalidOption(session);
  }
};

HANDLERS.MY_LISTING_OFFER_ACTION = (session, input) => {
  const n = digit(input);
  const listingId = session.ctx.selectedListingId;
  const offerId = session.ctx.selectedOfferId;
  const returnState = session.ctx.offerReturnState || 'MY_LISTING_OFFERS';
  if (n === 1) {
    core.acceptOffer({ listingId, offerId });
    flash(session, 'offer_accepted');
    if (returnState === 'MY_ORDERS') refreshOrderRows(session);
    goto(session, returnState === 'MY_ORDERS' ? 'MY_ORDERS' : 'MY_LISTING_DETAIL');
  } else if (n === 2) {
    goto(session, 'MY_LISTING_COUNTER_AMOUNT');
  } else if (n === 3) {
    core.rejectOffer({ listingId, offerId });
    flash(session, 'offer_rejected');
    if (returnState === 'MY_ORDERS') refreshOrderRows(session);
    goto(session, returnState === 'MY_ORDERS' ? 'MY_ORDERS' : 'MY_LISTING_DETAIL');
  } else if (n === 0) {
    goto(session, returnState);
  } else {
    invalidOption(session);
  }
};

HANDLERS.MY_LISTING_COUNTER_AMOUNT = (session, input) => {
  const amount = digit(input);
  if (amount === null || amount <= 0) {
    invalidOption(session);
    return;
  }
  core.counterOffer({ listingId: session.ctx.selectedListingId, offerId: session.ctx.selectedOfferId, amount });
  flash(session, 'offer_countered', { amount });
  const returnState = session.ctx.offerReturnState || 'MY_LISTING_OFFERS';
  if (returnState === 'MY_ORDERS') refreshOrderRows(session);
  goto(session, returnState);
};

// -------------------- MY ORDERS --------------------
HANDLERS.MY_ORDERS = (session, input) => {
  const n = digit(input);
  if (n === 0) {
    goto(session, 'MAIN_MENU');
    return;
  }
  const rows = session.ctx.myOrderRows || [];
  const row = rows[n - 1];
  if (!row) {
    invalidOption(session);
    return;
  }
  if (row.type === 'order') {
    goto(session, 'ORDER_HUB', { selectedOrderId: row.id });
  } else if (row.type === 'received_offer') {
    goto(session, 'MY_LISTING_OFFER_ACTION', {
      selectedListingId: row.listingId,
      selectedOfferId: row.id,
      offerReturnState: 'MY_ORDERS',
    });
  } else {
    flash(session, 'sent_offer_waiting');
  }
};

HANDLERS.ORDER_HUB = (session, input) => {
  const n = digit(input);
  if (n === 1) goto(session, 'ORDER_DELIVERY_STATUS');
  else if (n === 2) goto(session, 'ORDER_PAYMENT_STATUS');
  else if (n === 3) goto(session, 'ORDER_LOGISTICS_CHOICE');
  else if (n === 4) goto(session, 'ORDER_GRIEVANCE_CATEGORY');
  else if (n === 0) {
    refreshOrderRows(session);
    goto(session, 'MY_ORDERS');
  } else {
    invalidOption(session);
  }
};

HANDLERS.ORDER_DELIVERY_STATUS = (session, input) => {
  const n = digit(input);
  const map = { 1: 'preparing', 2: 'ready', 3: 'completed' };
  if (map[n]) {
    core.updateDeliveryStatus(session.ctx.selectedOrderId, map[n]);
    flash(session, 'delivery_updated', { status: t(session.lang, `delivery_${map[n]}`) });
    goto(session, 'ORDER_HUB');
  } else if (n === 0) {
    goto(session, 'ORDER_HUB');
  } else {
    invalidOption(session);
  }
};

HANDLERS.ORDER_PAYMENT_STATUS = (session, input) => {
  const n = digit(input);
  const map = { 1: 'pending', 2: 'paid' };
  if (map[n]) {
    core.updatePaymentStatus(session.ctx.selectedOrderId, map[n]);
    flash(session, 'payment_updated', { status: t(session.lang, `payment_${map[n]}`) });
    goto(session, 'ORDER_HUB');
  } else if (n === 0) {
    goto(session, 'ORDER_HUB');
  } else {
    invalidOption(session);
  }
};

HANDLERS.ORDER_LOGISTICS_CHOICE = (session, input) => {
  const n = digit(input);
  if (n >= 1 && n <= LOGISTICS_OPTIONS.length) {
    const option = LOGISTICS_OPTIONS[n - 1];
    core.setLogistics(session.ctx.selectedOrderId, option);
    flash(session, 'logistics_updated', { option: t(session.lang, `logistics_${option}`) });
    goto(session, 'ORDER_HUB');
  } else if (n === 0) {
    goto(session, 'ORDER_HUB');
  } else {
    invalidOption(session);
  }
};

HANDLERS.ORDER_GRIEVANCE_CATEGORY = (session, input) => {
  const n = digit(input);
  if (n >= 1 && n <= GRIEVANCE_CATEGORIES.length) {
    const category = GRIEVANCE_CATEGORIES[n - 1];
    const grievance = core.fileGrievance({ phone: session.phone, orderId: session.ctx.selectedOrderId, category });
    flash(session, 'grievance_filed_msg', { id: grievance.id });
    goto(session, 'ORDER_HUB');
  } else if (n === 0) {
    goto(session, 'ORDER_HUB');
  } else {
    invalidOption(session);
  }
};

// -------------------- MY GRIEVANCES --------------------
HANDLERS.MY_GRIEVANCES = (session, input) => {
  const n = digit(input);
  if (n === 0) {
    goto(session, 'MAIN_MENU');
    return;
  }
  const rows = session.ctx.myGrievanceRows || [];
  if (n >= 1 && n <= rows.length) {
    goto(session, 'MY_GRIEVANCE_DETAIL', { selectedGrievanceId: rows[n - 1].id });
  } else {
    invalidOption(session);
  }
};

HANDLERS.MY_GRIEVANCE_DETAIL = (session, input) => {
  if (digit(input) === 0) goto(session, 'MY_GRIEVANCES');
  else invalidOption(session);
};

// -------------------- MARKET INFO --------------------
HANDLERS.MARKET_INFO = (session, input) => {
  const n = digit(input);
  if (n === 1) goto(session, 'MARKET_INFO_PRICES');
  else if (n === 2) goto(session, 'MARKET_INFO_WEATHER');
  else if (n === 3) goto(session, 'MARKET_INFO_SCHEMES');
  else if (n === 0) goto(session, 'MAIN_MENU');
  else invalidOption(session);
};

HANDLERS.MARKET_INFO_PRICES = (session, input) => {
  if (digit(input) === 0) goto(session, 'MARKET_INFO');
  else invalidOption(session);
};
HANDLERS.MARKET_INFO_WEATHER = HANDLERS.MARKET_INFO_PRICES;
HANDLERS.MARKET_INFO_SCHEMES = HANDLERS.MARKET_INFO_PRICES;

// -------------------- HELP --------------------
HANDLERS.HELP = (session, input) => {
  if (digit(input) === 0) goto(session, 'MAIN_MENU');
  else invalidOption(session);
};

function handleInput(session, input) {
  const handler = HANDLERS[session.state];
  if (!handler) {
    session.state = 'MAIN_MENU';
    return render(session);
  }
  handler(session, input);
  return render(session);
}

module.exports = { handleInput };
