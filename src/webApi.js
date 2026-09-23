// ============================================================================
// WEB API (Smartphone/Web channel REST routes)
// ----------------------------------------------------------------------------
// Thin JSON wrappers around src/core.js - the SAME shared service layer the
// Button Phone channel's state machine (src/transitions.js) uses. No
// business logic lives here; every route just validates the request shape
// and calls a core.* function. This is what guarantees a listing created
// through this API is immediately visible/interactable from the SMS
// simulator, and vice versa - both channels read and write one shared store.
//
// Identity model matches the SMS channel exactly: a "web session" is just a
// session created via POST /api/session (src/sessionStore.js), the same
// endpoint the SMS simulator uses to start a new phone thread. The web
// frontend stores the returned phone in localStorage and sends it as the
// `phone` field/query param on every subsequent call - no separate auth.
// ============================================================================

const express = require('express');
const core = require('./core');
const { t, loadLocale } = require('./i18n');
const { LANGUAGES } = require('./languages');
const { createSession, getSession } = require('./sessionStore');

const router = express.Router();

function requirePhone(req, res) {
  const phone = req.body.phone || req.query.phone;
  const session = phone && getSession(phone);
  if (!session) {
    res.status(404).json({ error: 'Session not found. Start a new web session first.' });
    return null;
  }
  return session;
}

function label(lang, key, params) {
  return t(lang || 'en', key, params);
}

// -------------------- Session / language --------------------
router.post('/session', (req, res) => {
  const session = createSession();
  session.lang = 'en';
  res.json({ phone: session.phone, lang: session.lang });
});

router.post('/language', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { lang } = req.body;
  if (!LANGUAGES.some((l) => l.code === lang)) return res.status(400).json({ error: 'Unknown language' });
  session.lang = lang;
  res.json({ phone: session.phone, lang: session.lang });
});

router.get('/languages', (req, res) => {
  res.json(LANGUAGES);
});

// Full string bundle for a language - the web frontend uses this the same
// way the SMS channel's i18n.t() does, so both channels read display text
// from the exact same locale JSON files (no separate web translation set).
router.get('/locale', (req, res) => {
  const lang = req.query.lang || 'en';
  try {
    res.json(loadLocale(lang));
  } catch (e) {
    res.json(loadLocale('en'));
  }
});

// -------------------- Catalog --------------------
router.get('/categories', (req, res) => {
  const lang = req.query.lang || 'en';
  const cats = core.categories().map((c) => ({
    id: c.id,
    label: label(lang, `cat_${c.id}`),
    items: c.items.map((it) => ({ id: it, label: label(lang, `item_${it}`), hasPrice: core.itemMeta(it).hasPrice })),
  }));
  res.json(cats);
});

router.get('/grades', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json(core.grades().map((g) => ({ code: g, label: label(lang, `grade_${g}_option`) })));
});

router.get('/logistics-options', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json(core.logisticsOptions().map((o) => ({ code: o, label: label(lang, `logistics_${o}`) })));
});

router.get('/grievance-categories', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json(core.grievanceCategories().map((c) => ({ code: c, label: label(lang, `grievance_cat_${c}`) })));
});

router.get('/fpos', (req, res) => {
  res.json(core.listFPOs());
});

// -------------------- Market info --------------------
router.get('/market/prices', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json(core.todaysPrices().map((p) => ({ ...p, label: label(lang, `item_${p.item}`) })));
});

router.get('/market/history', (req, res) => {
  res.json(core.priceHistory(req.query.item));
});

router.get('/market/compare', (req, res) => {
  res.json(core.nearbyMarketPrices(req.query.item));
});

router.get('/market/weather', (req, res) => {
  const lang = req.query.lang || 'en';
  const advisory = core.weatherAdvisory();
  res.json({ text: label(lang, advisory.key, advisory.params) });
});

router.get('/market/schemes', (req, res) => {
  const lang = req.query.lang || 'en';
  res.json([label(lang, 'scheme_1'), label(lang, 'scheme_2'), label(lang, 'scheme_3')]);
});

// -------------------- FPO / verification --------------------
router.get('/profile/farmer', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const profile = core.getFarmerProfile(session.phone);
  const fpo = profile.fpoId ? core.listFPOs().find((f) => f.id === profile.fpoId) : null;
  res.json({ ...profile, fpo });
});

router.post('/profile/farmer/fpo', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { fpoId } = req.body;
  const profile = fpoId ? core.joinFPO(session.phone, fpoId) : core.leaveFPO(session.phone);
  res.json(profile);
});

router.post('/profile/farmer/toggle-verified', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  res.json(core.toggleSellerVerified(session.phone));
});

router.get('/profile/buyer', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  res.json(core.getBuyerProfile(session.phone));
});

