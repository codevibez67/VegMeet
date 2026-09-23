// ============================================================================
// SCREENS (rendering layer - Button Phone channel)
// ----------------------------------------------------------------------------
// Pure(ish) rendering: given the current session (state + ctx + selected
// locale), produce the SMS-style text to send back. This module never
// mutates data and never contains hardcoded English strings - every piece of
// display text is resolved through i18n's t(lang, key, params). All data
// reads go through src/core.js, the same shared service layer the
// Smartphone/Web channel's REST routes use.
// ============================================================================

const { t } = require('./i18n');
const { getLanguagePage, totalLanguagePages } = require('./languages');
const { CATEGORIES, ITEM_META, PRICE_HISTORY, NEARBY_MARKET_PRICES } = require('./seedData');
const core = require('./core');

function composeMenu(lang, { titleKey, titleParams, extraLines = [], options = [] }) {
  const lines = [];
  lines.push(t(lang, titleKey, titleParams));
  extraLines.forEach((l) => lines.push(l));
  options.forEach((o) => lines.push(`${o.num}. ${t(lang, o.labelKey, o.labelParams)}`));
  return lines.join('\n');
}

function itemLabel(lang, itemId) {
  return t(lang, `item_${itemId}`);
}
function categoryLabel(lang, catId) {
  return t(lang, `cat_${catId}`);
}

function availabilityLabel(lang, code) {
  if (code === 'now') return t(lang, 'list_avail_now');
  if (code === '3days') return t(lang, 'list_avail_3days');
  return t(lang, 'list_avail_week');
}

function statusLabel(lang, status) {
  const map = {
    active: 'status_active',
    offer: 'status_offer',
    sold: 'status_sold',
    pending: 'status_pending',
    accepted: 'status_accepted',
    countered: 'status_countered',
    rejected: 'status_rejected',
    confirmed: 'status_confirmed',
  };
  return t(lang, map[status] || 'status_active');
}

function fpoTag(lang, listing) {
  return listing.fpo ? ` ${t(lang, 'fpo_tag')}` : '';
}

const BUILDERS = {};

BUILDERS.LANG_SELECT = (session) => {
  const page = session.langPage || 0;
  const langs = getLanguagePage(page);
  const options = langs.map((l, idx) => ({ num: idx + 1, labelKey: null, labelText: l.nativeName }));
  const hasMore = page + 1 < totalLanguagePages();
  if (hasMore) options.push({ num: 9, labelKey: 'lang_more', labelText: null });
  if (page > 0) options.push({ num: 0, labelKey: 'lang_back', labelText: null });
  const lines = [t('en', 'lang_page_title')];
  options.forEach((o) => {
    const label = o.labelText || t('en', o.labelKey);
    lines.push(`${o.num}. ${label}`);
  });
  return { raw: lines.join('\n') };
};

BUILDERS.MAIN_MENU = (session) =>
  composeMenu(session.lang, {
    titleKey: 'main_title',
    options: [
      { num: 0, labelKey: 'main_change_lang' },
      { num: 1, labelKey: 'main_sell' },
      { num: 2, labelKey: 'main_buy' },
      { num: 3, labelKey: 'main_my_listings' },
      { num: 4, labelKey: 'main_my_orders' },
      { num: 5, labelKey: 'main_market_info' },
      { num: 6, labelKey: 'main_my_grievances' },
      { num: 7, labelKey: 'main_my_profile' },
      { num: 8, labelKey: 'main_help' },
    ],
  });

