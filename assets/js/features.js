/* ==========================================================================
   AutoR — доработки: общий каркас
   window.AutoRApp     — состояние и функции приложения (крючки в features/patches.py)
   window.AutoRBilling — тариф, пробный доступ и подписки (billing.js), только чтение
   Каждая доработка регистрирует обработчик страницы: F.on('dashboard', fn).
   Страница отрисовалась → приложение шлёт событие autor:render → обработчики дорисовывают свои блоки.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.AutoRApp;
  if (!A) return;
  var F = window.AutoRFeatures = window.AutoRFeatures || {};

  F.A = A;
  F.esc = A.esc;
  F.icon = function (id) { return A.iconSprite(id); };
  F.$ = function (sel, root) { return (root || document).querySelector(sel); };
  F.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  F.billing = function () { return window.AutoRBilling || null; };
  F.plan = function () { var b = F.billing(); return b ? b.plan() : 'max'; };
  F.isSample = function () { return !!(A.state && A.state.sample); };
  F.num = function (n) { return A.formatNumber(n); };
  F.pct = function (x) { return (Math.round(x * 10) / 10).toLocaleString('ru-RU') + '%'; };

  // Личные настройки вида (что свёрнуто, какая вкладка) — только в этом браузере
  F.pref = function (key, value) {
    try {
      if (arguments.length > 1) { localStorage.setItem('autor.ui.' + key, JSON.stringify(value)); return value; }
      return JSON.parse(localStorage.getItem('autor.ui.' + key));
    } catch (e) { return null; }
  };

  // Поля, которых нет в старых сохранённых кабинетах
  F.ensure = function () {
    var s = A.state;
    if (!s) return;
    ['week', 'month', 'activity'].forEach(function (k) {
      if (s[k] && Array.isArray(s[k].messages) && !Array.isArray(s[k].orders)) s[k].orders = s[k].messages.map(function () { return 0; });
    });
    if (!s.crm || typeof s.crm !== 'object') s.crm = {};
    if (typeof s.crm.threshold !== 'number') s.crm.threshold = 3;
    if (!Array.isArray(s.crm.history)) s.crm.history = [];
    if (s.settings && !s.settings.botMode) s.settings.botMode = 'ai';
    if (!s.ai || typeof s.ai !== 'object') s.ai = { month: '', used: 0 };
  };

  // Отрисовка страниц
  var handlers = {};
  F.on = function (page, fn) { (handlers[page] = handlers[page] || []).push(fn); };
  F.lastPage = null;
  function run(page) {
    F.ensure();
    (handlers[page] || []).concat(handlers['*'] || []).forEach(function (fn) {
      try { fn(page); } catch (e) { if (window.console) console.error('AutoR:', e); }
    });
    F.lastPage = page;
  }
  document.addEventListener('autor:render', function (e) { run(e.detail.page); });
  F.start = function () { run(A.ui.page); };
  // Выполнить действие, когда откроется страница (переход по hash происходит не сразу)
  F.after = function (page, fn) {
    var h = function (e) {
      if (e.detail.page !== page) return;
      document.removeEventListener('autor:render', h);
      setTimeout(fn, 0);
    };
    document.addEventListener('autor:render', h);
  };

  // Вставить HTML-блок один раз (повторная отрисовка заменяет старый)
  F.mount = function (key, html, where, anchor) {
    var old = F.$('[data-ar-block="' + key + '"]');
    if (old) old.remove();
    if (!anchor) return null;
    anchor.insertAdjacentHTML(where, html);
    return F.$('[data-ar-block="' + key + '"]');
  };

  F.save = function () { A.saveState(); };
})();

/* ==========================================================================
   AutoR — «Ваш путь»: 7 шагов от первого входа до подписки.
   На главной: кольцо прогресса, большая карточка текущего шага и карта пути.
   В боковом меню: короткий прогресс. Шаги отмечаются сами.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;
  var KEY = 'autor.journey';

  function flags() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function mark(name) {
    var f = flags();
    if (f[name]) return;
    f[name] = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(f)); } catch (e) {}
    refresh();
  }
  F.journeyMark = mark;

  // Свои товары: в режиме примера кабинет пользователя отложен в отдельный ключ (sample.js)
  function ownProducts() {
    if (!F.isSample()) return (A.state.products || []).length;
    try {
      var own = JSON.parse(localStorage.getItem('autor.demo.state.v' + window.AUTOR_SEED.version + '.own') || 'null');
      return own && own.products ? own.products.length : 0;
    } catch (e) { return 0; }
  }

  function steps() {
    var b = F.billing(), f = flags();
    if (ownProducts() > 0) f.product = 1;
    if (F.isSample()) f.sample = 1;
    return [
      { id: 'reg', icon: 'i-user', tone: 'gold', title: 'Вы зарегистрированы', short: 'Регистрация',
        more: 'Кабинет AutoR создан — можно начинать.', done: true },
      { id: 'demo', icon: 'i-play', tone: 'mint', title: 'Запустите пробный доступ', short: 'Пробный доступ на 30 минут', time: '30 секунд',
        more: 'Все функции VIP на 30 минут — без оплаты и без привязки карты.', done: !!(b && (b.demoStarted() || b.access())) },
      { id: 'product', icon: 'i-box', tone: 'peach', title: 'Добавьте свой товар', short: 'Свой товар', time: '1 минута',
        more: 'Название, цена и остаток — и бот сразу начнёт отвечать по нему: наличие, цена, условия.', done: !!f.product, cta: 'Добавить товар', act: 'product' },
      { id: 'test', icon: 'i-chat', tone: 'lilac', title: 'Проверьте бота', short: 'Проверка бота', time: '30 секунд',
        more: 'Напишите вопрос так, как написал бы покупатель, — ответ придёт за пару секунд.', done: !!f.test, cta: 'Проверить бота', act: 'test' },
      { id: 'sample', icon: 'i-eye', tone: 'rose', title: 'Посмотрите пример магазина', short: 'Пример магазина', time: '1 минута',
        more: 'Так выглядит кабинет, когда идут заказы: сотни сообщений, графики, конверсия. Ваш кабинет сохранится.', done: !!f.sample, cta: 'Открыть пример', act: 'sample' },
      { id: 'access', icon: 'i-zap-circle', tone: 'gold', title: 'Купите доступ', short: 'Доступ навсегда', time: 'пара минут в Telegram',
        more: '999 ₽ один раз — и тариф MAXIMUM на 30 дней в подарок. Оплата у менеджера, код приходит в чат.', done: !!(b && b.access()), cta: 'Купить доступ', act: 'buy' },
      { id: 'sub', icon: 'i-star', tone: 'ink', title: 'Выберите подписку', short: 'Подписка', time: '1 минута',
        more: 'Когда подарок закончится: VIP за 299 ₽ или MAXIMUM за 799 ₽ в месяц, без автосписаний.', done: !!(b && b.subscribed()), cta: 'Смотреть тарифы', act: 'tariffs' },
    ];
  }

  function action(s, cls, label) {
    if (!s.act) return '';
    if (s.act === 'buy') {
      var tg = (F.billing() || {}).tg || '#';
      return '<a class="' + cls + '" href="' + F.esc(tg) + '" target="_blank" rel="noopener">' + label + '</a>';
    }
    return '<button class="' + cls + '" type="button" data-ar-journey="' + s.act + '">' + label + '</button>';
  }

  var ringN = 0;
  function ring(done, total, size) {
    var r = size / 2 - 5, c = 2 * Math.PI * r, id = 'arRing' + (++ringN);
    return '<span class="ar-ring" style="width:' + size + 'px;height:' + size + 'px" role="img" aria-label="Пройдено ' + done + ' из ' + total + '">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD34D"/><stop offset="1" stop-color="#F07B3F"/></linearGradient></defs>' +
      '<circle class="ar-ring__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"/>' +
      '<circle class="ar-ring__bar" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="url(#' + id + ')" stroke-dasharray="' + (c * done / total).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg><b>' + done + '<small>/' + total + '</small></b></span>';
  }

  function plaque() {
    var list = steps(), done = list.filter(function (s) { return s.done; }).length, total = list.length;
    if (done === total && F.pref('journeyHidden')) return '';
    var nextIdx = list.findIndex(function (s) { return !s.done; });
    var next = list[nextIdx];
    var collapsed = !!F.pref('journeyCollapsed') && next;
    var left = total - done;

    var head = '<header class="ar-path__head">' + ring(done, total, 64) +
      '<div class="ar-path__headline"><span class="ar-path__eyebrow">' + F.icon('i-sparkles') + ' Ваш путь к первым продажам</span>' +
        '<h2>' + (next ? (collapsed ? 'Дальше: ' + F.esc(next.title.toLowerCase()) : 'Осталось ' + left + ' ' + A.plural(left, 'шаг', 'шага', 'шагов')) : 'Всё готово — бот работает на вас') + '</h2>' +
        '<p>' + (next ? (collapsed ? F.esc(next.more) : 'Пара минут — и AutoR отвечает покупателям вместо вас') : 'Все 7 шагов пройдены. Плашку можно скрыть.') + '</p></div>' +
      (collapsed ? action(next, 'btn btn-primary ar-path__head-cta', next.cta + ' ' + F.icon('i-arrow-right')) : '') +
      '<button class="ar-path__toggle" type="button" data-ar-journey="' + (next ? 'collapse' : 'hide') + '" aria-expanded="' + !collapsed + '" aria-label="' +
        (next ? (collapsed ? 'Развернуть путь' : 'Свернуть путь') : 'Скрыть') + '">' + F.icon(next ? 'i-chevron-down' : 'i-close') + '</button>' +
    '</header>';
    if (!next || collapsed) return '<section class="ar-path' + (collapsed ? ' is-collapsed' : ' is-complete') + '" data-ar-block="journey" aria-label="Ваш путь в AutoR">' + head + '</section>';

    var after = list.slice(nextIdx + 1).find(function (s) { return !s.done; });
    var focus = '<article class="ar-path__focus ar-tone-' + next.tone + '">' +
      '<span class="ar-path__blob" aria-hidden="true"></span>' +
      '<div class="ar-path__focus-top"><span class="ar-path__big-icon">' + F.icon(next.icon) + '</span>' +
        '<span class="ar-path__pill">Шаг ' + (nextIdx + 1) + ' из ' + total + (next.time ? ' · ≈ ' + next.time : '') + '</span></div>' +
      '<h3>' + F.esc(next.title) + '</h3><p>' + F.esc(next.more) + '</p>' +
      '<span class="ar-path__ghost" aria-hidden="true">' + F.icon(next.icon) + '</span>' +
      '<div class="ar-path__go">' + action(next, 'btn btn-primary ar-path__cta', next.cta + ' ' + F.icon('i-arrow-right')) +
        (after ? '<span class="ar-path__after">Потом: <b>' + F.esc(after.short.toLowerCase()) + '</b>' + (after.time ? ' · ≈ ' + after.time : '') + '</span>' : '') +
      '</div>' +
    '</article>';

    var map = '<ol class="ar-path__map">' + list.map(function (s, i) {
      var cls = s.done ? 'is-done' : i === nextIdx ? 'is-now' : '';
      var dot = '<span class="ar-path__dot">' + (s.done ? F.icon('i-check') : i + 1) + '</span>';
      var text = '<span class="ar-path__label"><strong>' + F.esc(s.short) + '</strong><small>' +
        (s.done ? 'Готово' : i === nextIdx ? 'Сейчас' : '≈ ' + s.time) + '</small></span>';
      var mini = '<span class="ar-path__mini ar-tone-' + s.tone + '">' + F.icon(s.icon) + '</span>';
      var inner = dot + text + mini;
      if (!s.done && i !== nextIdx && s.act) return '<li class="' + cls + '">' + action(s, 'ar-path__row', inner) + '</li>';
      return '<li class="' + cls + '"><span class="ar-path__row">' + inner + '</span></li>';
    }).join('') + '</ol>';

    return '<section class="ar-path" data-ar-block="journey" aria-label="Ваш путь в AutoR">' + head +
      '<div class="ar-path__body">' + focus + map + '</div></section>';
  }

  function sideBlock() {
    var list = steps(), done = list.filter(function (s) { return s.done; }).length;
    if (done === list.length) return '';
    var next = list.find(function (s) { return !s.done; });
    return '<a class="ar-side-journey" href="#/dashboard" data-ar-block="side-journey">' + ring(done, list.length, 40) +
      '<span class="ar-side-journey__text"><span class="ar-side-journey__head">Ваш путь</span>' +
      '<span class="ar-side-journey__next">' + F.esc(next.title) + ' ' + F.icon('i-arrow-right') + '</span></span>' +
    '</a>';
  }

  var lastSide = null;
  function renderSide() {
    var html = sideBlock();
    var cmp = html.replace(/arRing\d+/g, '');
    if (cmp === lastSide && (html === '' || F.$('[data-ar-block="side-journey"]'))) return;   // без лишних перерисовок
    lastSide = cmp;
    F.mount('side-journey', html, 'afterbegin', F.$('.sidebar-bottom'));
    document.documentElement.classList.toggle('ar-has-journey', !!html);
  }

  function renderPlaque() {
    var view = F.$('#view');
    if (!view || view.getAttribute('data-page') !== 'dashboard') return;
    F.mount('journey', plaque(), 'afterend', F.$('#view .page > .page-head'));
  }

  function refresh() { renderSide(); renderPlaque(); }
  F.journeyRefresh = refresh;

  F.on('dashboard', renderPlaque);
  F.on('*', renderSide);
  document.addEventListener('autor:billing', refresh);

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-ar-journey]');
    if (!el) return;
    var act = el.getAttribute('data-ar-journey');
    if (act === 'collapse') { F.pref('journeyCollapsed', !F.pref('journeyCollapsed')); renderPlaque(); return; }
    if (act === 'hide') { F.pref('journeyHidden', true); renderPlaque(); return; }
    if (act === 'product') {
      if (F.isSample()) { A.toast('Сейчас открыт пример магазина', 'Вернитесь к своему кабинету — товар добавится в него.', 'info'); return; }
      F.after('catalog', function () { A.openAddProductModal(); });
      A.navigate('catalog');
      return;
    }
    if (act === 'test') { A.openBotTestModal(); return; }
    if (act === 'sample') {
      var s = F.$('[data-sample-load]');
      if (s) { s.click(); return; }
      var t = document.createElement('button');
      t.setAttribute('data-sample-load', ''); t.hidden = true;
      document.body.appendChild(t); t.click(); t.remove();
      return;
    }
    if (act === 'tariffs') { var b = F.billing(); if (b) b.tariffs(); }
  });
})();

/* ==========================================================================
   AutoR — график «Конверсия в заказ по дням» на главной.
   Конверсия дня = заказы из чатов / обращения покупателей. Столбики — заказы, линия — конверсия.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;

  function series(period) {
    var d = (period === 'month' ? A.state.month : A.state.week) || {};
    var msgs = d.messages || [], orders = d.orders || [], labels = d.labels || [];
    return {
      labels: labels, msgs: msgs,
      orders: msgs.map(function (_, i) { return Math.max(0, orders[i] || 0); }),
      conv: msgs.map(function (m, i) { return m > 0 ? Math.min(100, (orders[i] || 0) / m * 100) : null; }),
    };
  }
  function niceMax(v) {
    var steps = [4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100];
    for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i];
    return 100;
  }

  // Рисуется под реальную ширину карточки: шрифты и точки не растягиваются
  function svg(d, W) {
    var H = Math.round(Math.max(180, Math.min(250, W * 0.26)));
    var L = 40, R = 10, T = 18, B = 26, n = d.labels.length;
    var pw = W - L - R, ph = H - T - B, step = pw / Math.max(1, n);
    var vals = d.conv.filter(function (c) { return c != null; });
    var maxC = niceMax(Math.max.apply(null, [4].concat(vals)) * 1.12);
    var maxO = Math.max.apply(null, [1].concat(d.orders));
    var y = function (c) { return T + ph - c / maxC * ph; };
    var x = function (i) { return L + step * (i + 0.5); };
    var every = step < 34 ? Math.ceil(34 / step) : 1;
    var out = '<svg class="ar-conv__svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Конверсия в заказ по дням: в среднем ' +
      F.pct(d.orders.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, d.msgs.reduce(function (a, b) { return a + b; }, 0)) * 100) + '">';
    [0, 0.5, 1].forEach(function (k) {
      var yy = y(maxC * k).toFixed(1);
      out += '<line class="ar-conv__grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>' +
        '<text class="ar-conv__tick" x="' + (L - 8) + '" y="' + (+yy + 4) + '" text-anchor="end">' + (maxC * k) + '%</text>';
    });
    var bw = Math.max(6, Math.min(28, step * 0.42));
    d.orders.forEach(function (o, i) {
      var h = o / maxO * ph * 0.55;
      if (h > 0) out += '<rect class="ar-conv__bar' + (i === n - 1 ? ' is-last' : '') + '" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + (T + ph - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4"/>';
    });
    var pts = [];
    d.conv.forEach(function (c, i) { if (c != null) pts.push([x(i), y(c), i, c]); });
    if (pts.length > 1) out += '<polyline class="ar-conv__line" points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (p, k) {
      var last = k === pts.length - 1;
      out += '<circle class="ar-conv__dot' + (last ? ' is-last' : '') + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (last ? 5 : 3.5) + '"/>';
      if (last) out += '<text class="ar-conv__val" x="' + p[0].toFixed(1) + '" y="' + (p[1] - 10).toFixed(1) + '" text-anchor="' + (p[0] > W - 40 ? 'end' : 'middle') + '">' + F.pct(p[3]) + '</text>';
    });
    d.labels.forEach(function (label, i) {
      if (i % every === 0 || i === n - 1) out += '<text class="ar-conv__xl" x="' + x(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + F.esc(label) + '</text>';
      var c = d.conv[i];
      var tip = label + ': ' + (c == null ? 'обращений не было' : d.orders[i] + ' ' + A.plural(d.orders[i], 'заказ', 'заказа', 'заказов') + ' из ' + d.msgs[i] + ' ' + A.plural(d.msgs[i], 'обращения', 'обращений', 'обращений') + ' — ' + F.pct(c));
      out += '<rect class="ar-conv__hit" x="' + (L + step * i).toFixed(1) + '" y="0" width="' + step.toFixed(1) + '" height="' + (H - B) + '"><title>' + F.esc(tip) + '</title></rect>';
    });
    return out + '</svg>';
  }
  function drawChart() {
    var box = F.$('[data-ar-block="conversion"] .ar-conv__chart');
    if (!box) return;
    var d = series(F.pref('convPeriod') === 'month' ? 'month' : 'week');
    box.innerHTML = svg(d, Math.max(260, Math.floor(box.clientWidth)));
  }

  function card() {
    var period = F.pref('convPeriod') === 'month' ? 'month' : 'week';
    var d = series(period);
    var totalM = d.msgs.reduce(function (a, b) { return a + b; }, 0);
    var totalO = d.orders.reduce(function (a, b) { return a + b; }, 0);
    var head = '<div class="chart-head"><div><h3 class="card-title">Конверсия в заказ по дням</h3>' +
      '<p class="card-sub">Какая доля обращений покупателей закончилась заказом</p></div>' +
      '<div class="segmented" data-ar-conv-period>' +
        '<button type="button" class="' + (period === 'week' ? 'active' : '') + '" data-p="week">7 дней</button>' +
        '<button type="button" class="' + (period === 'month' ? 'active' : '') + '" data-p="month">30 дней</button></div></div>';
    if (!totalM) {
      return '<section class="card ar-conv is-empty" data-ar-block="conversion">' + head +
        '<div class="ar-conv__empty"><span class="ar-conv__empty-icon">' + F.icon('i-trend-up') + '</span>' +
        '<div><strong>График появится, когда покупатели начнут писать</strong>' +
        '<p>Здесь будет видно по дням, сколько обращений превратилось в заказы. Оформить заказ можно прямо в чате — кнопкой «Оформить заказ».</p></div></div></section>';
    }
    var avg = totalO / totalM * 100;
    var last = d.conv.length - 1, today = d.conv[last];
    var best = -1;
    d.conv.forEach(function (c, i) { if (c != null && (best < 0 || c > d.conv[best])) best = i; });
    var diff = today == null ? null : today - avg;
    var diffHtml = diff == null ? '' : '<em class="' + (diff >= 0 ? 'up' : 'down') + '">' + (diff >= 0 ? '+' : '−') +
      (Math.round(Math.abs(diff) * 10) / 10).toLocaleString('ru-RU') + ' п. п. к среднему</em>';
    return '<section class="card ar-conv" data-ar-block="conversion">' + head +
      '<div class="ar-conv__kpis">' +
        '<div><span>Сегодня</span><strong>' + (today == null ? '—' : F.pct(today)) + '</strong>' + diffHtml + '</div>' +
        '<div><span>В среднем за ' + (period === 'month' ? '30 дней' : '7 дней') + '</span><strong>' + F.pct(avg) + '</strong></div>' +
        '<div><span>Заказов из чатов</span><strong>' + F.num(totalO) + '</strong><em>из ' + F.num(totalM) + ' обращений</em></div>' +
        '<div><span>Лучший день</span><strong>' + (best < 0 ? '—' : F.esc(d.labels[best]) + ' · ' + F.pct(d.conv[best])) + '</strong></div>' +
      '</div>' +
      '<div class="ar-conv__chart"></div>' +
      '<div class="ar-conv__legend"><span><i class="is-bar"></i> Заказы из чатов</span><span><i class="is-line"></i> Конверсия, %</span></div>' +
    '</section>';
  }

  function render() {
    var anchor = F.$('#view .kpi-grid') || F.$('#view .ar-start__hero');
    F.mount('conversion', card(), 'afterend', anchor);
    drawChart();
  }
  var resizeTimer = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 150); });
  F.on('dashboard', render);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ar-conv-period] button');
    if (!b) return;
    F.pref('convPeriod', b.getAttribute('data-p'));
    render();
  });

  // Заказ из чата: +1 к сегодняшнему дню (используется в stock.js)
  F.countOrder = function () {
    var s = A.state;
    s.stats.orders = (s.stats.orders || 0) + 1;
    ['week', 'month', 'activity'].forEach(function (k) {
      var o = s[k] && s[k].orders;
      if (Array.isArray(o) && o.length) o[o.length - 1] += 1;
    });
    if (Array.isArray(s.funnel) && s.funnel.length) {
      var f = s.funnel[s.funnel.length - 1], top = s.funnel[0].value || 0;
      f.value += 1;
      f.percent = top ? Math.round(f.value / top * 100) : 0;
    }
  };
})();

/* ==========================================================================
   AutoR — Сценарии: удаление, возврат стандартных, режимы «Шаблоны» и «ИИ».
   При каждом входе на страницу — окно выбора режима; на странице — переключатель.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;
  var BUILTIN = /^r[1-7]$/;

  function mode() { return A.state.settings.botMode === 'ai' ? 'ai' : 'templates'; }
  function setMode(m) {
    A.state.settings.botMode = m;
    F.save();
    A.renderRoute();
    A.toast(m === 'ai' ? 'Отвечает ИИ' : 'Отвечают шаблоны',
      m === 'ai' ? 'Бот понимает вопрос и отвечает своими словами по вашим товарам и профилю.' : 'Бот отвечает по сценариям с триггерами и вашими текстами.', 'success');
  }

  /* ---------- удаление и возврат ---------- */
  function seedRules() { return (window.AUTOR_SEED && window.AUTOR_SEED.rules) || []; }
  function missingBuiltins() {
    return seedRules().filter(function (r) { return !A.getRule(r.id); });
  }
  function askDelete(id) {
    var rule = A.getRule(id);
    if (!rule) return;
    var builtin = BUILTIN.test(rule.id);
    A.openModal(A.modalHeader('Удалить сценарий?', '«' + rule.name + '»') +
      '<div class="modal-body"><p class="ar-modal-text">Бот перестанет отвечать по этому сценарию. ' +
      (builtin ? 'Стандартный сценарий можно вернуть кнопкой «Вернуть стандартные».' : 'Свой сценарий удалится насовсем.') + '</p></div>' +
      '<div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button>' +
      '<button class="btn btn-sm ar-danger-solid" type="button" data-ar-rule-confirm="' + F.esc(rule.id) + '">' + F.icon('i-trash') + ' Удалить</button></div>');
  }
  function doDelete(id) {
    var i = A.state.rules.findIndex(function (r) { return r.id === id; });
    if (i < 0) return;
    var name = A.state.rules[i].name;
    A.state.rules.splice(i, 1);
    F.save();
    A.closeModal();
    A.renderRoute();
    A.updateGlobalBadges();
    A.toast('Сценарий удалён', '«' + name + '» больше не используется ботом.', 'info');
  }
  function restore() {
    var miss = missingBuiltins();
    if (!miss.length) return;
    var order = seedRules().map(function (r) { return r.id; });
    miss.forEach(function (r) { A.state.rules.push(JSON.parse(JSON.stringify(r))); });
    A.state.rules.sort(function (a, b) {
      var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    F.save();
    A.renderRoute();
    A.updateGlobalBadges();
    A.toast('Стандартные сценарии вернулись', miss.length + ' ' + A.plural(miss.length, 'сценарий', 'сценария', 'сценариев') + ' снова в списке.', 'success');
  }

  /* ---------- выбор режима ---------- */
  function chooser() {
    var cur = mode();
    var lim = F.aiLimit ? F.aiLimit() : Infinity;
    function tile(id, icon, title, lead, chips, flag) {
      return '<button class="ar-mode-card' + (cur === id ? ' is-current' : '') + '" type="button" data-ar-mode="' + id + '" aria-pressed="' + (cur === id) + '">' +
        '<span class="ar-mode-card__check" aria-hidden="true">' + F.icon('i-check') + '</span>' +
        (cur === id ? '<span class="ar-mode-card__flag is-now">Сейчас</span>' : flag ? '<span class="ar-mode-card__flag">' + flag + '</span>' : '') +
        '<span class="ar-mode-card__icon">' + F.icon(icon) + '</span>' +
        '<strong>' + title + '</strong>' +
        '<span class="ar-mode-card__lead">' + lead + '</span>' +
        '<span class="ar-mode-card__chips">' + chips.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</span>' +
      '</button>';
    }
    A.openModal(A.modalHeader('Как будет отвечать бот?', 'Выберите режим — его можно сменить в любой момент переключателем вверху страницы.') +
      '<div class="modal-body"><div class="ar-mode-grid">' +
        tile('templates', 'i-bolt', 'Шаблоны', 'Триггеры и ваши тексты — бот отвечает точно по ним', ['Свои триггеры и ответы', 'Точно по вашему тексту']) +
        tile('ai', 'i-sparkles', 'ИИ', 'Сам понимает вопрос и отвечает своими словами', ['Любые формулировки', lim === Infinity ? 'Без лимита' : F.num(lim) + ' ответов в месяц'], 'Новое') +
      '</div><p class="ar-modal-note">' + F.icon('i-info') + ' ИИ отвечает через сервер AutoR: он видит ваш каталог и историю диалога.</p></div>',
      { className: 'ar-mode-modal', onMount: function (modal) { var b = modal.querySelector('.ar-mode-card.is-current') || modal.querySelector('.ar-mode-card'); if (b) setTimeout(function () { b.focus({ preventScroll: true }); }, 60); } });
  }

  /* ---------- страница ---------- */
  function switcher() {
    var m = mode();
    return '<div class="ar-mode-switch" data-ar-block="mode-switch">' +
      '<span class="ar-mode-switch__label">Режим ответа</span>' +
      '<div class="ar-mode-seg" role="group" aria-label="Режим ответа бота">' +
        '<button type="button" class="' + (m === 'templates' ? 'active' : '') + '" data-ar-mode-set="templates" aria-pressed="' + (m === 'templates') + '">' + F.icon('i-bolt') + ' Шаблоны</button>' +
        '<button type="button" class="' + (m === 'ai' ? 'active' : '') + '" data-ar-mode-set="ai" aria-pressed="' + (m === 'ai') + '">' + F.icon('i-sparkles') + ' ИИ</button>' +
      '</div>' +
      '<span class="ar-mode-switch__hint">' + (m === 'ai' ? 'Бот отвечает сам, без триггеров' : 'Бот отвечает по сценариям ниже') + '</span>' +
    '</div>';
  }

  function aiPanel() {
    var s = A.state, shop = s.shop || {}, products = s.products || [];
    var lim = F.aiLimit(), used = F.aiUsed();
    var profileOk = !!(shop.name && shop.city && shop.description);
    var TONES = { friendly: 'Дружелюбный', neutral: 'Нейтральный', expert: 'Экспертный' };
    var know = [
      ['i-user', 'Профиль магазина', profileOk ? F.esc(shop.name) + ' · ' + F.esc(shop.city) : 'Заполните город и описание — ИИ использует их в ответах', '#/settings', profileOk],
      ['i-box', 'Товары', products.length ? products.length + ' ' + A.plural(products.length, 'товар', 'товара', 'товаров') + ' с ценами и остатками' : 'Добавьте товары — ИИ отвечает по ним', '#/catalog', products.length > 0],
      ['i-smile', 'Тон общения', (TONES[s.settings.tone] || 'Нейтральный') + (s.settings.emoji ? ', с эмодзи' : ''), '#/settings', true],
      ['i-users', 'Сложные вопросы', 'Счёт, опт, жалобы — ИИ передаёт менеджеру', null, true],
    ];
    var meter = lim === Infinity
      ? '<div class="ar-ai__meter"><strong>Без лимита</strong><span>ИИ-ответов в месяц на тарифе MAXIMUM</span></div>'
      : '<div class="ar-ai__meter"><strong>' + F.num(Math.max(0, lim - used)) + '<small> из ' + F.num(lim) + '</small></strong><span>ИИ-ответов осталось в этом месяце</span>' +
        '<span class="ar-journey__bar"><i style="width:' + Math.min(100, Math.round(used / lim * 100)) + '%"></i></span>' +
        '<button class="btn btn-white btn-sm" type="button" data-ar-tariffs>' + F.icon('i-zap-circle') + ' Без лимита — в MAXIMUM</button></div>';
    return '<section class="ar-ai" data-ar-block="ai-panel">' +
      '<div class="ar-ai__hero">' +
        '<div class="ar-ai__copy"><span class="ar-ai__pill"><span class="demo-dot"></span> ИИ на связи</span>' +
          '<h2>ИИ отвечает покупателям сам</h2>' +
          '<p>Никаких триггеров и шаблонов: ИИ читает вопрос целиком, понимает, о чём спрашивают, и отвечает своими словами — по вашему товару, цене, остатку и профилю. Если вопрос сложный, зовёт менеджера.</p>' +
          '<div class="ar-ai__actions"><button class="btn btn-lime" type="button" data-test-bot-ai>' + F.icon('i-sparkles') + ' Проверить ИИ на сообщении</button></div></div>' +
        meter +
      '</div>' +
      '<div class="ar-ai__grid">' + know.map(function (k) {
        var inner = '<span class="ar-ai__k-icon">' + F.icon(k[0]) + '</span><span><strong>' + k[1] + '</strong><small>' + k[2] + '</small></span>' +
          '<span class="ar-ai__k-state ' + (k[4] ? 'ok' : 'todo') + '">' + F.icon(k[4] ? 'i-check' : 'i-arrow-right') + '</span>';
        return k[3] ? '<a class="card ar-ai__k" href="' + k[3] + '">' + inner + '</a>' : '<div class="card ar-ai__k">' + inner + '</div>';
      }).join('') + '</div>' +
      '<p class="ar-ai__note">' + F.icon('i-info') + ' ИИ отвечает по вашим товарам и истории диалога и не придумывает того, чего нет в каталоге. Цены, наличие и условия он берёт из карточки товара и профиля магазина.</p>' +
    '</section>';
  }

  function render() {
    var page = F.$('#view .page');
    if (!page) return;
    var head = F.$('#view .page > .page-head');
    F.mount('mode-switch', switcher(), 'afterend', head);
    var ai = mode() === 'ai';
    page.classList.toggle('ar-mode-ai', ai);
    F.mount('ai-panel', ai ? aiPanel() : '', 'afterend', ai ? F.$('[data-ar-block="mode-switch"]') : null);

    // пустой список и возврат стандартных сценариев
    var grid = F.$('#view .rule-grid');
    if (grid && !A.state.rules.length) {
      grid.innerHTML = '<div class="ar-rules-empty"><span class="ar-start__icon ar-start__icon--lg">' + F.icon('i-bolt') + '</span>' +
        '<h3>Сценариев пока нет</h3>' +
        '<p>Сценарий — это ответ бота на частый вопрос. Укажите слова, по которым его узнать (например, «есть», «наличие»), и текст ответа — в нём можно использовать {{товар}}, {{цена}} и {{остаток}}. Пока сценариев нет, бот передаёт вопросы менеджеру.</p>' +
        '<div class="ar-start__actions"><button class="btn btn-primary" type="button" data-ar-new-rule>' + F.icon('i-plus') + ' Создать первый сценарий</button>' +
        '<button class="btn btn-white" type="button" data-ar-mode-set="ai">' + F.icon('i-sparkles') + ' Или пусть отвечает ИИ</button></div></div>';
    }
    var tools = F.$('#view .rules-toolbar');
    var miss = missingBuiltins().length;
    F.mount('rules-restore', miss ? '<button class="btn btn-white btn-sm" type="button" data-ar-rules-restore data-ar-block="rules-restore">' +
      F.icon('i-refresh') + ' Вернуть стандартные (' + miss + ')</button>' : '', 'beforeend', miss ? tools : null);

    // при каждом входе в «Сценарии» — выбор режима (не при перерисовке той же страницы)
    if (F.lastPage !== 'rules') setTimeout(chooser, 30);
  }
  F.on('rules', render);

  document.addEventListener('click', function (e) {
    var t = e.target;
    var del = t.closest('[data-rule-delete]');
    if (del) { e.preventDefault(); askDelete(del.getAttribute('data-rule-delete')); return; }
    var ok = t.closest('[data-ar-rule-confirm]');
    if (ok) { doDelete(ok.getAttribute('data-ar-rule-confirm')); return; }
    if (t.closest('[data-ar-rules-restore]')) { restore(); return; }
    if (t.closest('[data-ar-new-rule]')) { var nr = F.$('#view [data-new-rule]'); if (nr) nr.click(); return; }
    var pick = t.closest('[data-ar-mode]');
    if (pick) {
      var m = pick.getAttribute('data-ar-mode');
      A.closeModal();
      if (m !== mode()) setMode(m);
      return;
    }
    var set = t.closest('[data-ar-mode-set]');
    if (set && set.getAttribute('data-ar-mode-set') !== mode()) { setMode(set.getAttribute('data-ar-mode-set')); return; }
    if (t.closest('[data-test-bot-ai]')) A.openBotTestModal();
  });
})();

