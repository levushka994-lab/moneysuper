/* ==========================================================================
   AutoR — доступ, промокоды и подписки (без сервера)
   - Вход: экран «как устроен AutoR» с кнопками «Купить доступ», «Ввести промокод», «Пробный доступ».
   - Пробный доступ: 30 минут с правами VIP, один раз на устройство.
   - Коды: в файле только хэши PBKDF2-SHA256 — сами коды из кода страницы не достать.
     access — доступ навсегда + MAXIMUM на 30 дней; vip / max — подписка на 30 дней (нужен доступ).
   - Тарифы: Бесплатный (доступ без подписки), VIP, MAXIMUM; платные функции под замком.
   Всё хранится в браузере: человек, разбирающийся в коде, сможет обойти замки.
   Для настоящей защиты проверки нужно перенести на сервер.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = {"salt":"139876865a93cdbd44b8c92a8e8211f1","iterations":150000,"codes":{"4ade06ffa3b08295919152aa7552db96a9414410b1f6632eaf45483f7eff37e2":"access","a14f7b93e38fb82a2249db519cbe6bb2172a8f69201d4fde67d49c41b828202c":"access","2e55e05ada507cfaa994de4c72314d71f1afe5acef8d35f1efb4a771867159e6":"access","3ca445dedc0636cd46918e199a7fde1141a3c339e281f531f75c567ded62c5f4":"access","ce0880aaa0fe79fc72dc98ec312a5bf3aabdb1616219084386539c87c812a5fb":"access","fc8946d120508f25e549593e2d6c6ac26c664373f47303f8f88453b240ffe948":"access","4552c146c68763aaf1aafad103282926d2c85fc00b691405b654693fc93bc02b":"access","098c17ae0b70519e5f3e6f3162c84528c31c89c4f74073c8101070479c3ccb14":"access","866541f67c58ba7bdd8154cd242a4e7cff2580e21f6b5aa7f43982bac4761cad":"access","2421e1849b067f5c25aa9c719adb33b5d2913750751f6a38891725648dee5195":"access","f94da07dc3d8573200b0292a94e1c60b853982d918cb05ef4024fae4d7c072e8":"vip","14556b1baa1c0f3e18e012840f7878ee55cd361d0e256f9adb362be9c78d8e86":"vip","fd8dc394ce6764b27e0cbc86683e3cdfcc8492150870feaf49c2ce4acbfd554a":"vip","85c09c1d8f2c28b7a294c6d2f9591867ec04eda129b4b359b3084d70858ab8aa":"vip","9dc68b6ca0cf59257bc44dd0c1bf55a6a8b77a21c9252f43b1140b614fccc65e":"vip","7552a184597639c394b296f5e9a1d8f14a7731091e576647e8be4c04e6d840db":"vip","9cafa92b51ae390144abdc80fdaecd9aa0f88107e3a02cf20ed808d99eba662c":"vip","09c9c22aa5c67642190064fb223d2617f896f7de77ace50deb1db12359135d66":"vip","f7dfdf73ce1b62cc0a34cbf9eae39179f26b0e9fe81ee253b9a99a35930a624e":"vip","0cb47339a3557c5ae0017dd2ea1a5589d1b5918142ae708dd7c8349771c915fb":"vip","ff617579df0490143945c85e1a80e0a03ee5a7297dbcf3f951ae81d868f9cf1c":"max","ae19b0af84cf5d8c2d1956c9588235e0ad7c47b57d94bda61da134bacddece6f":"max","47c0f276d9deb41eaa87164f7e7c195a471e2b42afabaa73c24f2b69f1f3f533":"max","3bf832fb40a487a0cbe4c85c80ca8e5398defa1551395ff734551f9ad62d80f2":"max","d4b94285ac24a306e0a21595a6f1c8e3401416c00c4d6d5ba5e87d28939bce1e":"max","e5d7dd84ae89b1ca61b3c8a19f1b8573f9443866ae0965f05549b82f5cb2b69c":"max","6bf3de1f61d29fd5b21e6bb681557fc7286063271786e26a1db5251734859431":"max","e7b8045d787a7f5c0c646cc1e000739fb4d132f97d0e1a3cffb472124120e37a":"max","1da2c121eaac5d46f1533cbee683c701974f4c1de41575d54f05f02ef47de0f7":"max","045110c3fc6b31882041513476158eb0c7c66f18cf11752aad39a1e3a8062b4f":"max"}};
  var TG = 'https://t.me/maksim_busy';
  var KEY = 'autor-billing-v1';
  var SIGN = 'AR·k9#v1·volt';
  var DEMO_MS = 30 * 60 * 1000;
  var MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  var RANK = { free: 0, vip: 1, max: 2 };
  var NAME = { free: 'Бесплатный', vip: 'VIP', max: 'MAXIMUM' };

  /* ---------- хранение ---------- */
  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  var EMPTY = { access: false, vipUntil: 0, maxUntil: 0, demoStart: 0, clock: 0, last: 0, used: [] };
  var st = load();
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.d && raw.s === fnv(SIGN + raw.d)) {
        var r = Object.assign({}, EMPTY, JSON.parse(raw.d));
        r.used = Array.isArray(r.used) ? r.used.slice() : [];
        return r;
      }
    } catch (e) { /* хранилище недоступно или испорчено — начинаем с закрытого доступа */ }
    return Object.assign({}, EMPTY, { used: [] });
  }
  // Если AutoR открыт в нескольких вкладках, сохранение не затирает то, что сделано в другой:
  // доступ и использованные коды объединяются, сроки берутся самые поздние, пробный доступ — самое раннее.
  function merge(a, b) {
    var used = a.used.slice();
    b.used.forEach(function (h) { if (used.indexOf(h) < 0) used.push(h); });
    return {
      access: !!(a.access || b.access), vipUntil: Math.max(a.vipUntil, b.vipUntil), maxUntil: Math.max(a.maxUntil, b.maxUntil),
      demoStart: a.demoStart && b.demoStart ? Math.min(a.demoStart, b.demoStart) : (a.demoStart || b.demoStart),
      clock: Math.max(a.clock || 0, b.clock || 0), last: b.last, used: used
    };
  }
  // объект st не подменяется: на него могут держать ссылку (st.demoStart = now() и т. п.)
  function sync() { Object.assign(st, merge(load(), st)); }
  // запись как есть, без слияния с соседними вкладками
  function rawSave() {
    try { var d = JSON.stringify(st); localStorage.setItem(KEY, JSON.stringify({ d: d, s: fnv(SIGN + d) })); } catch (e) {}
  }
  function save() {
    try {
      sync();
      rawSave();
    } catch (e) {}
  }

  /* ---------- состояние доступа ---------- */
  // Время приложения идёт только вперёд: прибавляется прошедшее время, а перевод часов
  // компьютера назад пропускается — так пробный доступ и подписки нельзя продлить, отмотав часы.
  var savedAt = 0;
  function now() {
    var t = Date.now();
    if (!st.clock || !st.last) { st.clock = st.last = t; }
    var d = t - st.last;
    if (d > 0) st.clock += d;
    st.last = t;
    if (d < 0 || Math.abs(t - savedAt) > 60000) { savedAt = t; save(); }
    return st.clock;
  }
  function demoLeft() { return st.demoStart ? Math.max(0, st.demoStart + DEMO_MS - now()) : 0; }
  function inDemo() { return !st.access && demoLeft() > 0; }
  function hasAccess() { return st.access || inDemo(); }
  function plan() {
    if (!hasAccess()) return 'free';
    if (inDemo()) return 'vip';
    if (st.maxUntil > now()) return 'max';
    if (st.vipUntil > now()) return 'vip';
    return 'free';
  }
  function until() { var p = plan(); return p === 'max' ? st.maxUntil : p === 'vip' ? st.vipUntil : 0; }
  function fmtDate(t) { var d = new Date(t); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function fmtLeft(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); s %= 60; return m + ':' + ('0' + s).slice(-2); }

  /* ---------- проверка кодов: PBKDF2-SHA256 ---------- */
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function normalize(code) {
    var c = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^AUTOR/, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1');
    for (var i = 0; i < c.length; i++) if (ALPHA.indexOf(c[i]) < 0) return '';
    return c.length === 12 ? c : '';
  }
  function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2); return s; }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function utf8(s) { return new TextEncoder().encode(s); }

  function kdf(code) {
    var salt = unhex(CFG.salt);
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.importKey('raw', utf8(code), 'PBKDF2', false, ['deriveBits'])
        .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: CFG.iterations }, k, 256); })
        .then(function (b) { return hex(new Uint8Array(b)); });
    }
    return new Promise(function (ok) { setTimeout(function () { ok(hex(pbkdf2(utf8(code), salt, CFG.iterations))); }, 20); });
  }

  // Запасной PBKDF2 на чистом JS — если сайт открыт не по HTTPS и WebCrypto недоступен
  var K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(msg) {
    var l = msg.length, n = ((l + 9 + 63) >> 6) << 6, p = new Uint8Array(n);
    p.set(msg); p[l] = 0x80;
    var bits = l * 8; p[n - 4] = bits >>> 24; p[n - 3] = bits >>> 16; p[n - 2] = bits >>> 8; p[n - 1] = bits;
    var h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
    for (var o = 0; o < n; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = (p[o + i * 4] << 24) | (p[o + i * 4 + 1] << 16) | (p[o + i * 4 + 2] << 8) | p[o + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var a = w[i - 15], b = w[i - 2];
        w[i] = (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 16] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)) + w[i - 7];
      }
      var A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], G = h[6], H = h[7];
      for (i = 0; i < 64; i++) {
        var t1 = (H + (((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7))) + ((E & F) ^ (~E & G)) + K[i] + w[i]) >>> 0;
        var t2 = ((((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10))) + ((A & B) ^ (A & C) ^ (B & C))) >>> 0;
        H = G; G = F; F = E; E = (D + t1) >>> 0; D = C; C = B; B = A; A = (t1 + t2) >>> 0;
      }
      h[0] += A; h[1] += B; h[2] += C; h[3] += D; h[4] += E; h[5] += F; h[6] += G; h[7] += H;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[i * 4] = h[i] >>> 24; out[i * 4 + 1] = h[i] >>> 16; out[i * 4 + 2] = h[i] >>> 8; out[i * 4 + 3] = h[i]; }
    return out;
  }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    var ip = new Uint8Array(64 + msg.length), op = new Uint8Array(96);
    for (var i = 0; i < 64; i++) { var k = key[i] || 0; ip[i] = k ^ 0x36; op[i] = k ^ 0x5c; }
    ip.set(msg, 64); op.set(sha256(ip), 64);
    return sha256(op);
  }
  function pbkdf2(pass, salt, iters) {
    var s = new Uint8Array(salt.length + 4); s.set(salt); s[salt.length + 3] = 1;
    var u = hmac(pass, s), t = u.slice();
    for (var i = 1; i < iters; i++) { u = hmac(pass, u); for (var j = 0; j < 32; j++) t[j] ^= u[j]; }
    return t;
  }

  var fails = 0, blockedUntil = 0;
  function redeem(raw) {
    if (now() < blockedUntil) return Promise.resolve({ ok: false, msg: 'Слишком много попыток. Подождите ' + Math.ceil((blockedUntil - now()) / 1000) + ' сек.' });
    sync();   // вдруг код уже ввели в другой вкладке
    var code = normalize(raw);
    if (!code) return Promise.resolve({ ok: false, msg: 'Код выглядит так: AUTOR-XXXX-XXXX-XXXX' });
    return kdf(code).then(function (h) {
      var type = CFG.codes[h];
      if (!type) {
        return remoteRedeem(code, h).then(function (remote) {
          if (remote && remote.valid) {
            var applied = applyType(remote.type, h);
            if (applied && applied.ok) remoteConsume(code);
            return applied;
          }
          fails++;
          if (fails >= 5) { blockedUntil = now() + 30000; fails = 0; }
          return { ok: false, msg: (remote && remote.msg) || 'Такого промокода нет. Проверьте, нет ли опечатки.' };
        });
      }
      return applyType(type, h);
    });
  }

  // Код, выданный в админке, проверяется на сервере AutoR (одноразовый, общий для всех устройств).
  function remoteConsume(code) {
    if (typeof fetch !== 'function') return;
    fetch('/api/promo/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: rawCode(code) })
    }).catch(function () {});
  }

  function remoteRedeem(code, h) {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return fetch('/api/promo/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: rawCode(code) })
    }).then(function (res) { return res.json(); }).catch(function () { return null; });
  }

  function rawCode(code) {
    var digits = String(code || '').replace(/[^0-9A-Z]/g, '');
    return 'AUTOR-' + digits.slice(0, 4) + '-' + digits.slice(4, 8) + '-' + digits.slice(8, 12);
  }

  function applyType(type, h) {
    fails = 0;
      if (st.used.indexOf(h) >= 0) return { ok: false, msg: 'Этот промокод уже активирован на этом устройстве.' };
      if (type !== 'access' && !st.access) return { ok: false, msg: 'Это код подписки. Сначала откройте доступ промокодом доступа.' };
      var t = now();
      if (type === 'access') { st.access = true; st.maxUntil = Math.max(t, st.maxUntil) + MONTH_MS; }
      if (type === 'vip') st.vipUntil = Math.max(t, st.vipUntil) + MONTH_MS;
      if (type === 'max') st.maxUntil = Math.max(t, st.maxUntil) + MONTH_MS;
      st.used.push(h);
      save();
      setTimeout(notify, 0);
      var msg = type === 'access' ? 'Доступ открыт навсегда. MAXIMUM в подарок — до ' + fmtDate(st.maxUntil) + '.'
        : type === 'vip' ? 'VIP продлён до ' + fmtDate(st.vipUntil) + '.' : 'MAXIMUM включён до ' + fmtDate(st.maxUntil) + '.';
    return { ok: true, msg: msg, type: type, until: fmtDate(type === 'vip' ? st.vipUntil : st.maxUntil) };
  }

  /* ---------- тарифы ---------- */
  var ROWS = [
    ['Автоответов в месяц', '100', '2 000', 'без лимита'],
    ['Аккаунты Авито', '1', '1', 'до 5 магазинов'],
    ['Товары с автоответом', '10', '200', 'без лимита'],
    ['Сценарии (триггеры и ответы)', 'до 10', 'до 25', 'без лимита'],
    ['Тон, эмодзи, задержка, рабочие часы', '—', '✓', '✓'],
    ['Пауза бота и «Взять диалог на себя»', '✓', '✓', '✓'],
    ['Лог бота и уверенность ответа', '—', '✓', '✓'],
    ['Экспорт диалогов', '—', '✓', '✓'],
    ['Аналитика', '—', '7 и 30 дней, воронка', '+ тепловая карта, точность сценариев, экспорт'],
    ['Уведомления', 'в кабинете', '+ Telegram', '+ Email и вечерняя сводка'],
    ['Интеграции', 'Авито', '+ Telegram', '+ CRM и вебхуки'],
    ['Команда', '1 человек', '1 человек', 'до 5 менеджеров'],
    ['Поддержка', 'справка', 'чат', 'приоритет и помощь с настройкой'],
  ];
  // Карточки тарифов: для кого, цена, мощность автопилота (1–3) и главное, что входит
  var PLAN_CARDS = {
    free: { icon: 'i-user', who: 'Чтобы попробовать бота', price: '0', unit: '₽', day: 'после покупки доступа', power: 1, intro: '',
      items: ['100 автоответов в месяц', 'До 10 сценариев', '10 товаров с автоответом', 'Пауза бота и «Взять диалог на себя»', 'Уведомления в кабинете'] },
    vip: { icon: 'i-star', who: 'Для одного продавца', price: '299', unit: '₽ / мес', day: '≈ 10 ₽ в день', power: 2, intro: 'Всё из Бесплатного, плюс ещё',
      items: ['2 000 автоответов в месяц', 'До 25 сценариев', '200 товаров с автоответом', 'Тон, эмодзи, задержка, рабочие часы', 'Лог бота и уверенность ответа', 'Аналитика за 7 и 30 дней', 'Telegram-уведомления и экспорт диалогов', 'Поддержка в чате'] },
    max: { icon: 'i-zap-circle', who: 'Для магазина с командой', price: '799', unit: '₽ / мес', day: '≈ 27 ₽ в день', power: 3, intro: 'Всё из VIP, плюс ещё',
      items: ['Автоответы без лимита', 'Товары с автоответом без лимита', 'Сценарии без лимита', 'До 5 магазинов Авито в одном кабинете', 'До 5 менеджеров в команде',
        'Тепловая карта: когда пишут покупатели', 'Точность каждого сценария', 'Экспорт аналитики', 'Email-уведомления', 'Вечерняя сводка за день',
        'Интеграция с CRM', 'Вебхуки для своих систем', 'Приоритетная поддержка', 'Помощь с настройкой бота'] },
  };

  /* ---------- замки на функциях ---------- */
  // Сколько сценариев работает на тарифе (считаются по порядку в списке)
  var RULE_LIMIT = { free: 10, vip: 25, max: Infinity };
  function ruleLimit() { return RULE_LIMIT[plan()] || RULE_LIMIT.free; }
  function overLimitCards() { return all('[data-rule-card]').slice(ruleLimit() === Infinity ? Infinity : ruleLimit()); }
  function sectionByTitle(title) {
    var out = [];
    document.querySelectorAll('.settings-section').forEach(function (s) {
      var h = s.querySelector('h2');
      if (h && h.textContent.trim().indexOf(title) === 0) out.push(s);
    });
    return out;
  }
  function route() { return (location.hash || '').replace(/^#\/?/, '').split('/')[0] || 'dashboard'; }
  // Что закрыто: [найти элементы, нужный тариф, название, как закрыть: overlay — накрыть блок, click — перехватить нажатие]
  var LOCKS = [
    [function () { return route() === 'analytics' ? [document.querySelector('#view .page') || document.querySelector('#view')] : []; }, 'vip', 'Аналитика', 'page'],
    [function () { return route() === 'analytics' ? closestAll('.heatmap', '.card, .analytics-card') : []; }, 'max', 'Тепловая карта', 'overlay'],
    [function () { return route() === 'analytics' ? closestAll('.scenario-tr', '.card, .analytics-card') : []; }, 'max', 'Точность сценариев', 'overlay'],
    [function () { return route() === 'analytics' ? all('[data-export-state]') : []; }, 'max', 'Экспорт аналитики', 'click'],
    [function () { return all('.decision-card, .bot-log'); }, 'vip', 'Лог бота и уверенность ответа', 'overlay'],
    [function () { return all('[data-export-chat]'); }, 'vip', 'Экспорт диалогов', 'click'],
    [function () { var out = []; overLimitCards().forEach(function (c) { out = out.concat(Array.prototype.slice.call(c.querySelectorAll('[data-rule-toggle], [data-rule-edit]'))); }); return out; }, 'vip', 'Больше 10 сценариев', 'click'],
    [function () { var out = []; if (plan() === 'vip') overLimitCards().forEach(function (c) { out = out.concat(Array.prototype.slice.call(c.querySelectorAll('[data-rule-toggle], [data-rule-edit]'))); }); return out; }, 'max', 'Больше 25 сценариев', 'click'],
    [function () { return [].concat(sectionByTitle('Тон общения'), sectionByTitle('Скорость и передача'), sectionByTitle('Рабочие часы')); }, 'vip', 'Тон, задержка и рабочие часы', 'overlay'],
    [function () { return all('[data-demo-toast="Telegram подключается в полной версии"]'); }, 'vip', 'Уведомления и подключение Telegram', 'click'],
    [function () { return all('[data-setting-notification="digest"]'); }, 'max', 'Email и вечерняя сводка', 'click'],
    [function () { return all('[data-demo-toast="CRM подключается в полной версии"]'); }, 'max', 'Подключение CRM', 'click'],
    [function () { return sectionByTitle('Вебхук'); }, 'max', 'Вебхуки', 'overlay'],
    [function () { return all('#workspace-btn'); }, 'max', 'Несколько магазинов', 'click'],
  ];
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function closestAll(sel, up) {
    var out = [];
    all(sel).forEach(function (el) { var c = el.closest(up); if (c && out.indexOf(c) < 0) out.push(c); });
    return out;
  }
  function needs(level) { return RANK[plan()] < RANK[level]; }

  var observer, scheduled = false;
  function applyLocks() {
    observer && observer.disconnect();
    all('.ar-overlay').forEach(function (el) { el.remove(); });
    all('[data-ar-lock]').forEach(function (el) {
      el.removeAttribute('data-ar-lock'); el.removeAttribute('data-ar-name');
      el.classList.remove('ar-locked', 'ar-locked-page', 'ar-locked-click');
    });
    if (hasAccess()) {
      LOCKS.forEach(function (l) {
        if (!needs(l[1])) return;
        l[0]().forEach(function (el) {
          if (!el) return;
          el.setAttribute('data-ar-lock', l[1]);
          el.setAttribute('data-ar-name', l[2]);
          if (l[3] === 'click') { el.classList.add('ar-locked-click'); return; }
          el.classList.add(l[3] === 'page' ? 'ar-locked-page' : 'ar-locked');
          var ov = document.createElement('div');
          ov.className = 'ar-overlay';
          ov.innerHTML = '<div class="ar-overlay__box"><span class="ar-overlay__lock">' + lockSvg() + '</span><strong></strong><span></span>' +
            '<button class="ar-btn ar-btn--sm" type="button" data-ar-upgrade></button></div>';
          ov.querySelector('strong').textContent = l[2];
          ov.querySelector('span:not(.ar-overlay__lock)').textContent = 'Доступно в ' + NAME[l[1]];
          ov.querySelector('button').textContent = 'Подключить ' + NAME[l[1]];
          ov.querySelector('button').setAttribute('data-ar-upgrade', l[1]);
          el.appendChild(ov);
        });
      });
      enforceFreeRules();
    }
    renderChrome();
    observe();
  }
  // Сценарии сверх лимита тарифа выключаются штатным переключателем приложения
  function enforceFreeRules() {
    var changed = false;
    overLimitCards().forEach(function (card) {
      var inp = card.querySelector('input[data-rule-toggle]');
      if (inp && inp.checked) {
        inp.setAttribute('data-ar-pass', '1');
        inp.click();
        inp.removeAttribute('data-ar-pass');
        changed = true;
      }
    });
    // приложение перерисовало список — замки нужно наложить заново
    if (changed) requestAnimationFrame(applyLocks);
  }
  function observe() {
    observer = observer || new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; applyLocks(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Перехват нажатий на закрытые функции: вместо действия — окно с тарифами
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-ar-pass]')) return;
    var lock = t.closest('.ar-locked-click, .ar-locked, .ar-locked-page');
    if (lock && !t.closest('.ar-overlay')) {
      e.preventDefault(); e.stopImmediatePropagation();
      upgrade(lock.getAttribute('data-ar-lock'), lock.getAttribute('data-ar-name'));
      return;
    }
    var newRule = t.closest('[data-new-rule]');
    if (newRule && hasAccess() && all('[data-rule-card]').length >= ruleLimit()) {
      e.preventDefault(); e.stopImmediatePropagation();
      upgrade(plan() === 'free' ? 'vip' : 'max', plan() === 'free' ? 'Больше 10 сценариев' : 'Больше 25 сценариев');
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    var lock = e.target.closest && e.target.closest('.ar-locked, .ar-locked-page');
    if (lock && !e.target.closest('.ar-overlay') && e.key !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  /* ---------- разметка ---------- */
  function lockSvg() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(id) { return '<svg class="icon" aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  var STEPS = [
    ['i-chat', 'Покупатель пишет', 'Вопрос приходит в чат объявления на Авито.'],
    ['i-bolt', 'Бот узнаёт тему', 'Наличие, цена, доставка, гарантия — по вашим сценариям или с ИИ.'],
    ['i-box', 'Отвечает по каталогу', 'Подставляет цену и остаток из ваших товаров за секунды.'],
    ['i-users', 'Сложное — вам', 'Если бот не уверен, диалог уходит менеджеру.'],
  ];
  var SECTIONS = [
    ['i-grid', 'Дашборд', 'Сколько ответил бот и сколько заказов принёс'],
    ['i-chat', 'Чаты', 'Все диалоги, ответы бота и «Взять диалог на себя»'],
    ['i-box', 'Товары', 'Каталог с Авито и автоответ по каждому товару'],
    ['i-zap-circle', 'Сценарии', 'Правила ответов и свои шаблоны'],
    ['i-chart', 'Аналитика', 'Воронка до заказа и время, когда пишут'],
    ['i-settings', 'Настройки', 'Тон общения, рабочие часы, уведомления'],
  ];

  function codeForm(id) {
    return '<form class="ar-code" data-ar-form hidden>' +
      '<label class="ar-code__label" for="' + id + '">Промокод</label>' +
      '<div class="ar-code__row"><input class="ar-code__input" id="' + id + '" autocomplete="off" spellcheck="false" placeholder="AUTOR-XXXX-XXXX-XXXX" maxlength="24">' +
      '<button class="ar-btn" type="submit">Активировать</button></div>' +
      '<p class="ar-code__msg" role="status" aria-live="polite"></p></form>';
  }

  var gate;
  function renderGate() {
    var expired = !st.access && st.demoStart && demoLeft() === 0;
    var shell = document.querySelector('.app-shell');
    if (hasAccess()) {
      if (gate) { gate.remove(); gate = null; }
      if (shell) shell.inert = false;
      document.documentElement.classList.remove('ar-gated');
      return;
    }
    closeModal();
    document.documentElement.classList.add('ar-gated');
    if (shell) shell.inert = true;
    if (!gate) { gate = document.createElement('div'); document.body.appendChild(gate); }
    gate.className = 'ar-gate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'ar-gate-title');
    gate.innerHTML =
      '<div class="ar-gate__card">' +
        '<header class="ar-gate__head">' +
          '<span class="ar-gate__brand"><span class="ar-gate__mark">' + icon('i-bolt') + '</span>AutoR</span>' +
          '<p class="ar-gate__eyebrow"><span class="ar-led"></span>Кабинет автоответов для Авито</p>' +
          '<h1 class="ar-gate__title" id="ar-gate-title">Бот отвечает покупателям,<br>пока вы занимаетесь магазином</h1>' +
          '<p class="ar-gate__lead">Вот как устроен AutoR и что будет у вас внутри.</p>' +
        '</header>' +
        '<div class="ar-gate__grid">' +
          '<section class="ar-gate__how" aria-label="Как это работает"><h2 class="ar-gate__h">Как это работает</h2><ol class="ar-steps">' +
            STEPS.map(function (s, i) { return '<li class="ar-step"><span class="ar-step__no">' + (i + 1) + '</span><span class="ar-step__icon">' + icon(s[0]) + '</span><span><strong>' + s[1] + '</strong><span>' + s[2] + '</span></span></li>'; }).join('') +
          '</ol></section>' +
          '<section class="ar-buy" aria-label="Доступ">' +
            (expired ? '<p class="ar-buy__expired">' + icon('i-clock') + 'Пробное время закончилось. Чтобы продолжить, откройте доступ.</p>' : '') +
            '<p class="ar-buy__price"><span>Доступ к AutoR</span><strong>999 ₽</strong><small>навсегда · разовая оплата</small></p>' +
            '<p class="ar-buy__gift">' + icon('i-sparkles') + '<span><b>MAXIMUM на 30 дней в подарок</b></span></p>' +
            '<a class="ar-btn ar-btn--buy" href="' + TG + '" target="_blank" rel="noopener">' + icon('i-send') + 'Купить доступ</a>' +
            '<p class="ar-buy__note">Оплата через менеджера в Telegram. После оплаты он пришлёт промокод.</p>' +
            '<div class="ar-buy__or"><span>или</span></div>' +
            '<div class="ar-buy__alts">' +
              '<button class="ar-alt ar-alt--code" type="button" data-ar-code-toggle aria-expanded="false">' +
                '<span class="ar-alt__icon">' + icon('i-tag') + '</span>' +
                '<span class="ar-alt__text"><strong>Ввести промокод</strong><small>Код от менеджера</small></span>' +
                '<span class="ar-alt__arrow">' + icon('i-chevron-down') + '</span></button>' +
              codeForm('ar-gate-code') +
              (expired
                ? '<button class="ar-alt ar-alt--demo is-used" type="button" disabled>' +
                    '<span class="ar-alt__icon">' + icon('i-clock') + '</span>' +
                    '<span class="ar-alt__text"><strong>Пробный доступ использован</strong><small>Продолжить можно с промокодом</small></span></button>'
                : '<button class="ar-alt ar-alt--demo" type="button" data-ar-demo>' +
                    '<span class="ar-alt__icon"><span class="ar-alt__pulse" aria-hidden="true"></span>' + icon('i-play') + '</span>' +
                    '<span class="ar-alt__text"><strong>Пробный доступ · 30 минут</strong><small>Бесплатно · все функции VIP</small></span>' +
                    '<span class="ar-alt__arrow">' + icon('i-arrow-right') + '</span></button>') +
            '</div>' +
            '<button class="ar-link" type="button" data-ar-tariffs>Подписки VIP и MAXIMUM →</button>' +
          '</section>' +
          '<section class="ar-gate__inside" aria-label="Что внутри"><h2 class="ar-gate__h">Что внутри</h2><ul class="ar-tiles">' +
            SECTIONS.map(function (s) { return '<li class="ar-tile"><span class="ar-tile__icon">' + icon(s[0]) + '</span><strong>' + s[1] + '</strong><span>' + s[2] + '</span></li>'; }).join('') +
          '</ul></section>' +
        '</div>' +
      '</div>';
    var buy = gate.querySelector('.ar-btn--buy');
    buy && buy.focus({ preventScroll: true });
  }

  /* ---------- окна: тарифы и «нужна подписка» ---------- */
  var modal;
  function closeModal() { if (modal) { modal.remove(); modal = null; } }
  function openModal(html, label, cls) {
    closeModal();
    modal = document.createElement('div');
    modal.className = 'ar-modal';
    modal.innerHTML = '<div class="ar-modal__backdrop" data-ar-close></div><div class="ar-modal__panel' + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' +
      '<button class="ar-modal__close" type="button" data-ar-close aria-label="Закрыть">' + icon('i-close') + '</button>' + html + '</div>';
    document.body.appendChild(modal);
    var f = modal.querySelector('a.ar-btn, button:not([data-ar-close]), input');
    f && f.focus({ preventScroll: true });
  }
  function link(cls, html) { return '<a class="ar-btn ' + cls + '" href="' + TG + '" target="_blank" rel="noopener">' + html + '</a>'; }
  function power(n) {
    return '<span class="ar-pc__power" role="img" aria-label="Мощность автопилота: ' + n + ' из 3">' +
      [1, 2, 3].map(function (i) { return '<i' + (i <= n ? ' class="on"' : '') + '></i>'; }).join('') + '</span>';
  }
  function perks(list) { return '<ul class="ar-pc__list">' + list.map(function (t) { return '<li>' + icon('i-check') + '<span>' + t + '</span></li>'; }).join('') + '</ul>'; }

  var RING = '<span class="ar-pc__ring" aria-hidden="true"></span>';
  function intro(info) { return info.intro ? '<p class="ar-pc__intro">' + info.intro + ' ' + info.items.length + ':</p>' : ''; }
  function planCard(c) {
    var info = PLAN_CARDS[c], p = plan(), cur = hasAccess() && c === p, lower = hasAccess() && RANK[c] < RANK[p], cta;
    if (cur) {
      cta = '<p class="ar-pc__current">' + icon('i-check-circle') + (inDemo() ? 'Пробный доступ' : 'Ваш тариф' + (until() ? ' · до ' + fmtDate(until()) : '')) + '</p>' +
        (c !== 'free' && !inDemo() ? '<a class="ar-pc__renew" href="' + TG + '" target="_blank" rel="noopener">Продлить у менеджера →</a>' : '');
    } else if (c === 'free') {
      cta = '<p class="ar-pc__current is-muted">' + (st.access ? 'Входит в доступ' : 'Откроется после покупки доступа') + '</p>';
    } else if (lower) {
      cta = '<p class="ar-pc__current is-muted">Входит в ваш тариф</p>';
    } else {
      cta = link('ar-pc__cta ' + (c === 'max' ? 'ar-btn--glow' : 'ar-btn--light'), icon(info.icon) + 'Подключить ' + NAME[c]);
    }
    return '<article class="ar-pc ar-pc--' + c + (cur ? ' is-current' : '') + '">' + (c === 'max' ? RING : '') +
      (c === 'max' ? '<span class="ar-pc__ribbon">' + icon('i-sparkles') + 'Лучший выбор</span>' : '') +
      '<div class="ar-pc__top"><span class="ar-pc__icon">' + icon(info.icon) + '</span>' + power(info.power) + '</div>' +
      '<h3 class="ar-pc__name">' + NAME[c] + '</h3><p class="ar-pc__for">' + info.who + '</p>' +
      '<p class="ar-pc__price"><strong>' + info.price + '</strong><span>' + info.unit + '</span></p><p class="ar-pc__day">' + info.day + '</p>' +
      cta +
      intro(info) + perks(info.items) +
    '</article>';
  }

  function tariffs() {
    var p = plan();
    var status = inDemo() ? 'Пробный доступ · осталось ' + fmtLeft(demoLeft())
      : !st.access ? 'Доступ ещё не открыт'
      : p === 'free' ? 'Бесплатный тариф' : NAME[p] + ' до ' + fmtDate(until());
    var gift = st.access ? '' :
      '<div class="ar-tf__access"><span class="ar-tf__gift">' + icon('i-sparkles') + '</span>' +
        '<div><strong>Сначала — доступ к AutoR за 999 ₽</strong><span>Навсегда, и сразу <b>MAXIMUM на 30 дней в подарок</b></span></div>' +
        link('ar-btn--glow', icon('i-send') + 'Купить доступ') + '</div>';
    var table = '<div class="ar-tf__scroll"><table class="ar-tf__table"><thead><tr><th scope="col">Возможность</th>' +
      ['free', 'vip', 'max'].map(function (c) { return '<th scope="col">' + NAME[c] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      ROWS.map(function (r) {
        return '<tr><th scope="row">' + r[0] + '</th>' + r.slice(1).map(function (v) { return '<td' + (v === '—' ? ' class="is-off"' : '') + '>' + v + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    openModal(
      '<header class="ar-tf__head">' +
        '<p class="ar-tf__status"><span class="ar-led' + (hasAccess() ? '' : ' is-off') + '"></span>' + esc(status) + '</p>' +
        '<h2 class="ar-tf__title">Выберите мощность <span>автопилота</span></h2>' +
        '<p class="ar-tf__lead">Подписка на 30 дней без автосписаний: оплачиваете у менеджера в Telegram, код приходит в чат и включается сразу.</p>' +
      '</header>' + gift +
      '<div class="ar-tf__plans">' + ['free', 'vip', 'max'].map(planCard).join('') + '</div>' +
      '<details class="ar-tf__compare"><summary>' + icon('i-sliders') + 'Сравнить все возможности</summary>' + table + '</details>' +
      '<footer class="ar-tf__foot"><ul class="ar-tf__trust">' +
        '<li>' + icon('i-shield') + 'Без автосписаний</li><li>' + icon('i-send') + 'Код приходит в Telegram</li><li>' + icon('i-bolt') + 'Включается сразу</li>' +
      '</ul><button class="ar-btn ar-btn--ghost" type="button" data-ar-code-toggle>' + icon('i-tag') + 'Ввести промокод</button></footer>' +
      codeForm('ar-modal-code'), 'Тарифы', 'ar-modal__panel--dark ar-modal__panel--tf');
  }

  function upgrade(level, name) {
    var info = PLAN_CARDS[level];
    var cta = !st.access && !inDemo() ? link('ar-btn--glow ar-btn--block', icon('i-send') + 'Купить доступ — 999 ₽')
      : link((level === 'max' ? 'ar-btn--glow' : 'ar-btn--light') + ' ar-btn--block', icon(info.icon) + 'Подключить ' + NAME[level] + ' — ' + info.price + ' ₽/мес');
    openModal(
      '<div class="ar-up__head"><span class="ar-up__lock">' + lockSvg() + '</span><div>' +
        '<p class="ar-tf__status">Входит в тариф ' + NAME[level] + '</p>' +
        '<h2 class="ar-up__title">' + esc(name || 'Эта функция') + '</h2></div></div>' +
      (inDemo() ? '<p class="ar-up__note">В пробном доступе открыты функции VIP, а эта — из ' + NAME[level] + '.</p>' : '') +
      '<div class="ar-up__plan ar-pc ar-pc--' + level + '">' + (level === 'max' ? RING : '') +
        '<div class="ar-up__plan-head"><span class="ar-pc__icon">' + icon(info.icon) + '</span><div><strong>' + NAME[level] + '</strong><span>' + info.who + '</span></div>' +
          '<p class="ar-pc__price"><strong>' + info.price + '</strong><span>' + info.unit + '</span></p></div>' +
        intro(info) + perks(info.items.slice(0, 4)) +
        (info.items.length > 4 ? '<p class="ar-up__more">+ ещё ' + (info.items.length - 4) + ' — в окне «Все тарифы»</p>' : '') + cta +
      '</div>' +
      '<div class="ar-up__actions"><button class="ar-btn ar-btn--ghost" type="button" data-ar-code-toggle>' + icon('i-tag') + 'Ввести код</button>' +
        '<button class="ar-btn ar-btn--ghost" type="button" data-ar-tariffs>' + icon('i-sliders') + 'Все тарифы</button></div>' +
      codeForm('ar-up-code'), 'Нужна подписка', 'ar-modal__panel--dark ar-modal__panel--up');
  }

  /* ---------- шапка и меню: тариф и таймер пробного доступа ---------- */
  function renderChrome() {
    var p = plan();
    var label = inDemo() ? 'Пробный · ' + fmtLeft(demoLeft()) : !st.access ? 'Нет доступа' : p === 'free' ? 'Бесплатный · улучшить' : NAME[p] + ' · до ' + fmtDate(until());
    var actions = document.querySelector('.topbar-actions');
    if (actions) {
      var chip = actions.querySelector('.ar-chip');
      if (!chip) {
        chip = document.createElement('button');
        chip.type = 'button';
        chip.setAttribute('data-ar-tariffs', '');
        actions.insertBefore(chip, actions.firstChild);
      }
      chip.className = 'ar-chip ar-chip--' + (inDemo() ? 'demo' : p);
      if (chip.textContent !== label) chip.innerHTML = '<span class="ar-led"></span>' + esc(label);
    }
    var nav = document.querySelector('.side-nav');
    if (nav && !nav.querySelector('[data-ar-nav]')) {
      var a = document.createElement('a');
      a.className = 'nav-item';
      a.href = '#';
      a.setAttribute('data-ar-tariffs', '');
      a.setAttribute('data-ar-nav', '');
      a.innerHTML = icon('i-star') + '<span>Тариф</span><span class="nav-count soft" data-ar-nav-plan></span>';
      nav.appendChild(a);
    }
    var np = document.querySelector('[data-ar-nav-plan]');
    var short = inDemo() ? 'PRO' : p === 'max' ? 'MAX' : p === 'vip' ? 'VIP' : 'FREE';
    if (np && np.textContent !== short) np.textContent = short;
    var sub = document.querySelector('.side-profile-text span');
    var subText = 'Владелец · ' + (inDemo() ? 'Пробный доступ' : NAME[p]);
    if (sub && sub.textContent !== subText) sub.textContent = subText;
  }

  /* ---------- действия ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-ar-close]')) { closeModal(); return; }
    if (t.closest('[data-ar-tariffs]')) { e.preventDefault(); tariffs(); return; }
    var up = t.closest('[data-ar-upgrade]');
    if (up) { e.preventDefault(); e.stopPropagation(); upgrade(up.getAttribute('data-ar-upgrade'), up.closest('.ar-overlay__box').querySelector('strong').textContent); return; }
    var tg = t.closest('[data-ar-code-toggle]');
    if (tg) {
      var form = (tg.closest('.ar-modal__panel, .ar-buy') || document).querySelector('[data-ar-form]');
      if (form) {
        form.hidden = !form.hidden;
        tg.setAttribute('aria-expanded', String(!form.hidden));
        if (!form.hidden) form.querySelector('input').focus();
      }
      return;
    }
    if (t.closest('[data-ar-demo]')) {
      if (!st.demoStart) { st.demoStart = now(); save(); }
      update();
    }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-ar-form]');
    if (!form) return;
    e.preventDefault();
    var msg = form.querySelector('.ar-code__msg'), btn = form.querySelector('button'), from = modal;
    msg.className = 'ar-code__msg'; msg.textContent = 'Проверяем…'; btn.disabled = true;
    redeem(form.querySelector('input').value).then(function (r) {
      btn.disabled = false;
      msg.className = 'ar-code__msg ' + (r.ok ? 'is-ok' : 'is-err');
      msg.textContent = r.msg;
      if (r.ok) {
        celebrate(r);
        // закрываем только то окно, в котором вводили код
        setTimeout(function () { if (from && modal === from) closeModal(); update(); }, 900);
      }
    });
  });

  /* ---------- праздник: промокод активирован ---------- */
  function celebrate(r) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var old = document.querySelector('.ar-win');
    if (old) old.remove();
    var TEXT = {
      access: ['Доступ открыт!', 'AutoR ваш навсегда, а MAXIMUM — в подарок до ' + r.until + '.', ['Навсегда', 'MAXIMUM 30 дней', 'Все функции открыты']],
      vip: ['VIP подключён!', 'Всё из VIP работает до ' + r.until + '.', ['До 25 сценариев', 'Аналитика', 'Telegram-уведомления']],
      max: ['MAXIMUM подключён!', 'Без лимитов до ' + r.until + '.', ['Без лимитов', 'ИИ без ограничений', 'Команда и CRM']]
    };
    var t = TEXT[r.type] || TEXT.access;
    var conf = '';
    if (!reduce) {
      var colors = ['#FFC21A', '#FFE08A', '#F07B3F', '#3FDB80', '#FFFEFB', '#9B8AFB'];
      for (var i = 0; i < 90; i++) {
        var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 300;
        conf += '<i style="--x:' + Math.round(Math.cos(a) * d) + 'px;--y:' + Math.round(Math.sin(a) * d * 0.7 - 70) + 'px;--fall:' +
          Math.round(200 + Math.random() * 260) + 'px;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;--d:' + (Math.random() * 0.18).toFixed(2) +
          's;--c:' + colors[i % colors.length] + ';--w:' + Math.round(6 + Math.random() * 6) + 'px"></i>';
      }
    }
    var el = document.createElement('div');
    el.className = 'ar-win';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ar-win-title');
    el.innerHTML = '<div class="ar-win__confetti" aria-hidden="true">' + conf + '</div>' +
      '<div class="ar-win__card">' +
        '<div class="ar-win__badge" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>' +
        '<p class="ar-win__eyebrow">Промокод активирован</p>' +
        '<h2 class="ar-win__title" id="ar-win-title">' + esc(t[0]) + '</h2>' +
        '<p class="ar-win__text">' + esc(t[1]) + '</p>' +
        '<div class="ar-win__chips">' + t[2].map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
        '<button class="ar-btn ar-btn--glow ar-win__go" type="button" data-ar-win-close>Поехали ' + icon('i-arrow-right') + '</button>' +
      '</div>';
    document.body.appendChild(el);
    var timer = setTimeout(close, 5000);
    function close() {
      clearTimeout(timer);
      if (!el.isConnected || el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 280);
    }
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-ar-win-close]')) close(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); } });
    setTimeout(function () { var go = el.querySelector('[data-ar-win-close]'); if (go) go.focus({ preventScroll: true }); }, 350);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal) closeModal(); });

  // Для модуля доработок (путь покупателя, лимиты ИИ): только чтение состояния и открытие окон
  function notify() { document.dispatchEvent(new CustomEvent('autor:billing')); }

  /* ---------- коды из админки ---------- */

  window.AutoRBilling = {
    plan: plan, inDemo: inDemo, hasAccess: hasAccess,
    access: function () { return !!st.access; },
    demoStarted: function () { return !!st.demoStart; },
    subscribed: function () { return st.used.some(function (h) { var t = CFG.codes[h]; return t === 'vip' || t === 'max'; }); },
    tariffs: function () { tariffs(); },
    upgrade: function (level, name) { upgrade(level, name); },
    tg: TG
  };

  var lastState = '';
  function update() {
    var key = hasAccess() + '|' + plan() + '|' + (st.demoStart && !st.access ? demoLeft() > 0 : '');
    if (key !== lastState) { lastState = key; renderGate(); applyLocks(); notify(); return; }
    // таймер пробного доступа тикает каждую секунду — без пересборки замков, чтобы ничего не мерцало
    observer && observer.disconnect();
    renderChrome();
    observe();
  }

  update();
  setInterval(update, 1000);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('storage', function (e) { if (e.key === KEY) { sync(); update(); } });
  window.addEventListener('hashchange', function () { setTimeout(applyLocks, 0); });
})();