router.post('/profile/buyer/verify', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { businessType, businessName } = req.body;
  res.json(core.verifyBuyer(session.phone, businessType, businessName));
});

// -------------------- Listings --------------------
router.get('/listings', (req, res) => {
  const { item, category, grade, availability, fpoOnly, verifiedOnly, priceMin, priceMax, sort } = req.query;
  const listings = core.listActiveListings({
    item: item || undefined,
    category: category || undefined,
    grade: grade || undefined,
    availability: availability || undefined,
    fpoOnly: fpoOnly === 'true',
    verifiedOnly: verifiedOnly === 'true',
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    sort: sort || undefined,
  });
  res.json(listings);
});

router.get('/listings/mine', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  res.json(core.myListings(session.phone));
});

router.get('/listings/:id', (req, res) => {
  try {
    res.json(core.getListing(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.get('/listings/:id/offers', (req, res) => {
  try {
    res.json(core.offersForListing(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post('/listings', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { item, qty, grade, price, availability } = req.body;
  if (!item || !qty || !price || !availability) {
    return res.status(400).json({ error: 'item, qty, price and availability are required' });
  }
  const listing = core.createListing({
    farmerId: session.phone,
    farmerLabel: `Farmer ${session.phone}`,
    location: 'Your Village',
    item,
    qty: Number(qty),
    grade: grade || 'B',
    price: Number(price),
    availability,
  });
  res.json(listing);
});

router.post('/listings/:id/cancel', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  try {
    res.json(core.cancelListing(req.params.id, session.phone));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// -------------------- Offers --------------------
router.post('/offers', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { listingId, amount } = req.body;
  try {
    const offer = core.makeOffer({ listingId, buyerId: session.phone, amount: amount !== undefined ? Number(amount) : undefined });
    res.json(offer);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/offers/:listingId/:offerId/accept', (req, res) => {
  try {
    const order = core.acceptOffer({ listingId: req.params.listingId, offerId: req.params.offerId });
    res.json(order);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/offers/:listingId/:offerId/counter', (req, res) => {
  const { amount } = req.body;
  try {
    const offer = core.counterOffer({ listingId: req.params.listingId, offerId: req.params.offerId, amount: Number(amount) });
    res.json(offer);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/offers/:listingId/:offerId/reject', (req, res) => {
  try {
    const offer = core.rejectOffer({ listingId: req.params.listingId, offerId: req.params.offerId });
    res.json(offer);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// -------------------- Lots / Group Sale --------------------
router.get('/lots', (req, res) => {
  if (req.query.item) return res.json(core.getLot(req.query.item));
  res.json(core.allLots());
});

router.post('/lots/join', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { item, qty } = req.body;
  res.json(core.joinLot(session.phone, item, Number(qty)));
});

router.post('/bulk-sourcing', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { item, qty } = req.body;
  res.json(core.requestBulkSourcing(session.phone, item, Number(qty)));
});

// -------------------- Orders --------------------
router.get('/orders/mine', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  res.json(core.myOrderRows(session.phone));
});

router.get('/orders/:id', (req, res) => {
  try {
    res.json(core.getOrder(req.params.id));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post('/orders/:id/delivery-status', (req, res) => {
  try {
    res.json(core.updateDeliveryStatus(req.params.id, req.body.status));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/orders/:id/payment-status', (req, res) => {
  try {
    res.json(core.updatePaymentStatus(req.params.id, req.body.status));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/orders/:id/logistics', (req, res) => {
  try {
    res.json(core.setLogistics(req.params.id, req.body.option));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// -------------------- Grievances --------------------
router.post('/grievances', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const { orderId, category, detail } = req.body;
  res.json(core.fileGrievance({ phone: session.phone, orderId, category, detail }));
});

router.get('/grievances/mine', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  res.json(core.myGrievances(session.phone));
});

// -------------------- Notifications (mocked) --------------------
router.get('/notifications', (req, res) => {
  const session = requirePhone(req, res);
  if (!session) return;
  const lang = req.query.lang || session.lang || 'en';
  const notifications = [];
  core.myListings(session.phone).forEach((listing) => {
    listing.offers
      .filter((o) => o.status === 'pending')
      .forEach((o) => {
        notifications.push({
          id: `offer-${o.id}`,
          text: label(lang, 'notif_new_offer', { item: label(lang, `item_${listing.item}`), amount: o.amount }),
        });
      });
  });
  core.allLots().forEach((lot) => {
    if (lot.totalQty >= lot.targetQty) {
      notifications.push({
        id: `lot-${lot.item}`,
        text: label(lang, 'notif_lot_target_reached', { item: label(lang, `item_${lot.item}`) }),
      });
    }
  });
  res.json(notifications);
});

module.exports = router;