/* ==========================================================================
   AutoR — ответ бота: режим «ИИ» (живой ответ через сервер) и свои сценарии в режиме «Шаблоны».
   ИИ не придумывает фактов: говорит только то, что есть в товаре и профиле магазина,
   остальное обещает уточнить. Настоящая нейросеть подключается позже на сервере.
   Лимит ИИ-ответов в месяц: Бесплатный — 30, VIP — 500, MAXIMUM — без лимита.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;
  var LIMITS = { free: 30, vip: 500, max: Infinity };

  function monthKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); }
  F.aiLimit = function () { return LIMITS[F.plan()] || LIMITS.free; };
  F.aiUsed = function () { F.ensure(); var ai = A.state.ai; return ai.month === monthKey() ? ai.used : 0; };
  function countAi() {
    var ai = A.state.ai, m = monthKey();
    if (ai.month !== m) { ai.month = m; ai.used = 0; }
    ai.used += 1;
  }

  /* ---------- распознавание: что спрашивают (в порядке, как в сообщении) ---------- */
  var TOPICS = [
    ['complex', 'Передача менеджеру', /(менеджер|оператор|жалоб|претензи|сч[её]т[^а-я]|[^а-я]ооо[^а-я]|юрлиц|юр\.? ?лиц|[^а-я]опт(ом)?[^а-я]|договор|возврат денег)/],
    ['avail', 'Наличие', /(есть ли|есть\?|в наличии|наличи|остал|актуальн|ещ[её] прода|можно купить|забронир|отлож)/],
    ['bargain', 'Цена и скидки', /(скидк|скинете|торг|уступ|дешевле|подешевле|акци|промокод)/],
    ['price', 'Цена', /(цен[аеуы]|стоит|сколько|стоимост|поч[её]м)/],
    ['delivery', 'Доставка', /(достав|отправ|пришл[её]те|сдэк|cdek|почт|курьер|в другой город|boxberry)/],
    ['pickup', 'Самовывоз', /(самовывоз|забрать|адрес|где вы|где находит|подъехать|приехать|встретиться|вживую)/],
    ['warranty', 'Гарантия', /(гарант|возврат|обмен|брак)/],
    ['photo', 'Фото товара', /(фото|фотк|снимк|видео|покаж)/],
    ['condition', 'Состояние', /(состояни|царап|скол(ы|ов|а)?[^а-яь]|б\/у|[^а-я]бу[^а-я]|пользовал|оригинал|новый\?|новая\?|новое\?)/],
    ['specs', 'Характеристики', /(характеристик|размер|цвет|памят|объ[её]м|[^а-я]вес[^а-я]|модел|совмест|подойд[её]т|комплект)/],
    ['payment', 'Оплата', /(оплат|перевод|наличн|картой|рассроч|кредит)/],
    ['thanks', 'Благодарность', /(спасибо|благодар)/],
    ['hello', 'Приветствие', /(здравствуй|добрый|доброе|доброго|привет)/],
  ];
  function detect(text) {
    var t = ' ' + text.toLowerCase().replace(/ё/g, 'е') + ' ';
    var found = [];
    TOPICS.forEach(function (tp) {
      var m = t.match(tp[2]);
      if (m) found.push({ id: tp[0], label: tp[1], at: m.index });
    });
    // «есть?» внутри вопроса о цене — это не про наличие; «сколько стоит доставка» — про доставку
    var has = function (id) { return found.some(function (f) { return f.id === id; }); };
    if (has('delivery') && has('price') && /(сколько|стоит|стоимост)[^.?!]{0,25}(достав|отправ)|(достав|отправ)[^.?!]{0,25}(сколько|стоит|стоимост)/.test(t)) {
      found = found.filter(function (f) { return f.id !== 'price'; });
    }
    if (has('bargain')) found = found.filter(function (f) { return f.id !== 'price'; });
    return found.sort(function (a, b) { return a.at - b.at; });
  }

  function pick(list, seed) { return list[Math.abs(seed) % list.length]; }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  /* ---------- ответ ИИ ---------- */
  function aiReply(chat, text) {
    var s = A.state, p = A.chatProduct(chat), shop = s.shop || {}, set = s.settings || {};
    var tone = set.tone || 'neutral', seed = hash(text);
    var name = '«' + p.name + '»', price = A.formatPrice(p.price);
    var low = F.lowStock ? F.lowStock(p) : 3;
    var topics = detect(text), ids = topics.map(function (t) { return t.id; });
    var first = chat && chat.buyer && chat.buyer.name && chat.buyer.name !== 'Покупатель' ? A.buyerFirstName(chat) : '';
    var hasBot = !!(chat && chat.messages && chat.messages.some(function (m) { return m.from === 'bot'; }));
    var parts = [], handoff = false, attachment = null;

    if (!hasBot || (ids[0] === 'hello' && ids.length === 1)) {
      parts.push(tone === 'friendly' ? 'Здравствуйте' + (first ? ', ' + first : '') + '!' : tone === 'expert' ? 'Добрый день.' : 'Добрый день' + (first ? ', ' + first : '') + '.');
    }
    var main = topics.filter(function (t) { return t.id !== 'hello' && t.id !== 'thanks'; }).slice(0, 4);
    main.forEach(function (t) {
      switch (t.id) {
        case 'avail':
          if (p.stock > 0) parts.push(name + ' в наличии' + (p.stock <= low ? ' — осталось всего ' + p.stock + ' шт.' : '') + '.');
          else parts.push('Сейчас ' + name + ' закончился. ' + (p.note ? p.note + ' ' : '') + 'Могу записать вас на предзаказ и написать, как только появится.');
          break;
        case 'price':
          parts.push('Цена — ' + price + (p.oldPrice ? ' вместо ' + A.formatPrice(p.oldPrice) : '') + '.');
          break;
        case 'bargain':
          parts.push('В объявлении цена ' + price + '. Про скидку спрошу у менеджера — если сможем уступить, он напишет сюда.');
          break;
        case 'delivery':
          parts.push(pick(['Отправим удобной для вас службой доставки', 'Доставку организуем удобной вам службой'], seed) +
            (shop.city ? ' из города ' + shop.city : '') + ' — напишите ваш город, и я посчитаю срок и стоимость.');
          break;
        case 'pickup':
          parts.push('Забрать можно самовывозом' + (shop.city ? ' (' + shop.city + ')' : '') + ' — договоримся о времени, и я пришлю точный адрес.');
          break;
        case 'warranty':
          parts.push(/гарант/i.test(p.note || '') ? p.note : 'Проверить ' + name + ' можно при получении, а точные условия гарантии и возврата уточню и отвечу здесь же.');
          break;
        case 'photo':
          if (p.image) { attachment = p.image; parts.push('Конечно, вот фото ' + name + '.'); }
          else parts.push('Дополнительные фото пришлёт менеджер — я уже передал просьбу.');
          break;
        case 'condition':
          parts.push(p.note && !/постав|предзаказ/i.test(p.note) ? 'По состоянию: ' + p.note : 'Состояние — как на фото в объявлении; если нужно, пришлю дополнительные снимки.');
          break;
        case 'specs':
          parts.push(p.subtitle ? 'Коротко о товаре: ' + p.subtitle + '. Если важна какая-то деталь — спросите, отвечу.' : 'Характеристики есть в описании объявления — спросите, что важно, и я отвечу.');
          break;
        case 'payment':
          parts.push('С оплатой подстроимся — подскажите, как вам удобнее, и я расскажу, как оформить.');
          break;
        case 'complex':
          handoff = true;
          break;
      }
    });
    if (ids.indexOf('thanks') >= 0 && !main.length) parts.push(pick(['Пожалуйста! Если появятся вопросы — пишите, отвечу сразу.', 'Рад помочь! Пишите, если что-то ещё понадобится.'], seed));
    if (!main.length && ids.indexOf('thanks') < 0) {
      if (/\?/.test(text) && ids.indexOf('hello') < 0) { handoff = true; }
      else parts.push('Подскажите, что вас интересует по ' + name + ' — наличие, цена или доставка?');
    }
    if (tone === 'expert' && p.subtitle && (ids.indexOf('avail') >= 0 || ids.indexOf('price') >= 0) && ids.indexOf('specs') < 0) parts.push('Коротко о товаре: ' + p.subtitle + '.');
    if (handoff) parts.push(main.length > 1 ? 'По остальному подключу менеджера — он ответит в течение 10 минут.' : 'Это лучше решит менеджер — я уже передал ему диалог, он ответит в течение 10 минут.');
    else if (p.stock > 0 && (ids.indexOf('avail') >= 0 || ids.indexOf('price') >= 0) && ids.indexOf('delivery') < 0) parts.push(pick(['Отложить для вас?', 'Хотите, отложу для вас?', 'Оформим?'], seed));
    var body = parts.join(' ');
    if (tone === 'friendly' && set.emoji && !handoff) body += ' 🙂';
    var topic = main.length ? main[0].label : ids.indexOf('thanks') >= 0 ? 'Благодарность' : 'Вопрос покупателя';
    return {
      from: 'bot', text: body, rule: 'ИИ-ассистент', confidence: handoff ? 74 : Math.min(98, 88 + main.length * 3),
      latency: (set.delay || 3) + ' сек', attachment: attachment, handoff: handoff, topic: handoff ? 'Передача менеджеру' : topic, ai: true,
    };
  }
  F.aiReply = aiReply;

  /* ---------- свои сценарии (режим «Шаблоны») ---------- */
  function fill(tpl, p) {
    return String(tpl)
      .replace(/\{\{товар\}\}/g, p.name)
      .replace(/\{\{цена\}\}/g, A.formatPrice(p.price))
      .replace(/\{\{остаток\}\}/g, p.stock + ' шт.')
      .replace(/\{\{цена_со_скидкой\}\}/g, A.formatPrice(Math.round(p.price * 0.95)))
      .replace(/шт\.\./g, 'шт.');
  }
  function customReply(chat, text) {
    var t = text.toLowerCase(), best = null, score = 0;
    (A.state.rules || []).forEach(function (r) {
      if (/^r[1-7]$/.test(r.id) || r.enabled === false) return;
      var sc = (r.triggers || []).filter(function (tr) { tr = String(tr).trim().toLowerCase(); return tr && t.indexOf(tr) >= 0; }).length;
      if (sc > score) { score = sc; best = r; }
    });
    if (!best) return null;
    best.used = (best.used || 0) + 1;
    return {
      from: 'bot', text: fill(best.reply, A.chatProduct(chat)), rule: best.name, confidence: Math.min(99, 94 + score),
      latency: (A.state.settings.delay || 3) + ' сек', attachment: null, handoff: false, topic: best.name,
    };
  }

  var warned = false;
  F.reply = function (chat, text) {
    F.ensure();
    if (F.journeyMark) F.journeyMark('test');
    if (A.state.settings.botMode === 'ai') {
      if (F.aiUsed() < F.aiLimit()) {
        var r = aiReply(chat, text);
        countAi();
        F.save();
        return r;
      }
      if (!warned) {
        warned = true;
        setTimeout(function () { A.toast('ИИ-ответы на этот месяц закончились', 'Пока бот отвечает по шаблонам. Без лимита — на тарифе MAXIMUM.', 'info'); }, 50);
      }
    }
    return customReply(chat, text);   // null → стандартные сценарии приложения
  };
})();

