(function () {
  'use strict';

  // ==========================================================================
  // State + persistence (mirrors the SMS channel's session-based identity:
  // the same fake "phone number" scheme, just stored in localStorage here
  // instead of being typed on a keypad)
  // ==========================================================================
  var state = {
    phone: localStorage.getItem('vegmeet_phone') || null,
    lang: localStorage.getItem('vegmeet_lang') || 'en',
    role: localStorage.getItem('vegmeet_role') || 'farmer',
    bundle: {},
    enBundle: {},
    activeView: 'home',
  };

  function save() {
    if (state.phone) localStorage.setItem('vegmeet_phone', state.phone);
    localStorage.setItem('vegmeet_lang', state.lang);
    localStorage.setItem('vegmeet_role', state.role);
  }

  // ==========================================================================
  // API client
  // ==========================================================================
  function api(path, method, body) {
    var opts = { method: method || 'GET', headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch('/api/web' + path, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  function withPhone(obj) {
    return Object.assign({ phone: state.phone }, obj || {});
  }

  function qs(params) {
    var parts = [];
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  // ==========================================================================
  // i18n - pulls from the SAME locale JSON files as the SMS channel via
  // GET /api/web/locale?lang=xx. Falls back to English exactly like the
  // server-side t() does, so partially-translated languages degrade
  // gracefully instead of showing raw keys.
  // ==========================================================================
  function t(key, params) {
    var template = state.bundle[key] !== undefined ? state.bundle[key] : state.enBundle[key];
    if (template === undefined) return '[[' + key + ']]';
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(params, k) ? params[k] : m;
    });
  }

  function loadBundles(lang) {
    var jobs = [api('/locale?lang=en')];
    if (lang !== 'en') jobs.push(api('/locale?lang=' + lang));
    return Promise.all(jobs).then(function (results) {
      state.enBundle = results[0];
      state.bundle = results[1] || results[0];
    });
  }

  // ==========================================================================
  // DOM helpers
  // ==========================================================================
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ITEM_EMOJI = {
    onion: '🧅', tomato: '🍅', potato: '🥔',
    banana: '🍌', mango: '🥭', apple: '🍎',
    goat: '🐐', cow: '🐄', poultry: '🐔',
  };

  function statusBadgeClass(status) {
    return 'badge badge-' + status;
  }

  // ==========================================================================
  // Landing screen
  // ==========================================================================
  function renderLanding() {
    $('landingTagline').textContent = t('web_tagline');
    $('landingLangLabel').textContent = t('web_select_language');
    $('btnContinueFarmer').textContent = t('web_continue_farmer');
    $('btnContinueBuyer').textContent = t('web_continue_buyer');
    $('landingSwitchToSms').innerHTML = t('web_switch_to_sms') + ' &rarr;';

    api('/languages').then(function (langs) {
      var wrap = $('landingLangPicker');
      wrap.innerHTML = '';
      langs.forEach(function (l) {
        var chip = document.createElement('button');
        chip.className = 'lang-chip' + (l.code === state.lang ? ' selected' : '');
        chip.textContent = l.nativeName;
        chip.addEventListener('click', function () {
          state.lang = l.code;
          loadBundles(state.lang).then(renderLanding);
        });
        wrap.appendChild(chip);
      });
    });
  }

  function startSession(role) {
    state.role = role;
    api('/session', 'POST').then(function (data) {
      state.phone = data.phone;
      return api('/language', 'POST', withPhone({ lang: state.lang }));
    }).then(function () {
      save();
      showApp();
    });
  }

  // ==========================================================================
  // App shell (topbar + nav)
  // ==========================================================================
  var NAV_ITEMS = [
    { id: 'home', labelKey: 'web_nav_home' },
    { id: 'sell', labelKey: 'main_sell' },
    { id: 'buy', labelKey: 'main_buy' },
    { id: 'my-listings', labelKey: 'main_my_listings' },
    { id: 'my-orders', labelKey: 'main_my_orders' },
    { id: 'market-info', labelKey: 'main_market_info' },
    { id: 'grievances', labelKey: 'main_my_grievances' },
    { id: 'profile', labelKey: 'main_my_profile' },
    { id: 'notifications', labelKey: 'web_nav_notifications' },
  ];

  var VIEW_RENDERERS = {}; // filled in below per view

  function renderNav() {
    var bar = $('navbar');
    bar.innerHTML = '';
    NAV_ITEMS.forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'nav-btn' + (state.activeView === item.id ? ' active' : '');
      btn.textContent = t(item.labelKey);
      btn.addEventListener('click', function () { switchView(item.id); });
      bar.appendChild(btn);
    });
  }

  function switchView(viewId) {
    state.activeView = viewId;
    NAV_ITEMS.forEach(function (item) {
      $('view-' + item.id).classList.toggle('hidden', item.id !== viewId);
    });
    renderNav();
    if (VIEW_RENDERERS[viewId]) VIEW_RENDERERS[viewId]();
  }

  function showApp() {
    $('view-landing').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    $('channelTag').textContent = 'Web App Channel — ' + state.phone;
    $('btnSwitchRole').textContent = t('web_nav_home');
    populateLangSelect();
    renderNav();
    switchView('home');
  }

  function populateLangSelect() {
    api('/languages').then(function (langs) {
      var sel = $('langSelect');
      sel.innerHTML = '';
      langs.forEach(function (l) {
        var opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = l.nativeName;
        if (l.code === state.lang) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = function () {
        state.lang = sel.value;
        save();
        loadBundles(state.lang).then(function () {
          renderNav();
          if (VIEW_RENDERERS[state.activeView]) VIEW_RENDERERS[state.activeView]();
          $('btnSwitchRole').textContent = t('web_nav_home');
        });
      };
    });
  }

  // ==========================================================================
  // Small reusable widgets
  // ==========================================================================
  function itemPicker(container, categories, selectedItem, onSelect) {
    container.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'item-picker';
    categories.forEach(function (cat) {
      cat.items.forEach(function (it) {
        var tile = document.createElement('div');
        tile.className = 'item-tile' + (it.id === selectedItem ? ' selected' : '');
        tile.innerHTML = '<span class="emoji">' + (ITEM_EMOJI[it.id] || '🌱') + '</span>' + esc(it.label);
        tile.addEventListener('click', function () { onSelect(it, cat); });
        grid.appendChild(tile);
      });
    });
    container.appendChild(grid);
  }

  function progressBar(container, totalQty, targetQty) {
    var pct = Math.max(0, Math.min(100, Math.round((totalQty / targetQty) * 100)));
    var wrap = document.createElement('div');
    var track = document.createElement('div');
    track.className = 'progress-track';
    var fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = pct + '%';
    track.appendChild(fill);
    var label = document.createElement('div');
    label.className = 'progress-label';
    label.textContent = t('web_lot_progress_label', { totalQty: totalQty, targetQty: targetQty }) + ' (' + pct + '%)';
    wrap.appendChild(track);
    wrap.appendChild(label);
    container.appendChild(wrap);
  }

  // Hand-rolled inline SVG line chart - no charting library, keeps the app
  // dependency-free like the rest of this prototype.
  function lineChart(container, points) {
    var w = 640, h = 220, padL = 46, padR = 12, padT = 14, padB = 28;
    var prices = points.map(function (p) { return p.price; });
    var min = Math.min.apply(null, prices);
    var max = Math.max.apply(null, prices);
    var range = Math.max(1, max - min);
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

    function xAt(i) { return padL + stepX * i; }
    function yAt(price) { return padT + innerH - ((price - min) / range) * innerH; }

    var pathD = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(p.price).toFixed(1);
    }).join(' ');

    var gridLines = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH / 4) * g;
      gridLines += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) + '" stroke="var(--border)" stroke-width="1"/>';
    }

    var dots = points.map(function (p, i) {
      return '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.price).toFixed(1) + '" r="2.5" fill="var(--accent-dark)"></circle>';
    }).join('');

    var xLabels = '';
    [0, Math.floor(points.length / 2), points.length - 1].forEach(function (i) {
      xLabels += '<text x="' + xAt(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="11" fill="var(--text-muted)" text-anchor="middle">' + esc(points[i].date) + '</text>';
    });

    var yLabels = '<text x="4" y="' + (yAt(max) + 4) + '" font-size="11" fill="var(--text-muted)">' + max + '</text>' +
      '<text x="4" y="' + (yAt(min) + 4) + '" font-size="11" fill="var(--text-muted)">' + min + '</text>';

    container.innerHTML = '<div class="chart-wrap"><svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="220">' +
      gridLines + yLabels + xLabels +
      '<path d="' + pathD + '" fill="none" stroke="var(--accent)" stroke-width="2.5"/>' +
      dots +
      '</svg></div>';
  }

  // ==========================================================================
  // HOME
  // ==========================================================================
  function renderHome() {
    var el = $('view-home');
    el.innerHTML =
      '<h2 class="section-heading">' + t('web_nav_home') + '</h2>' +
      '<div class="card" id="homeIntroCard"></div>' +
      '<h3 class="section-heading">' + t('todays_prices_title') + '</h3>' +
      '<div class="card-grid" id="homePricesGrid"></div>' +
      '<h3 class="section-heading">' + t('price_graph_title').split(' - ')[0] + '</h3>' +
      '<div class="card" id="homeChartCard">' +
      '  <select id="homeChartItemSelect"></select>' +
      '  <div id="homeChartContainer"></div>' +
      '</div>' +
      '<h3 class="section-heading">' + t('compare_markets_title').split(' - ')[0] + '</h3>' +
      '<div class="card" id="homeCompareCard">' +
      '  <select id="homeCompareItemSelect"></select>' +
      '  <div id="homeCompareResult"></div>' +
      '</div>';

    var introCard = $('homeIntroCard');
    if (state.role === 'farmer') {
      introCard.innerHTML = '<strong>' + esc(t('web_continue_farmer')) + '</strong><br/><button class="btn" id="homeCtaSell">' + esc(t('web_sell_heading')) + '</button>';
      $('homeCtaSell').addEventListener('click', function () { switchView('sell'); });
    } else {
      introCard.innerHTML = '<strong>' + esc(t('web_continue_buyer')) + '</strong><br/><button class="btn" id="homeCtaBuy">' + esc(t('main_buy')) + '</button>';
      $('homeCtaBuy').addEventListener('click', function () { switchView('buy'); });
    }

    api('/market/prices?lang=' + state.lang).then(function (rows) {
      var grid = $('homePricesGrid');
      grid.innerHTML = '';
      rows.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'price-card';
        card.innerHTML = '<div class="price-item">' + (ITEM_EMOJI[r.item] || '') + ' ' + esc(r.label) + '</div><div class="price-value">Rs.' + r.price + '/kg</div>';
        grid.appendChild(card);
      });
    });

    api('/categories?lang=' + state.lang).then(function (cats) {
      var pricedItems = [];
      cats.forEach(function (c) { c.items.forEach(function (it) { if (it.hasPrice) pricedItems.push(it); }); });

      function fillSelect(sel) {
        sel.innerHTML = '';
        pricedItems.forEach(function (it) {
          var opt = document.createElement('option');
          opt.value = it.id;
          opt.textContent = it.label;
          sel.appendChild(opt);
        });
      }

      var chartSel = $('homeChartItemSelect');
      fillSelect(chartSel);
      function loadChart() {
        api('/market/history?item=' + chartSel.value).then(function (hist) {
          lineChart($('homeChartContainer'), hist);
        });
      }
      chartSel.addEventListener('change', loadChart);
      loadChart();

      var compareSel = $('homeCompareItemSelect');
      fillSelect(compareSel);
      function loadCompare() {
        api('/market/compare?item=' + compareSel.value).then(function (rows) {
          var html = '<table class="data-table"><tr><th>Market</th><th>Price (Rs./kg)</th></tr>';
          rows.forEach(function (r) { html += '<tr><td>' + esc(r.market) + '</td><td>Rs.' + r.price + '</td></tr>'; });
          html += '</table>';
          $('homeCompareResult').innerHTML = html;
        });
      }
      compareSel.addEventListener('change', loadCompare);
      loadCompare();
    });
  }
  VIEW_RENDERERS.home = renderHome;

  // ==========================================================================
  // SELL
  // ==========================================================================
  var sellState = { item: null, category: null };

  function renderSell() {
    var el = $('view-sell');
    el.innerHTML =
      '<h2 class="section-heading">' + t('web_sell_heading') + '</h2>' +
      '<div>' + t('web_sell_step_item') + '</div>' +
      '<div id="sellItemPicker"></div>' +
      '<div id="sellFormWrap"></div>' +
      '<div id="sellLotWrap"></div>';

    api('/categories?lang=' + state.lang).then(function (cats) {
      itemPicker($('sellItemPicker'), cats, sellState.item, function (it, cat) {
        sellState.item = it.id;
        sellState.category = cat.id;
        renderSell();
      });
      if (sellState.item) {
        renderSellForm(sellState.item);
        renderSellLot(sellState.item);
      }
    });
  }
  VIEW_RENDERERS.sell = renderSell;

  function renderSellForm(item) {
    var wrap = $('sellFormWrap');
    wrap.innerHTML =
      '<h3 class="section-heading">' + t('web_sell_step_details') + '</h3>' +
      '<div class="card">' +
      '  <div class="form-row"><label>' + t('web_sell_qty_label') + '</label><input type="number" id="sellQty" min="1"/></div>' +
      '  <div class="form-row"><label>' + t('web_sell_grade_label') + '</label>' +
      '    <div class="radio-group">' +
      '      <label><input type="radio" name="sellGrade" value="A"/> ' + t('grade_a_option') + '</label>' +
      '      <label><input type="radio" name="sellGrade" value="B" checked/> ' + t('grade_b_option') + '</label>' +
      '      <label><input type="radio" name="sellGrade" value="C"/> ' + t('grade_c_option') + '</label>' +
      '    </div>' +
      '  </div>' +
      '  <div class="form-row"><label>' + t('web_sell_price_label') + '</label>' +
      '    <div class="radio-group">' +
      '      <label><input type="radio" name="sellPriceMode" value="market" checked/> <span id="sellMarketPriceLabel"></span></label>' +
      '      <label><input type="radio" name="sellPriceMode" value="custom"/> ' + t('web_sell_price_custom_option') + '</label>' +
      '    </div>' +
      '    <input type="number" id="sellCustomPrice" placeholder="Rs./kg" disabled style="margin-top:8px;"/>' +
      '  </div>' +
      '  <div class="form-row"><label>' + t('web_sell_availability_label') + '</label>' +
      '    <div class="radio-group">' +
      '      <label><input type="radio" name="sellAvail" value="now" checked/> ' + t('list_avail_now') + '</label>' +
      '      <label><input type="radio" name="sellAvail" value="3days"/> ' + t('list_avail_3days') + '</label>' +
      '      <label><input type="radio" name="sellAvail" value="week"/> ' + t('list_avail_week') + '</label>' +
      '    </div>' +
      '  </div>' +
      '  <button class="btn" id="sellSubmitBtn">' + t('web_sell_submit') + '</button>' +
      '  <div id="sellResultMsg" style="margin-top:10px;"></div>' +
      '</div>';

    api('/market/prices?lang=' + state.lang).then(function (rows) {
      var row = rows.find(function (r) { return r.item === item; });
      $('sellMarketPriceLabel').textContent = t('web_sell_price_market_option') + (row ? ' (Rs.' + row.price + '/kg)' : '');
    });

    var customPriceInput = $('sellCustomPrice');
    Array.prototype.forEach.call(document.getElementsByName('sellPriceMode'), function (radio) {
      radio.addEventListener('change', function () {
        customPriceInput.disabled = radio.value !== 'custom' || !radio.checked;
      });
    });

    $('sellSubmitBtn').addEventListener('click', function () {
      var qty = Number($('sellQty').value);
      var grade = document.querySelector('input[name=sellGrade]:checked').value;
      var priceMode = document.querySelector('input[name=sellPriceMode]:checked').value;
      var availability = document.querySelector('input[name=sellAvail]:checked').value;
      if (!qty || qty <= 0) { $('sellResultMsg').textContent = t('invalid_option'); return; }

      var pricePromise;
      if (priceMode === 'market') {
        pricePromise = api('/market/prices?lang=' + state.lang).then(function (rows) {
          var row = rows.find(function (r) { return r.item === item; });
          return row ? row.price : 0;
        });
      } else {
        pricePromise = Promise.resolve(Number($('sellCustomPrice').value) || 0);
      }

      pricePromise.then(function (price) {
        return api('/listings', 'POST', withPhone({ item: item, qty: qty, grade: grade, price: price, availability: availability }));
      }).then(function (listing) {
        var confirmLine = t('list_confirm', {
          id: listing.id, item: t('item_' + listing.item), qty: listing.qty,
          price: listing.price, availability: t('list_avail_' + listing.availability),
        }).split('\n').join(' ');
        $('sellResultMsg').innerHTML = '<strong>' + t('web_sell_success') + '</strong><br/>' + esc(confirmLine);
        $('sellQty').value = '';
      });
    });
  }

  function renderSellLot(item) {
    var wrap = $('sellLotWrap');
    wrap.innerHTML = '<h3 class="section-heading">' + t('web_lot_heading') + '</h3><div class="card" id="sellLotCard"></div>';
    api('/lots?item=' + item).then(function (lot) {
      var card = $('sellLotCard');
      card.innerHTML =
        '<p>' + t('web_lot_explain') + '</p>' +
        '<div><strong>' + t('grade_select_title') + ':</strong> ' + t('grade_' + lot.grade.toLowerCase() + '_option') + '</div>' +
        '<div id="lotProgressWrap"></div>' +
        '<div class="form-row"><label>' + t('web_lot_join_qty_label') + '</label><input type="number" id="lotJoinQty" min="1"/></div>' +
        '<button class="btn btn-outline" id="lotJoinBtn">' + t('web_lot_join_button') + '</button>';
      progressBar($('lotProgressWrap'), lot.totalQty, lot.targetQty);
      $('lotJoinBtn').addEventListener('click', function () {
        var qty = Number($('lotJoinQty').value);
        if (!qty || qty <= 0) return;
        api('/lots/join', 'POST', withPhone({ item: item, qty: qty })).then(function () {
          renderSellLot(item);
        });
      });
    });
  }

  // ==========================================================================
  // BUY
  // ==========================================================================
  var buyState = { item: null, category: null, filters: {} };

  function renderBuy() {
    var el = $('view-buy');
    el.innerHTML =
      '<h2 class="section-heading">' + t('main_buy') + '</h2>' +
      '<div id="buyItemPicker"></div>' +
      '<div id="buyBody"></div>';

    api('/categories?lang=' + state.lang).then(function (cats) {
      itemPicker($('buyItemPicker'), cats, buyState.item, function (it, cat) {
        buyState.item = it.id;
        buyState.category = cat.id;
        buyState.filters = {};
        renderBuy();
      });
      if (buyState.item) renderBuyBody(buyState.item);
    });
  }
  VIEW_RENDERERS.buy = renderBuy;

  function renderBuyBody(item) {
    var body = $('buyBody');
    body.innerHTML =
      '<div class="card">' +
      '  <h3 class="section-heading" style="margin-top:0;">' + t('web_filter_heading') + '</h3>' +
      '  <div class="form-row"><label>' + t('web_filter_price_range') + '</label>' +
      '    <div style="display:flex; gap:8px;"><input type="number" id="filterPriceMin" placeholder="Min"/><input type="number" id="filterPriceMax" placeholder="Max"/></div></div>' +
      '  <div class="form-row"><label>' + t('web_filter_grade') + '</label>' +
      '    <select id="filterGrade"><option value="">' + t('web_filter_any') + '</option><option value="A">' + t('grade_a_option') + '</option><option value="B">' + t('grade_b_option') + '</option><option value="C">' + t('grade_c_option') + '</option></select></div>' +
      '  <div class="form-row"><label>' + t('web_filter_availability') + '</label>' +
      '    <select id="filterAvail"><option value="">' + t('web_filter_any') + '</option><option value="now">' + t('list_avail_now') + '</option><option value="3days">' + t('list_avail_3days') + '</option><option value="week">' + t('list_avail_week') + '</option></select></div>' +
      '  <div class="form-row"><label><input type="checkbox" id="filterFpoOnly"/> ' + t('web_filter_fpo_only') + '</label></div>' +
      '  <div class="form-row"><label><input type="checkbox" id="filterVerifiedOnly"/> ' + t('web_filter_verified_only') + '</label></div>' +
      '  <div class="form-row"><label>' + t('filter_title') + '</label>' +
      '    <select id="filterSort"><option value="">' + t('web_filter_any') + '</option><option value="price_asc">' + t('filter_lowest_price') + '</option><option value="nearest">' + t('filter_nearest') + '</option></select></div>' +
      '  <button class="btn" id="filterApplyBtn">' + t('web_filter_apply') + '</button>' +
      '  <button class="btn btn-outline" id="filterClearBtn">' + t('web_filter_clear') + '</button>' +
      '</div>' +
      '<div id="buyResultsWrap"></div>' +
      '<h3 class="section-heading">' + t('buy_bulk_sourcing') + '</h3>' +
      '<div class="card">' +
      '  <div class="form-row"><label>' + t('bulk_qty_prompt') + '</label><input type="number" id="bulkQty" min="1"/></div>' +
      '  <button class="btn btn-outline" id="bulkSubmitBtn">' + t('buy_bulk_sourcing') + '</button>' +
      '  <div id="bulkResultMsg" style="margin-top:8px;"></div>' +
      '</div>';

    $('filterApplyBtn').addEventListener('click', function () {
      buyState.filters = {
        priceMin: $('filterPriceMin').value, priceMax: $('filterPriceMax').value,
        grade: $('filterGrade').value, availability: $('filterAvail').value,
        fpoOnly: $('filterFpoOnly').checked, verifiedOnly: $('filterVerifiedOnly').checked,
        sort: $('filterSort').value,
      };
      loadBuyResults(item);
    });
    $('filterClearBtn').addEventListener('click', function () { buyState.filters = {}; renderBuyBody(item); });
    $('bulkSubmitBtn').addEventListener('click', function () {
      var qty = Number($('bulkQty').value);
      if (!qty) return;
      api('/bulk-sourcing', 'POST', withPhone({ item: item, qty: qty })).then(function (result) {
        $('bulkResultMsg').textContent = result.matched
          ? t('bulk_matched', { qty: result.pooledQty, item: t('item_' + item) })
          : t('bulk_open', { qty: qty, item: t('item_' + item) });
      });
    });

    loadBuyResults(item);
  }

  function loadBuyResults(item) {
    var f = buyState.filters || {};
    api('/listings' + qs({
      item: item, priceMin: f.priceMin, priceMax: f.priceMax, grade: f.grade,
      availability: f.availability, fpoOnly: f.fpoOnly, verifiedOnly: f.verifiedOnly, sort: f.sort,
    })).then(function (listings) {
      var wrap = $('buyResultsWrap');
      if (!listings.length) {
        wrap.innerHTML = '<div class="empty-state">' + t('no_listings') + '</div>';
        return;
      }
      wrap.innerHTML = '';
      listings.forEach(function (l) {
        var card = document.createElement('div');
        card.className = 'card';
        card.innerHTML =
          '<strong>' + esc(l.farmerLabel) + '</strong>, ' + esc(l.location) +
          (l.fpo ? ' <span class="badge badge-fpo">' + t('web_fpo_badge') + '</span>' : '') +
          (l.sellerVerified ? ' <span class="badge badge-verified">' + t('web_seller_verified_badge') + '</span>' : '') +
          '<br/>' + l.qty + 'kg @ Rs.' + l.price + '/kg &middot; ' + t('grade_' + l.grade.toLowerCase() + '_option') + ' &middot; ' + t('list_avail_' + l.availability) +
          '<div style="margin-top:10px;"><button class="btn btn-small" data-accept="' + l.id + '">' + t('web_accept_price_button') + '</button> ' +
          '<button class="btn btn-outline btn-small" data-offer="' + l.id + '">' + t('web_make_offer_button') + '</button></div>' +
          '<div class="offer-form hidden" id="offerForm-' + l.id + '" style="margin-top:8px;">' +
          '<input type="number" placeholder="Rs./kg" id="offerAmount-' + l.id + '"/> ' +
          '<button class="btn btn-small" data-submit-offer="' + l.id + '">' + t('web_offer_submit') + '</button></div>' +
          '<div id="offerMsg-' + l.id + '" style="margin-top:6px; font-size:13px;"></div>';
        wrap.appendChild(card);
      });

      wrap.querySelectorAll('[data-accept]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-accept');
          api('/offers', 'POST', withPhone({ listingId: id })).then(function () {
            $('offerMsg-' + id).textContent = t('offer_placed');
          });
        });
      });
      wrap.querySelectorAll('[data-offer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-offer');
          $('offerForm-' + id).classList.toggle('hidden');
        });
      });
      wrap.querySelectorAll('[data-submit-offer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-submit-offer');
          var amount = Number($('offerAmount-' + id).value);
          if (!amount) return;
          api('/offers', 'POST', withPhone({ listingId: id, amount: amount })).then(function () {
            $('offerMsg-' + id).textContent = t('offer_placed');
          });
        });
      });
    });
  }

  // ==========================================================================
  // MY LISTINGS
  // ==========================================================================
  function renderMyListings() {
    var el = $('view-my-listings');
    el.innerHTML = '<h2 class="section-heading">' + t('web_my_listings_heading') + '</h2><div id="myListingsWrap"></div>';
    api('/listings/mine' + qs({ phone: state.phone })).then(function (listings) {
      var wrap = $('myListingsWrap');
      if (!listings.length) { wrap.innerHTML = '<div class="empty-state">' + t('my_listings_empty') + '</div>'; return; }
      wrap.innerHTML = '';
      listings.forEach(function (l) {
        var card = document.createElement('div');
        card.className = 'card';
        card.innerHTML =
          '<strong>' + t('item_' + l.item) + '</strong> &mdash; ' + l.qty + 'kg @ Rs.' + l.price + '/kg ' +
          '<span class="' + statusBadgeClass(l.status) + '">' + t('status_' + l.status) + '</span>' +
          (l.fpo ? ' <span class="badge badge-fpo">' + t('web_fpo_badge') + '</span>' : '') +
          '<div style="margin-top:8px;">' +
          (l.status !== 'sold' ? '<button class="btn btn-danger btn-small" data-cancel="' + l.id + '">' + t('my_listing_cancel') + '</button> ' : '') +
          '</div><div id="offersWrap-' + l.id + '"></div>';
        wrap.appendChild(card);
        renderOffersForListing(l.id, $('offersWrap-' + l.id));
      });
      wrap.querySelectorAll('[data-cancel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          api('/listings/' + btn.getAttribute('data-cancel') + '/cancel', 'POST', withPhone({})).then(renderMyListings);
        });
      });
    });
  }
  VIEW_RENDERERS['my-listings'] = renderMyListings;

  function renderOffersForListing(listingId, container) {
    api('/listings/' + listingId + '/offers').then(function (offers) {
      var actionable = offers.filter(function (o) { return o.status === 'pending' || o.status === 'countered'; });
      if (!actionable.length) { container.innerHTML = ''; return; }
      var html = '<table class="data-table"><tr><th>Offer</th><th>' + t('web_table_status') + '</th><th>' + t('web_table_actions') + '</th></tr>';
      actionable.forEach(function (o) {
        html += '<tr><td>Rs.' + o.amount + '/kg</td><td><span class="' + statusBadgeClass(o.status) + '">' + t('status_' + o.status) + '</span></td>' +
          '<td><button class="btn btn-small" data-accept-offer="' + o.id + '" data-listing="' + listingId + '">' + t('offer_accept') + '</button> ' +
          '<button class="btn btn-outline btn-small" data-reject-offer="' + o.id + '" data-listing="' + listingId + '">' + t('offer_reject') + '</button></td></tr>';
      });
      html += '</table>';
      container.innerHTML = html;
      container.querySelectorAll('[data-accept-offer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          api('/offers/' + btn.getAttribute('data-listing') + '/' + btn.getAttribute('data-accept-offer') + '/accept', 'POST', {}).then(renderMyListings);
        });
      });
      container.querySelectorAll('[data-reject-offer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          api('/offers/' + btn.getAttribute('data-listing') + '/' + btn.getAttribute('data-reject-offer') + '/reject', 'POST', {}).then(renderMyListings);
        });
      });
    });
  }

  // ==========================================================================
  // MY ORDERS
  // ==========================================================================
  function renderMyOrders() {
    var el = $('view-my-orders');
    el.innerHTML = '<h2 class="section-heading">' + t('web_my_orders_heading') + '</h2><div id="myOrdersWrap"></div>';
    api('/orders/mine' + qs({ phone: state.phone })).then(function (rows) {
      var wrap = $('myOrdersWrap');
      if (!rows.length) { wrap.innerHTML = '<div class="empty-state">' + t('my_orders_empty') + '</div>'; return; }
      wrap.innerHTML = '';
      rows.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'card';
        var head = '<strong>' + t('item_' + r.item) + '</strong> &mdash; ' + r.qty + 'kg @ Rs.' + r.price + '/kg ' +
          '<span class="' + statusBadgeClass(r.status) + '">' + t('status_' + r.status) + '</span>';
        card.innerHTML = head + '<div id="orderDetail-' + (r.id) + '"></div>';
        wrap.appendChild(card);
        if (r.type === 'order') {
          renderOrderHub(r.id, $('orderDetail-' + r.id));
        } else if (r.type === 'received_offer') {
          renderReceivedOfferControls(r, $('orderDetail-' + r.id));
        } else {
          $('orderDetail-' + r.id).innerHTML = '<div class="empty-state">' + t('sent_offer_waiting') + '</div>';
        }
      });
    });
  }
  VIEW_RENDERERS['my-orders'] = renderMyOrders;

  function renderReceivedOfferControls(row, container) {
    container.innerHTML =
      '<div style="margin-top:8px;"><button class="btn btn-small" id="acceptRecv">' + t('offer_accept') + '</button> ' +
      '<button class="btn btn-outline btn-small" id="rejectRecv">' + t('offer_reject') + '</button></div>';
    $('acceptRecv').addEventListener('click', function () {
      api('/offers/' + row.listingId + '/' + row.id + '/accept', 'POST', {}).then(renderMyOrders);
    });
    $('rejectRecv').addEventListener('click', function () {
      api('/offers/' + row.listingId + '/' + row.id + '/reject', 'POST', {}).then(renderMyOrders);
    });
  }

  function renderOrderHub(orderId, container) {
    api('/orders/' + orderId).then(function (order) {
      container.innerHTML =
        '<div class="form-row"><label>' + t('web_order_delivery_label') + '</label>' +
        '<select id="deliverySel-' + orderId + '">' +
        ['preparing', 'ready', 'completed'].map(function (s) { return '<option value="' + s + '"' + (order.deliveryStatus === s ? ' selected' : '') + '>' + t('delivery_' + s) + '</option>'; }).join('') +
        '</select> <button class="btn btn-small" data-update-delivery="' + orderId + '">' + t('order_update_delivery') + '</button></div>' +
        '<div class="form-row"><label>' + t('web_order_payment_label') + '</label>' +
        '<select id="paymentSel-' + orderId + '">' +
        ['pending', 'paid'].map(function (s) { return '<option value="' + s + '"' + (order.paymentStatus === s ? ' selected' : '') + '>' + t('payment_' + s) + '</option>'; }).join('') +
        '</select> <button class="btn btn-small" data-update-payment="' + orderId + '">' + t('order_update_payment') + '</button></div>' +
        '<div class="form-row"><label>' + t('web_order_logistics_label') + '</label>' +
        '<select id="logisticsSel-' + orderId + '">' +
        ['farmer_delivers', 'fpo_collection', 'buyer_pickup'].map(function (s) { return '<option value="' + s + '"' + (order.logistics === s ? ' selected' : '') + '>' + t('logistics_' + s) + '</option>'; }).join('') +
        '</select> <button class="btn btn-small" data-update-logistics="' + orderId + '">' + t('order_set_logistics') + '</button></div>' +
        '<button class="btn btn-outline btn-small" data-file-grievance="' + orderId + '">' + t('order_file_grievance') + '</button>' +
        '<div id="grievanceForm-' + orderId + '" class="hidden" style="margin-top:8px;"></div>';

      container.querySelector('[data-update-delivery]').addEventListener('click', function () {
        api('/orders/' + orderId + '/delivery-status', 'POST', { status: $('deliverySel-' + orderId).value }).then(renderMyOrders);
      });
      container.querySelector('[data-update-payment]').addEventListener('click', function () {
        api('/orders/' + orderId + '/payment-status', 'POST', { status: $('paymentSel-' + orderId).value }).then(renderMyOrders);
      });
      container.querySelector('[data-update-logistics]').addEventListener('click', function () {
        api('/orders/' + orderId + '/logistics', 'POST', { option: $('logisticsSel-' + orderId).value }).then(renderMyOrders);
      });
      container.querySelector('[data-file-grievance]').addEventListener('click', function () {
        var f = $('grievanceForm-' + orderId);
        f.classList.toggle('hidden');
        if (f.innerHTML) return;
        api('/grievance-categories?lang=' + state.lang).then(function (cats) {
          f.innerHTML =
            '<div class="form-row"><label>' + t('web_grievance_category_label') + '</label><select id="grievCat-' + orderId + '">' +
            cats.map(function (c) { return '<option value="' + c.code + '">' + esc(c.label) + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-row"><label>' + t('web_grievance_detail_label') + '</label><textarea id="grievDetail-' + orderId + '" rows="2"></textarea></div>' +
            '<button class="btn btn-small" id="grievSubmit-' + orderId + '">' + t('web_grievance_submit') + '</button>' +
            '<div id="grievMsg-' + orderId + '" style="margin-top:6px;"></div>';
          $('grievSubmit-' + orderId).addEventListener('click', function () {
            api('/grievances', 'POST', withPhone({
              orderId: orderId, category: $('grievCat-' + orderId).value, detail: $('grievDetail-' + orderId).value,
            })).then(function (g) {
              $('grievMsg-' + orderId).textContent = t('grievance_filed_msg', { id: g.id });
            });
          });
        });
      });
    });
  }

  // ==========================================================================
  // MARKET INFO
  // ==========================================================================
  function renderMarketInfo() {
    var el = $('view-market-info');
    el.innerHTML =
      '<h2 class="section-heading">' + t('web_market_info_heading') + '</h2>' +
      '<h3 class="section-heading">' + t('todays_prices_title') + '</h3><div class="card-grid" id="miPrices"></div>' +
      '<h3 class="section-heading">' + t('weather_title') + '</h3><div class="card" id="miWeather"></div>' +
      '<h3 class="section-heading">' + t('schemes_title') + '</h3><div class="card" id="miSchemes"></div>' +
      '<h3 class="section-heading">' + t('web_logistics_info_heading') + '</h3><div class="card" id="miLogistics"></div>';

    api('/market/prices?lang=' + state.lang).then(function (rows) {
      var grid = $('miPrices');
      grid.innerHTML = '';
      rows.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'price-card';
        card.innerHTML = '<div class="price-item">' + (ITEM_EMOJI[r.item] || '') + ' ' + esc(r.label) + '</div><div class="price-value">Rs.' + r.price + '/kg</div>';
        grid.appendChild(card);
      });
    });
    api('/market/weather?lang=' + state.lang).then(function (data) {
      $('miWeather').textContent = data.text;
    });
    api('/market/schemes?lang=' + state.lang).then(function (rows) {
      $('miSchemes').innerHTML = '<ul>' + rows.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    });
    api('/logistics-options?lang=' + state.lang).then(function (rows) {
      $('miLogistics').innerHTML = '<ul>' + rows.map(function (o) { return '<li>' + esc(o.label) + '</li>'; }).join('') + '</ul>';
    });
  }
  VIEW_RENDERERS['market-info'] = renderMarketInfo;

  // ==========================================================================
  // GRIEVANCES
  // ==========================================================================
  function renderGrievances() {
    var el = $('view-grievances');
    el.innerHTML = '<h2 class="section-heading">' + t('web_my_grievances_heading') + '</h2><div id="grievListWrap"></div>';
    api('/grievances/mine' + qs({ phone: state.phone })).then(function (rows) {
      var wrap = $('grievListWrap');
      if (!rows.length) { wrap.innerHTML = '<div class="empty-state">' + t('my_grievances_empty') + '</div>'; return; }
      var html = '<table class="data-table"><tr><th>Order</th><th>' + t('web_grievance_category_label') + '</th><th>' + t('web_table_status') + '</th></tr>';
      rows.forEach(function (g) {
        html += '<tr><td>' + esc(g.orderId) + '</td><td>' + t('grievance_cat_' + g.category) + '</td>' +
          '<td><span class="badge">' + t('grievance_status_' + g.status.replace('-', '_')) + '</span></td></tr>';
      });
      html += '</table>';
      wrap.innerHTML = html;
    });
  }
  VIEW_RENDERERS.grievances = renderGrievances;

  // ==========================================================================
  // PROFILE
  // ==========================================================================
  function renderProfile() {
    var el = $('view-profile');
    el.innerHTML =
      '<h2 class="section-heading">' + t('profile_title') + '</h2>' +
      '<h3 class="section-heading">' + t('web_fpo_heading') + '</h3><div class="card" id="profileFpoCard"></div>' +
      '<h3 class="section-heading">' + t('web_buyer_verify_heading') + '</h3><div class="card" id="profileBuyerCard"></div>';

    Promise.all([
      api('/profile/farmer' + qs({ phone: state.phone })),
      api('/fpos'),
    ]).then(function (results) {
      var farmerProfile = results[0], fpos = results[1];
      var card = $('profileFpoCard');
      card.innerHTML =
        '<div>' + t('profile_fpo_line', { fpo: farmerProfile.fpo ? farmerProfile.fpo.name : t('fpo_none') }) + '</div>' +
        '<div>' + t('profile_seller_verified_line', { status: t(farmerProfile.verified ? 'verified_yes' : 'verified_no') }) + '</div>' +
        '<div class="form-row" style="margin-top:10px;"><select id="fpoSelect"><option value="">' + t('fpo_leave_option') + '</option>' +
        fpos.map(function (f) { return '<option value="' + f.id + '"' + (farmerProfile.fpoId === f.id ? ' selected' : '') + '>' + esc(f.name) + ' (' + esc(f.location) + ')</option>'; }).join('') +
        '</select> <button class="btn btn-small" id="fpoSaveBtn">' + t('web_fpo_join_button') + '</button></div>' +
        '<button class="btn btn-outline btn-small" id="toggleVerifiedBtn">' + t('profile_toggle_seller_verified_option') + '</button>';
      $('fpoSaveBtn').addEventListener('click', function () {
        api('/profile/farmer/fpo', 'POST', withPhone({ fpoId: $('fpoSelect').value || null })).then(renderProfile);
      });
      $('toggleVerifiedBtn').addEventListener('click', function () {
        api('/profile/farmer/toggle-verified', 'POST', withPhone({})).then(renderProfile);
      });
    });

    api('/profile/buyer' + qs({ phone: state.phone })).then(function (buyerProfile) {
      var card = $('profileBuyerCard');
      card.innerHTML =
        '<div>' + t('profile_verify_line', { status: t(buyerProfile.verified ? 'verified_yes' : 'verified_no') }) + '</div>' +
        '<div class="form-row" style="margin-top:10px;"><label>' + t('web_business_name_label') + '</label><input type="text" id="bizName" value="' + esc(buyerProfile.businessName || '') + '"/></div>' +
        '<div class="form-row"><label>' + t('web_business_type_label') + '</label><select id="bizType">' +
        ['trader', 'retailer', 'exporter', 'processor'].map(function (bt) {
          return '<option value="' + bt + '"' + (buyerProfile.businessType === bt ? ' selected' : '') + '>' + t('business_type_' + bt) + '</option>';
        }).join('') + '</select></div>' +
        '<button class="btn btn-small" id="bizSubmit">' + t('web_verify_submit') + '</button>';
      $('bizSubmit').addEventListener('click', function () {
        api('/profile/buyer/verify', 'POST', withPhone({ businessType: $('bizType').value, businessName: $('bizName').value })).then(renderProfile);
      });
    });
  }
  VIEW_RENDERERS.profile = renderProfile;

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================
  function renderNotifications() {
    var el = $('view-notifications');
    el.innerHTML = '<h2 class="section-heading">' + t('web_notifications_heading') + '</h2><div id="notifWrap"></div>';
    api('/notifications' + qs({ phone: state.phone, lang: state.lang })).then(function (rows) {
      var wrap = $('notifWrap');
      if (!rows.length) { wrap.innerHTML = '<div class="empty-state">' + t('web_notifications_empty') + '</div>'; return; }
      wrap.innerHTML = rows.map(function (n) { return '<div class="notif-item">' + esc(n.text) + '</div>'; }).join('');
    });
  }
  VIEW_RENDERERS.notifications = renderNotifications;

  // ==========================================================================
  // Boot
  // ==========================================================================
  $('btnContinueFarmer').addEventListener('click', function () { startSession('farmer'); });
  $('btnContinueBuyer').addEventListener('click', function () { startSession('buyer'); });
  $('btnSwitchRole').addEventListener('click', function () {
    localStorage.removeItem('vegmeet_phone');
    state.phone = null;
    $('app-shell').classList.add('hidden');
    $('view-landing').classList.remove('hidden');
    renderLanding();
  });

  loadBundles(state.lang).then(function () {
    if (state.phone) {
      // Verify the saved session still exists (server may have restarted).
      api('/profile/farmer' + qs({ phone: state.phone })).then(function () {
        showApp();
      }).catch(function () {
        localStorage.removeItem('vegmeet_phone');
        state.phone = null;
        renderLanding();
      });
    } else {
      renderLanding();
    }
  });
})();
