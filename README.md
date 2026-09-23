# Vegmeet

A multi-channel farmer-to-buyer agri marketplace prototype. **One shared
backend**, **two front-facing channels**:

1. **Button Phone Channel** (`/sms-view`) — the original numeric,
   menu-driven SMS-style interface for feature-phone farmers/buyers. Every
   input is a single digit or a short digit run (quantity/price entry) —
   never free text or native-script typing. Language support works by the
   **system** sending messages in the user's chosen language; the user never
   types in that language.
2. **Smartphone/Web Channel** (`/app-view`) — a full web dashboard for
   smartphone/laptop users: real forms, filters, tables, badges and a
   hand-rolled SVG price chart, in the same restrained visual language as the
   SMS channel.

Both channels read and write the **exact same in-memory data** through a
single shared service layer (`src/core.js`). A listing created on the web
dashboard is immediately visible and actionable from the SMS simulator, and
vice versa — proven in the demo script below.

No real SMS gateway, payment gateway, KYC, or logistics dispatch is
integrated — see "Explicitly out of scope" below.

## Run it

```bash
npm install
npm start
```

Then open **http://localhost:3000** — it redirects to the web dashboard
(`/app-view`). The SMS simulator is at **http://localhost:3000/sms-view**.
Each page has a link/tab to switch to the other channel, so both can be
shown side by side in a live demo.

No API keys, database, or external services required.

## Demo script (proves the shared backend)

1. Open `/app-view`, pick a language, click **Continue as Farmer**. Go to
   **Sell → Onion**, create a graded listing (e.g. 500kg, Grade A, market
   price), and note it appears under **My Listings**. Also try the **Group
   Sale (Lot)** panel below the form — it shows a live progress bar toward
   the pool's target quantity.
2. Open `/sms-view` in another tab (or click **New Conversation** there),
   select a language, go to **Buy → Vegetables → Onion → Place Offer on a
   Listing** — the listing created in step 1 shows up in the numbered list
   (with its Grade and FPO badge), proving both channels share one dataset.
   Make a counter-offer.
3. Back in `/app-view` as the farmer, go to **My Orders** — the offer placed
   from the SMS channel appears live. Accept it, then use the **Order Hub**
   to update **Delivery Status**, **Payment Status**, **Logistics**, and
   optionally **File a Grievance**.
4. Switch back to `/sms-view` as the buyer and check **My Orders** — the
   order now shows **Confirmed**, matching the web dashboard exactly.
5. On the language picker, switch to **Tamil** or **Hindi** on either
   channel mid-session — both channels pull display text from the same
   `locales/*.json` files, so item names, menus, and dashboard headings all
   translate together.

## Features

### Shared core (both channels)
- Listings, offers (accept / counter-offer / reject), orders, **quality
  grading** (A/B/C on every listing), **FPO membership** (join/leave a
  Farmer Producer Organisation; listings show an FPO badge), **buyer
  business verification** (mock, self-declared), **verified-seller status**
  (mock, self-declared), **Group Sale "Lots"** (graded, FPO-aware pooled
  batches with a target quantity and progress bar), **bulk sourcing
  requests** (matched against Lot pools), **logistics** (farmer delivers /
  FPO collection point / buyer pickup), **payment status** (pending/paid)
  tracked separately from **delivery status** (preparing/ready/completed),
  and **grievances** tied to a specific order (quality / payment / delivery
  / other).
- All of the above lives in `src/core.js` — one set of functions called by
  both `src/transitions.js` (SMS) and `src/webApi.js` (REST). Neither
  channel touches `src/seedData.js` arrays directly.

### Button Phone Channel (`/sms-view`)
- 100% numeric interaction; invalid input never crashes or dead-ends the
  conversation.
- Main Menu: Change Language, Sell, Buy, My Listings, My Orders, Market
  Info, My Grievances, My Profile (FPO + verification), Help.
- Sell: category → item → current price / 14-day ASCII price graph /
  best-time-to-sell advisory (weather-linked) / compare nearby markets /
  list for sale (quantity → grade → price → availability) / join Group Sale.
- Buy: browse listings (grade + FPO badges shown inline) / filter by
  price-location-availability / place offer or accept listed price /
  request bulk sourcing.
- My Orders → **Order Hub**: update delivery status, payment status,
  logistics, or file a grievance — all as numbered sub-menus.
- Paginated language-selection menu (8 options + "9. More languages" +
  "0. Back"), reused as the general pattern anywhere a list could exceed ~8
  items.

### Smartphone/Web Channel (`/app-view`)
- **Landing page**: language picker (all 23 languages as chips) + Continue
  as Farmer / Continue as Buyer. Session identity is the same fake-phone
  scheme as the SMS channel (no login), just stored in `localStorage`.
- **Home**: today's prices as cards, a hand-rolled inline-SVG price trend
  chart (no charting library/CDN dependency), and a nearby-markets
  comparison table — all item-selectable.
- **Sell**: crop picker (emoji-as-image tiles) → quantity/grade/price/
  availability form → a separate **Group Sale (Lot)** panel with a visible
  pooled-quantity progress bar ("800kg / 1000kg target").