/* ==========================================================================
   AutoR — живой ответ нейросети. Браузер обращается к своему же домену
   (/api/chat), nginx проксирует запрос в DeepSeek и подставляет ключ уже на
   сервере: ключ не покидает сервер и не виден в исходниках страницы.
   Если сервис недоступен, ответ собирают сценарии приложения — чат не ломается.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;
  var ENDPOINT = '/api/chat';
  var TIMEOUT = 12000;

  function clean(text) {
    return String(text || '')
      .replace(/\*\*/g, '')
      .replace(/^[«"'\s]+|[»"'\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600);
  }

  function productLine(p) {
    if (!p) return '';
    var parts = ['«' + p.name + '»'];
    if (p.subtitle) parts.push(p.subtitle);
    parts.push('цена ' + A.formatPrice(p.price) + (p.oldPrice ? ' (было ' + A.formatPrice(p.oldPrice) + ')' : ''));
    parts.push(p.stock > 0 ? 'в наличии ' + p.stock + ' шт.' : 'сейчас нет в наличии');
    if (p.note) parts.push(p.note);
    return parts.join(', ') + '.';
  }

  function catalogText() {
    return (A.state.products || []).slice(0, 12).map(function (p) {
      return '• ' + p.name + ' — ' + A.formatPrice(p.price) + ', ' +
        (p.stock > 0 ? 'в наличии (' + p.stock + ' шт.)' : 'нет в наличии') +
        (p.note ? '; ' + p.note : '');
    }).join('\n');
  }

  function systemPrompt(chat) {
    var s = A.state, shop = s.shop || {}, set = s.settings || {}, p = A.chatProduct(chat);
    var tone = set.tone === 'friendly' ? 'дружелюбно, но по делу'
      : set.tone === 'expert' ? 'сухо и профессионально' : 'спокойно и вежливо';
    var rules = (s.rules || []).filter(function (r) {
      return !/^r[1-7]$/.test(r.id) && r.enabled !== false && r.reply;
    }).slice(0, 10).map(function (r) {
      return '• ' + r.name + ': ' + String(r.reply).replace(/\{\{[^}]+\}\}/g, '…');
    });

    var lines = [
      'Ты — ассистент магазина «' + (shop.name || 'магазин') + '» на Авито и отвечаешь покупателям в чате вместо продавца.',
      'Пиши по-русски, ' + tone + '. Одно-два коротких предложения, без списков, без markdown, без эмодзи.',
      'Если диалог уже начат — не здоровайся заново.',
      'Факты бери только из данных ниже: цены, наличие, сроки и условия не выдумывай.',
      'Если факта нет — скажи, что уточнишь у менеджера, и предложи помощь.',
      'Не упоминай, что ты нейросеть или бот, и не говори про тесты и примеры.',
      'Когда уместно, задай один короткий вопрос, который двигает к заказу.'
    ];
    if (shop.city) lines.push('Город магазина: ' + shop.city + '.');
    if (shop.description) lines.push('О магазине: ' + shop.description);
    if (p) lines.push('Покупатель спрашивает про: ' + productLine(p));
    var cat = catalogText();
    if (cat) lines.push('Каталог:\n' + cat);
    if (rules.length) lines.push('Формулировки, которые продавец уже использует:\n' + rules.join('\n'));
    return lines.join('\n');
  }

  function messagesFor(chat, text) {
    var list = [{ role: 'system', content: systemPrompt(chat) }];
    (chat.messages || []).slice(-8).forEach(function (m) {
      var body = String(m.text || '').slice(0, 500);
      if (body) list.push({ role: m.from === 'buyer' ? 'user' : 'assistant', content: body });
    });
    var last = list[list.length - 1];
    if (!last || last.role !== 'user' || last.content !== String(text || '').slice(0, 500)) {
      list.push({ role: 'user', content: String(text || '').slice(0, 500) });
    }
    return list;
  }

  function callApi(messages) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-flash',
        thinking: { type: 'disabled' },
        messages: messages,
        max_tokens: 260,
        temperature: 0.6
      }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var msg = data && data.choices && data.choices[0] && data.choices[0].message;
      return clean(msg && msg.content);
    }).finally(function () { clearTimeout(timer); });
  }

  function bumpAi() {
    var d = new Date(), key = d.getFullYear() + '-' + (d.getMonth() + 1);
    var ai = A.state.ai || (A.state.ai = { month: '', used: 0 });
    if (ai.month !== key) { ai.month = key; ai.used = 0; }
    ai.used += 1;
  }

  F.aiOnline = function (chat, text) {
    F.ensure();
    if ((A.state.settings || {}).botMode !== 'ai') return Promise.resolve(null);
    if (F.aiUsed() >= F.aiLimit()) return Promise.resolve(null);
    var started = Date.now();
    return callApi(messagesFor(chat, text)).then(function (content) {
      if (!content || content.length < 2) return null;
      bumpAi();
      var seconds = Math.max(2, Math.round((Date.now() - started) / 1000));
      return {
        from: 'bot', text: content, rule: 'ИИ-ассистент',
        confidence: Math.min(98, 89 + Math.min(9, Math.round(content.length / 45))),
        latency: seconds + ' сек', attachment: null, handoff: false, topic: 'Ответ ИИ', ai: true
      };
    }).catch(function (err) {
      if (window.console) console.warn('AutoR: ИИ не ответил —', err && err.message);
      return null;
    });
  };
})();

