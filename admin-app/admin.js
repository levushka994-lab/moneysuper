/* AutoR Admin — отдельное приложение админки (admin.site-port.ru).
   Состояние — localStorage этого домена, ключ autor.admin.v1. */

(function () {
  "use strict";

  var KEY = "autor.admin.v1";

  var ROLES = {
    owner: "Владелец",
    manager: "Менеджер",
    support: "Поддержка"
  };
  var PLANS = { free: "FREE", vip: "VIP", max: "MAXIMUM", pro: "PRO" };
  var STATUS = {
    active: "работает",
    invited: "приглашён",
    off: "доступ закрыт"
  };
  var PROMO_TYPES = {
    access: "Доступ навсегда",
    vip: "VIP на месяц",
    max: "MAXIMUM на месяц"
  };
  var ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

  /* ── Состояние ───────────────────────────────────────── */

  function seed() {
    return {
      users: [
        { id: "u1", name: "Лев Барбер", email: "lev@uyut-stroy.ru", role: "owner", plan: "pro", status: "active", lastAt: "сегодня, 10:12" },
        { id: "u2", name: "Анна Смирнова", email: "anna@uyut-stroy.ru", role: "manager", plan: "pro", status: "invited", lastAt: "—" }
      ],
      codes: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return seed();
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.codes)) return seed();
      return data;
    } catch (err) {
      return seed();
    }
  }

  var state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      toast("Не удалось сохранить", "Браузер не разрешил запись в localStorage.");
    }
  }

  /* ── Утилиты ─────────────────────────────────────────── */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); }).join("");
  }

  function today() {
    var d = new Date();
    var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    return d.getDate() + " " + months[d.getMonth()];
  }

  function toast(title, text) {
    var box = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<b>" + esc(title) + "</b>" + (text ? "<span>" + esc(text) + "</span>" : "");
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  function randomCode() {
    var out = [];
    var bytes = new Uint8Array(12);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
    for (var i = 0; i < 12; i += 1) out.push(ALPHA.charAt(bytes[i] % ALPHA.length));
    return "AUTOR-" + out.slice(0, 4).join("") + "-" + out.slice(4, 8).join("") + "-" + out.slice(8, 12).join("");
  }

  /* Хеш тот же, что проверяет окно доступа на сайте:
     PBKDF2-SHA256, соль 139876865a93cdbd44b8c92a8e8211f1, 150000 итераций, 256 бит, hex. */
  var SALT_HEX = "139876865a93cdbd44b8c92a8e8211f1";
  var ITERATIONS = 150000;

  function hex(bytes) {
    return Array.prototype.map.call(new Uint8Array(bytes), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function sha256(bytes) {
    if (window.crypto && crypto.subtle) return crypto.subtle.digest("SHA-256", bytes);
    return Promise.reject(new Error("no subtle"));
  }

  function hmac(key, data) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("no subtle"));
    return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign("HMAC", k, data); });
  }

  function unhex(str) {
    var out = new Uint8Array(str.length / 2);
    for (var i = 0; i < out.length; i += 1) out[i] = parseInt(str.substr(i * 2, 2), 16);
    return out;
  }

  function pbkdf2(code) {
    var salt = unhex(SALT_HEX);
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"])
        .then(function (k) {
          return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: ITERATIONS }, k, 256);
        })
        .then(hex);
    }
    return Promise.reject(new Error("no subtle"));
  }

  /* ── Вкладки ─────────────────────────────────────────── */

  var tab = "users";

  $("#tabs").addEventListener("click", function (event) {
    var button = event.target.closest("[data-tab]");
    if (!button) return;
    tab = button.dataset.tab;
    render();
  });

  /* ── Рендер ──────────────────────────────────────────── */

  function render() {
    $$("#tabs .tab").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    });
    $("#users-count").textContent = state.users.length;
    $("#promos-count").textContent = state.codes.length;
    $("#view").innerHTML = tab === "users" ? usersMarkup() : promosMarkup();
  }

  function usersMarkup() {
    var active = state.users.filter(function (u) { return u.status === "active"; }).length;
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1>Пользователи</h1>' +
          '<p>Кто работает в кабинете магазина: ведёт диалоги, меняет товары и настройки бота.</p>' +
        '</div>' +
        '<div class="page-actions">' +
          '<button class="btn btn-primary" type="button" data-invite>Пригласить</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head">' +
          '<div><h2>' + state.users.length + ' человек</h2><p>' + active + ' с открытым доступом.</p></div>' +
        '</div>' +
        '<div class="rows">' +
          '<div class="row row--users row--head">' +
            '<span></span><span>Кто</span><span>Роль</span><span>Тариф</span><span>Статус</span><span></span>' +
          '</div>' +
          state.users.map(userRow).join("") +
        '</div>' +
      '</div>';
  }

  function userRow(user) {
    var canDelete = state.users.length > 1;
    return '' +
      '<div class="row row--users" data-user="' + esc(user.id) + '">' +
        '<span class="ava">' + esc(initials(user.name)) + '</span>' +
        '<span class="who-cell"><strong>' + esc(user.name) + '</strong><span>' + esc(user.email) + '</span></span>' +
        '<span class="cell">' + esc(ROLES[user.role] || user.role) + '</span>' +
        '<span class="plan">' + esc(PLANS[user.plan] || user.plan) + '</span>' +
        '<span class="status status--' + esc(user.status) + '">' + esc(STATUS[user.status] || user.status) + '</span>' +
        '<span class="actions">' +
          '<button class="icon-btn" type="button" data-toggle="' + esc(user.id) + '" title="' +
            (user.status === "off" ? "Открыть доступ" : "Закрыть доступ") + '">' +
            '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/></svg>' +
          '</button>' +
          (canDelete
            ? '<button class="icon-btn icon-btn--danger" type="button" data-remove="' + esc(user.id) + '" title="Удалить">' +
              '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>'
            : '') +
        '</span>' +
      '</div>';
  }

  function promosMarkup() {
    var totals = { access: 0, vip: 0, max: 0 };
    state.codes.forEach(function (code) { totals[code.type] = (totals[code.type] || 0) + 1; });
    return '' +
      '<div class="page-head">' +
        '<div>' +
          '<h1>Промокоды</h1>' +
          '<p>Коды на доступ к кабинету. Каждый работает один раз, привязан к своему уровню.</p>' +
        '</div>' +
        '<div class="page-actions totals">' +
          '<span class="pill">доступ <b>' + totals.access + '</b></span>' +
          '<span class="pill">VIP <b>' + totals.vip + '</b></span>' +
          '<span class="pill">MAXIMUM <b>' + totals.max + '</b></span>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<form class="promo-form" id="promo-form">' +
          '<label class="field"><span>Что даёт код</span>' +
            '<select name="type">' +
              Object.keys(PROMO_TYPES).map(function (key) {
                return '<option value="' + key + '">' + esc(PROMO_TYPES[key]) + '</option>';
              }).join("") +
            '</select>' +
          '</label>' +
          '<label class="field"><span>Сколько</span>' +
            '<input type="text" inputmode="numeric" name="count" value="1" />' +
          '</label>' +
          '<button class="btn btn-primary" type="submit">Создать</button>' +
        '</form>' +
        '<p class="hint">Код передаётся покупателю после оплаты. В окне доступа его вводят в поле «Ввести промокод».</p>' +
        (state.codes.length
          ? '<div class="rows">' +
              '<div class="row row--promos row--head"><span>Код</span><span>Что даёт</span><span>Создан</span><span></span></div>' +
              state.codes.slice().reverse().map(promoRow).join("") +
            '</div>'
          : '<p class="empty">Пока ни одного кода. Первый появится сразу после «Создать».</p>') +
      '</div>';
  }

  function promoRow(code) {
    return '' +
      '<div class="row row--promos" data-code="' + esc(code.code) + '">' +
        '<span class="code">' + esc(code.code) + '</span>' +
        '<span class="cell">' + esc(PROMO_TYPES[code.type] || code.type) + '</span>' +
        '<span class="cell">' + esc(code.at) + '</span>' +
        '<span class="actions">' +
          '<button class="icon-btn" type="button" data-copy="' + esc(code.code) + '" title="Скопировать">' +
            '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a1 1 0 0 0-1 1v9"/></svg>' +
          '</button>' +
          '<button class="icon-btn icon-btn--danger" type="button" data-revoke="' + esc(code.code) + '" title="Отозвать">' +
            '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
          '</button>' +
        '</span>' +
      '</div>';
  }

  /* ── Действия ────────────────────────────────────────── */

  $("#view").addEventListener("click", function (event) {
    var invite = event.target.closest("[data-invite]");
    if (invite) { openInvite(); return; }

    var toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      var user = state.users.find(function (u) { return u.id === toggle.dataset.toggle; });
      if (!user) return;
      user.status = user.status === "off" ? "active" : "off";
      save(); render();
      toast(user.status === "off" ? "Доступ закрыт" : "Доступ открыт", user.name);
      return;
    }

    var remove = event.target.closest("[data-remove]");
    if (remove) {
      var victim = state.users.find(function (u) { return u.id === remove.dataset.remove; });
      if (!victim) return;
      state.users = state.users.filter(function (u) { return u.id !== victim.id; });
      save(); render();
      toast("Пользователь удалён", victim.name + " больше не входит в кабинет.");
      return;
    }

    var copy = event.target.closest("[data-copy]");
    if (copy) {
      var code = copy.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject())
        .then(function () { toast("Код скопирован", code); })
        .catch(function () { toast("Код готов", code); });
      return;
    }

    var revoke = event.target.closest("[data-revoke]");
    if (revoke) {
      var target = revoke.dataset.revoke;
      state.codes = state.codes.filter(function (c) { return c.code !== target; });
      save(); render();
      toast("Код отозван", target);
    }
  });

  $("#view").addEventListener("submit", function (event) {
    if (event.target.id !== "promo-form") return;
    event.preventDefault();
    var form = event.target;
    var type = form.querySelector("[name='type']").value;
    var count = Math.max(1, Math.min(10, parseInt(form.querySelector("[name='count']").value, 10) || 1));
    var made = [];
    for (var i = 0; i < count; i += 1) {
      var code = randomCode();
      made.push({ code: code, type: type, at: today() });
      state.codes.push(made[made.length - 1]);
    }
    save(); render();
    toast(count > 1 ? "Промокоды созданы" : "Промокод создан", made.map(function (c) { return c.code; }).join(", "));
  });

  /* ── Модалка приглашения ─────────────────────────────── */

  function openModal(title, body, onMount) {
    var modal = $("#modal");
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    modal.hidden = false;
    if (onMount) onMount(modal);
  }

  function closeModal() {
    $("#modal").hidden = true;
    $("#modal-body").innerHTML = "";
  }

  $("#modal").addEventListener("click", function (event) {
    if (event.target === $("#modal") || event.target.closest("[data-modal-close]")) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !$("#modal").hidden) closeModal();
  });

  function openInvite() {
    openModal("Пригласить в кабинет", '' +
      '<form id="invite-form">' +
        '<label class="field"><span>Имя</span><input type="text" name="name" placeholder="Например, Пётр Соколов" required /></label>' +
        '<label class="field"><span>Почта</span><input type="email" name="email" placeholder="name@shop.ru" required /></label>' +
        '<label class="field"><span>Роль</span><select name="role">' +
          '<option value="manager">Менеджер — ведёт диалоги</option>' +
          '<option value="support">Поддержка — смотрит переписки</option>' +
          '<option value="owner">Владелец — полный доступ</option>' +
        '</select></label>' +
        '<div class="modal-foot">' +
          '<button class="btn btn-white" type="button" data-modal-close>Отмена</button>' +
          '<button class="btn btn-primary" type="submit">Пригласить</button>' +
        '</div>' +
      '</form>', function (modal) {
        var form = modal.querySelector("#invite-form");
        form.querySelector("[name='name']").focus();
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var name = form.querySelector("[name='name']").value.trim();
          var email = form.querySelector("[name='email']").value.trim();
          if (!name || !email) return;
          state.users.push({
            id: "u" + Date.now().toString(36),
            name: name,
            email: email,
            role: form.querySelector("[name='role']").value,
            plan: "pro",
            status: "invited",
            lastAt: "—"
          });
          save(); closeModal(); render();
          toast("Приглашение добавлено", name + " ждёт первого входа.");
        });
      });
  }

  /* ── Старт ───────────────────────────────────────────── */

  render();
})();