- **Buy**: crop picker → real filters (price range, grade, availability,
  FPO-backed only, verified-sellers only, sort) → listing cards with
  Accept-Price / Make-Offer actions.
- **My Listings** / **My Orders** / **My Grievances**: dashboard tables with
  status badges instead of numbered menus; **My Orders** expands into the
  same Order Hub concept as SMS (delivery/payment/logistics/grievance),
  plus an optional free-text grievance detail field (SMS stays category-only
  per the "no free text" constraint).
- **Market Info**: prices, weather advisory, government schemes, and
  transport/storage options as readable cards.
- **My Profile**: FPO join/leave + verified-seller toggle (farmer side),
  business name/type verification (buyer side).
- **Notifications**: mocked feed (new offers received, Group Sale pool
  reached its target).
- Responsive layout (usable on a phone browser or a laptop), same off-white
  background / single green accent / no-gradient visual identity as the SMS
  channel, Noto Sans with Indic subsets.

### i18n (shared by both channels)
- One JSON file per language in `locales/`, keyed by language-neutral
  message id — **the single source of translated text for both channels**.
  The web app fetches the raw locale bundle via `GET /api/web/locale?lang=`
  and formats it client-side exactly like the server's `i18n.t()`.
- **10 languages fully translated**: English, Tamil, Hindi, Telugu, Kannada,
  Malayalam, Marathi, Bengali, Gujarati, Punjabi.
- The remaining 13 scheduled languages (Assamese, Bodo, Dogri, Kashmiri,
  Konkani, Maithili, Manipuri, Nepali, Odia, Sanskrit, Santali, Sindhi,
  Urdu) exist as scaffold files with the full correct key set and English
  placeholder content, marked `"_status": "TODO: translate"`.
- Of the 10 fully-translated languages, **English, Hindi and Tamil** also
  carry full translations for every key added in this multi-channel
  extension (FPO, grading, logistics, payment, grievances, web dashboard
  chrome). The other 7 (Telugu, Kannada, Malayalam, Marathi, Bengali,
  Gujarati, Punjabi) have the original feature set fully translated; newer
  keys fall back to English automatically (`t()` never shows a raw key) —
  filling them in is a content-only task, same as the scaffold languages.
- Adding a missing language or finishing a partial one is purely a content
  task (fill in one JSON file), never a code change.

## Architecture

```
server.js                 Express app: mounts both channels + the shared web API
src/
  core.js                 SHARED service layer - listings/offers/orders/FPO/
                            verification/grading/lots/logistics/payments/
                            grievances/market data. Called by BOTH channels.
  smsGateway.js            THE swap point for a real SMS gateway (see below)
  sessionStore.js          In-memory sessions keyed by a fake phone number
                            (shared identity scheme for both channels)
  languages.js             Registry of all 23 languages + pagination helpers
  i18n.js                  Loads locales/*.json, t(lang, key, params) lookup
  seedData.js              Raw in-memory store: categories, items, 14-day mock
                            price history, nearby-market prices, listings,
                            FPOs, farmer/buyer profiles, group-sale "lots",
                            orders, grievances. Only src/core.js touches this.
  screens.js               SMS rendering layer: state + ctx + locale -> text
                            (no business logic, no hardcoded strings)
  transitions.js           SMS state-machine layer: state + digit -> next
                            state (100% language-agnostic; calls src/core.js)
  webApi.js                REST routes for the web channel - thin JSON
                            wrappers over src/core.js, no business logic
locales/                   One JSON file per language - shared by both channels
public/
  sms/                     Button Phone channel: SMS-thread simulator + keypad
  app/                     Smartphone/Web channel: landing + dashboard SPA
```

The separation is intentional: `src/core.js` is the only place that mutates
shared data, `src/transitions.js` and `src/webApi.js` are both thin
channel-specific layers on top of it, `src/screens.js` and `public/app/app.js`
are the only places that produce display text (via `i18n`/the locale
bundle), and `src/seedData.js` never contains anything translated.

## Swapping in a real SMS gateway (future work)

Everything the Button Phone channel sends goes through a single function:

```js
// src/smsGateway.js
function sendMessage(phone, text) { ... }
```

To go live, replace the body of that one function with a real provider call
(Twilio, Textlocal, a telecom aggregator API, etc.) and wire the inbound
webhook from that provider to call `handleInput(session, digitsReceived)`
from `src/transitions.js`. No other file needs to change.

## Explicitly out of scope for this prototype

- Real SMS/telecom gateway integration (Twilio, Textlocal, etc.)
- Real government mandi price API / real weather API (both are mocked with
  realistic static/generated data — see `src/seedData.js`)
- Real payments/escrow gateway (payment status is a manual mock toggle)
- Real KYC / business verification (buyer verification and seller
  verification are both self-declared mocks, no documents checked)
- Real authentication (session-based identity, matching both channels, is
  sufficient for this demo)
- Real logistics/transport dispatch (logistics is a manual mock selection)
- Auto-detecting language from phone number or region (language is always
  an explicit user choice)
- A database (all data is in-memory and resets when the server restarts —
  fine for a demo, not for production)