/* ==========================================================================
   AutoR — склад и остатки (CRM) в разделе «Товары» и «Оформить заказ» в чате.
   Остатки меняются кнопками +/−, «Приходом» и продажами из чатов; каждое движение — в истории.
   Когда остаток доходит до порога «мало», приходит уведомление. Бот отвечает по текущему остатку.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;
  var A = F.A;

  F.lowStock = function (p) {
    var s = A.state;
    if (p && typeof p.lowAt === 'number') return p.lowAt;
    return s && s.crm && typeof s.crm.threshold === 'number' ? s.crm.threshold : 3;
  };
  function statusOf(p) {
    if (p.stock <= 0) return ['out', 'Нет в наличии'];
    if (p.stock <= F.lowStock(p)) return ['low', 'Заканчивается'];
    return ['ok', 'В наличии'];
  }
  function stamp() {
    var d = new Date();
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  // Изменить остаток: delta > 0 — приход, < 0 — продажа или списание
  F.changeStock = function (id, delta, reason) {
    F.ensure();
    var p = A.getProduct(id);
    if (!p || !delta) return null;
    var before = Math.max(0, p.stock || 0);
    var after = Math.max(0, before + delta);
    if (after === before) return p;
    p.stock = after;
    A.state.crm.history.unshift({ at: stamp(), id: p.id, name: p.name, delta: after - before, balance: after, reason: reason || (delta > 0 ? 'Приход' : 'Списание') });
    A.state.crm.history = A.state.crm.history.slice(0, 200);
    var lim = F.lowStock(p);
    if (after < before && before > lim && after <= lim) {
      var text = after === 0 ? 'Закончился «' + p.name + '» — бот отвечает, что товара нет' : 'Заканчивается «' + p.name + '»: осталось ' + after + ' шт.';
      if (Array.isArray(A.state.notifications)) A.state.notifications.unshift({ id: A.uid('n'), icon: 'i-box', tone: 'amber', text: text, time: 'Только что' });
      A.toast(after === 0 ? 'Товар закончился' : 'Товар заканчивается', text, 'info');
    }
    F.save();
    return p;
  };

  /* ---------- вкладки раздела ---------- */
  function view() { return F.pref('catalogView') === 'stock' ? 'stock' : 'cards'; }
  function tabs() {
    var v = view(), products = A.state.products || [];
    var warn = products.filter(function (p) { return statusOf(p)[0] !== 'ok'; }).length;
    return '<div class="ar-cat-tabs" role="tablist" aria-label="Вид раздела" data-ar-block="cat-tabs">' +
      '<button type="button" role="tab" aria-selected="' + (v === 'cards') + '" class="' + (v === 'cards' ? 'active' : '') + '" data-ar-cat-view="cards">' + F.icon('i-grid') + ' Карточки товаров</button>' +
      '<button type="button" role="tab" aria-selected="' + (v === 'stock') + '" class="' + (v === 'stock' ? 'active' : '') + '" data-ar-cat-view="stock">' + F.icon('i-box') + ' Склад и остатки · CRM' +
        (warn ? '<span class="ar-cat-tabs__warn">' + warn + '</span>' : '') + '</button>' +
    '</div>';
  }

  /* ---------- панель склада ---------- */
  function sold30(id) {
    return A.state.crm.history.filter(function (h) { return h.id === id && h.delta < 0 && /Продажа/.test(h.reason); })
      .reduce(function (a, h) { return a - h.delta; }, 0);
  }
  function panel() {
    var s = A.state, products = s.products || [];
    if (!products.length) {
      return '<section class="card ar-stock ar-stock--empty" data-ar-block="stock">' +
        '<span class="ar-start__icon ar-start__icon--lg">' + F.icon('i-box') + '</span><h2>Склад пуст</h2>' +
        '<p>Добавьте товар — и здесь появятся остатки, предупреждения «заканчивается» и история продаж из чатов.</p>' +
        '<div class="ar-start__actions"><button class="btn btn-primary" type="button" data-add-product-ar>' + F.icon('i-plus') + ' Добавить товар</button></div></section>' + syncBlock();
    }
    var units = 0, value = 0, low = [], out = [];
    products.forEach(function (p) {
      units += p.stock; value += p.stock * (p.price || 0);
      var st = statusOf(p)[0];
      if (st === 'low') low.push(p); if (st === 'out') out.push(p);
    });
    var alert = low.length || out.length ? '<div class="ar-stock__alert">' + F.icon('i-bell') + '<div><strong>Нужно пополнить: ' +
      (low.length + out.length) + ' ' + A.plural(low.length + out.length, 'товар', 'товара', 'товаров') + '</strong><span>' +
      out.concat(low).slice(0, 4).map(function (p) { return F.esc(p.name) + ' — ' + (p.stock ? p.stock + ' шт.' : 'нет'); }).join(' · ') + '</span></div></div>' : '';
    var rows = products.map(function (p) {
      var st = statusOf(p);
      return '<tr data-ar-stock-row="' + F.esc(p.id) + '">' +
        '<td class="ar-stock__prod">' + (p.image ? '<img src="' + F.esc(p.image) + '" alt="">' : '<span class="ar-stock__ph">' + F.icon('i-box') + '</span>') +
          '<span><strong>' + F.esc(p.name) + '</strong><small>' + F.esc(p.sku || p.category || '') + '</small></span></td>' +
        '<td class="ar-stock__num">' + A.formatPrice(p.price || 0) + '</td>' +
        '<td><div class="ar-qty" role="group" aria-label="Остаток «' + F.esc(p.name) + '»">' +
          '<button type="button" data-ar-stock="-1" aria-label="Списать одну штуку"' + (p.stock <= 0 ? ' disabled' : '') + '>−</button>' +
          '<output>' + p.stock + '</output>' +
          '<button type="button" data-ar-stock="1" aria-label="Добавить одну штуку">+</button></div></td>' +
        '<td><span class="ar-stock__badge is-' + st[0] + '">' + st[1] + '</span></td>' +
        '<td class="ar-stock__num">' + sold30(p.id) + '</td>' +
        '<td><label class="ar-stock__low"><span class="sr-only">Порог «мало» для «' + F.esc(p.name) + '»</span>≤ <input type="number" min="0" max="999" inputmode="numeric" value="' + F.lowStock(p) + '" data-ar-low></label></td>' +
        '<td class="ar-stock__act"><button class="btn btn-white btn-sm" type="button" data-ar-income>' + F.icon('i-plus') + ' Приход</button></td>' +
      '</tr>';
    }).join('');
    var hist = s.crm.history.slice(0, 12);
    return '<section class="ar-stock" data-ar-block="stock">' +
      '<div class="ar-stock__kpis">' +
        '<div class="card"><span>Товаров</span><strong>' + products.length + '</strong></div>' +
        '<div class="card"><span>Единиц на складе</span><strong>' + F.num(units) + '</strong></div>' +
        '<div class="card"><span>Заканчивается</span><strong class="' + (low.length ? 'is-low' : '') + '">' + low.length + '</strong></div>' +
        '<div class="card"><span>Нет в наличии</span><strong class="' + (out.length ? 'is-out' : '') + '">' + out.length + '</strong></div>' +
        '<div class="card"><span>Стоимость остатков</span><strong>' + A.formatPrice(value) + '</strong></div>' +
      '</div>' + alert +
      '<div class="card ar-stock__table-card"><div class="card-head"><div><h3 class="card-title">Остатки по товарам</h3>' +
        '<p class="card-sub">Бот отвечает по этим цифрам: если остаток 0 — честно говорит, что товара нет, и предлагает предзаказ.</p></div>' +
        '<label class="ar-stock__def">Порог «мало» по умолчанию ≤ <input type="number" min="0" max="999" value="' + s.crm.threshold + '" data-ar-low-default aria-label="Порог «мало» по умолчанию"></label></div>' +
        '<div class="ar-stock__scroll"><table class="ar-stock__table"><thead><tr><th>Товар</th><th>Цена</th><th>Остаток</th><th>Статус</th><th>Продано из чатов</th><th>Порог «мало»</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="ar-stock__bottom">' +
        '<div class="card ar-stock__history"><div class="card-head"><div><h3 class="card-title">История движений</h3><p class="card-sub">Приход, продажи из чатов и списания</p></div></div>' +
          (hist.length ? '<ul>' + hist.map(function (h) {
            return '<li><span class="ar-stock__delta ' + (h.delta > 0 ? 'is-in' : 'is-outflow') + '">' + (h.delta > 0 ? '+' : '−') + Math.abs(h.delta) + '</span>' +
              '<span><strong>' + F.esc(h.name) + '</strong><small>' + F.esc(h.reason) + ' · остаток ' + h.balance + '</small></span><time>' + F.esc(h.at) + '</time></li>';
          }).join('') + '</ul>' : '<p class="ar-stock__none">Движений пока не было. Нажмите «Приход» или оформите заказ в чате.</p>') +
        '</div>' + syncBlock() +
      '</div>' +
    '</section>';
  }

  function syncBlock() {
    var tg = (F.billing() || {}).tg || '#';
    var crms = [['amoCRM', 'Сделки и остатки из amoCRM'], ['1С:CRM', 'Склад и номенклатура из 1С'], ['BPMSoft', 'Каталог и остатки из BPMSoft']];
    return '<div class="card ar-sync" data-ar-block="crm-sync"><div class="card-head"><div><h3 class="card-title">Синхронизация с вашей CRM</h3>' +
      '<p class="card-sub">Остатки будут обновляться сами — из учётной системы, без ручного ввода.</p></div><span class="ar-sync__plan">MAXIMUM</span></div>' +
      '<ul class="ar-sync__list">' + crms.map(function (c) {
        return '<li><span class="ar-sync__logo">' + F.esc(c[0].charAt(0)) + '</span><span><strong>' + F.esc(c[0]) + '</strong><small>' + F.esc(c[1]) + '</small></span>' +
          '<a class="btn btn-white btn-sm" href="' + F.esc(tg) + '" target="_blank" rel="noopener">Подключить</a></li>';
      }).join('') + '</ul>' +
      '<p class="ar-sync__note">' + F.icon('i-info') + ' Подключение настраивает менеджер: нужен сервер AutoR и доступ к API вашей CRM. Напишите — подскажем сроки.</p></div>';
  }

  function render() {
    var tools = F.$('#view .catalog-tools');
    if (!tools) return;
    F.mount('cat-tabs', tabs(), 'beforebegin', tools);
    var page = F.$('#view .page');
    var stock = view() === 'stock';
    page.classList.toggle('ar-view-stock', stock);
    F.mount('crm-sync', '', 'beforeend', null);
    F.mount('stock', stock ? panel() : '', 'beforeend', stock ? page : null);
  }
  function rerender() {
    var scroll = window.scrollY;
    render();
    window.scrollTo(0, scroll);
  }
  F.on('catalog', render);

  /* ---------- приход ---------- */
  function income(id) {
    var p = A.getProduct(id);
    if (!p) return;
    A.openModal(A.modalHeader('Приход товара', p.name + ' · сейчас ' + p.stock + ' шт.') +
      '<div class="modal-body"><div class="field"><label class="field-label" for="ar-income-qty">Сколько пришло, шт.</label>' +
      '<input class="input" id="ar-income-qty" type="number" min="1" max="9999" value="5" inputmode="numeric"></div>' +
      '<div class="field"><label class="field-label" for="ar-income-note">Комментарий <small>необязательно</small></label>' +
      '<input class="input" id="ar-income-note" maxlength="80" placeholder="Например, поставка от поставщика"></div></div>' +
      '<div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button>' +
      '<button class="btn btn-primary btn-sm" type="button" data-ar-income-ok="' + F.esc(p.id) + '">' + F.icon('i-plus') + ' Оприходовать</button></div>',
      { onMount: function (m) { var i = m.querySelector('#ar-income-qty'); setTimeout(function () { i.focus(); i.select(); }, 60); } });
  }

  /* ---------- заказ из чата ---------- */
  function orderModal() {
    var chat = A.getActiveChat();
    if (!chat) return;
    var p = A.chatProduct(chat);
    var none = !p || p.stock <= 0 || !A.getProduct(p.id);
    A.openModal(A.modalHeader('Оформить заказ', chat.buyer.name + ' · ' + p.name) +
      '<div class="modal-body">' +
      (none ? '<p class="ar-modal-text">' + F.icon('i-info') + ' Товара нет на складе. Пополните остаток в «Товары → Склад и остатки», затем оформите заказ.</p>' :
        '<div class="ar-order"><img src="' + F.esc(p.image || '') + '" alt=""><div><strong>' + F.esc(p.name) + '</strong><span>' + A.formatPrice(p.price) + ' · на складе ' + p.stock + ' шт.</span></div></div>' +
        '<div class="field"><label class="field-label" for="ar-order-qty">Количество</label>' +
        '<input class="input" id="ar-order-qty" type="number" min="1" max="' + p.stock + '" value="1" inputmode="numeric"></div>' +
        '<p class="ar-modal-note" id="ar-order-sum"></p>') +
      '</div><div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button>' +
      (none ? '<a class="btn btn-primary btn-sm" href="#/catalog" data-ar-to-stock>Пополнить склад</a>' :
        '<button class="btn btn-primary btn-sm" type="button" data-ar-order-ok="' + F.esc(chat.id) + '">' + F.icon('i-check') + ' Оформить</button>') + '</div>',
      { onMount: function (m) {
        var q = m.querySelector('#ar-order-qty'), out = m.querySelector('#ar-order-sum');
        if (!q) return;
        var upd = function () {
          var n = Math.max(1, Math.min(p.stock, parseInt(q.value, 10) || 1));
          out.innerHTML = 'Сумма: <b>' + A.formatPrice(p.price * n) + '</b> · остаток станет ' + (p.stock - n) + ' шт. Заказ попадёт в конверсию на главной.';
        };
        q.addEventListener('input', upd); upd();
        setTimeout(function () { q.focus(); q.select(); }, 60);
      } });
  }
  function placeOrder(chatId) {
    var chat = A.getChat(chatId), q = F.$('#ar-order-qty');
    if (!chat || !q) return;
    var p = A.chatProduct(chat);
    var n = Math.max(1, Math.min(p.stock, parseInt(q.value, 10) || 1));
    if (!p.stock) return;
    F.changeStock(p.id, -n, 'Продажа в чате · ' + chat.buyer.name);
    if (F.countOrder) F.countOrder();
    chat.messages.push({ id: A.uid('m'), from: 'system', text: 'Заказ оформлен: ' + p.name + ' × ' + n + ' — ' + A.formatPrice(p.price * n), time: chat.updated || '' });
    if (Array.isArray(A.state.feed)) {
      A.state.feed.unshift({ id: A.uid('f'), type: 'order', icon: 'i-box', text: 'Заказ из чата: ' + p.name + ' × ' + n + ' — ' + chat.buyer.name, time: 'Только что' });
      A.state.feed = A.state.feed.slice(0, 8);
    }
    F.save();
    A.closeModal();
    A.refreshConversation(chat);
    A.toast('Заказ оформлен', p.name + ' × ' + n + '. Остаток: ' + p.stock + ' шт.', 'success');
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var v = t.closest('[data-ar-cat-view]');
    if (v) { F.pref('catalogView', v.getAttribute('data-ar-cat-view')); rerender(); return; }
    var b = t.closest('[data-ar-stock]');
    if (b) {
      var row = b.closest('[data-ar-stock-row]');
      F.changeStock(row.getAttribute('data-ar-stock-row'), +b.getAttribute('data-ar-stock'), +b.getAttribute('data-ar-stock') > 0 ? 'Приход' : 'Списание вручную');
      rerender();
      var again = F.$('[data-ar-stock-row="' + row.getAttribute('data-ar-stock-row') + '"] [data-ar-stock="' + b.getAttribute('data-ar-stock') + '"]');
      if (again && !again.disabled) again.focus();
      return;
    }
    var inc = t.closest('[data-ar-income]');
    if (inc) { income(inc.closest('[data-ar-stock-row]').getAttribute('data-ar-stock-row')); return; }
    var ok = t.closest('[data-ar-income-ok]');
    if (ok) {
      var qty = Math.max(1, Math.min(9999, parseInt((F.$('#ar-income-qty') || {}).value, 10) || 0));
      var note = ((F.$('#ar-income-note') || {}).value || '').trim();
      F.changeStock(ok.getAttribute('data-ar-income-ok'), qty, 'Приход' + (note ? ' · ' + note : ''));
      A.closeModal();
      rerender();
      A.toast('Приход оформлен', '+' + qty + ' шт. на складе.', 'success');
      return;
    }
    if (t.closest('[data-add-product-ar]')) { A.openAddProductModal(); return; }
    if (t.closest('[data-create-product]')) {   // товар добавлен окном приложения — обновить склад и путь
      setTimeout(function () { if (A.ui.page === 'catalog') rerender(); if (F.journeyRefresh) F.journeyRefresh(); }, 0);
      return;
    }
    if (t.closest('[data-ar-order]')) { orderModal(); return; }
    var po = t.closest('[data-ar-order-ok]');
    if (po) { placeOrder(po.getAttribute('data-ar-order-ok')); return; }
    if (t.closest('[data-ar-to-stock]')) { F.pref('catalogView', 'stock'); A.closeModal(); }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-ar-low]')) {
      var p = A.getProduct(t.closest('[data-ar-stock-row]').getAttribute('data-ar-stock-row'));
      if (p) { p.lowAt = Math.max(0, Math.min(999, parseInt(t.value, 10) || 0)); F.save(); rerender(); }
    } else if (t.matches('[data-ar-low-default]')) {
      F.ensure();
      A.state.crm.threshold = Math.max(0, Math.min(999, parseInt(t.value, 10) || 0));
      (A.state.products || []).forEach(function (p) { delete p.lowAt; });
      F.save(); rerender();
    }
  });
})();

/* ==========================================================================
   AutoR — удобный чат: панель «О диалоге» сворачивается (выбор запоминается),
   окно переписки занимает почти весь экран. Этот файл подключается последним и запускает доработки.
   ========================================================================== */
(function () {
  'use strict';
  var F = window.AutoRFeatures;
  if (!F || !F.A) return;

  function paneOpen() {
    var p = F.pref('chatPane');
    return p == null ? window.innerWidth >= 1680 : !!p;
  }
  function apply() {
    var layout = F.$('#chats-layout');
    if (!layout) return;
    var open = paneOpen();
    layout.classList.toggle('ar-pane-closed', !open);
    F.$$('[data-ar-pane]').forEach(function (b) { b.setAttribute('aria-pressed', String(open)); b.classList.toggle('active', open); });
  }
  F.on('chats', apply);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-ar-pane]')) return;
    F.pref('chatPane', !paneOpen());
    apply();
  });

  F.start();
})();