// -------------------- PROFILE (FPO + buyer verification) --------------------
BUILDERS.PROFILE = (session) => {
  const { lang, phone } = session;
  const farmerProfile = core.getFarmerProfile(phone);
  const buyerProfile = core.getBuyerProfile(phone);
  const fpo = farmerProfile.fpoId ? core.listFPOs().find((f) => f.id === farmerProfile.fpoId) : null;
  return composeMenu(lang, {
    titleKey: 'profile_title',
    extraLines: [
      t(lang, 'profile_fpo_line', { fpo: fpo ? fpo.name : t(lang, 'fpo_none') }),
      t(lang, 'profile_seller_verified_line', { status: t(lang, farmerProfile.verified ? 'verified_yes' : 'verified_no') }),
      t(lang, 'profile_verify_line', { status: t(lang, buyerProfile.verified ? 'verified_yes' : 'verified_no') }),
    ],
    options: [
      { num: 1, labelKey: 'profile_join_fpo_option' },
      { num: 2, labelKey: 'profile_verify_option' },
      { num: 3, labelKey: 'profile_toggle_seller_verified_option' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.PROFILE_FPO_SELECT = (session) => {
  const { lang } = session;
  const fpos = core.listFPOs();
  const options = fpos.map((f, idx) => ({ num: idx + 1, labelKey: null, labelText: `${f.name} (${f.location})` }));
  options.push({ num: fpos.length + 1, labelKey: 'fpo_leave_option' });
  options.push({ num: 0, labelKey: 'back' });
  const lines = [t(lang, 'fpo_select_title')];
  options.forEach((o) => lines.push(`${o.num}. ${o.labelText || t(lang, o.labelKey)}`));
  return lines.join('\n');
};

BUILDERS.PROFILE_VERIFY_TYPE = (session) =>
  composeMenu(session.lang, {
    titleKey: 'business_type_title',
    options: [
      { num: 1, labelKey: 'business_type_trader' },
      { num: 2, labelKey: 'business_type_retailer' },
      { num: 3, labelKey: 'business_type_exporter' },
      { num: 4, labelKey: 'business_type_processor' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.SELL_CATEGORY = (session) =>
  composeMenu(session.lang, {
    titleKey: 'cat_title',
    options: [
      { num: 1, labelKey: 'cat_vegetables' },
      { num: 2, labelKey: 'cat_fruits' },
      { num: 3, labelKey: 'cat_livestock' },
      { num: 4, labelKey: 'back' },
    ],
  });

BUILDERS.SELL_ITEM = (session) => {
  const cat = CATEGORIES.find((c) => c.id === session.ctx.category);
  const options = cat.items.map((it, idx) => ({ num: idx + 1, labelKey: `item_${it}` }));
  options.push({ num: cat.items.length + 1, labelKey: 'back' });
  return composeMenu(session.lang, {
    titleKey: 'item_title',
    titleParams: { category: categoryLabel(session.lang, cat.id) },
    options,
  });
};

BUILDERS.SELL_ACTION = (session) => {
  const item = session.ctx.item;
  const hasPrice = ITEM_META[item].hasPrice;
  const options = [];
  let n = 1;
  options.push({ num: n++, labelKey: 'action_current_price' });
  if (hasPrice) {
    options.push({ num: n++, labelKey: 'action_price_graph' });
    options.push({ num: n++, labelKey: 'action_best_time' });
    options.push({ num: n++, labelKey: 'action_compare_markets' });
  }
  options.push({ num: n++, labelKey: 'action_list_item' });
  if (hasPrice) options.push({ num: n++, labelKey: 'action_group_sale' });
  options.push({ num: n++, labelKey: 'back' });
  return composeMenu(session.lang, {
    titleKey: 'sell_action_title',
    titleParams: { item: itemLabel(session.lang, item) },
    options,
  });
};

BUILDERS.SELL_CURRENT_PRICE = (session) => {
  const { lang, ctx } = session;
  const item = ctx.item;
  const hasPrice = ITEM_META[item].hasPrice;
  const extraLines = [];
  if (hasPrice) {
    extraLines.push(t(lang, 'current_price_line', { price: core.currentPrice(item), market: 'Local Mandi' }));
  } else {
    extraLines.push(t(lang, 'livestock_no_price'));
  }
  return composeMenu(lang, {
    titleKey: 'current_price_title',
    titleParams: { item: itemLabel(lang, item) },
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.SELL_PRICE_GRAPH = (session) => {
  const { lang, ctx } = session;
  const item = ctx.item;
  const hist = PRICE_HISTORY[item];
  const prices = hist.map((h) => h.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = Math.max(1, maxPrice - minPrice);
  const extraLines = hist.map((h) => {
    const barLen = Math.max(1, Math.round(((h.price - minPrice) / range) * 10));
    return t(lang, 'price_graph_line', { date: h.date, price: h.price, bar: '#'.repeat(barLen) });
  });
  const trendUp = hist[hist.length - 1].price >= hist[0].price;
  extraLines.push(t(lang, 'price_graph_summary', { trend: trendUp ? '↑ rising' : '↓ falling' }));
  return composeMenu(lang, {
    titleKey: 'price_graph_title',
    titleParams: { item: itemLabel(lang, item) },
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.SELL_BEST_TIME = (session) => {
  const { lang, ctx } = session;
  const item = ctx.item;
  const hist = PRICE_HISTORY[item];
  const trendUp = hist[hist.length - 1].price >= hist[0].price;
  const weather = core.weatherAdvisory();
  let recKey = trendUp ? 'best_time_rec_wait' : 'best_time_rec_now';
  let reasonKey = trendUp ? 'best_time_reason_rising' : 'best_time_reason_falling';
  if (weather.key === 'weather_rain_warning') {
    recKey = 'best_time_rec_now';
    reasonKey = 'best_time_reason_rain';
  }
  return composeMenu(lang, {
    titleKey: 'best_time_title',
    titleParams: { item: itemLabel(lang, item) },
    extraLines: [
      t(lang, 'best_time_recommend', { recommendation: t(lang, recKey) }),
      t(lang, 'best_time_reason', { reason: t(lang, reasonKey, { days: weather.params.days || '' }) }),
    ],
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.SELL_COMPARE_MARKETS = (session) => {
  const { lang, ctx } = session;
  const item = ctx.item;
  const rows = NEARBY_MARKET_PRICES[item];
  const best = rows.reduce((a, b) => (b.price > a.price ? b : a));
  const extraLines = rows.map((r) => t(lang, 'compare_markets_line', { market: r.market, price: r.price }));
  extraLines.push(t(lang, 'compare_markets_tip', { bestMarket: best.market }));
  return composeMenu(lang, {
    titleKey: 'compare_markets_title',
    titleParams: { item: itemLabel(lang, item) },
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.SELL_GROUP_SALE_STATUS = (session) => {
  const { lang, ctx } = session;
  const pool = core.getLot(ctx.item);
  const pct = Math.min(100, Math.round((pool.totalQty / pool.targetQty) * 100));
  const barLen = Math.max(0, Math.min(10, Math.round(pct / 10)));
  const bar = '#'.repeat(barLen) + '-'.repeat(10 - barLen);
  return composeMenu(lang, {
    titleKey: 'group_sale_status',
    titleParams: {
      item: itemLabel(lang, ctx.item),
      count: pool.participants.length,
      totalQty: pool.totalQty,
      targetQty: pool.targetQty,
      grade: pool.grade,
      bar,
      pct,
    },
    extraLines: [t(lang, 'group_sale_ask_join')],
    options: [
      { num: 1, labelKey: 'group_sale_join_option' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.SELL_GROUP_SALE_QTY = (session) =>
  composeMenu(session.lang, { titleKey: 'group_sale_qty_prompt', options: [] });

BUILDERS.SELL_LIST_QTY = (session) => composeMenu(session.lang, { titleKey: 'list_qty_prompt', options: [] });

BUILDERS.SELL_LIST_GRADE = (session) =>
  composeMenu(session.lang, {
    titleKey: 'grade_select_title',
    options: [
      { num: 1, labelKey: 'grade_a_option' },
      { num: 2, labelKey: 'grade_b_option' },
      { num: 3, labelKey: 'grade_c_option' },
    ],
  });

BUILDERS.SELL_LIST_PRICE_CHOICE = (session) => {
  const { lang, ctx } = session;
  const price = core.currentPrice(ctx.item) || 0;
  return composeMenu(lang, {
    titleKey: 'list_price_title',
    options: [
      { num: 1, labelKey: 'list_price_market', labelParams: { price } },
      { num: 2, labelKey: 'list_price_own' },
    ],
  });
};

BUILDERS.SELL_LIST_PRICE_CUSTOM = (session) =>
  composeMenu(session.lang, { titleKey: 'list_price_custom_prompt', options: [] });

BUILDERS.SELL_LIST_AVAILABILITY = (session) =>
  composeMenu(session.lang, {
    titleKey: 'list_avail_title',
    options: [
      { num: 1, labelKey: 'list_avail_now' },
      { num: 2, labelKey: 'list_avail_3days' },
      { num: 3, labelKey: 'list_avail_week' },
    ],
  });

BUILDERS.BUY_CATEGORY = (session) =>
  composeMenu(session.lang, {
    titleKey: 'cat_title',
    options: [
      { num: 1, labelKey: 'cat_vegetables' },
      { num: 2, labelKey: 'cat_fruits' },
      { num: 3, labelKey: 'cat_livestock' },
      { num: 4, labelKey: 'back' },
    ],
  });

BUILDERS.BUY_ITEM = (session) => {
  const cat = CATEGORIES.find((c) => c.id === session.ctx.category);
  const options = cat.items.map((it, idx) => ({ num: idx + 1, labelKey: `item_${it}` }));
  options.push({ num: cat.items.length + 1, labelKey: 'back' });
  return composeMenu(session.lang, {
    titleKey: 'item_title',
    titleParams: { category: categoryLabel(session.lang, cat.id) },
    options,
  });
};

BUILDERS.BUY_ACTION = (session) =>
  composeMenu(session.lang, {
    titleKey: 'buy_action_title',
    titleParams: { item: itemLabel(session.lang, session.ctx.item) },
    options: [
      { num: 1, labelKey: 'buy_view_listings' },
      { num: 2, labelKey: 'buy_filter_listings' },
      { num: 3, labelKey: 'buy_place_offer' },
      { num: 4, labelKey: 'buy_bulk_sourcing' },
      { num: 5, labelKey: 'back' },
    ],
  });

function listingRows(lang, listings) {
  return listings.map((l, idx) =>
    t(lang, 'listing_row', {
      idx: idx + 1,
      farmer: l.farmerLabel,
      location: l.location,
      qty: l.qty,
      price: l.price,
      availability: availabilityLabel(lang, l.availability),
      grade: l.grade,
      fpoTag: fpoTag(lang, l),
    })
  );
}

BUILDERS.BUY_LISTINGS_VIEW = (session) => {
  const { lang, ctx } = session;
  const listings = (ctx.listingResultIds || []).map((id) => core.getListing(id));
  const extraLines = listings.length ? listingRows(lang, listings) : [t(lang, 'no_listings')];
  return composeMenu(lang, {
    titleKey: 'listings_title',
    titleParams: { item: itemLabel(lang, ctx.item) },
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.BUY_FILTER_CHOICE = (session) =>
  composeMenu(session.lang, {
    titleKey: 'filter_title',
    options: [
      { num: 1, labelKey: 'filter_lowest_price' },
      { num: 2, labelKey: 'filter_nearest' },
      { num: 3, labelKey: 'filter_ready_now' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.BUY_PLACE_OFFER_SELECT = (session) => {
  const { lang, ctx } = session;
  const listings = (ctx.listingResultIds || []).map((id) => core.getListing(id));
  const extraLines = listings.length ? listingRows(lang, listings) : [t(lang, 'no_listings')];
  return composeMenu(lang, {
    titleKey: 'place_offer_select_title',
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.BUY_PLACE_OFFER_ACTION = (session) => {
  const { lang, ctx } = session;
  const listing = core.getListing(ctx.selectedListingId);
  return composeMenu(lang, {
    titleKey: 'place_offer_action_title',
    titleParams: { farmer: listing.farmerLabel, qty: listing.qty, price: listing.price, grade: listing.grade },
    options: [
      { num: 1, labelKey: 'place_offer_accept' },
      { num: 2, labelKey: 'place_offer_make' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.BUY_OFFER_AMOUNT = (session) =>
  composeMenu(session.lang, { titleKey: 'offer_amount_prompt', options: [] });

BUILDERS.BUY_BULK_QTY = (session) => composeMenu(session.lang, { titleKey: 'bulk_qty_prompt', options: [] });

BUILDERS.MY_LISTINGS = (session) => {
  const { lang, phone } = session;
  const mine = core.myListings(phone);
  const extraLines = mine.length
    ? mine.map((l, idx) =>
        t(lang, 'my_listings_row', {
          idx: idx + 1,
          item: itemLabel(lang, l.item),
          qty: l.qty,
          price: l.price,
          status: statusLabel(lang, l.status),
        })
      )
    : [t(lang, 'my_listings_empty')];
  return composeMenu(lang, {
    titleKey: 'my_listings_title',
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.MY_LISTING_DETAIL = (session) => {
  const { lang, ctx } = session;
  const listing = core.getListing(ctx.selectedListingId);
  return composeMenu(lang, {
    titleKey: 'my_listing_detail_title',
    titleParams: { id: listing.id, item: itemLabel(lang, listing.item) },
    options: [
      { num: 1, labelKey: 'my_listing_view_offers' },
      { num: 2, labelKey: 'my_listing_cancel' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.MY_LISTING_OFFERS = (session) => {
  const { lang, ctx } = session;
  const listing = core.getListing(ctx.selectedListingId);
  const offers = core.offersForListing(listing.id).filter((o) => o.status === 'pending' || o.status === 'countered');
  const extraLines = offers.length
    ? offers.map((o, idx) => t(lang, 'offer_row', { idx: idx + 1, amount: o.amount, status: statusLabel(lang, o.status) }))
    : [t(lang, 'no_offers_msg')];
  return composeMenu(lang, {
    titleKey: 'my_listing_detail_title',
    titleParams: { id: listing.id, item: itemLabel(lang, listing.item) },
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.MY_LISTING_OFFER_ACTION = (session) => {
  const { lang, ctx } = session;
  const offers = core.offersForListing(ctx.selectedListingId);
  const offer = offers.find((o) => o.id === ctx.selectedOfferId);
  return composeMenu(lang, {
    titleKey: 'offer_action_title',
    titleParams: { amount: offer.amount },
    options: [
      { num: 1, labelKey: 'offer_accept' },
      { num: 2, labelKey: 'offer_counter' },
      { num: 3, labelKey: 'offer_reject' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.MY_LISTING_COUNTER_AMOUNT = (session) =>
  composeMenu(session.lang, { titleKey: 'offer_counter_prompt', options: [] });

BUILDERS.MY_ORDERS = (session) => {
  const { lang, ctx } = session;
  const rows = ctx.myOrderRows || [];
  const extraLines = rows.length
    ? rows.map((r, idx) => t(lang, 'order_row', { idx: idx + 1, item: itemLabel(lang, r.item), qty: r.qty, price: r.price, status: statusLabel(lang, r.status) }))
    : [t(lang, 'my_orders_empty')];
  return composeMenu(lang, {
    titleKey: 'my_orders_title',
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.ORDER_HUB = (session) => {
  const { lang, ctx } = session;
  const order = core.getOrder(ctx.selectedOrderId);
  return composeMenu(lang, {
    titleKey: 'order_hub_title',
    titleParams: { id: order.id, item: itemLabel(lang, order.item) },
    extraLines: [
      t(lang, 'order_hub_delivery_line', { status: t(lang, `delivery_${order.deliveryStatus}`) }),
      t(lang, 'order_hub_payment_line', { status: t(lang, `payment_${order.paymentStatus}`) }),
      t(lang, 'order_hub_logistics_line', { option: order.logistics ? t(lang, `logistics_${order.logistics}`) : t(lang, 'logistics_none') }),
    ],
    options: [
      { num: 1, labelKey: 'order_update_delivery' },
      { num: 2, labelKey: 'order_update_payment' },
      { num: 3, labelKey: 'order_set_logistics' },
      { num: 4, labelKey: 'order_file_grievance' },
      { num: 0, labelKey: 'back' },
    ],
  });
};

BUILDERS.ORDER_DELIVERY_STATUS = (session) =>
  composeMenu(session.lang, {
    titleKey: 'delivery_status_title',
    options: [
      { num: 1, labelKey: 'delivery_preparing' },
      { num: 2, labelKey: 'delivery_ready' },
      { num: 3, labelKey: 'delivery_completed' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.ORDER_PAYMENT_STATUS = (session) =>
  composeMenu(session.lang, {
    titleKey: 'payment_status_title',
    options: [
      { num: 1, labelKey: 'payment_pending' },
      { num: 2, labelKey: 'payment_paid' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.ORDER_LOGISTICS_CHOICE = (session) =>
  composeMenu(session.lang, {
    titleKey: 'logistics_title',
    options: [
      { num: 1, labelKey: 'logistics_farmer_delivers' },
      { num: 2, labelKey: 'logistics_fpo_collection' },
      { num: 3, labelKey: 'logistics_buyer_pickup' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.ORDER_GRIEVANCE_CATEGORY = (session) =>
  composeMenu(session.lang, {
    titleKey: 'grievance_category_title',
    options: [
      { num: 1, labelKey: 'grievance_cat_quality' },
      { num: 2, labelKey: 'grievance_cat_payment' },
      { num: 3, labelKey: 'grievance_cat_delivery' },
      { num: 4, labelKey: 'grievance_cat_other' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.MY_GRIEVANCES = (session) => {
  const { lang, ctx } = session;
  const rows = ctx.myGrievanceRows || [];
  const extraLines = rows.length
    ? rows.map((g, idx) =>
        t(lang, 'grievance_row', { idx: idx + 1, orderId: g.orderId, category: t(lang, `grievance_cat_${g.category}`), status: t(lang, `grievance_status_${g.status}`) })
      )
    : [t(lang, 'my_grievances_empty')];
  return composeMenu(lang, {
    titleKey: 'my_grievances_title',
    extraLines,
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.MY_GRIEVANCE_DETAIL = (session) => {
  const { lang, ctx } = session;
  const grievance = core.myGrievances(session.phone).find((g) => g.id === ctx.selectedGrievanceId);
  return composeMenu(lang, {
    titleKey: 'grievance_detail_title',
    titleParams: { id: grievance.id },
    extraLines: [
      t(lang, 'grievance_detail_body', {
        orderId: grievance.orderId,
        category: t(lang, `grievance_cat_${grievance.category}`),
        status: t(lang, `grievance_status_${grievance.status}`),
      }),
    ],
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.MARKET_INFO = (session) =>
  composeMenu(session.lang, {
    titleKey: 'market_info_title',
    options: [
      { num: 1, labelKey: 'market_info_prices' },
      { num: 2, labelKey: 'market_info_weather' },
      { num: 3, labelKey: 'market_info_schemes' },
      { num: 0, labelKey: 'back' },
    ],
  });

BUILDERS.MARKET_INFO_PRICES = (session) => {
  const { lang } = session;
  const rows = core.todaysPrices();
  const extraLines = rows.map((r) => t(lang, 'todays_prices_row', { item: itemLabel(lang, r.item), price: r.price }));
  return composeMenu(lang, { titleKey: 'todays_prices_title', extraLines, options: [{ num: 0, labelKey: 'back' }] });
};

BUILDERS.MARKET_INFO_WEATHER = (session) => {
  const { lang } = session;
  const advisory = core.weatherAdvisory();
  const text = t(lang, advisory.key, advisory.params);
  return composeMenu(lang, {
    titleKey: 'weather_title',
    extraLines: [t(lang, 'weather_text', { advisory: text })],
    options: [{ num: 0, labelKey: 'back' }],
  });
};

BUILDERS.MARKET_INFO_SCHEMES = (session) =>
  composeMenu(session.lang, {
    titleKey: 'schemes_title',
    extraLines: [t(session.lang, 'scheme_1'), t(session.lang, 'scheme_2'), t(session.lang, 'scheme_3'), t(session.lang, 'schemes_note')],
    options: [{ num: 0, labelKey: 'back' }],
  });

BUILDERS.HELP = (session) =>
  composeMenu(session.lang, {
    titleKey: 'help_title',
    extraLines: [t(session.lang, 'help_text')],
    options: [{ num: 0, labelKey: 'back' }],
  });

function render(session) {
  const builder = BUILDERS[session.state];
  if (!builder) return `[[unknown state ${session.state}]]`;
  const result = builder(session);
  const text = typeof result === 'string' ? result : result.raw || result;
  if (session.ctx.flash) {
    const flashText = session.ctx.flash;
    delete session.ctx.flash;
    return `${flashText}\n\n${text}`;
  }
  return text;
}

function renderCurrentScreen(session) {
  return render(session);
}

module.exports = { render, renderCurrentScreen };
