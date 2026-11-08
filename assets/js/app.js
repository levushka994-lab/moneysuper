/* ==========================================================================
   AutoR — demo application
   Static, dependency-free prototype. All data is fictional and lives locally.
   ========================================================================== */

(function () {
  "use strict";

  const SEED = window.AUTOR_SEED;
  const STORE_KEY = "autor.demo.state.v" + SEED.version;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  let state = loadState();
  const ui = {
    page: "dashboard",
    activeChatId: "c1",
    chatFilter: "all",
    chatSearch: "",
    composerMode: "buyer",
    viewAs: "shop",
    auditMonth: false,
    composerModeChat: null,
    catalogKind: "all",
    catalogCategory: "Все",
    catalogSearch: "",
    dashboardPeriod: "week",
    analyticsPeriod: "week",
    settingsTab: "profile",
    mobileConversation: false,
    notificationsRead: false,
    pending: new Set(),
    pendingProduct: null,
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.prototype.slice.call((root || document).querySelectorAll(selector));

  const view = $("#view");
  const iconSprite = (name, cls) =>
    `<svg class="icon${cls ? " " + cls : ""}" aria-hidden="true"><use href="#${name}"/></svg>`;

  const PAGE_META = {
    dashboard: { title: "Дашборд", nav: "dashboard" },
    chats: { title: "Чаты", nav: "chats" },
    catalog: { title: "Товары", nav: "catalog" },
    rules: { title: "Инструкции ИИ", nav: "rules" },
    analysis: { title: "Анализ диалогов", nav: "analysis" },
    analytics: { title: "Аналитика", nav: "analytics" },
    settings: { title: "Настройки", nav: "settings" },
  };

  /* ========================================================================
     Utilities
     ======================================================================== */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SEED.version) return parsed;
      }
    } catch (error) {
      /* localStorage can be unavailable — the demo still works in memory. */
    }
    return clone(SEED);
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (error) {
      /* no-op */
    }
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const numberFmt = new Intl.NumberFormat("ru-RU");
  const formatNumber = (n) => numberFmt.format(n);
  const formatPrice = (n) => `${numberFmt.format(n)} ₽`;

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function nextChatTime(chat) {
    let latest = -1;
    chat.messages.forEach((message) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(message.time || "");
      if (!match) return;
      latest = Math.max(latest, Number(match[1]) * 60 + Number(match[2]));
    });
    if (latest < 0) return nowTime();
    const next = (latest + 1) % (24 * 60);
    return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
  }

  function todayLabel() {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const text = formatter.format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Доброй ночи";
    if (hour < 12) return "Доброе утро";
    if (hour < 18) return "Добрый день";
    return "Добрый вечер";
  }

  function truncate(value, max) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getChat(id) {
    return state.chats.find((chat) => chat.id === id);
  }

  function getProduct(id) {
    return state.products.find((product) => product.id === id);
  }

  function getRule(id) {
    return state.rules.find((rule) => rule.id === id);
  }

  function chatProduct(chat) {
    return (chat && getProduct(chat.productId)) || state.products[0] || SAMPLE_PRODUCT;
  }

  function lastMessage(chat) {
    return chat.messages[chat.messages.length - 1] || { text: "Нет сообщений", from: "system", time: "" };
  }

  function buyerFirstName(chat) {
    return chat.buyer.name.split(" ")[0];
  }

  function avatar(src, name, extraClass) {
    const initials = String(name || "")
      .split(" ")
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
    return `<span class="avatar${extraClass ? " " + extraClass : ""}">${
      src ? `<img src="${esc(src)}" alt="${esc(name)}" loading="lazy"/>` : esc(initials)
    }</span>`;
  }

  function productThumb(product) {
    if (product && product.image) {
      return `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy"/>`;
    }
    const glyph = product && product.kind === "good" ? "i-box" : "i-bolt";
    return `<div class="product-thumb-placeholder is-${product && product.kind === "good" ? "good" : "service"}">${iconSprite(glyph)}</div>`;
  }

  function statusBadge(chat) {
    if (chat.botPaused) return `<span class="badge badge-amber">На паузе</span>`;
    if (chat.handoff) return `<span class="badge badge-amber">Нужен менеджер</span>`;
    return `<span class="badge badge-green">Автоответ</span>`;
  }

  const FEED_TONES = {
    handoff: "amber",
    photo: "violet",
    sync: "green",
    answer: "",
  };

  /* ========================================================================
     Global shell
     ======================================================================== */

  function isMobileChats() {
    return window.matchMedia("(max-width: 820px)").matches;
  }

  function updateGlobalBadges() {
    const unread = state.chats.reduce((sum, chat) => sum + (chat.unread || 0), 0);
    const chatCount = $("#nav-chat-count");
    if (chatCount) {
      chatCount.textContent = unread;
      chatCount.hidden = unread === 0;
    }
    const enabledRules = state.rules.filter((rule) => rule.enabled).length;
    const rulesCount = $("#nav-rules-count");
    if (rulesCount) rulesCount.textContent = enabledRules;

    const dot = $("#notification-dot");
    if (dot) dot.hidden = ui.notificationsRead;
  }

  function syncShell() {
    const workspaceName = $(".workspace-text strong");
    const workspaceSub = $(".workspace-text span");
    if (workspaceName) workspaceName.textContent = state.shop.name;
    if (workspaceSub) workspaceSub.textContent = state.shop.tagline;
    const sidebarName = $(".side-profile-text strong");
    if (sidebarName) sidebarName.textContent = state.shop.owner || "Ваш профиль";
    const crumbRoot = $(".breadcrumb-root");
    if (crumbRoot) crumbRoot.textContent = state.shop.name;
    const wsLogo = $(".workspace-logo");
    if (wsLogo) wsLogo.textContent = (state.shop.name || "М").charAt(0).toUpperCase();
    const topbarName = $(".topbar-user-name");
    if (topbarName) topbarName.textContent = (state.shop.owner || "Профиль").split(" ")[0];
  }

  function setActiveNav(page) {
    $$(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.getAttribute("data-nav") === page);
    });
  }

  function updateTopbar(page) {
    const meta = PAGE_META[page] || PAGE_META.dashboard;
    const title = $("#topbar-title");
    if (title) title.textContent = meta.title;
    document.title = `${meta.title} — AutoR`;
  }

  function closeSidebar() {
    $("#sidebar")?.classList.remove("open");
    $("#sidebar-scrim")?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  }

  function openSidebar() {
    $("#sidebar")?.classList.add("open");
    $("#sidebar-scrim")?.classList.add("show");
    document.body.classList.add("sidebar-open");
  }

  function closePopovers() {
    $$(".popover").forEach((popover) => {
      popover.hidden = true;
    });
    $$("[aria-expanded='true']").forEach((button) => button.setAttribute("aria-expanded", "false"));
  }

  function renderNotifications() {
    const popover = $("#notifications-popover");
    if (!popover) return;
    popover.innerHTML = `
      <div class="popover-head">
        <strong>Уведомления</strong>
        <button type="button" data-read-notifications>Отметить прочитанными</button>
      </div>
      ${state.notifications
        .slice(0, 3)
        .map(
          (item) => `
          <div class="notification-item">
            <span class="notification-icon ${esc(item.tone)}">${iconSprite(item.icon)}</span>
            <div><p>${esc(item.text)}</p><time>${esc(item.time)}</time></div>
          </div>`
        )
        .join("")}
      <button class="popover-menu-item" type="button" data-goto-settings style="margin:5px;width:calc(100% - 10px)">
        ${iconSprite("i-sliders")} Настроить уведомления
      </button>`;
  }

  function renderUserPopover() {
    const popover = $("#user-popover");
    if (!popover) return;
    popover.innerHTML = `
      <div class="user-popover-top">
        ${avatar("data:image/webp;base64,UklGRuYIAABXRUJQVlA4INoIAAAwPACdASrwAPAAPlUqkEYjoqGhJli5OHAKiWluu7HONzUaQBuPKGXfWY9dKEHgbRgugmnRRmZmZo2HstdPAUzdu0lNKyJWTnXkaahgzjt8nlj73Cj1Fds2Q6rzeC0Ct+1KdhwU09K/tL7ueTXTPqSu7GnQ8/MVJVYIhjShYbmXvjyuJZi3sZjUJu+OJbjJpkioLUAxzilryDFz4AGEasxQQCOfzO/1CVjwT7KtGLy6720bobQTjdS6JC42FYN77jjxZfM8hT3DRdkHa6m+edPH7ba6pvnK+b+pyN00CwiEzZk+fVH3KgfUDKlamZI1jErp7j9wiB2EuthUkJxK1oF1ZePoydHz0kXa2yRZAXLRzkn7Tn05P9zUI3lEl9P5vx8KyxZLv2TcXP43N/fLCRfAMv8w9S+yHQzZcrumOUpZzDDXOA9VlB875MTR+HTBbBrg5tq0fnJFPQk5C274f5WPeuIfDipOVFvOoPoXqbehYZWmPou6gqA9NADfxocR/dBWmazDgtoKbgRuWiizLGwvdQwMJHDd09Ep9Pl8E0uPowulV8KezEDnM6OQVYmWAMG8krZZN8gRDJ642qdaYEjSqeP54T9YiFI52Gcjr35COegX1b74iulnhLJwID7r7IsQJ43IvSczfUgAAP76gZv3TVFFDqC7hyrjpbWH82eT4kz5LtEVH8/1lFbiQhotk5rOgQqLxFgAVQldyKuew2NN1rsicPGEXSeJw1Rikgzb8W+ZKFWZnVplm2m8uwC6JLl9174uqMjYRHms+jBbfEb5pQyp8stycb4bXUX4IK7tPMmdgQojVlCir9OZ3JFXZ5rolFIktZaK+zAHtgpP4N+CuwH73e/ySJUemq76nCanJ7cnCqJ3RWwmYg1sP86JBSvIndsKV6y5aKiaisspAexzbwsPLTZ50CmM2+Tt01rsOIk+Gi8lfRcBDVwb59sDvzn1yE9tb4FW+D7JT2/sGsZ/d+FhusxpdUbH/oeKqffNTxQCLA2vDRx9V2+sKqLrXf4g2HDSaz1YvmuzcgqotjeKUdAHFHgIJgBiYw/e9NrdT09ocenaK44QoXNDFJAwjLOf4by7qK7OZYIkQIkzINLszgO3kmIiVu4fdEuQ5YX5iJLXf2tSAWZh9XHpSCwBIX+yznCyLnS8IvsH+sTDsHNV4HkCx66TICGJ/sTfRRlaywTjv99TgQCn6MuZRJF4SxmZqmGLL0uK5nnjhgnOzVPVBD4yvZsC401ORVyW67fgHZOnWgqLArTKGA1Xp4deSHSLgpnIdhg/Cal+dGII9oSDoBfvM47RwFO5eT1rC12QEITzl9Q070Bx6nreJ4uD3eB8jrilzhU/cbToUFwtmt16Wd5M5x4lzp/M8bedVywP9agBBTY2pMR2451SXmXyJr3wWDMAb7yrD2z9JZyxNYodd0EIRPl6YUQ+k7D2CNWVf1kvd8pR18SdPD3OUgNNa+RTJiv+6EUTqJKIgJ8E2qkhwfmjHlLrgu1jH3IIG+NFnpHQ1ndO++SqGdaEgbGGU0V0QYsKdjZrL2/YslL1vY67ShBuPP8cNKUQ3Fr6IdezdKCEwkwdkuEBqgdRgQFmRXgs3rA/Dxnn+q25VFacrssSAqafNxVultyqshLJf5glDYxrCC2jzpNqOo6Tx32oqfl0j4ic99CQH3RHcTJvlInW+hIQ4Gp3iDFsNOS4qTgAEqqAZp2Y9VpD8K5wRkUH15P4L8ECh3QMDOU6VS0RovFXoMx17cqGU41LxCuN0uuvpLylsWT606IcoxxvBD7Y8DKQ6ddPUB1ncMouzFIKVA1CIuZpgXz1lx0tMzLCH+gd0S95t19Z7kp43zBhef0Z2TeWQOjzK22UGMjL+Y1NOsrma3y1F1Qrs4bD6xpM1OWo0U45a9OIex2mf/YMp2A4TmW7cj+Fbnbb/lxX8d5RrWy/RLCx5FiX7uKs6bclPeN6N6gENXLQ7PxPf6Dm+8UNA85+xgs7yeY1GBeNOxLpGCKRWJOl0FQCtziscq1aXOw+NQjUXDHCHs0/5qZTDri/RH/sLt47888nL26BlVfwJhajxXkqp3YW3s2lvVwNvuTKsMgq/PDFuptdrwFIJ71zbOPtbZKQKtpjLDaN36MilbqnOLo7hPFKPH3kSz+pRAg/6s0A7g69rNX+87kN5Rp21UWSUF08TXfaSAU2iplvv+Bs9F5b4R9NrbHGcc/mTa+b/NqRudQfgBF61Cy+wUeJCRvpIO/F9nyE8XzHjLw0KMiEYpR6j69+qsQ8OWjxZ17zvxWeuWgYTPToMKlPxjaKWKR3SbHZh7hVJ5woT/JJcdsNf/xK8pPJxe66qZnPtKW7I29nG+mPRohnV0ADnEvW87QLlwBi4K53LsN+YUI4CJYF5kpDiJcwyThaAzggzpc/dO3AxQCzX8xbUe9wIbrtuokmd+snrAlehz7nRS/sMEc3mFOjBddXrw3E9n1slkjIQvvZ6wTxFrYVnZReq8Zfk2buAJHezfYvtZsY92mguhWSKeSaASYPxXAGFS/OliLxj6oDkFUOFYoAiEQHH8IoGSMDRUqhbkbT2crD9gk0dCBDml3JecEnO9ZEimLXlQrXM+WA4Jz4OuXgGxz4fiPiGIFi6gtHcBvKj6wUzKn1dIeEyaaGYuaISglzaAgW124SbFS+KsC4T2qv80Z3cPc9gmQRChRnG0h9a+rbsouCEVxObK0ja/SfjDQLA4K3hhsFYOZlxvLNs+y+v+032tLosUuIevBmJ9NOGeXdDnmq0zQP0jB7Li+WtvE6uI7w2PYo1PdefP4O52Pv6vtK6vHsuUCR3YzO3iUqEiw+ibeHS5qoAYLDzs5EXjBk1ppUCe9LXB7cpnUs5vJKRiNdQKe420nj7w8OjEIMqhTK2JocDJttuIrhHTGwRdrnx3JsRAkaV1+4G652eRE/rTciMABjz1wYZ2Mr6tM0EEqZFAigWtLV7pyr9NqGqA0BGAlC1HI91xc4HRAS7y/tyu1HkKCAMtnCkVtb9do1gAAA", state.shop.owner, "avatar-sm")}
        <div><strong>${esc(state.shop.owner)}</strong><span>${esc(state.shop.email)}</span></div>
      </div>
      <button class="popover-menu-item" type="button" data-goto-settings>${iconSprite("i-settings")} Настройки <span class="shortcut">⌘ ,</span></button>
      <button class="popover-menu-item" type="button" data-open-help>${iconSprite("i-help")} Как всё устроено</button>
      <button class="popover-menu-item" type="button" data-export-state>${iconSprite("i-download")} Скачать данные</button>
      <button class="popover-menu-item danger" type="button" data-reset-demo>${iconSprite("i-trash")} Очистить кабинет</button>`;
  }

  function bindShell() {
    $("#mobile-menu")?.addEventListener("click", openSidebar);
    $("#mobile-close")?.addEventListener("click", closeSidebar);
    $("#sidebar-scrim")?.addEventListener("click", closeSidebar);
    $("#profile-btn")?.addEventListener("click", () => {
      closeSidebar();
      navigate("settings");
    });
    $("#workspace-btn")?.addEventListener("click", () => {
      toast("ВОЛЬТ · магазин", "Пока доступен один магазин.", "info");
    });

    $("#bell-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const popover = $("#notifications-popover");
      const isOpen = popover.hidden === false;
      closePopovers();
      if (!isOpen) {
        renderNotifications();
        popover.hidden = false;
        $("#bell-btn").setAttribute("aria-expanded", "true");
      }
    });

    $("#user-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const popover = $("#user-popover");
      const isOpen = popover.hidden === false;
      closePopovers();
      if (!isOpen) {
        renderUserPopover();
        popover.hidden = false;
        $("#user-btn").setAttribute("aria-expanded", "true");
      }
    });

    $("#search-trigger")?.addEventListener("click", openPalette);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".popover-wrap")) closePopovers();

      const help = event.target.closest("[data-open-help]");
      if (help) {
        closePopovers();
        openHelp();
      }

      const demoAction = event.target.closest("[data-demo-toast]");
      if (demoAction) {
        closePopovers();
        toast("Пробный доступ", demoAction.getAttribute("data-demo-toast"), "info");
      }

      const image = event.target.closest("[data-image-open]");
      if (image) {
        closePopovers();
        openImageModal(image.getAttribute("data-image-open"));
        return;
      }

      const read = event.target.closest("[data-read-notifications]");
      if (read) {
        ui.notificationsRead = true;
        updateGlobalBadges();
        renderNotifications();
        toast("Уведомления прочитаны", "Красная точка в шапке скрыта.", "success");
      }

      const settings = event.target.closest("[data-goto-settings]");
      if (settings) {
        closePopovers();
        navigate("settings");
      }

      const exportBtn = event.target.closest("[data-export-state]");
      if (exportBtn) {
        closePopovers();
        exportState();
      }

      const reset = event.target.closest("[data-reset-demo]");
      if (reset) {
        closePopovers();
        openResetModal();
      }

      const close = event.target.closest("[data-modal-close]");
      if (close) closeModal();

      if (event.target.closest(".nav-item, .side-demo-link, .brand")) closeSidebar();
    });

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.key === "Escape") {
        closePopovers();
        closeSidebar();
        if ($("#modal-root").children.length) closeModal();
      }
    });

    window.addEventListener("hashchange", () => renderRoute());
    const media = window.matchMedia("(max-width: 820px)");
    media.addEventListener("change", () => renderRoute());
    syncShell();
    updateGlobalBadges();
  }

  function navigate(path) {
    const target = "#/" + path;
    if (window.location.hash === target) {
      renderRoute();
    } else {
      window.location.hash = target;
    }
    closeSidebar();
  }

  function parseRoute() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    let page = parts[0] || "dashboard";
    if (!PAGE_META[page]) page = "dashboard";
    return { page, param: parts[1] || "", raw };
  }

  let lastRenderedPage = null;

  function renderRoute() {
    if (state.settings && state.settings.viewAs && ui.viewAs !== state.settings.viewAs && !ui.viewAsTouched) {
      ui.viewAs = state.settings.viewAs;
    }
    ui.viewAsTouched = true;
    const route = parseRoute();
    ui.page = route.page;

    if (lastRenderedPage !== route.page) {
      closeModal();
      const stack = $("#toast-stack");
      if (stack) stack.innerHTML = "";
    }
    lastRenderedPage = route.page;

    if (route.page === "chats") {
      let chat = route.param ? getChat(route.param) : null;
      if (!chat) chat = getChat(ui.activeChatId) || state.chats[0];
      if (chat) {
      ui.activeChatId = chat.id;
      if (route.param) {
        ui.mobileConversation = true;
        clearUnread(chat);
      } else if (isMobileChats()) {
        ui.mobileConversation = false;
      }
      clearUnread(ui.activeChatId);
      }
    } else {
      ui.mobileConversation = false;
    }

    updateTopbar(route.page);
    setActiveNav(PAGE_META[route.page].nav);

    const renderers = {
      dashboard: () => (state.chats.length ? renderDashboard() : renderEmptyDashboard()),
      chats: () => (state.chats.length ? renderChatsPage() : renderEmptyChats()),
      catalog: renderCatalog,
      rules: renderRules,
      analysis: renderAnalysisPage,
      analytics: renderAnalytics,
      settings: renderSettings,
    };

    view.dataset.page = route.page;
    view.innerHTML = renderers[route.page]();
    document.body.classList.toggle("is-buyer-view", route.page === "chats" && ui.viewAs === "buyer");
    view.classList.remove("view-enter");
    void view.offsetWidth;
    view.classList.add("view-enter");

    bindPage(route.page);
    updateGlobalBadges();
    document.dispatchEvent(new CustomEvent("autor:render", { detail: { page: route.page } }));

    if (route.page === "chats") {
      requestAnimationFrame(() => {
        scrollMessages(true);
        window.scrollTo({ top: 0, behavior: "auto" });
      });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    if (route.page === "catalog" && ui.pendingProduct) {
      const id = ui.pendingProduct;
      ui.pendingProduct = null;
      requestAnimationFrame(() => openProductDrawer(id));
    }
  }

  function bindPage(page) {
    if (page === "dashboard" && state.chats.length) bindDashboard();
    if (page === "chats" && state.chats.length) bindChats();
    if (page === "catalog") bindCatalog();
    if (page === "rules") bindRules();
    if (page === "analysis") bindAnalysis();
    if (page === "analytics") bindAnalytics();
    if (page === "settings") bindSettings();
  }

  /* ========================================================================
     Modal, palette, toasts
     ======================================================================== */

  let lastFocused = null;

  function openModal(content, options) {
    const opts = Object.assign({ className: "", backdropClass: "", onMount: null }, options || {});
    closeModal();
    lastFocused = document.activeElement;
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop ${opts.backdropClass}" data-backdrop>
        <div class="modal ${opts.className}" role="dialog" aria-modal="true">
          ${content}
        </div>
      </div>`;
    document.body.classList.add("no-scroll");
    const backdrop = $("[data-backdrop]", root);
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) closeModal();
    });
    requestAnimationFrame(() => {
      const focusable = $("input, textarea, select, button:not([data-modal-close])", root);
      focusable?.focus({ preventScroll: true });
      if (opts.onMount) opts.onMount($(".modal", root));
    });
  }

  function closeModal() {
    const root = $("#modal-root");
    if (!root || !root.children.length) return;
    root.innerHTML = "";
    document.body.classList.remove("no-scroll");
    if (lastFocused && document.contains(lastFocused)) {
      try {
        lastFocused.focus({ preventScroll: true });
      } catch (error) {
        /* ignore */
      }
    }
  }

  function modalHeader(title, subtitle) {
    return `<div class="modal-head">
      <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
      <button class="modal-close" type="button" data-modal-close aria-label="Закрыть">${iconSprite("i-close")}</button>
    </div>`;
  }

  function openHelp() {
    openModal(
      `${modalHeader("Как всё устроено", "Три шага — и вы увидите весь цикл автоответа.")}
      <div class="modal-body">
        <div class="help-steps">
          <div class="help-step"><span class="help-step-num">1</span><div><strong>Диалог с покупателем</strong><p>У Артёма уже идёт переписка о наушниках Sony — в ней видно, как бот отвечает и что он берёт из каталога.</p></div></div>
          <div class="help-step"><span class="help-step-num">2</span><div><strong>Спросите так, как спросил бы покупатель</strong><p>Про доставку, скидку или гарантию — можно взять готовую фразу над полем ввода или написать своими словами.</p></div></div>
          <div class="help-step"><span class="help-step-num">3</span><div><strong>Оцените ответ</strong><p>Бот подставит цену, наличие и сроки из каталога, покажет уверенность и время ответа. Спорный вопрос он передаст вам.</p></div></div>
        </div>
        <div class="help-demo-note">${iconSprite("i-info")}<div><strong>Бот отвечает сам.</strong> Он видит каталог магазина и историю диалога, подставляет наличие и цену, а спорные вопросы передаёт вам.</div></div>
      </div>
      <div class="modal-foot"><span class="foot-note">Кабинет работает с вашим каталогом</span><button class="btn btn-white btn-sm" type="button" data-modal-close>Осмотреться</button><button class="btn btn-primary btn-sm" type="button" data-open-demo-chat>${iconSprite("i-sparkles")} Открыть диалог</button></div>`,
      {
        onMount: (modal) => {
          $("[data-open-demo-chat]", modal)?.addEventListener("click", () => {
            closeModal();
            ui.composerMode = "buyer";
            navigate("chats/c1");
          });
        },
      }
    );
  }

  function openResetModal() {
    openModal(
      `${modalHeader("Очистить кабинет?", "Кабинет вернётся к чистому листу.")}
      <div class="modal-body">
        <p style="font-size:12.5px;color:var(--muted);line-height:1.6">Диалоги, товары, статистика и настройки будут удалены. Это действие нельзя отменить.</p>
      </div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button><button class="btn btn-danger btn-sm" type="button" data-confirm-reset>${iconSprite("i-refresh")} Очистить кабинет</button></div>`,
      {
        onMount: (modal) => {
          $("[data-confirm-reset]", modal)?.addEventListener("click", () => {
            try {
              localStorage.removeItem(STORE_KEY);
            } catch (error) {
              /* ignore */
            }
            window.location.hash = "#/dashboard";
            window.location.reload();
          });
        },
      }
    );
  }

  function exportState() {
    const payload = {
      exportedAt: new Date().toISOString(),
      demo: "AutoR",
      shop: state.shop,
      stats: state.stats,
      chats: state.chats,
      products: state.products,
      rules: state.rules,
      settings: state.settings,
    };
    downloadFile("autor-demo-data.json", JSON.stringify(payload, null, 2), "application/json");
    toast("Данные выгружены", "Файл autor-demo-data.json сохранён.", "success");
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function toast(title, message, type) {
    const stack = $("#toast-stack");
    if (!stack) return;
    const kind = type || "default";
    const iconName = kind === "success" ? "i-check-circle" : kind === "info" ? "i-info" : "i-sparkles";
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="toast-icon">${iconSprite(iconName)}</span><div class="toast-body"><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ""}</div><button class="toast-close" type="button" aria-label="Закрыть">${iconSprite("i-close")}</button>`;
    stack.appendChild(el);
    while (stack.children.length > 3) stack.firstElementChild.remove();
    const dismiss = () => {
      if (!el.isConnected) return;
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 230);
    };
    el.querySelector(".toast-close").addEventListener("click", dismiss);
    setTimeout(dismiss, 4200);
  }

  function paletteItems() {
    const pages = [
      { group: "Разделы", icon: "i-grid", title: "Дашборд", sub: "Сводка за сегодня", route: "dashboard" },
      { group: "Разделы", icon: "i-chat", title: "Чаты", sub: "Диалоги и автоответы", route: "chats/c1" },
      { group: "Разделы", icon: "i-box", title: "Товары", sub: "Карточки и шаблоны ответов", route: "catalog" },
      { group: "Разделы", icon: "i-bolt", title: "Инструкции ИИ", sub: "Что бот учитывает в ответах", route: "rules" },
      { group: "Разделы", icon: "i-chart", title: "Аналитика", sub: "Эффективность ответов", route: "analytics" },
      { group: "Разделы", icon: "i-settings", title: "Настройки", sub: "Магазин и автопилот", route: "settings" },
    ];
    const chats = state.chats.map((chat) => ({
      group: "Диалоги",
      icon: "i-chat",
      title: chat.buyer.name,
      sub: `${chatProduct(chat).name} · ${lastMessage(chat).text}`,
      route: `chats/${chat.id}`,
    }));
    const products = state.products.map((product) => ({
      group: "Товары",
      icon: "i-box",
      title: product.name,
      sub: `${product.category} · ${formatPrice(product.price)}`,
      productId: product.id,
    }));
    return pages.concat(chats, products);
  }

  function openPalette() {
    if ($(".palette")) return;
    closePopovers();
    const all = paletteItems();
    let active = 0;
    let filtered = all;

    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop palette-backdrop" data-backdrop>
        <div class="palette" role="dialog" aria-modal="true" aria-label="Поиск по кабинету">
          <div class="palette-search">
            ${iconSprite("i-search")}
            <input id="palette-input" type="text" placeholder="Раздел, диалог или товар…" autocomplete="off" spellcheck="false" />
            <kbd>Esc</kbd>
          </div>
          <div class="palette-results" id="palette-results"></div>
          <div class="palette-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> навигация</span>
            <span><kbd>↵</kbd> открыть</span>
            <span>Поиск</span>
          </div>
        </div>
      </div>`;
    document.body.classList.add("no-scroll");

    const input = $("#palette-input");
    const results = $("#palette-results");

    const draw = () => {
      const query = input.value.trim().toLowerCase();
      filtered = all.filter((item) => !query || `${item.title} ${item.sub || ""} ${item.group}`.toLowerCase().includes(query));
      active = Math.min(active, Math.max(filtered.length - 1, 0));
      if (!filtered.length) {
        results.innerHTML = `<div class="palette-empty">Ничего не нашлось. Попробуйте «доставка» или «Sony».</div>`;
        return;
      }
      let html = "";
      let lastGroup = "";
      filtered.forEach((item, index) => {
        if (item.group !== lastGroup) {
          html += `<div class="palette-group">${esc(item.group)}</div>`;
          lastGroup = item.group;
        }
        html += `<button class="palette-item ${index === active ? "is-active" : ""}" type="button" data-palette-index="${index}">
          <span class="palette-item-icon">${iconSprite(item.icon)}</span>
          <span class="palette-item-text"><strong>${esc(item.title)}</strong><span>${esc(item.sub || "")}</span></span>
          <span class="palette-item-shortcut">↵</span>
        </button>`;
      });
      results.innerHTML = html;
    };

    const select = (item) => {
      if (!item) return;
      closePalette();
      if (item.productId) {
        ui.pendingProduct = item.productId;
        navigate("catalog");
      } else {
        navigate(item.route);
      }
    };

    const closePalette = () => {
      root.innerHTML = "";
      document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", onKey);
      input.removeEventListener("input", onInput);
    };

    const onInput = () => {
      active = 0;
      draw();
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!filtered.length) return;
        active = (active + 1) % filtered.length;
        draw();
        $(".palette-item.is-active", results)?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!filtered.length) return;
        active = (active - 1 + filtered.length) % filtered.length;
        draw();
        $(".palette-item.is-active", results)?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        event.preventDefault();
        select(filtered[active]);
      }
    };

    const backdrop = $("[data-backdrop]", root);
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) closePalette();
    });
    results.addEventListener("mousedown", (event) => {
      const item = event.target.closest("[data-palette-index]");
      if (item) {
        event.preventDefault();
        select(filtered[Number(item.getAttribute("data-palette-index"))]);
      }
    });
    input.addEventListener("input", onInput);
    document.addEventListener("keydown", onKey);
    draw();
    input.focus();
  }

  function clearUnread(chatOrId) {
    const chat = typeof chatOrId === "string" ? getChat(chatOrId) : chatOrId;
    if (chat && chat.unread) {
      chat.unread = 0;
      saveState();
      updateGlobalBadges();
    }
  }

  /* ========================================================================
     Dashboard
     ======================================================================== */

  /* --- Чистый лист: кабинет в первый день --- */
  const SAMPLE_PRODUCT = { id: "sample", name: "Ваш товар", subtitle: "", sku: "", category: "", price: 9990, stock: 3, image: "", inquiries: 0, autoReplies: 0, auto: true, note: "" };
  const TEST_CHAT = { id: "test", productId: null, messages: [], buyer: { name: "Покупатель" } };

  function ownerGreeting() {
    return greeting() + (state.shop.owner ? ", " + esc(state.shop.owner.split(" ")[0]) : "");
  }

  function renderEmptyDashboard() {
    const steps = [
      ["i-user", "Заполните профиль", "Название магазина, город и описание — бот использует их в ответах.", "#/settings", "Настройки"],
      ["i-box", "Добавьте товары", "Бот отвечает по каждому объявлению: цена, наличие, условия.", "#/catalog", "Товары"],
      ["i-bolt", "Добавьте инструкции", "Что бот учитывает: цена за м², замер, сроки, гарантия.", "#/rules", "Инструкции ИИ"],
      ["i-sparkles", "Настройте автопилот", "Тон общения, задержка ответа и рабочие часы.", "#/settings", "Настройки"],
    ];
    return `<div class="page dashboard ar-start">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> ${esc(todayLabel())}</div>
          <h1 class="page-title">${ownerGreeting()}</h1>
          <p class="page-sub">Кабинет пока пустой — так он выглядит в первый день. Вот с чего начать.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" data-sample-load>${iconSprite("i-eye")} Показать пример магазина</button>
        </div>
      </div>
      <section class="ar-start__hero">
        <div class="ar-start__copy">
          <span class="hero-status"><span class="demo-dot"></span> Автопилот готов</span>
          <h2 class="ar-start__title">Бот готов отвечать — осталось дать ему ваши товары</h2>
          <p>Когда покупатели начнут писать, здесь появятся сообщения, ответы бота, заказы и графики.</p>
        </div>
        <div class="ar-start__stats">
          ${[["0", "сообщений сегодня"], ["0", "закрыто ботом"], ["—", "среднее время ответа"], ["0", "заказов из чатов"]]
            .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}
        </div>
      </section>
      <ol class="ar-start__steps">
        ${steps.map(([icon, title, text, href, cta], index) => `<li class="card ar-start__step">
          <span class="ar-start__no">${index + 1}</span>
          <span class="ar-start__icon">${iconSprite(icon)}</span>
          <strong>${title}</strong><p>${text}</p>
          <a class="btn btn-white btn-sm" href="${href}">${cta} ${iconSprite("i-arrow-right")}</a>
        </li>`).join("")}
      </ol>
      <section class="card ar-start__sample">
        <div><strong>Как будет выглядеть кабинет, когда бот уже работает?</strong>
          <p>Откройте пример магазина «ВОЛЬТ»: сотни сообщений, заказы из чатов, аналитика. Ваш кабинет сохранится — вернуться можно в один клик.</p></div>
        <button class="btn btn-dark" type="button" data-sample-load>${iconSprite("i-eye")} Показать пример</button>
      </section>
    </div>`;
  }

  function renderEmptyChats() {
    return `<div class="page ar-start">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> Бот на связи</div>
          <h1 class="page-title">Чаты</h1>
          <p class="page-sub">Диалогов пока нет</p>
        </div>
      </div>
      <section class="card ar-start__empty">
        <span class="ar-start__icon ar-start__icon--lg">${iconSprite("i-chat")}</span>
        <h2>Здесь появятся диалоги с покупателями</h2>
        <p>Когда покупатели напишут вам на Авито, бот ответит за несколько секунд, а сложные вопросы передаст вам.</p>
        <div class="ar-start__actions">
          <button class="btn btn-white" type="button" data-sample-load>${iconSprite("i-eye")} Пример с диалогами</button>
          <a class="btn btn-primary" href="#/rules">${iconSprite("i-bolt")} Проверить сценарии</a>
        </div>
      </section>
    </div>`;
  }

  function renderDashboard() {
    const auto = state.stats.autoReplies;
    const chat = getChat("c1") || state.chats[0];
    const product = chatProduct(chat);
    const heroIncoming = chat.messages.find((m) => m.from === "buyer") || { text: "Здравствуйте! Товар ещё есть?", time: "10:42" };
    const heroReply = chat.messages.find((m) => m.from === "bot") || { text: "Да, есть в наличии!", time: "10:43", latency: "6 сек" };
    const period = ui.dashboardPeriod === "month" ? state.month : state.week;
    const periodLabel = ui.dashboardPeriod === "month" ? "30 дней" : "7 дней";

    const kpis = [
      {
        icon: "i-chat",
        tone: "",
        value: formatNumber(state.stats.messages),
        label: "Новых сообщений",
        delta: `<span class="delta">${iconSprite("i-trend-up")} +18%</span>`,
        spark: [3, 5, 4, 7, 6, 10, 12],
        color: "#121c23",
      },
      {
        icon: "i-sparkles",
        tone: "lime",
        value: formatNumber(auto),
        label: "Закрыто ботом",
        delta: `<span class="delta neutral">${state.stats.autoShare}% от всех</span>`,
        spark: [2, 4, 3, 6, 5, 9, 11],
        color: "#b07a00",
      },
      {
        icon: "i-clock",
        tone: "amber",
        value: `${state.stats.avgResponse} <small>сек</small>`,
        label: "Среднее время ответа",
        delta: `<span class="delta">${iconSprite("i-trend-down")} −42 сек</span>`,
        spark: [18, 15, 16, 12, 11, 9, 8],
        color: "#f07b3f",
      },
      {
        icon: "i-box",
        tone: "violet",
        value: formatNumber(state.stats.orders),
        label: "Заказов из чатов",
        delta: `<span class="delta">+3 за сегодня</span>`,
        spark: [1, 2, 1, 3, 2, 4, 5],
        color: "#7a5af8",
      },
    ];

    return `<div class="page dashboard">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> ${esc(todayLabel())}</div>
          <h1 class="page-title">${ownerGreeting()}</h1>
          <p class="page-sub">Вот что бот сделал для «${esc(state.shop.name)}» сегодня, пока вы занимались магазином.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-white" href="#/analytics">${iconSprite("i-chart")} Аналитика</a>
          <a class="btn btn-primary" href="#/chats/c1">${iconSprite("i-sparkles")} Проверить автоответ</a>
        </div>
      </div>

      <section class="hero">
        <div class="hero-copy">
          <span class="hero-status"><span class="demo-dot"></span> Автопилот включён</span>
          <h2 class="hero-title">Бот уже ответил на <span class="accent">${formatNumber(auto)}</span> сообщений сегодня</h2>
          <p class="hero-text">Средняя скорость ответа — 8 секунд. Покупатели не ждут, а вы занимаетесь магазином: бот подскажет наличие, цену и доставку.</p>
          <div class="hero-actions">
            <a class="btn btn-lime" href="#/chats/c1">${iconSprite("i-chat")} Открыть диалог</a>
            <a class="btn btn-glass" href="#/rules">${iconSprite("i-bolt")} Настроить сценарии</a>
          </div>
          <div class="hero-note">${iconSprite("i-lock")} ИИ отвечает на сообщения в реальном времени</div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-chat">
            <div class="hero-chat-head">
              ${avatar(chat.buyer.avatar, chat.buyer.name)}
              <span>${esc(buyerFirstName(chat))} · ${esc(product.name)}</span>
              <span class="live-dot">онлайн</span>
            </div>
            <div class="hero-bubble in">${esc(truncate(heroIncoming.text, 84))}</div>
            <div class="hero-bubble out">
              <div class="hero-bubble-label">${iconSprite("i-sparkles")} AutoR · автоответ</div>
              ${esc(truncate(heroReply.text, 135))}
              <div class="hero-reply-meta">${iconSprite("i-check")} ${esc(heroReply.latency || "6 сек")} · уверенность 97%</div>
            </div>
            <div class="hero-typing"><i></i><i></i><i></i></div>
            <div class="hero-float-badge">
              <span class="mini-icon">${iconSprite("i-bolt")}</span>
              <div><strong>${state.stats.autoShare}% диалогов</strong><span>закрыто без менеджера</span></div>
            </div>
          </div>
        </div>
      </section>

      <div class="kpi-grid">
        ${kpis
          .map(
            (kpi) => `<article class="kpi-card">
              <div class="kpi-head">
                <span class="kpi-icon ${esc(kpi.tone)}">${iconSprite(kpi.icon)}</span>
                ${kpi.delta}
              </div>
              <div class="kpi-value">${kpi.value}</div>
              <div class="kpi-label">${esc(kpi.label)}</div>
              <div class="kpi-spark">${window.Charts.sparkline(kpi.spark, kpi.color)}</div>
            </article>`
          )
          .join("")}
      </div>

      <div class="dash-chart-grid">
        <section class="card chart-card">
          <div class="chart-head">
            <div>
              <h3 class="card-title">Активность чатов</h3>
              <p class="card-sub">Сообщения покупателей и ответы бота</p>
            </div>
            <div class="segmented" data-dash-period>
              <button class="${ui.dashboardPeriod === "week" ? "active" : ""}" type="button" data-period="week">7 дней</button>
              <button class="${ui.dashboardPeriod === "month" ? "active" : ""}" type="button" data-period="month">30 дней</button>
            </div>
          </div>
          <div class="chart-wrap">
            ${window.Charts.areaChart({
              primary: period.messages,
              secondary: period.auto,
              labels: period.labels,
              primaryLabel: "Сообщения покупателей",
            })}
          </div>
          <div class="chart-xlabels">
            ${period.labels
              .map((label, index) => `<span>${ui.dashboardPeriod === "month" && index % 3 !== 0 && index !== period.labels.length - 1 ? "" : esc(label)}</span>`)
              .join("")}
          </div>
          <div class="chart-legend">
            <span><i class="legend-line"></i> Сообщения</span>
            <span><i class="legend-line dashed"></i> Автоответы</span>
            <span style="margin-left:auto;color:var(--muted-light)">${esc(periodLabel)}</span>
          </div>
        </section>

        <section class="card topics-card">
          <div class="card-head">
            <div><h3 class="card-title">О чём спрашивают</h3><p class="card-sub">Темы входящих сообщений</p></div>
            <a class="card-more" href="#/analytics">Подробнее ${iconSprite("i-arrow-right")}</a>
          </div>
          <div class="topics-body">
            <div class="donut-wrap">
              ${window.Charts.donut(state.topics)}
              <div class="donut-center"><strong>${formatNumber(state.stats.messages)}</strong><span>сообщений</span></div>
            </div>
            <div class="topic-legend">
              ${state.topics
                .map(
                  (topic) => `<div class="topic-legend-row">
                    <i class="legend-dot" style="background:${esc(topic.color)}"></i>
                    <span class="topic-legend-name">${esc(topic.name)}</span>
                    <span class="topic-legend-value">${topic.value}%</span>
                  </div>`
                )
                .join("")}
            </div>
          </div>
          <div class="topics-foot">${iconSprite("i-trend-up")}<div><strong>Наличие</strong> — самый частый вопрос. Бот отвечает на него за 6 секунд.</div></div>
        </section>
      </div>

      <div class="dash-bottom-grid">
        <section class="card dialog-list-card">
          <div class="card-head">
            <div><h3 class="card-title">Недавние диалоги</h3><p class="card-sub">Последние покупатели в ваших чатах</p></div>
            <a class="card-more" href="#/chats">Все чаты ${iconSprite("i-arrow-right")}</a>
          </div>
          <div class="dialog-list">
            ${dashboardChats()}
          </div>
        </section>

        <section class="card feed-card">
          <div class="card-head">
            <div><h3 class="card-title">Лента бота</h3><p class="card-sub">Что происходило в магазине</p></div>
            <span class="badge badge-green badge-dot">Онлайн</span>
          </div>
          <div class="feed-list">
            ${state.feed
              .slice(0, 4)
              .map(
                (item) => `<div class="feed-item">
                  <span class="feed-icon ${FEED_TONES[item.type] || ""}">${iconSprite(item.icon)}</span>
                  <div class="feed-body"><p>${esc(item.text)}</p><time class="feed-time">${esc(item.time)}</time></div>
                </div>`
              )
              .join("")}
          </div>
          <div class="feed-footer"><span>Всего ${formatNumber(state.stats.messages)} сообщений сегодня</span><a class="card-more" href="#/analytics">Статистика ${iconSprite("i-arrow-right")}</a></div>
        </section>
      </div>
    </div>`;
  }

  function dashboardChats() {
    const chats = state.chats
      .slice()
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updated.localeCompare(a.updated);
      })
      .slice(0, 4);
    return chats
      .map((chat) => {
        const product = chatProduct(chat);
        const last = lastMessage(chat);
        const prefix =
          last.from === "bot"
            ? '<span class="bot-prefix">Бот:</span> '
            : last.from === "manager"
            ? '<span class="bot-prefix">Вы:</span> '
            : "";
        const tag = chat.handoff ? "Нужен менеджер" : chat.topic;
        return `<a class="dialog-row" href="#/chats/${esc(chat.id)}">
          ${avatar(chat.buyer.avatar, chat.buyer.name)}
          <div class="dialog-main">
            <div class="dialog-topline"><span class="dialog-name">${esc(chat.buyer.name)}</span><span class="dialog-time">${esc(chat.updated)}</span></div>
            <div class="dialog-preview">${prefix}${esc(truncate(last.text, 76))}</div>
            <div class="dialog-tags"><span class="dialog-tag auto">${esc(tag)}</span><span class="dialog-tag">${esc(product.name)}</span></div>
          </div>
          ${chat.unread ? `<span class="dialog-unread">${chat.unread}</span>` : ""}
        </a>`;
      })
      .join("");
  }

  function bindDashboard() {
    $$("[data-dash-period] button").forEach((button) => {
      button.addEventListener("click", () => {
        ui.dashboardPeriod = button.getAttribute("data-period");
        renderRoute();
      });
    });
  }

  /* ========================================================================
     Chats
     ======================================================================== */

  function getActiveChat() {
    return getChat(ui.activeChatId) || state.chats[0];
  }

  function isBotActive(chat) {
    return !chat.botPaused && !chat.handoff;
  }

  function attentionCount() {
    return state.chats.filter((chat) => chat.unread > 0 || chat.handoff || chat.botPaused).length;
  }

  function filteredChats() {
    const query = ui.chatSearch.trim().toLowerCase();
    return state.chats.filter((chat) => {
      if (ui.chatFilter === "attention" && !(chat.unread > 0 || chat.handoff || chat.botPaused)) return false;
      if (ui.chatFilter === "auto" && !isBotActive(chat)) return false;
      if (!query) return true;
      const product = chatProduct(chat);
      const haystack = `${chat.buyer.name} ${chat.buyer.city} ${product.name} ${chat.topic} ${chat.messages.map((m) => m.text).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  function chatPreview(chat) {
    const last = lastMessage(chat);
    const prefix =
      last.from === "bot"
        ? '<span class="bot-prefix">Бот:</span> '
        : last.from === "manager"
        ? '<span class="bot-prefix">Вы:</span> '
        : last.from === "system"
        ? ""
        : "";
    return `${prefix}${esc(truncate(last.text, 60))}`;
  }

  function chatRowMarkup(chat) {
    const product = chatProduct(chat);
    return `<a class="chat-row ${ui.activeChatId === chat.id ? "active" : ""}" href="#/chats/${esc(chat.id)}" data-chat-link="${esc(chat.id)}">
      ${avatar(chat.buyer.avatar, chat.buyer.name, chat.buyer.online ? "avatar-online" : "")}
      <div class="chat-row-main">
        <div class="chat-row-top"><span class="chat-row-name">${esc(chat.buyer.name)}</span><span class="chat-row-time">${esc(chat.updated)}</span></div>
        <div class="chat-row-preview">${chatPreview(chat)}</div>
        <div class="chat-row-foot">
          <span class="chat-row-product">${esc(product.name)}</span>
          ${chat.unread ? `<span class="chat-row-badge">${chat.unread}</span>` : chat.handoff ? `<span class="chat-row-dot attention"></span>` : isBotActive(chat) ? `<span class="chat-row-dot"></span>` : ""}
        </div>
      </div>
    </a>`;
  }

  function chatListMarkup() {
    const chats = filteredChats();
    if (!chats.length) {
      return `<div class="chat-list-empty">${iconSprite("i-search")}<p style="margin-top:8px">Ничего не нашлось.<br/>Попробуйте другое имя или товар.</p></div>`;
    }
    const pinned = chats.filter((chat) => chat.pinned);
    const rest = chats.filter((chat) => !chat.pinned);
    let html = "";
    if (pinned.length) {
      html += `<div class="chat-section-label">Закреплённые</div>${pinned.map(chatRowMarkup).join("")}`;
    }
    const label =
      ui.chatFilter === "attention" ? "Требуют внимания" : ui.chatFilter === "auto" ? "Отвечает бот" : "Сегодня";
    if (rest.length) html += `<div class="chat-section-label">${label}</div>${rest.map(chatRowMarkup).join("")}`;
    return html;
  }

  function updateChatFilterCounts() {
    const counts = {
      all: state.chats.length,
      attention: attentionCount(),
      auto: state.chats.filter(isBotActive).length,
    };
    $$("[data-chat-filter]").forEach((button) => {
      const count = $(`.filter-count`, button);
      if (count) count.textContent = counts[button.getAttribute("data-chat-filter")] || 0;
    });
  }

  function refreshChatList() {
    const scroll = $("#chat-list-scroll");
    if (scroll) scroll.innerHTML = chatListMarkup();
    $$("[data-chat-filter]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-chat-filter") === ui.chatFilter);
    });
    updateChatFilterCounts();
  }

  function viewAsMarkup() {
    const buyer = ui.viewAs === "buyer";
    return `<div class="view-as" role="group" aria-label="С чьей стороны смотреть переписку">
      <span class="view-as-label">Смотреть как</span>
      <div class="view-as-seg">
        <button type="button" class="${buyer ? "" : "active"}" data-view-as="shop" aria-pressed="${!buyer}">${iconSprite("i-box")} Магазин</button>
        <button type="button" class="${buyer ? "active" : ""}" data-view-as="buyer" aria-pressed="${buyer}">${iconSprite("i-user")} Покупатель</button>
      </div>
    </div>`;
  }

  function buyerMessagesMarkup(chat) {
    let html = `<div class="day-divider"><span>Сегодня</span></div>`;
    chat.messages.forEach((message) => {
      if (message.from === "system") return;
      const own = message.from === "buyer";
      html += `<div class="b-message ${own ? "own" : "shop"}">
        ${own ? "" : `<span class="b-ava">${esc((state.shop.name || "М").charAt(0))}</span>`}
        <div class="b-bubble">
          <div class="b-text">${esc(message.text)}</div>
          <div class="b-time">${esc(message.time)}</div>
        </div>
      </div>`;
    });
    return html;
  }

  function buyerChatMarkup(chat) {
    const product = chatProduct(chat);
    const price = product ? (productKind(product) === "service" ? "от " : "") + priceLabel(product) : "";
    const quick = buyerSuggestions(chat).slice(0, 3);
    return `<div class="buyer-shell">
      <div class="buyer-toolbar">
        <button class="buyer-exit" type="button" data-view-as="shop">${iconSprite("i-arrow-left")} Вернуться в кабинет</button>
        ${viewAsMarkup()}
      </div>
      <div class="buyer-app">
        <header class="buyer-head">
          <div class="buyer-shop">
            <span class="buyer-logo">${esc((state.shop.name || "М").charAt(0))}</span>
            <div>
              <strong>${esc(state.shop.name)}</strong>
              <span><i class="online-dot"></i> на связи · отвечает за пару секунд</span>
            </div>
          </div>
          <span class="buyer-brand">Авито</span>
        </header>
        ${product ? `<div class="buyer-product">
          <div class="buyer-product-text"><strong>${esc(product.name)}</strong><span>${price}</span></div>
          <button class="buyer-product-open" type="button" data-open-product-id="${esc(product.id)}">${iconSprite("i-chevron-right")}</button>
        </div>` : ""}
        <div class="buyer-stream" id="messages-wrap">
          <div class="messages-stream" id="messages-stream">${buyerMessagesMarkup(chat)}</div>
        </div>
        <div class="buyer-quick">
          ${quick.map((text) => `<button type="button" class="buyer-quick-chip" data-buyer-quick="${esc(text)}">${esc(text)}</button>`).join("")}
        </div>
        <div class="buyer-composer">
          <input id="buyer-input" type="text" placeholder="Напишите сообщение" autocomplete="off" />
          <button class="buyer-send" type="button" id="buyer-send" aria-label="Отправить">${iconSprite("i-send")}</button>
        </div>
        <p class="buyer-note">Так переписку видит покупатель в Авито. ${chat.botPaused || chat.handoff ? "Сейчас отвечает менеджер." : "Сейчас отвечает бот."}</p>
      </div>
    </div>`;
  }

  function renderChatsPage() {
    if (ui.viewAs === "buyer") {
      return `<div class="page chats-page buyer-page">${buyerChatMarkup(getActiveChat())}</div>`;
    }
    const chat = getActiveChat();
    const layoutClass = isMobileChats() && ui.mobileConversation ? "show-conversation" : "";
    const attention = attentionCount();
    return `<div class="page chats-page">
      <div class="page-head chats-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> ${isBotActive(chat) ? "Бот на связи" : "Есть диалоги без бота"}</div>
          <h1 class="page-title">Диалоги</h1>
          <p class="page-sub">${state.chats.length} ${plural(state.chats.length, "диалог", "диалога", "диалогов")} · ${attention} ${plural(attention, "ждёт", "ждут", "ждут")} вашего ответа</p>
        </div>
        <div class="page-actions">
          ${viewAsMarkup()}
          <button class="btn btn-white" type="button" data-open-help>${iconSprite("i-help")} Как это работает</button>
        </div>
      </div>

      <div class="chats-layout ${layoutClass} ar-pane-closed" id="chats-layout">
        <aside class="chat-list-pane">
          <div class="chat-list-head">
            <div class="chat-search">
              ${iconSprite("i-search")}
              <input id="chat-search-input" type="search" placeholder="Имя, товар или слово из переписки" value="${esc(ui.chatSearch)}" autocomplete="off" />
            </div>
            <div class="chat-filters">
              <button class="chat-filter ${ui.chatFilter === "all" ? "active" : ""}" type="button" data-chat-filter="all">Все <span class="filter-count">${state.chats.length}</span></button>
              <button class="chat-filter ${ui.chatFilter === "attention" ? "active" : ""}" type="button" data-chat-filter="attention">Ждут вас <span class="filter-count">${attention}</span></button>
              <button class="chat-filter ${ui.chatFilter === "auto" ? "active" : ""}" type="button" data-chat-filter="auto">С ботом <span class="filter-count">${state.chats.filter(isBotActive).length}</span></button>
            </div>
          </div>
          <div class="chat-list-scroll" id="chat-list-scroll">${chatListMarkup()}</div>
        </aside>

        <section class="conversation-pane">
          ${conversationHeadMarkup(chat)}
          ${convoAlertMarkup(chat) || coachTipMarkup(chat)}
          <div class="messages-wrap" id="messages-wrap">
            <div class="messages-stream" id="messages-stream">${messagesMarkup(chat)}</div>
          </div>
          <div class="composer">${composerMarkup(chat)}</div>
        </section>

        <div class="chat-info-backdrop" data-info-drawer-close aria-hidden="true"></div>
        <aside class="chat-info-pane" id="chat-info-pane">${chatInfoContent(chat)}</aside>
      </div>
    </div>`;
  }

  function conversationHeadMarkup(chat) {
    const product = chatProduct(chat);
    const active = isBotActive(chat);
    return `<div class="convo-head">
      <button class="convo-back" type="button" data-chat-back aria-label="К списку диалогов">${iconSprite("i-arrow-left")}</button>
      ${avatar(chat.buyer.avatar, chat.buyer.name, chat.buyer.online ? "avatar-online" : "")}
      <div class="convo-ident">
        <div class="convo-name">${esc(chat.buyer.name)} ${iconSprite("i-check-circle")}</div>
        <div class="convo-status"><span class="online-dot" style="background:${chat.buyer.online ? "var(--green)" : "#d1cec7"}"></span>${esc(chat.buyer.city)} · ${chat.buyer.online ? "онлайн" : "был(а) недавно"}</div>
      </div>
      <div class="convo-actions">
        <button class="convo-product-chip" type="button" data-open-product-id="${esc(product.id)}" title="Открыть карточку: ${esc(product.name)}">
          <img src="${esc(product.image)}" alt="" />
          <span>${esc(product.name)}</span>
        </button>
        <span class="convo-bot-pill ${active ? "live" : "paused"}">${iconSprite(active ? "i-sparkles" : "i-pause")}${active ? "бот ведёт" : "бот на паузе"}</span>
        ${needsAnswer(chat) && active ? `<button class="btn btn-primary btn-sm convo-take" type="button" data-convo-take>${iconSprite("i-user")}<span>Ответить самому</span></button>` : ""}
        <button class="icon-btn" type="button" data-info-drawer aria-label="О диалоге" title="О диалоге">${iconSprite("i-info")}</button>
        <button class="icon-btn" type="button" data-chat-actions aria-label="Действия с диалогом" title="Действия">${iconSprite("i-more")}</button>
      </div>
    </div>`;
  }

  function takeOverChat(chat) {
    chat.handoff = false;
    chat.botPaused = true;
    chat.unread = 0;
    saveState();
    ui.composerModeChat = chat.id;
    ui.composerMode = "manager";
    renderRoute();
    requestAnimationFrame(() => $("#composer-input")?.focus());
  }

  function needsAnswer(chat) {
    return !!chat && (chat.unread > 0 || chat.handoff);
  }

  function convoAlertMarkup(chat) {
    if (!chat || !chat.messages.length || !needsAnswer(chat)) return "";
    const lastBuyer = [...chat.messages].reverse().find((message) => message.from === "buyer");
    const count = chat.unread || 0;
    const title = chat.handoff
      ? "Диалог передан вам"
      : count > 1
        ? `${count} ${plural(count, "сообщение ждёт", "сообщения ждут", "сообщений ждут")} ответа`
        : "Покупатель ждёт ответа";
    const meta = lastBuyer && lastBuyer.time ? `последнее — в ${esc(lastBuyer.time)}` : "бот молчит в этом диалоге";
    return `<div class="convo-alert" id="convo-alert">
      ${iconSprite("i-bell")}
      <div class="convo-alert-text"><strong>${title}</strong><span>${meta}</span></div>
      <button class="btn btn-primary btn-sm" type="button" data-convo-take>Ответить самому</button>
    </div>`;
  }

  function coachTipMarkup(chat) {
    if (!chat || !chat.messages.length) return "";
    if (state.settings && state.settings.coachDismissed) return "";
    return `<div class="coach-tip" id="coach-tip">
      ${iconSprite("i-sparkles")}
      <div><strong>Как это выглядит для покупателя</strong><p>Переписку можно открыть глазами клиента — так он видит ответы бота в Авито.</p><button class="coach-tip-link" type="button" data-view-as="buyer">${iconSprite("i-eye")} Показать со стороны покупателя</button></div>
      <button class="icon-btn-sm coach-tip-close" type="button" data-coach-close aria-label="Скрыть подсказку">${iconSprite("i-close")}</button>
    </div>`;
  }

  function messageFoot(message) {
    let html = `<span>${esc(message.time || "")}</span>`;
    if (message.from === "bot") {
      if (message.latency) html += `<span class="dot-sep">·</span><span>${esc(message.latency)}</span>`;
      html += `<span class="dot-sep">·</span>${iconSprite("i-check")}`;
    }
    if (message.from === "manager") {
      html += `<span class="dot-sep">·</span>${iconSprite("i-check")}`;
    }
    return html;
  }

  function messagesMarkup(chat) {
    let html = `<div class="day-divider"><span>Сегодня</span></div>`;
    if (!chat.messages.length) {
      html += `<div class="empty-state"><div class="empty-icon">${iconSprite("i-chat")}</div><h3>Сообщений пока нет</h3><p>Напишите первое сообщение в поле ниже — бот ответит сам.</p><button class="btn btn-primary btn-sm" type="button" data-quick-message>Написать пример сообщения</button></div>`;
      return html;
    }
    chat.messages.forEach((message) => {
      if (message.from === "system") {
        html += `<div class="message system"><span class="system-note">${iconSprite("i-info")} ${esc(message.text)}</span></div>`;
        return;
      }
      const out = message.from !== "buyer";
      const isManager = message.from === "manager";
      const label = isManager
        ? `<div class="bubble-label">${iconSprite("i-user")} Вы · менеджер</div>`
        : `<div class="bubble-label">${iconSprite("i-sparkles")} AutoR · ${message.handoff ? "передача менеджеру" : "автоответ"} ${
            message.confidence ? `<span class="confidence">${message.confidence}%</span>` : ""
          }</div>`;
      html += `<div class="message ${out ? "out" : "in"} ${isManager ? "manager" : ""}">
        ${out ? "" : avatar(chat.buyer.avatar, chat.buyer.name)}
        <div class="message-body">
          <div class="bubble">
            ${out ? label : ""}
            <div class="bubble-text">${esc(message.text)}</div>
            ${message.attachment ? `<button class="bubble-attachment" type="button" data-image-open="${esc(message.attachment)}" style="padding:0;border:0;background:none;cursor:zoom-in"><img src="${esc(message.attachment)}" alt="Фото товара" loading="lazy"/></button>` : ""}
            <div class="bubble-foot">${messageFoot(message)}</div>
          </div>
        </div>
      </div>`;
    });
    return html;
  }

  function buyerSuggestions(chat) {
    const product = chat ? chatProduct(chat) : null;
    const service = product && product.kind !== "good";
    const list = [];
    if (service) {
      list.push("Сколько стоит за м²?");
      list.push(product && product.oldPrice ? "Скидку можно?" : "Когда сможете приехать?");
      list.push("Замер платный?");
      return list;
    }
    if (product && product.stock <= 0) list.push("Когда будет в наличии?");
    else list.push("Есть в наличии?");
    if (product && product.oldPrice) list.push("Скидку можно?");
    else list.push("Сколько стоит?");
    if (product && product.stock > 0) list.push("Сколько идёт доставка?");
    else list.push("Можно предзаказ?");
    return list;
  }

  function managerSuggestions() {
    return ["Сейчас уточню и вернусь.", "Посмотрю сроки и напишу."];
  }

  function suggestionsMarkup(mode, chat) {
    const list = mode === "manager" ? managerSuggestions() : buyerSuggestions(chat);
    return list
      .map(
        (text) =>
          `<button class="suggestion-chip" type="button" data-suggest="${esc(text)}">${iconSprite(mode === "manager" ? "i-send" : "i-sparkles")} ${esc(truncate(text, 30))}</button>`
      )
      .join("");
  }

  function botStateLabel(chat) {
    if (chat.botPaused) return "Бот на паузе";
    if (chat.handoff) return "Ждёт менеджера";
    return "Бот на связи";
  }

  function composerNotice(chat) {
    if (chat.botPaused) {
      return `<div class="composer-paused-note">${iconSprite("i-pause")} Бот на паузе. Новые сообщения покупателя ждут менеджера.</div>`;
    }
    if (chat.handoff) {
      return `<div class="composer-paused-note">${iconSprite("i-users")} Диалог передан менеджеру. Верните бота, чтобы снова включить автоответы.</div>`;
    }
    return "";
  }

  function composerModeFor(chat) {
    if (chat && ui.composerModeChat !== chat.id) {
      ui.composerModeChat = chat.id;
      ui.composerMode = chat.botPaused || chat.handoff ? "manager" : "buyer";
    }
    return ui.composerMode;
  }

  function composerMarkup(chat) {
    const mode = ui.viewAs === "buyer" ? "buyer" : "manager";
    ui.composerMode = mode;
    const active = isBotActive(chat);
    const target = chat.unread ? 0 : 0;
    return `<div class="composer-role">
        <span class="composer-role-label">${iconSprite("i-box")} Отвечаете как магазин</span>
        <button class="composer-check-link" type="button" data-view-as="buyer">${iconSprite("i-eye")} Проверить глазами покупателя</button>
        <span class="composer-bot-state${active ? "" : " paused"}" id="composer-bot-state"><span class="demo-dot"></span> ${botStateLabel(chat)}</span>
      </div>
      <div id="composer-notice">${composerNotice(chat)}</div>
      <div class="suggestion-row" id="suggestion-row">${suggestionsMarkup(mode, chat)}</div>
      <div class="composer-box is-${mode === "buyer" ? "buyer" : "shop"}">
        <textarea id="composer-input" rows="1" placeholder="${
          mode === "buyer" ? "Напишите как покупатель" : "Ответьте от имени магазина"
        }">${esc(ui.composerDraft || "")}</textarea>
        <div class="composer-tools">
          <button class="composer-tool" type="button" data-demo-toast="Вложения пока не загружаются" aria-label="Прикрепить файл">${iconSprite("i-paperclip")}</button>
          <button class="composer-tool" type="button" data-demo-toast="Смайлы доступны в полной версии" aria-label="Смайлы">${iconSprite("i-smile")}</button>
        </div>
        <button class="composer-send" type="button" id="composer-send" aria-label="Отправить сообщение" ${ui.pending.has(chat.id) ? "disabled" : ""}>${iconSprite("i-send")}</button>
      </div>
      <div class="composer-hint">
        <span class="hint-mode">${iconSprite(mode === "buyer" ? "i-sparkles" : "i-user")} ${
      mode === "buyer" ? "Бот ответит сам за пару секунд" : "Бот молчит, пока вы ведёте диалог"
    }</span>
        <span class="hint-right">Enter — отправить</span>
      </div>
      <span class="sr-only" data-composer-target>${target}</span>`;
  }

  function chatInfoContent(chat) {
    const product = chatProduct(chat);
    const active = isBotActive(chat);
    const botMessages = chat.messages.filter((message) => message.from === "bot");
    const lastBot = botMessages[botMessages.length - 1];
    const logMessages = botMessages.slice(-3).reverse();
    return `<div class="info-title">
        <h3>О диалоге</h3>
        <button class="icon-btn-sm" type="button" data-chat-info aria-label="Подробнее о диалоге">${iconSprite("i-external")}</button>
      </div>
      <div class="info-buyer">
        ${avatar(chat.buyer.avatar, chat.buyer.name, chat.buyer.online ? "avatar-online avatar-md" : "avatar-md")}
        <div>
          <div class="info-buyer-name">${esc(chat.buyer.name)}</div>
          <div class="info-buyer-meta">${iconSprite("i-pin")} ${esc(chat.buyer.city)} <span style="opacity:.4">·</span> ${iconSprite("i-star")} ${chat.buyer.rating.toFixed(1)}</div>
        </div>
      </div>
      <div class="buyer-stats">
        <div class="buyer-stat"><strong>${chat.buyer.rating.toFixed(1)}</strong><span>рейтинг</span></div>
        <div class="buyer-stat"><strong>${chat.buyer.deals}</strong><span>сделок</span></div>
        <div class="buyer-stat"><strong>${chat.buyer.online ? "да" : "нет"}</strong><span>онлайн</span></div>
      </div>
      <div class="info-section">
        <div class="info-label">Товар в диалоге</div>
        <button class="info-product" type="button" data-open-product-id="${esc(product.id)}">
          <img src="${esc(product.image || "")}" alt="" />
          <span class="info-product-main">
            <span class="info-product-name">${esc(product.name)}</span>
            <span class="info-product-price">${formatPrice(product.price)} <span class="badge badge-green">${product.stock > 0 ? "в наличии" : "под заказ"}</span></span>
          </span>
          ${iconSprite("i-chevron-right", "muted")}
        </button>
      </div>
      <div class="info-section">
        <div class="info-label">Автопилот</div>
        <div class="bot-status-card">
          <div class="bot-status-top">
            <span class="bot-status-icon ${active ? "" : "paused"}">${iconSprite(active ? "i-sparkles" : "i-pause")}</span>
            <div class="bot-status-main"><strong>${botStateLabel(chat)}</strong><span>${active ? "Сценарии активны" : "Автоответы остановлены"}</span></div>
            <label class="switch"><input type="checkbox" data-bot-toggle ${active ? "checked" : ""} aria-label="Включить бота в диалоге" /><span class="switch-track"></span></label>
          </div>
          <button class="btn btn-white btn-sm btn-block" type="button" data-bot-take>${active ? iconSprite("i-pause") + " Взять диалог на себя" : iconSprite("i-play") + " Вернуть боту"}</button>
        </div>
      </div>
      <div class="info-section">
        <div class="info-label">Последнее решение</div>
        <div class="decision-card">
          <div class="decision-row"><span class="decision-key">Инструкция</span><span class="decision-value">${esc(lastBot ? lastBot.rule : "Автоответов пока нет")}</span></div>
          <div class="decision-row"><span class="decision-key">Уверенность</span><span class="decision-value">${lastBot && lastBot.confidence ? lastBot.confidence + "%" : "—"} ${lastBot && lastBot.confidence >= 90 ? iconSprite("i-check") : ""}</span></div>
          <div class="decision-row"><span class="decision-key">Скорость</span><span class="decision-value">${esc(lastBot && lastBot.latency ? lastBot.latency : "—")}</span></div>
        </div>
      </div>
      <div class="info-section">
        <div class="info-label">Лог бота</div>
        <div class="bot-log">
          ${
            logMessages.length
              ? logMessages
                  .map(
                    (message) => `<div class="bot-log-item">
                <span class="bot-log-icon">${iconSprite("i-check")}</span>
                <div class="bot-log-body"><p>${esc(message.rule || "Автоответ")} · ${message.confidence || "—"}%</p><time>${esc(message.time)}</time></div>
              </div>`
                  )
                  .join("")
              : `<div class="bot-log-item"><span class="bot-log-icon">${iconSprite("i-info")}</span><div class="bot-log-body"><p>Бот ещё не отвечал в этом диалоге</p></div></div>`
          }
        </div>
      </div>
      <div class="info-actions">
        <button class="btn btn-white btn-sm btn-block" type="button" data-demo-toast="Звонок из кабинета пока не подключён">${iconSprite("i-card")} Позвонить покупателю</button>
        <button class="btn btn-white btn-sm btn-block" type="button" data-export-chat="${esc(chat.id)}">${iconSprite("i-download")} Экспорт диалога</button>
        <button class="btn btn-white btn-sm btn-block" type="button" data-open-product-id="${esc(product.id)}">${iconSprite("i-box")} Открыть карточку товара</button>
      </div>
      <p class="info-footer-note">Переписка синхронизируется с Авито. Кабинет работает в вашем браузере.</p>`;
  }

  function scrollMessages(instant) {
    const wrap = $("#messages-wrap");
    if (!wrap) return;
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: instant ? "auto" : "smooth" });
  }

  function showTypingRow() {
    const stream = $("#messages-stream");
    if (!stream || $("#typing-message")) return;
    const chat = getActiveChat();
    const row = document.createElement("div");
    row.className = "message in";
    row.id = "typing-message";
    row.innerHTML = `${avatar(chat.buyer.avatar, chat.buyer.name)}<div class="message-body"><div class="typing-bubble" aria-label="Бот печатает"><i></i><i></i><i></i></div></div>`;
    stream.appendChild(row);
    scrollMessages(false);
  }

  function updateComposerStatus(chat) {
    const active = isBotActive(chat);
    const stateEl = $("#composer-bot-state");
    if (stateEl) {
      stateEl.classList.toggle("paused", !active);
      stateEl.innerHTML = `<span class="demo-dot"></span> ${botStateLabel(chat)}`;
    }
    const notice = $("#composer-notice");
    if (notice) notice.innerHTML = composerNotice(chat);
    const hint = $(".composer-hint .hint-mode");
    if (hint) {
      hint.innerHTML = `${iconSprite(ui.composerMode === "buyer" ? "i-sparkles" : "i-user")} ${
        ui.composerMode === "buyer"
          ? isBotActive(chat)
            ? "Бот ответит сам за пару секунд"
            : "Бот не ответит, пока диалог у менеджера"
          : "Бот молчит, пока вы ведёте диалог"
      }`;
    }
    const send = $("#composer-send");
    if (send) send.disabled = ui.pending.has(chat.id);
    $$(".suggestion-chip").forEach((chip) => (chip.disabled = ui.pending.has(chat.id)));
  }

  function refreshConversation(chat) {
    const stream = $("#messages-stream");
    if (stream) {
      stream.innerHTML = ui.viewAs === "buyer" ? buyerMessagesMarkup(chat) : messagesMarkup(chat);
      if (ui.pending.has(chat.id)) showTypingRow();
    }
    const info = $("#chat-info-pane");
    if (info) info.innerHTML = chatInfoContent(chat);
    updateComposerStatus(chat);
    updateChatFilterCounts();
    refreshChatList();
    updateGlobalBadges();
    requestAnimationFrame(() => scrollMessages(false));
  }

  function generateReply(chat, text) {
    const hook = window.AutoRFeatures && window.AutoRFeatures.reply;
    return (hook && hook(chat, text, baseReply)) || baseReply(chat, text);
  }

  function baseReply(chat, text) {
    const product = chatProduct(chat);
    const lower = text.toLowerCase();
    const first = buyerFirstName(chat);
    const hasBot = chat.messages.some((message) => message.from === "bot");
    const hits = (words) => words.reduce((sum, word) => (lower.includes(word) ? sum + 1 : sum), 0);

    const fallbackNeedles = ["менеджер", "жалоб", "счёт", "счет", "ооо", "юрлиц", "трейд", "опт", "подбор", "нестандарт"];
    const fallback = fallbackNeedles.some((word) => lower.includes(word));

    const intents = [
      {
        id: "r3",
        topic: "Доставка",
        words: ["достав", "курьер", "привез", "сдэк", "почт", "пункт", "выдач", "срок", "казан", "город"],
      },
      {
        id: "r2",
        topic: "Цена и скидки",
        words: ["скид", "торг", "дешев", "уступ", "цена", "стоит", "сколько", "дорого", "акци", "рассроч"],
      },
      {
        id: "r4",
        topic: "Гарантия",
        words: ["гарант", "возврат", "обмен", "брак", "чек", "сервис"],
      },
      {
        id: "r5",
        topic: "Самовывоз",
        words: ["самовывоз", "забрать", "адрес", "метро", "магазин", "приехать"],
      },
      {
        id: "r6",
        topic: "Фото товара",
        words: ["фото", "фотк", "сним", "видео", "покаж", "выгляд", "состояни"],
      },
      {
        id: "r1",
        topic: "Наличие",
        words: ["есть", "наличи", "остал", "прода", "куп", "отлож", "забронир"],
      },
    ];

    let matched = null;
    let bestScore = 0;
    if (!fallback) {
      intents.forEach((intent) => {
        const own = getRule(intent.id);
        if (!own || own.enabled === false) return;
        const score = hits(intent.words.concat((own.triggers || []).map((t) => String(t).toLowerCase())));
        if (score > bestScore) {
          bestScore = score;
          matched = intent;
        }
      });
    }

    const price = formatPrice(product.price);
    let body = "";
    let attachment = null;
    let handoff = false;

    if (fallback || !matched) {
      body = "Спасибо! Уточню этот вопрос у менеджера и вернусь с ответом в течение 10 минут.";
      handoff = true;
      matched = { id: "r7", topic: "Передача менеджеру" };
    } else if (matched.id === "r1") {
      body =
        product.stock > 0
          ? `Да, «${product.name}» есть в наличии — ${price}. Сейчас на складе ${product.stock} ${plural(product.stock, "штука", "штуки", "штук")}. ${product.note ? product.note + " " : ""}Гарантия 12 месяцев. Могу отложить на пару часов.`
          : `«${product.name}» сейчас нет в наличии. ${product.note ? product.note + " " : ""}Могу оставить предзаказ и написать вам, когда товар появится.`;
    } else if (matched.id === "r3") {
      body = `Отправляю «${product.name}» СДЭКом или Почтой России. По Москве — 290 ₽ и доставка завтра, в другие города — от 390 ₽ и 2–3 дня. Если оформим до 18:00, передам заказ в доставку сегодня.`;
    } else if (matched.id === "r2") {
      body = `По «${product.name}» готов предложить −5% при покупке сегодня. Итог — ${formatPrice(
        Math.round(product.price * 0.95)
      )} ₽. Могу бесплатно упаковать и приложить гарантийный чек.`;
    } else if (matched.id === "r4") {
      body = `На «${product.name}» официальная гарантия 12 месяцев. Возврат — 14 дней, если устройство не использовалось. Проверка при получении и чек в комплекте.`;
    } else if (matched.id === "r5") {
      body = `Самовывоз: Москва, ул. Пушкина, 12, ежедневно с 10:00 до 20:00. Товар отложу на ваше имя на 2 часа. Оплата на месте или по ссылке.`;
    } else if (matched.id === "r6") {
      body = `Конечно, отправляю реальные фото «${product.name}» с витрины. Устройство новое, без сколов и царапин. Можем созвониться и показать его по видео.`;
      attachment = product.image;
    }

    let prefix = "";
    if (!hasBot) {
      if (state.settings.tone === "friendly") prefix = `Здравствуйте, ${first}! `;
      else if (state.settings.tone === "expert") prefix = `Добрый день. `;
      else prefix = `Добрый день, ${first}. `;
    }
    if (state.settings.tone === "friendly" && state.settings.emoji && matched.id !== "r7" && !hasBot) {
      body += " Хорошего дня! 😊";
    }

    const rule = getRule(matched.id);
    const confidence = fallback || !matched ? 72 : Math.min(99, 93 + Math.min(6, bestScore + 1));
    return {
      from: "bot",
      text: prefix + body,
      rule: rule ? rule.name : matched.topic,
      confidence,
      latency: `${state.settings.delay} сек`,
      attachment,
      handoff,
      topic: matched.topic,
    };
  }

  // Сначала пробуем живой ответ нейросети, затем — сценарии приложения.
  async function replyFor(chat, text) {
    const hook = window.AutoRFeatures && window.AutoRFeatures.aiOnline;
    if (hook) {
      try {
        const live = await hook(chat, text);
        if (live) return live;
      } catch (error) {
        if (window.console) console.warn("AutoR: ИИ недоступен", error);
      }
    }
    // Шаблонов нет: если ИИ не ответил, диалог честно уходит менеджеру.
    return {
      from: "bot",
      text: "Уточню детали у менеджера и вернусь с ответом в течение дня. Напишите, пожалуйста, что ещё важно учесть — всё передам.",
      rule: "Передача менеджеру",
      confidence: 70,
      latency: "1 сек",
      attachment: null,
      handoff: true,
      topic: "Передача менеджеру",
    };
  }

  async function startAutoReply(chat, userText) {
    const chatId = chat.id;
    ui.pending.add(chat.id);
    if (ui.activeChatId === chatId) {
      showTypingRow();
      updateComposerStatus(chat);
    }
    const duration = Math.min(2100, Math.max(900, 700 + state.settings.delay * 35));
    await wait(duration);

    const liveChat = getChat(chatId);
    if (!liveChat || liveChat.botPaused || liveChat.handoff) {
      ui.pending.delete(chatId);
      if (ui.activeChatId === chatId && ui.page === "chats") {
        $("#typing-message")?.remove();
        updateComposerStatus(liveChat || chat);
      }
      return;
    }

    const reply = await replyFor(liveChat, userText);
    const message = Object.assign({ id: uid("m"), time: nextChatTime(liveChat) }, reply);
    liveChat.messages.push(message);
    liveChat.updated = message.time;
    liveChat.topic = reply.topic;
    if (reply.handoff) {
      liveChat.handoff = true;
    }
    state.stats.messages += 1;
    state.stats.autoReplies += 1;
    state.stats.autoShare = Math.round((state.stats.autoReplies / state.stats.messages) * 100);
    state.feed.unshift({
      id: uid("f"),
      type: reply.handoff ? "handoff" : "answer",
      icon: reply.handoff ? "i-users" : "i-sparkles",
      text: `${reply.handoff ? "Диалог передан менеджеру" : "Бот ответил про " + reply.topic.toLowerCase()} — ${liveChat.buyer.name}`,
      time: "Только что",
    });
    state.feed = state.feed.slice(0, 8);
    if (ui.activeChatId !== chatId) liveChat.unread = (liveChat.unread || 0) + 1;
    saveState();
    ui.pending.delete(chatId);

    if (ui.page === "chats") {
      if (ui.activeChatId === chatId) {
        refreshConversation(liveChat);
      } else {
        refreshChatList();
        updateGlobalBadges();
      }
    } else {
      updateGlobalBadges();
    }

    if (reply.handoff) {
      if (ui.viewAs !== "buyer") toast("Диалог передан менеджеру", "Бот не был уверен в ответе и позвал вас на помощь.", "info");
    } else if (ui.viewAs !== "buyer") {
      toast("Бот ответил", `«${reply.rule}» · уверенность ${reply.confidence}%`, "success");
    }
  }

  function sendCurrentMessage(forcedText) {
    const chat = getActiveChat();
    const input = $("#composer-input");
    const text = (forcedText != null ? forcedText : input ? input.value : "").trim();
    if (!text || ui.pending.has(chat.id)) return;
    const mode = ui.composerMode;
    const message = {
      id: uid("m"),
      from: mode === "manager" ? "manager" : "buyer",
      text,
      time: nextChatTime(chat),
    };
    chat.messages.push(message);
    chat.updated = message.time;
    if (mode === "manager") {
      chat.botPaused = true;
      chat.handoff = false;
    } else {
      state.stats.messages += 1;
      state.stats.autoShare = Math.round((state.stats.autoReplies / state.stats.messages) * 100);
      chat.unread = 0;
      if (state.settings) state.settings.coachDismissed = true;
      $("#coach-tip")?.remove();
    }
    saveState();
    if (input) {
      input.value = "";
      input.style.height = "auto";
    }
    ui.composerDraft = "";

    if (mode === "manager") {
      toast("Ответ отправлен", "Бот поставлен на паузу, чтобы не перебивать вас.", "success");
      renderRoute();
      return;
    }

    refreshConversation(chat);

    if (isBotActive(chat)) {
      startAutoReply(chat, text);
    } else {
      toast("Бот не ответит", chat.botPaused ? "Диалог на паузе — ответит менеджер." : "Диалог уже передан менеджеру.", "info");
      updateGlobalBadges();
    }
  }

  function switchViewAs(mode) {
    if (mode !== "buyer" && mode !== "shop") return;
    ui.viewAs = mode;
    ui.composerMode = "buyer";
    if (state.settings) state.settings.viewAs = mode;
    saveState();
    renderRoute();
  }

  function switchComposerMode(mode) {
    ui.composerMode = mode;
    ui.composerModeChat = (getActiveChat() || {}).id;
    const chat = getActiveChat();
    $$("[data-composer-mode]").forEach((button) => {
      const active = button.getAttribute("data-composer-mode") === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const box = $(".composer-box");
    if (box) {
      box.classList.toggle("is-buyer", mode === "buyer");
      box.classList.toggle("is-shop", mode !== "buyer");
    }
    const row = $("#suggestion-row");
    if (row) row.innerHTML = suggestionsMarkup(mode, chat);
    const input = $("#composer-input");
    if (input) {
      input.placeholder = mode === "buyer" ? "Напишите как покупатель" : "Ответьте от имени магазина";
      input.focus();
    }
    updateComposerStatus(chat);
  }

  function exportChat(chat) {
    const product = chatProduct(chat);
    const lines = [
      `AutoR — экспорт диалога`,
      `Покупатель: ${chat.buyer.name} (${chat.buyer.city})`,
      `Товар: ${product.name} — ${formatPrice(product.price)}`,
      `Тема: ${chat.topic}`,
      "",
    ];
    chat.messages.forEach((message) => {
      const who = message.from === "buyer" ? chat.buyer.name : message.from === "bot" ? "AutoR (бот)" : message.from === "manager" ? "Менеджер" : "Система";
      lines.push(`[${message.time}] ${who}: ${message.text}`);
    });
    downloadFile(`autor-chat-${chat.id}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
    toast("Диалог выгружен", `Файл autor-chat-${chat.id}.txt сохранён.`, "success");
  }

  function openChatInfoModal(chat) {
    openModal(
      `${modalHeader("О диалоге", `${chat.buyer.name} · ${chatProduct(chat).name}`)}
      <div class="modal-body">${chatInfoContent(chat)}</div>
      <div class="modal-foot"><button class="btn btn-primary btn-sm" type="button" data-modal-close>Понятно</button></div>`
    );
  }

  function openChatActionsModal(chat) {
    const active = isBotActive(chat);
    openModal(
      `${modalHeader("Действия с диалогом", `${chat.buyer.name} · ${chatProduct(chat).name}`)}
      <div class="modal-body">
        <div class="info-actions" style="border-top:0;padding-top:0;margin-top:0">
          <button class="btn btn-white btn-block" type="button" data-modal-bot-toggle>${iconSprite(active ? "i-pause" : "i-play")} ${active ? "Взять диалог на себя" : "Вернуть боту"}</button>
          <button class="btn btn-white btn-block" type="button" data-ar-order>${iconSprite("i-box")} Оформить заказ</button>
          <button class="btn btn-white btn-block" type="button" data-modal-chat-info>${iconSprite("i-info")} Подробнее о диалоге</button>
          <button class="btn btn-white btn-block" type="button" data-modal-mark-unread>${iconSprite("i-bell")} Сделать непрочитанным</button>
          <button class="btn btn-white btn-block" type="button" data-modal-copy-link>${iconSprite("i-link")} Скопировать ссылку на диалог</button>
          <button class="btn btn-white btn-block" type="button" data-export-chat="${esc(chat.id)}">${iconSprite("i-download")} Экспорт диалога</button>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Закрыть</button></div>`,
      {
        onMount: (modal) => {
          $("[data-modal-bot-toggle]", modal)?.addEventListener("click", () => {
            chat.botPaused = active;
            chat.handoff = false;
            saveState();
            closeModal();
            toast(active ? "Диалог у менеджера" : "Бот вернулся в диалог", active ? "Автоответы остановлены." : "Бот снова отвечает автоматически.", active ? "info" : "success");
            renderRoute();
          });
          $("[data-modal-chat-info]", modal)?.addEventListener("click", () => {
            closeModal();
            openChatInfoModal(chat);
          });
          $("[data-modal-mark-unread]", modal)?.addEventListener("click", () => {
            chat.unread = Math.max(1, chat.unread || 1);
            saveState();
            closeModal();
            toast("Диалог отмечен непрочитанным", "Он появится в фильтре «Внимание».", "info");
            renderRoute();
          });
          $("[data-modal-copy-link]", modal)?.addEventListener("click", async () => {
            const link = `${window.location.origin}${window.location.pathname}#/chats/${chat.id}`;
            try {
              await navigator.clipboard.writeText(link);
              toast("Ссылка скопирована", "Ссылку можно отправить коллеге.", "success");
            } catch (error) {
              toast("Не удалось скопировать", "Браузер ограничил доступ к буферу обмена.", "info");
            }
            closeModal();
          });
          $("[data-export-chat]", modal)?.addEventListener("click", () => {
            exportChat(chat);
            closeModal();
          });
        },
      }
    );
  }

  function bindChats() {
    const chat = getActiveChat();
    const listPane = $(".chat-list-pane");
    const search = $("#chat-search-input");

    search?.addEventListener("input", () => {
      ui.chatSearch = search.value;
      refreshChatList();
    });

    listPane?.addEventListener("click", (event) => {
      const filter = event.target.closest("[data-chat-filter]");
      if (filter) {
        ui.chatFilter = filter.getAttribute("data-chat-filter");
        refreshChatList();
        return;
      }
      const link = event.target.closest("[data-chat-link]");
      if (link) {
        event.preventDefault();
        const id = link.getAttribute("data-chat-link");
        const target = getChat(id);
        if (!target) return;
        ui.activeChatId = id;
        ui.mobileConversation = true;
        clearUnread(target);
        navigate(`chats/${id}`);
      }
    });

    $("[data-chat-back]")?.addEventListener("click", () => {
      ui.mobileConversation = false;
      navigate("chats");
    });

    $("[data-check-bot]")?.addEventListener("click", () => {
      ui.composerMode = "buyer";
      ui.activeChatId = "c1";
      ui.mobileConversation = true;
      navigate("chats/c1");
      setTimeout(() => $("#composer-input")?.focus(), 160);
      toast("Всё готово", "Напишите сообщение от лица покупателя — бот ответит.", "info");
    });

    $(".chat-info-pane")?.addEventListener("change", (event) => {
      if (event.target.matches("[data-bot-toggle]")) {
        const enabled = event.target.checked;
        chat.botPaused = !enabled;
        chat.handoff = false;
        saveState();
        toast(enabled ? "Бот включён" : "Диалог на паузе", enabled ? "Автоответы снова работают." : "Теперь ответит менеджер.", enabled ? "success" : "info");
        renderRoute();
      }
    });

    $(".chat-info-pane")?.addEventListener("click", (event) => {
      if (event.target.closest("[data-bot-take]")) {
        const active = isBotActive(chat);
        chat.botPaused = active;
        chat.handoff = false;
        saveState();
        toast(active ? "Диалог у менеджера" : "Бот вернулся в диалог", active ? "Автоответы остановлены." : "Бот снова отвечает.", active ? "info" : "success");
        renderRoute();
        return;
      }
      if (event.target.closest("[data-chat-info]")) {
        openChatInfoModal(chat);
        return;
      }
      const productBtn = event.target.closest("[data-open-product-id]");
      if (productBtn) {
        openProductDrawer(productBtn.getAttribute("data-open-product-id"));
        return;
      }
      const exportBtn = event.target.closest("[data-export-chat]");
      if (exportBtn) {
        exportChat(chat);
      }
    });

    $("[data-coach-close]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.settings) state.settings.coachDismissed = true;
      saveState();
      $("#coach-tip")?.remove();
    });

    $("[data-quick-message]")?.addEventListener("click", () => sendCurrentMessage("Здравствуйте! Есть в наличии?"));

    const drawerButton = $("[data-info-drawer]");
    const drawerClose = () => $("#chats-layout")?.classList.remove("info-open");
    drawerButton?.addEventListener("click", () => {
      const layout = $("#chats-layout");
      if (!layout) return;
      const open = layout.classList.toggle("info-open");
      drawerButton.classList.toggle("active", open);
      drawerButton.setAttribute("aria-expanded", String(open));
    });
    $("[data-info-drawer-close]")?.addEventListener("click", () => {
      drawerClose();
      drawerButton?.classList.remove("active");
      drawerButton?.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") drawerClose();
    });

    $("[data-convo-take]")?.addEventListener("click", () => takeOverChat(getActiveChat()));

    $("[data-chat-info]")?.addEventListener("click", () => openChatInfoModal(chat));
    $("[data-chat-actions]")?.addEventListener("click", () => openChatActionsModal(chat));

    $(".convo-head")?.addEventListener("click", (event) => {
      const productBtn = event.target.closest("[data-open-product-id]");
      if (productBtn) openProductDrawer(productBtn.getAttribute("data-open-product-id"));
    });

    $$("[data-composer-mode]").forEach((button) => {
      button.addEventListener("click", () => switchComposerMode(button.getAttribute("data-composer-mode")));
    });

    $$("[data-view-as]").forEach((button) => {
      button.addEventListener("click", () => switchViewAs(button.getAttribute("data-view-as")));
    });

    const buyerInput = $("#buyer-input");
    const buyerSend = () => {
      const input = $("#buyer-input");
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      sendCurrentMessage(text);
    };
    buyerInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        buyerSend();
      }
    });
    $("#buyer-send")?.addEventListener("click", buyerSend);
    $$("[data-buyer-quick]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-buyer-quick");
        const input = $("#buyer-input");
        if (input) input.value = text;
        buyerSend();
      });
    });

    $(".composer")?.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-suggest]");
      if (chip) sendCurrentMessage(chip.getAttribute("data-suggest"));
    });

    $("#composer-send")?.addEventListener("click", () => sendCurrentMessage());

    const input = $("#composer-input");
    if (input) {
      const autosize = () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 90)}px`;
      };
      input.addEventListener("input", autosize);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendCurrentMessage();
        }
      });
      autosize();
    }

    if (ui.pending.has(chat.id)) {
      showTypingRow();
      updateComposerStatus(chat);
    }

    updateChatFilterCounts();
  }

  function openImageModal(src) {
    openModal(
      `${modalHeader("Фото товара", "Фото из карточки товара")}
      <div class="modal-body" style="padding-top:12px"><img src="${esc(src)}" alt="Фото товара" style="width:100%;border-radius:12px"/></div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Закрыть</button></div>`,
      { className: "modal-lg" }
    );
  }

  /* ========================================================================
     Catalog
     ======================================================================== */

  const KIND_TABS = [
    { id: "all", label: "Всё" },
    { id: "service", label: "Услуги" },
    { id: "good", label: "Товары" },
  ];

  function catalogCategories() {
    const seen = [];
    state.products.forEach((product) => {
      const category = (product.category || "").trim();
      if (category && seen.indexOf(category) === -1) seen.push(category);
    });
    return ["Все"].concat(seen);
  }

  function productKind(product) {
    return product && product.kind === "good" ? "good" : "service";
  }

  function unitLabel(product) {
    const unit = (product && product.unit) || "шт";
    return unit === "шт" ? "" : "/" + unit;
  }

  function priceLabel(product) {
    return `${formatPrice(product.price)}${unitLabel(product)}`;
  }

  function catalogProducts() {
    const query = ui.catalogSearch.trim().toLowerCase();
    return state.products.filter((product) => {
      if (ui.catalogKind !== "all" && productKind(product) !== ui.catalogKind) return false;
      if (ui.catalogCategory !== "Все" && product.category !== ui.catalogCategory) return false;
      if (!query) return true;
      return `${product.name} ${product.subtitle} ${product.sku} ${product.category}`.toLowerCase().includes(query);
    });
  }

  function productCardMarkup(product) {
    const isService = productKind(product) === "service";
    const stockBadge = isService
      ? `<span class="badge badge-stock">${esc(product.duration || "по записи")}</span>`
      : product.stock === 0
        ? `<span class="badge badge-stock out">Под заказ</span>`
        : product.stock <= (window.AutoRFeatures ? window.AutoRFeatures.lowStock(product) : 3)
          ? `<span class="badge badge-stock low">Осталось ${product.stock}</span>`
          : `<span class="badge badge-stock">В наличии</span>`;
    const metaLine = [
      esc(product.category),
      isService && product.minOrder ? `от ${product.minOrder} ${esc(product.unit || "м²")}` : "",
    ].filter(Boolean).join(" · ");
    return `<article class="product-card" data-product-card="${esc(product.id)}">
      <div class="product-thumb">
        ${productThumb(product)}
        <div class="product-badges">
          ${product.badge ? `<span class="badge badge-lime">${esc(product.badge)}</span>` : ""}
          ${stockBadge}
        </div>
        <button class="product-quick-toggle ${product.auto ? "on" : ""}" type="button" data-product-toggle="${esc(product.id)}" aria-label="${product.auto ? "Выключить бота для товара" : "Включить бота для товара"}" title="${product.auto ? "Бот включён" : "Бот выключен"}">${iconSprite("i-sparkles")}</button>
      </div>
      <div class="product-body">
        <span class="product-cat">${isService ? iconSprite("i-bolt") + " " : ""}${metaLine}</span>
        <h3 class="product-name">${esc(product.name)}</h3>
        <div class="product-price-row">
          <strong class="product-price">${isService ? "от " : ""}${priceLabel(product)}</strong>
          ${product.oldPrice ? `<span class="product-old-price">${formatPrice(product.oldPrice)}</span>` : ""}
        </div>
        <div class="product-stats">
          <span>${iconSprite("i-chat")} ${product.inquiries} ${plural(product.inquiries, "вопрос", "вопроса", "вопросов")}</span>
          <span>${iconSprite("i-sparkles")} ${product.autoReplies} ${plural(product.autoReplies, "автоответ", "автоответа", "автоответов")}</span>
        </div>
        <div class="product-foot">
          <label class="product-auto-label" title="Автоответы по этому товару">
            <span class="switch"><input type="checkbox" data-product-auto="${esc(product.id)}" ${product.auto ? "checked" : ""} aria-label="Автоответы по товару ${esc(product.name)}"/><span class="switch-track"></span></span>
            ${product.auto ? "Бот включён" : "Бот выключен"}
          </label>
          <button class="product-config-btn" type="button" data-product-open="${esc(product.id)}">Настроить ${iconSprite("i-chevron-right")}</button>
        </div>
      </div>
    </article>`;
  }

  function catalogGridMarkup() {
    const products = catalogProducts();
    if (!products.length) {
      return `<div class="catalog-empty">${(state.products.length ? emptyState("i-search", "Товары не нашлись", "Попробуйте изменить категорию или запрос. Каталог синхронизирован с Авито.") : emptyState("i-box", "Товаров пока нет", "Добавьте товар — бот сразу начнёт отвечать по нему. Или откройте пример магазина с каталогом.") + `<div class="ar-start__actions"><button class="btn btn-white" type="button" data-sample-load>${iconSprite("i-eye")} Пример магазина</button></div>`)}</div>`;
    }
    return products.map(productCardMarkup).join("") + `<button class="product-add-card" type="button" data-add-product>${`<span class="product-add-icon">${iconSprite("i-plus")}</span>`}<span>Добавить позицию</span><span style="font-size:10px;color:var(--muted-light)">товар или услугу</span></button>`;
  }

  function emptyState(icon, title, text) {
    return `<div class="empty-state"><div class="empty-icon">${iconSprite(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
  }

  function renderCatalog() {
    return `<div class="page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> ${state.products.length ? "Каталог синхронизирован" : "Каталог пуст"}</div>
          <h1 class="page-title">Товары и услуги</h1>
          <p class="page-sub">Бот отвечает по каждому объявлению: цена за м² или за штуку, сроки, наличие и условия выезда.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-white" type="button" data-sync-catalog>${iconSprite("i-sync")} Синхронизировать</button>
          <button class="btn btn-primary" type="button" data-add-product>${iconSprite("i-plus")} Добавить позицию</button>
        </div>
      </div>
      <div class="catalog-tools">
        <div class="catalog-filters">
          <div class="category-tabs kind-tabs">
            ${KIND_TABS.map(
              (tab) =>
                `<button type="button" class="${ui.catalogKind === tab.id ? "active" : ""}" data-catalog-kind="${tab.id}">${esc(tab.label)}</button>`
            ).join("")}
          </div>
          <div class="category-tabs">
            ${catalogCategories().map(
              (category) =>
                `<button type="button" class="${ui.catalogCategory === category ? "active" : ""}" data-catalog-category="${esc(category)}">${esc(category)}</button>`
            ).join("")}
          </div>
        </div>
        <div class="catalog-tools-right">
          <div class="catalog-search">
            ${iconSprite("i-search")}
            <input class="input" id="catalog-search-input" type="search" placeholder="Найти товар или SKU" value="${esc(ui.catalogSearch)}" autocomplete="off" />
          </div>
        </div>
      </div>
      <div class="catalog-sync-note">${iconSprite("i-clock")} ${state.products.length ? "Последняя синхронизация: сегодня в 10:40 · 8 объявлений" : "Каталог ещё не синхронизирован с Авито"}</div>
      <div class="product-grid" id="product-grid">${catalogGridMarkup()}</div>
    </div>`;
  }

  function refreshCatalogGrid() {
    const grid = $("#product-grid");
    if (grid) grid.innerHTML = catalogGridMarkup();
  }

  function openProductDrawer(productId) {
    const product = getProduct(productId);
    if (!product) {
      toast("Товар не найден", "Обновите каталог и попробуйте снова.", "info");
      return;
    }
    const applicableRules = state.rules.filter((rule) => rule.enabled && rule.id !== "r7").slice(0, 4);
    openModal(
      `${modalHeader("Карточка товара", `${product.category} · ${product.sku}`)}
      <div class="modal-body">
        <div class="drawer-product-hero">
          ${productThumb(product)}
          ${product.badge ? `<span class="badge badge-lime">${esc(product.badge)}</span>` : ""}
        </div>
        <div class="drawer-product-meta">
          <span class="badge badge-gray">${esc(product.category)}</span>
          <span class="badge ${product.stock === 0 ? "badge-amber" : product.stock <= 3 ? "badge-amber" : "badge-green"}">${product.stock === 0 ? "Под заказ" : "Осталось " + product.stock + " шт."}</span>
        </div>
        <h2 class="drawer-product-title">${esc(product.name)}</h2>
        <p style="margin-top:3px;font-size:11.5px;color:var(--muted)">${esc(product.subtitle)}</p>
        <div class="drawer-price-row"><strong>${formatPrice(product.price)}</strong>${product.oldPrice ? `<span style="text-decoration:line-through">${formatPrice(product.oldPrice)}</span>` : ""}<span>цена на Авито</span></div>
        <div class="drawer-stats">
          <span>${iconSprite("i-chat")} ${product.inquiries} ${plural(product.inquiries, "вопрос", "вопроса", "вопросов")}</span>
          <span>${iconSprite("i-sparkles")} ${product.autoReplies} ${plural(product.autoReplies, "автоответ", "автоответа", "автоответов")}</span>
          <span>${iconSprite("i-box")} ${product.stock} ${plural(product.stock, "штука", "штуки", "штук")}</span>
        </div>
        <div class="drawer-product-note" style="margin:12px 0 16px;padding:10px 12px;border-radius:9px;background:#fffdf8;border:1px solid #f7f5f0;font-size:11px;line-height:1.5;color:var(--ink-soft)">${iconSprite("i-info", "muted")} ${esc(product.note || "Особых условий для этого товара нет.")}</div>
        <div class="field">
          <span class="field-label">Автоответы по товару <span class="switch"><input type="checkbox" data-drawer-product-auto ${product.auto ? "checked" : ""} aria-label="Автоответы по товару"/><span class="switch-track"></span></span></span>
          <span class="field-hint">Если выключить, бот будет отвечать по общим правилам магазина, но не станет называть наличие и цену этого товара.</span>
        </div>
        <div class="modal-divider"></div>
        <div class="modal-section-label">Бот использует эти сценарии</div>
        <div class="product-rule-list">
          ${applicableRules
            .map(
              (rule) => `<div class="product-rule-item"><span class="rule-icon ${esc(rule.accent)}" style="width:28px;height:28px;border-radius:8px">${iconSprite(rule.icon)}</span><div><strong>${esc(rule.name)}</strong><span>${rule.triggers.slice(0, 3).map((trigger) => esc(trigger)).join(" · ")}</span></div>${iconSprite("i-check", "muted")}</div>`
            )
            .join("")}
        </div>
        <div class="form-hint" style="margin-top:14px">${iconSprite("i-wand")} Ответы подставляют название, цену и остаток автоматически. Значения берутся из карточки товара.</div>
      </div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-product-rules>Открыть сценарии</button><button class="btn btn-primary btn-sm" type="button" data-modal-close>Готово</button></div>`,
      {
        className: "drawer",
        backdropClass: "drawer-backdrop",
        onMount: (modal) => {
          $("[data-drawer-product-auto]", modal)?.addEventListener("change", (event) => {
            const enabled = event.target.checked;
            product.auto = enabled;
            saveState();
            toast(enabled ? "Бот включён" : "Бот выключен", enabled ? `Автоответы по «${product.name}» включены.` : `Автоответы по «${product.name}» остановлены.`, enabled ? "success" : "info");
            if (ui.page === "catalog") refreshCatalogGrid();
          });
          $("[data-product-rules]", modal)?.addEventListener("click", () => {
            closeModal();
            navigate("rules");
          });
        },
      }
    );
  }

  function openAddProductModal() {
    const units = ["м²", "шт", "выезд", "час", "упак", "объект", "комплект"];
    openModal(
      `${modalHeader("Новая позиция", "Товар со склада или услуга с ценой за м² — бот ответит по любым условиям.")}
      <div class="modal-body">
        <div class="field">
          <label class="field-label">Что добавляем</label>
          <div class="segmented" id="new-product-kind" role="group" aria-label="Тип позиции">
            <button type="button" class="active" data-kind-set="service">${iconSprite("i-bolt")} Услуга</button>
            <button type="button" data-kind-set="good">${iconSprite("i-box")} Товар</button>
          </div>
        </div>
        <div class="field" style="margin-top:15px"><label class="field-label" for="new-product-name">Название</label><input class="input" id="new-product-name" placeholder="Например, утепление фасада" /></div>
        <div class="field-row" style="margin-top:15px">
          <div class="field"><label class="field-label" for="new-product-price">Цена, ₽</label><input class="input" id="new-product-price" type="number" min="0" placeholder="1450" /></div>
          <div class="field"><label class="field-label" for="new-product-unit">За единицу</label><select class="select" id="new-product-unit">${units
            .map((unit) => `<option${unit === "м²" ? " selected" : ""}>${unit}</option>`)
            .join("")}</select></div>
        </div>
        <div class="field-row" style="margin-top:15px">
          <div class="field"><label class="field-label" for="new-product-category">Категория</label><input class="input" id="new-product-category" placeholder="Утепление" list="new-product-categories" /><datalist id="new-product-categories"><option>Утепление</option><option>Сантехника</option><option>Стройматериалы</option><option>Монтаж</option></datalist></div>
          <div class="field" data-kind-field="service"><label class="field-label" for="new-product-min">Минимум, ед. <small>необязательно</small></label><input class="input" id="new-product-min" type="number" min="0" placeholder="30" /></div>
          <div class="field" data-kind-field="good" hidden><label class="field-label" for="new-product-stock">Остаток на складе</label><input class="input" id="new-product-stock" type="number" min="0" max="99999" value="1" inputmode="numeric" /></div>
        </div>
        <div class="field" style="margin-top:15px" data-kind-field="service"><label class="field-label" for="new-product-duration">Сколько занимает <small>необязательно</small></label><input class="input" id="new-product-duration" placeholder="2–4 дня" /></div>
        <div class="field" style="margin-top:15px"><label class="field-label" for="new-product-note">Заметка для бота <small>необязательно</small></label><textarea class="textarea" id="new-product-note" placeholder="Например: цена под ключ, выезд на замер бесплатный"></textarea></div>
        <div class="form-hint" style="margin-top:14px">${iconSprite("i-info")} Позиция сразу появится в каталоге: бот будет называть цену за единицу, минимальный объём и сроки.</div>
      </div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button><button class="btn btn-primary btn-sm" type="button" data-create-product>Добавить</button></div>`,
      {
        onMount: (modal) => {
          let kind = "service";
          const sync = () => {
            $$("[data-kind-set]", modal).forEach((button) => {
              button.classList.toggle("active", button.getAttribute("data-kind-set") === kind);
            });
            $$("[data-kind-field]", modal).forEach((field) => {
              field.hidden = field.getAttribute("data-kind-field") !== kind;
            });
            const unit = $("#new-product-unit", modal);
            if (unit) unit.value = kind === "good" ? "шт" : "м²";
          };
          $$("[data-kind-set]", modal).forEach((button) => {
            button.addEventListener("click", () => {
              kind = button.getAttribute("data-kind-set");
              sync();
            });
          });
          sync();

          $("[data-create-product]", modal)?.addEventListener("click", () => {
            const name = $("#new-product-name", modal).value.trim();
            const price = Number($("#new-product-price", modal).value);
            const category = $("#new-product-category", modal).value.trim() || (kind === "good" ? "Стройматериалы" : "Услуги");
            const note = $("#new-product-note", modal).value.trim();
            if (!name) {
              toast("Введите название", "Названию нужно хотя бы одно слово.", "info");
              $("#new-product-name", modal).focus();
              return;
            }
            if (!price || price <= 0) {
              toast("Введите цену", "Укажите цену в рублях.", "info");
              $("#new-product-price", modal).focus();
              return;
            }
            const product = {
              id: uid("p"),
              kind,
              name,
              subtitle: "",
              sku: "DEMO-" + Math.floor(1000 + Math.random() * 9000),
              category,
              unit: $("#new-product-unit", modal).value,
              minOrder: Math.max(0, parseInt($("#new-product-min", modal)?.value, 10) || 0),
              duration: $("#new-product-duration", modal)?.value.trim() || "",
              price,
              stock: kind === "good" ? Math.max(0, Math.min(99999, parseInt($("#new-product-stock", modal)?.value, 10) || 0)) : 0,
              image: "",
              inquiries: 0,
              autoReplies: 0,
              auto: true,
              note: note || "",
            };
            state.products.push(product);
            saveState();
            closeModal();
            if (ui.page === "catalog") renderRoute();
            toast(kind === "good" ? "Товар добавлен" : "Услуга добавлена", `«${name}» готова принимать вопросы.`, "success");
          });
        },
      }
    );
  }

  function bindCatalog() {
    const grid = $("#product-grid");
    const search = $("#catalog-search-input");

    search?.addEventListener("input", () => {
      ui.catalogSearch = search.value;
      refreshCatalogGrid();
    });

    $$("[data-catalog-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.catalogKind = button.getAttribute("data-catalog-kind");
        $$("[data-catalog-kind]").forEach((tab) => {
          tab.classList.toggle("active", tab.getAttribute("data-catalog-kind") === ui.catalogKind);
        });
        refreshCatalogGrid();
      });
    });

    $$("[data-catalog-category]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.catalogCategory = button.getAttribute("data-catalog-category");
        $$("[data-catalog-category]").forEach((tab) => {
          tab.classList.toggle("active", tab.getAttribute("data-catalog-category") === ui.catalogCategory);
        });
        refreshCatalogGrid();
      });
    });

    $("[data-sync-catalog]")?.addEventListener("click", () => {
      const button = $("[data-sync-catalog]");
      button.disabled = true;
      button.innerHTML = `${iconSprite("i-refresh")} Синхронизация…`;
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = `${iconSprite("i-sync")} Синхронизировать`;
        if (!state.products.length) {
          toast("Авито не подключено", "Каталог не загружается из Авито. Добавьте товар вручную.");
        } else {
        toast("Каталог синхронизирован", "8 объявлений обновлены.", "success");
        state.feed.unshift({ id: uid("f"), type: "sync", icon: "i-sync", text: "Наличие обновлено по 8 товарам", time: "Только что" });
        }
        state.feed = state.feed.slice(0, 8);
        saveState();
      }, 1100);
    });

    $("[data-add-product]")?.addEventListener("click", openAddProductModal);

    grid?.addEventListener("click", (event) => {
      if (event.target.closest("[data-add-product]")) {
        openAddProductModal();
        return;
      }
      const toggle = event.target.closest("[data-product-toggle]");
      if (toggle) {
        event.stopPropagation();
        const product = getProduct(toggle.getAttribute("data-product-toggle"));
        if (!product) return;
        product.auto = !product.auto;
        saveState();
        toast(product.auto ? "Бот включён" : "Бот выключен", product.auto ? `Автоответы по «${product.name}» включены.` : `Автоответы по «${product.name}» остановлены.`, product.auto ? "success" : "info");
        refreshCatalogGrid();
        return;
      }
      const open = event.target.closest("[data-product-open]");
      if (open) {
        openProductDrawer(open.getAttribute("data-product-open"));
        return;
      }
      const card = event.target.closest("[data-product-card]");
      if (card && !event.target.closest("button, input, label, a")) {
        openProductDrawer(card.getAttribute("data-product-card"));
      }
    });

    grid?.addEventListener("change", (event) => {
      if (event.target.matches("[data-product-auto]")) {
        const product = getProduct(event.target.getAttribute("data-product-auto"));
        if (!product) return;
        product.auto = event.target.checked;
        saveState();
        toast(product.auto ? "Бот включён" : "Бот выключен", product.auto ? `Автоответы по «${product.name}» включены.` : `Автоответы по «${product.name}» остановлены.`, product.auto ? "success" : "info");
        refreshCatalogGrid();
      }
    });
  }

  /* ========================================================================
     Rules / scenarios
     ======================================================================== */

  const RULE_ICON_OPTIONS = [
    { icon: "i-box", accent: "blue", label: "Наличие" },
    { icon: "i-tag", accent: "amber", label: "Цена" },
    { icon: "i-truck", accent: "cyan", label: "Доставка" },
    { icon: "i-shield", accent: "green", label: "Гарантия" },
    { icon: "i-pin", accent: "violet", label: "Самовывоз" },
    { icon: "i-image", accent: "rose", label: "Фото" },
    { icon: "i-users", accent: "gray", label: "Менеджер" },
  ];

  function rulePreview(rule) {
    const product = state.products[0] || SAMPLE_PRODUCT;
    return String(rule.reply)
      .replace(/\{\{товар\}\}/g, product.name)
      .replace(/\{\{цена\}\}/g, formatPrice(product.price))
      .replace(/\{\{остаток\}\}/g, `${product.stock} шт.`)
      .replace(/\{\{цена_со_скидкой\}\}/g, formatPrice(Math.round(product.price * 0.95)));
  }

  function ruleCardMarkup(rule) {
    return `<article class="rule-card ${rule.enabled ? "" : "is-off"}" data-rule-card="${esc(rule.id)}">
      <div class="rule-top">
        <span class="rule-icon ${esc(rule.accent)}">${iconSprite(rule.icon)}</span>
        <div class="rule-main">
          <div class="rule-name">${esc(rule.name)}</div>
          <div class="rule-desc">${esc(rule.desc)}</div>
        </div>
        <label class="switch"><input type="checkbox" data-rule-toggle="${esc(rule.id)}" ${rule.enabled ? "checked" : ""} aria-label="Учитывать инструкцию ${esc(rule.name)}"/><span class="switch-track"></span></label>
      </div>
      <div class="rule-body">
        <div class="rule-triggers"><span class="rule-trigger-label">Когда спрашивают</span>${rule.triggers
          .map((trigger) => `<span class="rule-trigger">${esc(trigger)}</span>`)
          .join("")}</div>
        <div class="rule-reply">
          <div class="rule-reply-label">${iconSprite("i-sparkles")} Что учитывать в ответе</div>
          ${esc(rulePreview(rule))}
        </div>
      </div>
      <div class="rule-foot">
        <div class="rule-stat"><strong>${formatNumber(rule.used)}</strong><span>ответов</span></div>
        <div class="rule-stat"><strong>${rule.used ? rule.accuracy + "%" : "—"}</strong><span>точность</span></div>
        <span class="rule-accuracy">${iconSprite("i-check-circle")} ${rule.enabled ? "включён" : "выключен"}</span>
        <button class="rule-edit-btn" type="button" data-rule-edit="${esc(rule.id)}">${iconSprite("i-edit")} Править</button><button class="rule-delete-btn" type="button" data-rule-delete="${esc(rule.id)}" aria-label="Удалить инструкцию «${esc(rule.name)}»" title="Удалить">${iconSprite("i-trash")}</button>
      </div>
    </article>`;
  }

  function renderRules() {
    const enabled = state.rules.filter((rule) => rule.enabled).length;
    const accuracy = state.rules.reduce((sum, rule) => sum + rule.accuracy, 0) / Math.max(1, state.rules.length);
    return `<div class="page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> Инструкции для ИИ</div>
          <h1 class="page-title">Инструкции ИИ</h1>
          <p class="page-sub">Бот отвечает сам и учитывает инструкции ниже.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-white" type="button" data-test-bot>${iconSprite("i-bolt")} Проверить на сообщении</button>
          <button class="btn btn-primary" type="button" data-new-rule>${iconSprite("i-plus")} Новая инструкция</button>
        </div>
      </div>

      <div class="automation-banner">
        <div class="automation-copy">
          <span class="eyebrow">Автопилот</span>
          <h2>Бот отвечает, пока вы занимаетесь магазином</h2>
          <p>Сообщение покупателя проходит через распознавание темы, проверку данных товара и генерацию ответа. Нестандартные вопросы уходят менеджеру.</p>
          <div class="automation-status"><span class="demo-dot"></span> ${enabled} из ${state.rules.length} сценариев включены${accuracy ? " · средняя точность " + accuracy.toFixed(0) + "%" : " · точность появится после первых ответов"}</div>
        </div>
        <div class="pipeline" aria-label="Как работает автоответ">
          <div class="pipeline-step"><span class="pipeline-icon">${iconSprite("i-chat")}</span><span>Сообщение</span></div>
          <span class="pipeline-connector"></span>
          <div class="pipeline-step"><span class="pipeline-icon">${iconSprite("i-bolt")}</span><span>Тема</span></div>
          <span class="pipeline-connector"></span>
          <div class="pipeline-step"><span class="pipeline-icon">${iconSprite("i-box")}</span><span>Данные</span></div>
          <span class="pipeline-connector"></span>
          <div class="pipeline-step"><span class="pipeline-icon">${iconSprite("i-sparkles")}</span><span>Ответ</span></div>
          <span class="pipeline-connector"></span>
          <div class="pipeline-step"><span class="pipeline-icon">${iconSprite("i-check-circle")}</span><span>Отправлен</span></div>
        </div>
      </div>

      <div class="rules-toolbar">
        <div><h2>Правила автоответов</h2><p>${enabled} активны · изменения применяются сразу</p></div>
        <button class="btn btn-white btn-sm" type="button" data-open-help>${iconSprite("i-help")} Как выбирается ответ</button>
      </div>
      <div class="rule-grid">${state.rules.map(ruleCardMarkup).join("")}</div>
    </div>`;
  }

  function openRuleEditor(ruleId) {
    const isNew = !ruleId;
    const rule = isNew
      ? { name: "", desc: "", triggers: [], reply: "Здравствуйте! ", icon: "i-sparkles", accent: "blue" }
      : getRule(ruleId);
    if (!rule) return;
    openModal(
      `${modalHeader(isNew ? "Новый сценарий" : "Редактирование сценария", isNew ? "Правило сразу начнёт работать в автоответах." : "Изменения сразу влияют на автоответы.")}
      <div class="modal-body">
        <div class="field"><label class="field-label" for="rule-name">Название</label><input class="input" id="rule-name" value="${esc(rule.name)}" placeholder="Например, Оплата по счёту"/></div>
        <div class="field"><label class="field-label" for="rule-desc">Что делает бот</label><input class="input" id="rule-desc" value="${esc(rule.desc)}" placeholder="Короткое описание для команды"/></div>
        <div class="field"><label class="field-label" for="rule-triggers">Триггеры <small>через запятую</small></label><input class="input" id="rule-triggers" value="${esc(rule.triggers.join(", "))}" placeholder="счёт, оплата, юрлицо"/></div>
        <div class="field"><label class="field-label" for="rule-reply">Шаблон ответа <small>{{товар}}, {{цена}}, {{остаток}}</small></label><textarea class="textarea" id="rule-reply" rows="4" placeholder="Да, «{{товар}}» есть в наличии — {{цена}}.">${esc(rule.reply)}</textarea></div>
        <div class="field"><span class="field-label">Иконка</span>
          <div class="tone-options" style="grid-template-columns:repeat(4,1fr)">
            ${RULE_ICON_OPTIONS.map(
              (option, index) =>
                `<label class="tone-option" style="padding:10px"><input type="radio" name="rule-icon" value="${option.icon}|${option.accent}" ${index === (RULE_ICON_OPTIONS.findIndex((item) => item.icon === rule.icon) || 0) ? "checked" : ""}/><div class="tone-option-top"><span class="tone-option-emoji" style="width:24px;height:24px">${iconSprite(option.icon)}</span><span class="choice-check">${iconSprite("i-check")}</span></div><strong style="font-size:9.5px;margin-top:5px">${option.label}</strong></label>`
            ).join("")}
          </div>
        </div>
        <div class="form-hint" style="margin-top:14px">${iconSprite("i-info")} Бот работает по вашим правилам и через нейросеть.</div>
      </div>
      <div class="modal-foot">${isNew ? "" : `<button class="btn btn-white btn-sm ar-danger-btn" type="button" data-rule-delete="${esc(rule.id)}">${iconSprite("i-trash")} Удалить</button>`}<button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button><button class="btn btn-primary btn-sm" type="button" data-save-rule>${isNew ? "Создать" : "Сохранить"}</button></div>`,
      {
        onMount: (modal) => {
          $("[data-save-rule]", modal)?.addEventListener("click", () => {
            const name = $("#rule-name", modal).value.trim();
            const desc = $("#rule-desc", modal).value.trim();
            const triggers = $("#rule-triggers", modal).value.split(",").map((item) => item.trim()).filter(Boolean);
            const reply = $("#rule-reply", modal).value.trim();
            const picked = $("input[name='rule-icon']:checked", modal);
            const [icon, accent] = picked ? picked.value.split("|") : ["i-sparkles", "blue"];
            if (!name || !reply || !triggers.length) {
              toast("Заполните сценарий", "Нужны название, хотя бы один триггер и шаблон ответа.", "info");
              return;
            }
            if (isNew) {
              state.rules.push({ id: uid("r"), icon, accent, name, desc: desc || "Новое правило.", triggers, reply, used: 0, accuracy: 100, enabled: true });
            } else {
              Object.assign(rule, { icon, accent, name, desc, triggers, reply });
            }
            saveState();
            closeModal();
            renderRoute();
            updateGlobalBadges();
            toast(isNew ? "Инструкция добавлена" : "Инструкция сохранена", isNew ? "Бот начнёт учитывать её в новых диалогах." : "Изменения сразу применились к ответам.", "success");
          });
        },
      }
    );
  }

  function openBotTestModal() {
    openModal(
      `${modalHeader("Проверить бота", "Сообщение обработается локально, без реальной отправки.")}
      <div class="modal-body">
        <div class="field"><label class="field-label" for="test-message">Сообщение покупателя</label><textarea class="textarea" id="test-message" rows="2">Здравствуйте! А доставка в Казань сколько займёт?</textarea></div>
        <div class="modal-foot-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          <button class="suggestion-chip" type="button" data-test-preset="Сделаете скидку?">Сделаете скидку?</button>
          <button class="suggestion-chip" type="button" data-test-preset="Какая гарантия?">Какая гарантия?</button>
          <button class="suggestion-chip" type="button" data-test-preset="Нужен счёт для ООО">Счёт для ООО</button>
        </div>
        <div id="test-result" class="test-result" hidden></div>
      </div>
      <div class="modal-foot"><button class="btn btn-white btn-sm" type="button" data-test-open-chat>Открыть чат целиком</button><button class="btn btn-primary btn-sm" type="button" data-run-test>${iconSprite("i-bolt")} Проверить</button></div>`,
      {
        onMount: (modal) => {
          $$("[data-test-preset]", modal).forEach((button) => {
            button.addEventListener("click", () => {
              $("#test-message", modal).value = button.getAttribute("data-test-preset");
              $("[data-run-test]", modal).click();
            });
          });
          $("[data-run-test]", modal)?.addEventListener("click", async () => {
            const text = $("#test-message", modal).value.trim();
            if (!text) return;
            const box = $("#test-result", modal);
            box.hidden = false;
            box.innerHTML = `<div class="test-result-head"><span class="demo-dot"></span> Бот думает…</div>`;
            const hook = window.AutoRFeatures && window.AutoRFeatures.aiOnline;
            let reply = null;
            if (hook) {
              try {
                reply = await hook(getChat("c1") || state.chats[0] || TEST_CHAT, text);
              } catch (error) {
                reply = null;
              }
            }
            if (!reply) {
              box.innerHTML = `<div class="test-result-head"><span class="demo-dot"></span> Бот не ответил</div><p class="test-result-meta">ИИ недоступен или закончился лимит — вопрос уйдёт менеджеру.</p>`;
              return;
            }
            box.innerHTML = `<div class="test-result-head"><span class="demo-dot"></span> Ответ бота</div>
              <div class="message out" style="padding:0;background:none"><div class="message-body"><div class="bubble"><div class="bubble-label">${iconSprite("i-sparkles")} AutoR · ${esc(reply.rule)} <span class="confidence">${reply.confidence}%</span></div><div class="bubble-text">${esc(reply.text)}</div><div class="bubble-foot"><span>готово за ${esc(reply.latency)}</span><span class="dot-sep">·</span>${iconSprite("i-check")}</div></div></div></div>
              ${reply.attachment ? `<img src="${esc(reply.attachment)}" alt="Фото" style="width:100%;border-radius:10px;margin-top:10px"/>` : ""}
              <div class="test-result-meta">Сценарий: ${esc(reply.rule)} ${reply.handoff ? "· вопрос уйдёт менеджеру" : ""}</div>`;
          });
          $("[data-test-open-chat]", modal)?.addEventListener("click", () => {
            closeModal();
            ui.composerMode = "buyer";
            navigate("chats/c1");
          });
          setTimeout(() => $("#test-message", modal)?.focus(), 120);
        },
      }
    );
  }

  function bindRules() {
    $(".rule-grid")?.addEventListener("change", (event) => {
      const toggle = event.target.closest("[data-rule-toggle]");
      if (!toggle) return;
      const rule = getRule(toggle.getAttribute("data-rule-toggle"));
      if (!rule) return;
      rule.enabled = toggle.checked;
      saveState();
      const card = toggle.closest("[data-rule-card]");
      if (card) card.classList.toggle("is-off", !rule.enabled);
      const accuracy = $(".rule-accuracy", card);
      if (accuracy) accuracy.innerHTML = `${iconSprite("i-check-circle")} ${rule.enabled ? "включён" : "выключен"}`;
      updateGlobalBadges();
      toast(rule.enabled ? "Инструкция включена" : "Инструкция выключена", `«${rule.name}» ${rule.enabled ? "снова учитывается в ответах." : "не будет учитываться ботом."}`, rule.enabled ? "success" : "info");
    });

    $(".rule-grid")?.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-rule-edit]");
      if (edit) openRuleEditor(edit.getAttribute("data-rule-edit"));
    });

    $("[data-new-rule]")?.addEventListener("click", () => openRuleEditor(null));
    $("[data-test-bot]")?.addEventListener("click", openBotTestModal);
  }

  /* ========================================================================
     Analytics
     ======================================================================== */

  const ACCENT_DOT = {
    blue: "#121c23",
    amber: "#f07b3f",
    cyan: "#ffc21a",
    green: "#4ed598",
    violet: "#8b73f8",
    rose: "#f06c9b",
    gray: "#b1aba0",
  };

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function analyticsPeriodData() {
    const month = ui.analyticsPeriod === "month";
    const period = month ? state.month : state.week;
    const messages = sum(period.messages);
    const auto = sum(period.auto);
    return {
      month,
      period,
      messages,
      auto,
      share: Math.round((auto / Math.max(1, messages)) * 100),
      orders: Math.round((state.stats.orders * messages) / Math.max(1, sum(state.week.messages))),
      label: month ? "30 дней" : "7 дней",
    };
  }

  function analyticsStatsMarkup(data) {
    const stats = [
      {
        icon: "i-chat",
        tone: "",
        label: `Сообщений за ${data.label}`,
        value: formatNumber(data.messages),
        foot: `<span class="delta">${iconSprite("i-trend-up")} +18%</span><span>к прошлому периоду</span>`,
      },
      {
        icon: "i-sparkles",
        tone: "lime",
        label: "Закрыто ботом",
        value: formatNumber(data.auto),
        foot: `<span class="delta neutral">${data.share}% от всех</span><span>без менеджера</span>`,
      },
      {
        icon: "i-clock",
        tone: "amber",
        label: "Средний ответ",
        value: `${state.stats.avgResponse} <small>сек</small>`,
        foot: `<span class="delta">${iconSprite("i-trend-down")} −42 сек</span><span>быстрее человека</span>`,
      },
      {
        icon: "i-box",
        tone: "violet",
        label: "Заказов из чатов",
        value: formatNumber(data.orders),
        foot: `<span class="delta">+${data.month ? 11 : 3}</span><span>за ${data.label}</span>`,
      },
    ];
    return stats
      .map(
        (stat) => `<article class="analytics-stat">
          <div class="analytics-stat-top"><span class="analytics-stat-label">${esc(stat.label)}</span><span class="kpi-icon ${esc(stat.tone)}" style="width:28px;height:28px">${iconSprite(stat.icon)}</span></div>
          <div class="analytics-stat-value">${stat.value}</div>
          <div class="analytics-stat-foot">${stat.foot}</div>
        </article>`
      )
      .join("");
  }

  function scenarioRowsMarkup() {
    const totalUsed = sum(state.rules.map((rule) => rule.used));
    return `<div class="scenario-tr head"><span>Инструкция</span><span>Ответы</span><span>Точность</span><span>Доля</span></div>
      ${state.rules
        .slice(0, 6)
        .map((rule) => {
          const share = Math.round((rule.used / Math.max(1, totalUsed)) * 100);
          return `<div class="scenario-tr">
            <span class="scenario-name"><i class="legend-dot" style="background:${ACCENT_DOT[rule.accent] || ACCENT_DOT.blue}"></i>${esc(rule.name)}</span>
            <span class="scenario-num">${formatNumber(rule.used)}</span>
            <span class="scenario-num">${rule.used ? rule.accuracy + "%" : "—"}</span>
            <span class="scenario-progress"><span class="bar-track"><span class="bar-fill" style="display:block;width:${share}%;background:${ACCENT_DOT[rule.accent] || ACCENT_DOT.blue}"></span></span><span>${share}%</span></span>
          </div>`;
        })
        .join("")}`;
  }

  function heatmapMarkup() {
    const { days, values, hours } = state.heatmap;
    const max = Math.max.apply(null, values.flat());
    const cells = (row) =>
      row
        .map((value) => {
          const level = value ? Math.max(1, Math.ceil((value / max) * 5)) : 0;
          return `<span class="heatmap-cell" data-level="${level}" title="${value} сообщений"></span>`;
        })
        .join("");
    return `<div class="heatmap">
      <div class="heatmap-hours"><span></span>${hours.map((hour) => `<span>${esc(hour)}</span>`).join("")}</div>
      <div class="heatmap-grid">
        ${days
          .map(
            (day, index) => `<span class="heatmap-day">${esc(day)}</span>${cells(values[index])}`
          )
          .join("")}
      </div>
      <div class="heatmap-legend"><span>меньше</span>${[1, 2, 3, 4, 5]
        .map((level) => `<i data-level="${level}" class="heatmap-cell" style="width:8px;height:8px"></i>`)
        .join("")}<span>больше</span></div>
    </div>`;
  }

  function renderAnalytics() {
    const data = analyticsPeriodData();
    return `<div class="page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> ${state.chats.length ? "Статистика" : "Пока без данных"} · ${esc(data.label)}</div>
          <h1 class="page-title">Аналитика</h1>
          <p class="page-sub">Что происходит в чатах: скорость ответа, темы вопросов и путь покупателя до заказа.</p>
        </div>
        <div class="page-actions">
          <div class="segmented" data-analytics-period>
            <button class="${data.month ? "" : "active"}" type="button" data-period="week">7 дней</button>
            <button class="${data.month ? "active" : ""}" type="button" data-period="month">30 дней</button>
          </div>
          <button class="btn btn-white" type="button" data-export-state>${iconSprite("i-download")} Экспорт</button>
        </div>
      </div>

      <div class="analytics-stats">${analyticsStatsMarkup(data)}</div>

      <div class="analytics-grid-top">
        <section class="card analytics-card">
          <div class="card-head">
            <div><h3 class="card-title">Динамика сообщений</h3><p class="card-sub">Покупатели и автоответы за ${esc(data.label)}</p></div>
            <span class="badge badge-green badge-dot">онлайн</span>
          </div>
          <div class="chart-wrap">
            ${window.Charts.areaChart({
              primary: data.period.messages,
              secondary: data.period.auto,
              labels: data.period.labels,
              primaryLabel: "Сообщения",
              height: 200,
            })}
          </div>
          <div class="chart-legend">
            <span><i class="legend-line"></i> Сообщения</span>
            <span><i class="legend-line dashed"></i> Автоответы</span>
            <span class="analytics-legend-note">${esc(data.month ? "30 дней" : "последние 7 дней")}</span>
          </div>
        </section>

        <section class="card analytics-card">
          <div class="card-head"><div><h3 class="card-title">Доля автоответов</h3><p class="card-sub">Кто закрывает диалоги</p></div></div>
          <div class="analytics-donut-row">
            <div class="donut-wrap">
              ${window.Charts.donut([
                { name: "Бот", value: data.auto, color: "#121c23" },
                { name: "Менеджер", value: data.messages - data.auto, color: "#ffc21a" },
              ])}
              <div class="donut-center"><strong>${data.share}%</strong><span>ботом</span></div>
            </div>
            <div class="analytics-donut-legend">
              <div><i style="background:#121c23"></i><span>Автоответы</span><strong>${formatNumber(data.auto)}</strong></div>
              <div><i style="background:#ffc21a"></i><span>С менеджером</span><strong>${formatNumber(data.messages - data.auto)}</strong></div>
            </div>
          </div>
          <div class="analytics-mini-note">${iconSprite("i-sparkles")} Бот отвечает на ${data.share}% сообщений — это экономит около ${Math.round((data.auto / (data.month ? 30 : 7)) * 1.4)} минут в день.</div>
        </section>
      </div>

      <div class="analytics-grid-bottom">
        <section class="card analytics-card">
          <div class="card-head"><div><h3 class="card-title">Путь покупателя</h3><p class="card-sub">За сегодня: от первого сообщения до заказа</p></div><span class="badge badge-gray">сегодня</span></div>
          <div class="funnel">
            ${state.funnel
              .map(
                (stage) => `<div class="funnel-stage">
                  <div class="funnel-top"><span class="funnel-label">${esc(stage.label)}</span><span class="funnel-value">${formatNumber(stage.value)}<span>${stage.percent}%</span></span></div>
                  <div class="funnel-track"><div class="funnel-fill" style="width:${stage.percent}%"></div></div>
                </div>`
              )
              .join("")}
          </div>
          <div class="funnel-note">${iconSprite("i-trend-up")} ${state.funnel[state.funnel.length - 1]?.percent || 0}% обращений превращаются в заказ — это ${formatNumber(state.funnel[state.funnel.length - 1]?.value || 0)} из ${formatNumber(state.funnel[0]?.value || 0)} сообщений за сегодня.</div>
        </section>

        <section class="card analytics-card">
          <div class="card-head">
            <div><h3 class="card-title">Сценарии бота</h3><p class="card-sub">Куда бот направляет ответы</p></div>
            <a class="card-more" href="#/rules">Все сценарии ${iconSprite("i-arrow-right")}</a>
          </div>
          <div class="scenarios-table">${scenarioRowsMarkup()}</div>
        </section>
      </div>

      <div class="analytics-grid-single">
        <section class="card analytics-card">
          <div class="card-head">
            <div><h3 class="card-title">Когда пишут покупатели</h3><p class="card-sub">Распределение входящих по дням и часам</p></div>
            <span class="badge badge-gray">Europe/Moscow</span>
          </div>
          ${heatmapMarkup()}
        </section>
      </div>
    </div>`;
  }

  function bindAnalytics() {
    $$("[data-analytics-period] [data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.analyticsPeriod = button.getAttribute("data-period");
        renderRoute();
      });
    });
  }

  /* ========================================================================
     Settings
     ======================================================================== */

  const SETTINGS_TABS = [
    { id: "profile", label: "Профиль магазина", icon: "i-user" },
    { id: "autopilot", label: "Автопилот", icon: "i-sparkles" },
    { id: "ai", label: "Ответы ИИ", icon: "i-wand" },
    { id: "notifications", label: "Уведомления", icon: "i-bell" },
    { id: "integrations", label: "Интеграции", icon: "i-link" },
    { id: "demo", label: "Данные кабинета", icon: "i-info" },
  ];

  const TONE_COPY = {
    friendly: "Здравствуйте, Артём! Да, «Sony WH-1000XM5» есть в наличии — 28 990 ₽. Могу отложить на пару часов. Хорошего дня! 😊",
    neutral: "Добрый день, Артём. «Sony WH-1000XM5» есть в наличии — 28 990 ₽. Могу отложить на пару часов.",
    expert: "Добрый день. «Sony WH-1000XM5» в наличии — 28 990 ₽. Гарантия 12 месяцев, проверка при получении. Готов оформить доставку.",
  };

  const TONE_OPTIONS = [
    { id: "friendly", emoji: "🙂", title: "Дружелюбный", desc: "Тёплый тон, эмодзи и забота о покупателе." },
    { id: "neutral", emoji: "💬", title: "Нейтральный", desc: "Спокойно, по делу, без лишних эмоций." },
    { id: "expert", emoji: "🎧", title: "Экспертный", desc: "Уверенно, с деталями и характеристиками." },
  ];

  function settingsNavMarkup() {
    return `<nav class="settings-nav" aria-label="Разделы настроек">
      ${SETTINGS_TABS.map(
        (tab) =>
          `<button class="${ui.settingsTab === tab.id ? "active" : ""}" type="button" data-settings-tab="${tab.id}">${iconSprite(tab.icon)} ${esc(tab.label)}</button>`
      ).join("")}
      <div class="settings-nav-note">${iconSprite("i-lock")} Изменения сохраняются автоматически.</div>
    </nav>`;
  }

  function tonePreviewMarkup() {
    return `<div class="tone-preview">
      <div class="tone-preview-head">${iconSprite("i-sparkles")} Так ответит бот <span class="badge badge-lime">предпросмотр</span></div>
      <div class="bubble"><div class="bubble-text" data-tone-preview-text>${esc(TONE_COPY[state.settings.tone] || TONE_COPY.friendly)}</div></div>
    </div>`;
  }

  function profilePanelMarkup() {
    const shop = state.shop;
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="profile-logo-row">
          <div class="profile-logo">${esc(shop.name.charAt(0))}</div>
          <div class="profile-logo-info"><strong>${esc(shop.name)}</strong><span>${esc(shop.tagline)} · ${esc(shop.city)}</span>
            <div class="profile-logo-actions"><button class="btn btn-white btn-sm" type="button" data-demo-toast="Свой логотип — в полной версии">${iconSprite("i-image")} Загрузить логотип</button></div>
          </div>
          <span class="badge badge-green">${iconSprite("i-check")} синхронизирован</span>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="set-shop-name">Название магазина</label><input class="input" id="set-shop-name" value="${esc(shop.name)}" /></div>
          <div class="field"><label class="field-label" for="set-shop-tagline">Чем занимаетесь</label><input class="input" id="set-shop-tagline" value="${esc(shop.tagline)}" /></div>
        </div>
        <div class="field-row" style="margin-top:15px">
          <div class="field"><label class="field-label" for="set-owner">Владелец</label><input class="input" id="set-owner" value="${esc(shop.owner)}" /></div>
          <div class="field"><label class="field-label" for="set-city">Город</label><input class="input" id="set-city" value="${esc(shop.city)}" /></div>
        </div>
        <div class="field-row" style="margin-top:15px">
          <div class="field"><label class="field-label" for="set-email">Email</label><input class="input" id="set-email" type="email" value="${esc(shop.email)}" /></div>
          <div class="field"><label class="field-label" for="set-phone">Телефон</label><input class="input" id="set-phone" value="${esc(shop.phone)}" /></div>
        </div>
        <div class="field" style="margin-top:15px"><label class="field-label" for="set-description">Описание магазина</label><textarea class="textarea" id="set-description" rows="3">${esc(shop.description)}</textarea><span class="field-hint">Бот использует описание, чтобы отвечать о магазине и условиях.</span></div>
      </div>
      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-info")} Эти данные видит команда в кабинете</span><div class="settings-foot-actions"><button class="btn btn-white btn-sm" type="button" data-demo-toast="Аватар и логотип — в полной версии">Сбросить</button><button class="btn btn-primary btn-sm" type="button" data-save-profile>Сохранить профиль</button></div></div>
    </div>`;
  }

  function autopilotPanelMarkup() {
    const settings = state.settings;
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="settings-section-head"><h2>Тон общения</h2><p>Бот будет отвечать в выбранной манере. Тон применяется к первым сообщениям в диалоге.</p></div>
        <div class="tone-options">
          ${TONE_OPTIONS.map(
            (tone) => `<label class="tone-option"><input type="radio" name="tone" value="${tone.id}" ${settings.tone === tone.id ? "checked" : ""}/><div class="tone-option-top"><span class="tone-option-emoji">${tone.emoji}</span><span class="choice-check">${iconSprite("i-check")}</span></div><strong>${tone.title}</strong><p>${tone.desc}</p></label>`
          ).join("")}
        </div>
        <div class="setting-row" style="margin-top:16px"><div class="setting-row-main"><strong>Эмодзи в ответах</strong><span>Добавлять дружелюбные эмодзи, когда это уместно.</span></div><label class="switch"><input type="checkbox" data-setting-emoji ${settings.emoji ? "checked" : ""} aria-label="Эмодзи в ответах"/><span class="switch-track"></span></label></div>
        ${tonePreviewMarkup()}
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Скорость и передача менеджеру</h2><p>Задержка делает ответы похожими на живые. Если бот сомневается, диалог уйдёт вам.</p></div>
        <div class="settings-grid-2">
          <div class="field"><label class="field-label" for="set-delay">Задержка ответа <small data-delay-output>${settings.delay} сек</small></label><input class="range" id="set-delay" type="range" min="2" max="30" step="1" value="${settings.delay}" /><span class="field-hint">Ответ появится через ${settings.delay} секунд.</span></div>
          <div class="field"><label class="field-label" for="set-handoff">Передавать менеджеру после</label><select class="select" id="set-handoff"><option value="2" ${settings.handoffThreshold === 2 ? "selected" : ""}>2 неуверенных ответов</option><option value="3" ${settings.handoffThreshold === 3 ? "selected" : ""}>3 неуверенных ответов</option><option value="4" ${settings.handoffThreshold === 4 ? "selected" : ""}>4 неуверенных ответов</option><option value="5" ${settings.handoffThreshold === 5 ? "selected" : ""}>5 неуверенных ответов</option></select><span class="field-hint">Если подходящего сценария нет, диалог сразу переходит к вам.</span></div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Рабочие часы</h2><p>В рабочие часы бот отвечает сам, в остальное время копит вопросы.</p></div>
        <div class="schedule-days">
          ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => `<label class="schedule-day"><input type="checkbox" data-schedule-day="${index + 1}" ${settings.schedule.days.includes(index + 1) ? "checked" : ""}/><span>${day}</span></label>`).join("")}
        </div>
        <div class="schedule-time"><input class="input" id="set-schedule-from" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="10:00" value="${esc(settings.schedule.from)}"/><span>—</span><input class="input" id="set-schedule-to" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="21:00" value="${esc(settings.schedule.to)}"/><span class="field-hint" style="margin-left:6px">по Москве</span></div>
      </div>
      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-bolt")} Настройки влияют на реальные ответы бота</span><div class="settings-foot-actions"><button class="btn btn-white btn-sm" type="button" data-test-bot>${iconSprite("i-bolt")} Проверить</button><button class="btn btn-primary btn-sm" type="button" data-save-autopilot>Сохранить настройки</button></div></div>
    </div>`;
  }

  function notificationsPanelMarkup() {
    const notifications = state.settings.notifications;
    const rows = [
      { key: "newDialog", title: "Новый диалог", desc: "Когда покупатель пишет впервые или по новому товару." },
      { key: "handoff", title: "Передача менеджеру", desc: "Когда бот не уверен и зовёт вас на помощь." },
      { key: "digest", title: "Вечерняя сводка", desc: "Сколько диалогов закрыл бот и сколько заказов принёс." },
      { key: "product", title: "Вопросы о товаре", desc: "Каждый вопрос по конкретному объявлению. Может быть шумно." },
    ];
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="settings-section-head"><h2>Когда присылать уведомления</h2><p>Push-уведомления приходят в выбранные каналы в рабочие часы.</p></div>
        ${rows
          .map(
            (row) => `<div class="setting-row"><div class="setting-row-main"><strong>${row.title}</strong><span>${row.desc}</span></div><label class="switch"><input type="checkbox" data-setting-notification="${row.key}" ${notifications[row.key] ? "checked" : ""}/><span class="switch-track"></span></label></div>`
          )
          .join("")}
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Куда присылать</h2><p>Отметьте, куда присылать сводки.</p></div>
        <div class="setting-row"><div class="setting-row-main"><strong>В кабинете AutoR</strong><span>Колокольчик в шапке и лента на дашборде.</span></div><span class="connected-mark">${iconSprite("i-check")} включено</span></div>
        ${channelsMarkup()}
        <div class="setting-row"><div class="setting-row-main"><strong>Email</strong><span>Вечерняя сводка на ${esc(state.shop.email)}.</span></div><button class="btn btn-white btn-sm" type="button" data-demo-toast="Email-сводка появится вместе с серверной частью">Настроить</button></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Последние уведомления</h2><p>Так приходят оповещения в Telegram и MAX.</p></div>
        <div class="notify-feed">
          ${
            notificationLog().length
              ? notificationLog().slice(0, 4).map((item) => `<div class="notify-feed-item"><span class="notify-feed-channel">${esc(item.channel)}</span><div><strong>${esc(item.text)}</strong><span>${esc(item.time)}</span></div></div>`).join("")
              : `<div class="notify-feed-item"><span class="notify-feed-channel">AutoR</span><div><strong>Новый диалог: Артём Ковалёв — Sony WH-1000XM5</strong><span>10:42</span></div></div>
                 <div class="notify-feed-item"><span class="notify-feed-channel">AutoR</span><div><strong>Диалог передан вам: Ксения Морозова — торг</strong><span>10:04</span></div></div>`
          }
        </div>
      </div>
      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-lock")} Уведомления отправляются по расписанию</span><div class="settings-foot-actions"><button class="btn btn-primary btn-sm" type="button" data-notifications-done>Готово</button></div></div>
    </div>`;
  }

  function integrationsPanelMarkup() {
    const integrations = state.settings.integrations;
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="settings-section-head"><h2>Подключения</h2><p>Ключи и вебхуки хранятся в защищённом виде.</p></div>
        <div class="integration-card">
          <span class="integration-logo">A</span>
          <div class="integration-body"><strong>Авито <span class="badge badge-green">подключено</span></strong><span>${esc(state.shop.avitoAccount)} · с ${esc(state.shop.avitoConnectedAt)}</span></div>
          <div class="integration-side"><span class="connected-mark">${iconSprite("i-check")} активно</span><button class="btn btn-white btn-sm" type="button" data-demo-toast="Аккаунт Авито отключается в полной версии">Управлять</button></div>
        </div>
        ${channelsMarkup()}
        <div class="integration-card muted">
          <span class="integration-logo crm">C</span>
          <div class="integration-body"><strong>CRM <span class="badge badge-gray">не подключено</span></strong><span>Сохранять заказы и историю общения в вашу CRM.</span></div>
          <div class="integration-side"><button class="btn btn-white btn-sm" type="button" data-demo-toast="CRM подключается в полной версии">Подключить</button></div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Вебхук для событий</h2><p>Куда отправлять события, когда бот ответил или передал диалог.</p></div>
        <div class="field"><label class="field-label" for="set-webhook">URL вебхука</label><input class="input" id="set-webhook" placeholder="https://ваш-сервер.ru/autor" value="" disabled /><span class="field-hint">Вебхуки включены в тарифы VIP и MAXIMUM.</span></div>
        <div class="form-hint" style="margin-top:12px">${iconSprite("i-shield")} Ключи хранятся в защищённом виде, данные идут по HTTPS.</div>
      </div>
      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-link")} Авито, Telegram и CRM подключаются в одно окно</span><div class="settings-foot-actions"><button class="btn btn-primary btn-sm" type="button" data-integrations-done>Понятно</button></div></div>
    </div>`;
  }

  function demoPanelMarkup() {
    const totalMessages = state.chats.reduce((total, chat) => total + chat.messages.length, 0);
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="demo-data-banner">${iconSprite("i-sparkles")}<div><strong>Кабинет работает в этом браузере</strong><p>Состояние сохраняется автоматически, ответы бота генерирует нейросеть по вашему каталогу.</p></div><button class="btn btn-white btn-sm" type="button" data-open-help>Как это работает</button></div>
        <div class="settings-section-head"><h2>Состояние кабинета</h2><p>Данные хранятся в вашем браузере. Сброс вернёт исходный сценарий.</p></div>
        <div class="settings-grid-2">
          <div class="setting-row"><div class="setting-row-main"><strong>${state.chats.length} диалогов</strong><span>${totalMessages} сообщений в истории</span></div>${iconSprite("i-chat", "muted")}</div>
          <div class="setting-row"><div class="setting-row-main"><strong>${state.products.length} товаров</strong><span>${state.rules.filter((rule) => rule.enabled).length} активных сценариев</span></div>${iconSprite("i-box", "muted")}</div>
        </div>
        <div class="setting-row" style="margin-top:12px"><div class="setting-row-main"><strong>Версия</strong><span>AutoR · веб-кабинет</span></div><span class="badge badge-gray">v${SEED.version}</span></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-head"><h2>Экспорт и сброс</h2><p>Выгрузите данные в JSON или очистите кабинет.</p></div>
        <div class="danger-zone">
          <div><strong>Очистить кабинет</strong><p>Удалятся диалоги, товары, статистика и настройки — кабинет вернётся к чистому листу.</p></div>
          <div class="settings-foot-actions"><button class="btn btn-white btn-sm" type="button" data-export-state>${iconSprite("i-download")} Экспорт JSON</button><button class="btn btn-danger btn-sm" type="button" data-reset-demo>${iconSprite("i-trash")} Очистить кабинет</button></div>
        </div>
      </div>
      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-info")} Автоответы для Авито</span><div class="settings-foot-actions"><a class="btn btn-white btn-sm" href="#/chats/c1">${iconSprite("i-chat")} Открыть чат</a></div></div>
    </div>`;
  }

  /* ========================================================================
     Анализ диалогов
     ======================================================================== */

  function money(value) {
    return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
  }

  function auditScore(index, verdict) {
    const jitter = [0, 0.4, -0.3, 0.2, -0.5, 0.1, 0.35, -0.2][index % 8];
    const base = verdict.id === "ok" ? 8.2 : verdict.id === "soft" ? 6.1 : 4.2;
    return Math.max(2.5, Math.min(9.6, base + jitter));
  }

  function auditVerdict(chat) {
    if (chat.handoff) return { id: "handoff", label: "Передан вам", tone: "amber", next: "Ответить вручную и вернуть бота" };
    if (chat.unread > 0) return { id: "waiting", label: "Без ответа", tone: "red", next: "Ответить и предложить альтернативу" };
    const bot = chat.messages.filter((message) => message.from === "bot").length;
    if (bot >= 2) return { id: "ok", label: "Договорились", tone: "green", next: "Довести до оплаты" };
    return { id: "soft", label: "Остыл", tone: "gray", next: "Вернуть вопросом о наличии" };
  }

  function auditLossSources(month) {
    const scale = month ? 1.12 : 1;
    return [
      { title: "Долгий первый ответ", sub: "покупатель уходит к конкуренту", share: 34 },
      { title: "Нет ответа вне графика", sub: "вечер и выходные", share: 27 },
      { title: "Торг без ответа", sub: "спор о скидке обрывается", share: 21 },
      { title: "Вопрос без факта", sub: "нет остатка или срока", share: 12 },
      { title: "Служебные сообщения", sub: "бот отвечает на события Авито", share: 6 },
    ].map((row) => Object.assign(row, { share: Math.round(row.share * scale) }));
  }

  function auditData(month) {
    const chats = state.chats;
    const k = month ? 3.7 : 1;
    const avgCheck = state.products.length
      ? state.products.reduce((total, product) => total + product.price, 0) / state.products.length
      : 0;
    const rows = chats.map((chat, index) => {
      const product = chatProduct(chat);
      const last = chat.messages[chat.messages.length - 1] || {};
      const verdict = auditVerdict(chat);
      return {
        id: chat.id,
        name: (chat.buyer && chat.buyer.name) || "Покупатель",
        product: product ? product.name : "Без товара",
        time: last.time || "—",
        score: auditScore(index, verdict),
        verdict,
        good: verdict.id === "ok",
      };
    });
    rows.sort((a, b) => (a.good === b.good ? a.score - b.score : a.good ? 1 : -1));
    const overdue = rows.filter((row) => !row.good).length;
    const lost = Math.round((overdue * avgCheck * 0.28 * k) / 100) * 100;
    const quality = rows.length ? rows.reduce((total, row) => total + row.score, 0) / rows.length : 0;
    const plan = [
      { id: "night", title: "Включить автоответ вне рабочих часов", hint: `${Math.round(9 * k)} диалогов пришли вечером без ответа` },
      { id: "bargain", title: "Добавить правило торга с шагом скидки", hint: "21% обрывов — после вопроса о скидке" },
      { id: "stock", title: "Обновить остатки у 2 товаров", hint: "бот обещает наличие, которого нет" },
      { id: "system", title: "Пропускать служебные сообщения Авито", hint: "бот отвечает на события площадки" },
    ];
    return {
      month,
      label: month ? "30 дней" : "7 дней",
      shortLabel: month ? "30 дней" : "неделю",
      averageCheck: avgCheck,
      rows,
      overdue,
      overdueShare: rows.length ? Math.round((overdue / rows.length) * 100) : 0,
      lost,
      quality: quality ? quality.toFixed(1) : "—",
      fastShare: month ? 79 : 82,
      dialogs: Math.round(rows.length * k),
      sources: auditLossSources(month),
      plan,
    };
  }

  function auditPlanState() {
    if (!state.settings.auditPlan) state.settings.auditPlan = {};
    return state.settings.auditPlan;
  }

  function renderAnalysisPage() {
    const data = auditData(ui.auditMonth);
    const plan = auditPlanState();
    const done = data.plan.filter((item) => plan[item.id]).length;
    return `<div class="page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> Разбор переписок · ${esc(data.label)}</div>
          <h1 class="page-title">Анализ диалогов</h1>
          <p class="page-sub">Где теряются покупатели и что поменять в ответах. Разбор собирается из переписки и каталога.</p>
        </div>
        <div class="page-actions">
          <div class="segmented" data-audit-period>
            <button class="${data.month ? "" : "active"}" type="button" data-period="week">7 дней</button>
            <button class="${data.month ? "active" : ""}" type="button" data-period="month">30 дней</button>
          </div>
          <button class="btn btn-primary" type="button" data-audit-report>${iconSprite("i-download")} Отчёт за ${esc(data.shortLabel)}</button>
        </div>
      </div>

      <div class="audit-kpis">
        <div class="audit-kpi">
          <span class="audit-kpi-label">Без ответа</span>
          <strong class="audit-kpi-value">${data.overdue}<small>диалогов</small></strong>
          <span class="audit-kpi-hint">${data.overdueShare}% от всех переписок</span>
        </div>
        <div class="audit-kpi audit-kpi-loss">
          <span class="audit-kpi-label">Потеряно в заказах</span>
          <strong class="audit-kpi-value">${money(data.lost)}</strong>
          <span class="audit-kpi-hint">по среднему чеку ${money(data.averageCheck)}</span>
        </div>
        <div class="audit-kpi">
          <span class="audit-kpi-label">Оценка переписок</span>
          <strong class="audit-kpi-value">${data.quality}<small>/10</small></strong>
          <span class="audit-kpi-hint">${data.dialogs} диалогов в разборе</span>
        </div>
        <div class="audit-kpi">
          <span class="audit-kpi-label">Ответ до 5 минут</span>
          <strong class="audit-kpi-value">${data.fastShare}%</strong>
          <span class="audit-kpi-hint">цель — держать выше 90%</span>
        </div>
      </div>

      <div class="audit-grid">
        <section class="card audit-card">
          <div class="card-head">
            <div><h3 class="card-title">Где теряем</h3><p class="card-sub">Причины, по которым диалог не дошёл до заказа</p></div>
            <span class="badge badge-amber badge-dot">окно 48 часов</span>
          </div>
          <div class="audit-sources">
            ${data.sources
              .map(
                (source) => `<div class="audit-source">
                  <div class="audit-source-top"><strong>${esc(source.title)}</strong><span>${source.share}%</span></div>
                  <div class="audit-bar"><i style="width:${source.share}%"></i></div>
                  <span class="audit-source-sub">${esc(source.sub)}</span>
                </div>`
              )
              .join("")}
          </div>
        </section>

        <section class="card audit-card">
          <div class="card-head">
            <div><h3 class="card-title">План на неделю</h3><p class="card-sub">${done} из ${data.plan.length} сделано</p></div>
          </div>
          <div class="audit-plan">
            ${data.plan
              .map(
                (item) => `<label class="audit-plan-item ${plan[item.id] ? "done" : ""}">
                  <input type="checkbox" data-audit-plan="${item.id}" ${plan[item.id] ? "checked" : ""}/>
                  <span class="audit-plan-box">${iconSprite("i-check")}</span>
                  <span class="audit-plan-copy"><strong>${esc(item.title)}</strong><span>${esc(item.hint)}</span></span>
                </label>`
              )
              .join("")}
          </div>
        </section>
      </div>

      <section class="card audit-card">
        <div class="card-head">
          <div><h3 class="card-title">Диалоги в разборе</h3><p class="card-sub">Итог, возражение и следующий шаг по каждой переписке</p></div>
          <span class="audit-count">${data.rows.length}</span>
        </div>
        ${
          data.rows.length
            ? `<div class="audit-table">
                ${data.rows
                  .map(
                    (row) => `<div class="audit-row">
                      <div class="audit-row-main">
                        <strong>${esc(row.name)}</strong>
                        <span>${esc(row.product)} · последнее в ${esc(row.time)}</span>
                      </div>
                      <span class="audit-badge ${row.verdict.tone}">${esc(row.verdict.label)}</span>
                      <span class="audit-score ${row.score >= 7 ? "good" : row.score >= 5 ? "mid" : "bad"}">${row.score.toFixed(1)}</span>
                      <button class="btn btn-white btn-sm" type="button" data-audit-review="${esc(row.id)}">Разбор</button>
                    </div>`
                  )
                  .join("")}
              </div>`
            : `<div class="empty-inline">Пока нет переписок — разбор появится, когда покупатели напишут.</div>`
        }
      </section>

      <div class="audit-footnote">${iconSprite("i-info")} Разбор строится по вашей переписке и каталогу. Пока Авито не подключён как источник, цифры считаются по диалогам этого кабинета.</div>
    </div>`;
  }

  function bindAnalysis() {
    $$("[data-audit-period] button").forEach((button) => {
      button.addEventListener("click", () => {
        ui.auditMonth = button.getAttribute("data-period") === "month";
        renderRoute();
      });
    });
    $$("[data-audit-plan]").forEach((input) => {
      input.addEventListener("change", () => {
        auditPlanState()[input.getAttribute("data-audit-plan")] = input.checked;
        saveState();
        renderRoute();
      });
    });
    $$("[data-audit-review]").forEach((button) => {
      button.addEventListener("click", () => openAuditReview(button.getAttribute("data-audit-review")));
    });
    $("[data-audit-report]")?.addEventListener("click", openAuditReport);
  }

  function openAuditReview(chatId) {
    const chat = getChat(chatId);
    if (!chat) return;
    const product = chatProduct(chat);
    const botMessages = chat.messages.filter((message) => message.from === "bot");
    const lastBuyer = [...chat.messages].reverse().find((message) => message.from === "buyer");
    const verdict = auditVerdict(chat);
    const number = `#${1430000 + chatId.replace(/\D/g, "") * 7}`;
    const text = (lastBuyer && lastBuyer.text) || "Покупатель не задал вопрос";
    const objection = /скидк|дешев|торг/i.test(chat.messages.map((message) => message.text).join(" "))
      ? "Просит скидку — ответ без шага скидки"
      : /достав|срок|когда/i.test(chat.messages.map((message) => message.text).join(" "))
        ? "Важен срок — ответ стоит начинать со срока"
        : "Возражений не найдено";
    openModal(
      `${modalHeader("Разбор диалога", `${esc((chat.buyer && chat.buyer.name) || "Покупатель")} · ${esc(product ? product.name : "без товара")}`)}
      <div class="modal-body">
        <div class="audit-review-top">
          <span class="audit-badge ${verdict.tone}">${esc(verdict.label)}</span>
          <span class="audit-review-num">${esc(number)} · окно 48 часов</span>
        </div>
        <div class="audit-review-grid">
          <div class="audit-review-block"><span>Что хотел покупатель</span><strong>${esc(text)}</strong></div>
          <div class="audit-review-block"><span>Возражение</span><strong>${esc(objection)}</strong></div>
          <div class="audit-review-block"><span>Следующий шаг</span><strong>${esc(verdict.next)}</strong></div>
          <div class="audit-review-block"><span>Ответов бота</span><strong>${botMessages.length} · средняя уверенность ${
            botMessages.length ? Math.round(botMessages.reduce((total, message) => total + (message.confidence || 0), 0) / botMessages.length) : 0
          }%</strong></div>
        </div>
        <div class="audit-review-note">${iconSprite("i-sparkles")} Разбор собирает модель по переписке: итог, возражение и следующий шаг. Пока Авито не подключён, разбор идёт по диалогам кабинета.</div>
      </div>
      <div class="modal-foot"><span class="foot-note">${esc(number)}</span><button class="btn btn-white btn-sm" type="button" data-modal-close>Закрыть</button><button class="btn btn-primary btn-sm" type="button" data-audit-copy="${esc(number)}">${iconSprite("i-download")} Добавить в отчёт</button></div>`,
      {
        onMount: (modal) => {
          $("[data-audit-copy]", modal)?.addEventListener("click", () => {
            toast("Добавлено в отчёт", `Разбор ${number} попадёт в отчёт клиенту.`, "success");
            closeModal();
          });
        },
      }
    );
  }

  function openAuditReport() {
    const data = auditData(ui.auditMonth);
    openModal(
      `${modalHeader("Отчёт для клиента", `Разбор переписок за ${data.label}`)}
      <div class="modal-body">
        <div class="audit-report-head">
          <div class="audit-report-score">${data.quality}<span>/10</span></div>
          <div>
            <strong>Оценка переписок</strong>
            <p>${data.overdue} диалогов без ответа, потери около ${money(data.lost)}.</p>
          </div>
        </div>
        <div class="audit-report-rows">
          <div><span>Период</span><strong>${esc(data.label)}</strong></div>
          <div><span>Диалогов в разборе</span><strong>${data.dialogs}</strong></div>
          <div><span>Ответ до 5 минут</span><strong>${data.fastShare}%</strong></div>
          <div><span>Главная причина потерь</span><strong>Долгий первый ответ</strong></div>
          <div><span>Что делать на этой неделе</span><strong>${data.plan.length} шага в плане</strong></div>
        </div>
        <div class="audit-review-note">${iconSprite("i-info")} Отчёт собирается в PDF одной страницей и подписывается именем магазина. Файл появится после подключения Авито.</div>
      </div>
      <div class="modal-foot"><span class="foot-note">${esc(state.shop.name)}</span><button class="btn btn-white btn-sm" type="button" data-modal-close>Закрыть</button><button class="btn btn-white btn-sm" type="button" data-audit-link>${iconSprite("i-link")} Ссылка</button><button class="btn btn-primary btn-sm" type="button" data-audit-pdf>${iconSprite("i-download")} Скачать PDF</button></div>`,
      {
        onMount: (modal) => {
          $("[data-audit-pdf]", modal)?.addEventListener("click", () => {
            toast("Отчёт готовится", "PDF соберётся на сервере, когда подключим Авито как источник.", "info");
          });
          $("[data-audit-link]", modal)?.addEventListener("click", () => {
            toast("Ссылка скопирована", "Отправим клиенту — откроется та же страница с его разбором.", "success");
          });
        },
      }
    );
  }

  /* ========================================================================
     Расширенные настройки ИИ и каналы уведомлений
     ======================================================================== */

  const AI_MODES = [
    { id: "auto", title: "Отвечает сам", desc: "Бот отвечает покупателю сразу и передаёт вам только спорные вопросы." },
    { id: "draft", title: "Черновик", desc: "Готовит ответ, а отправляете его вы — после проверки." },
    { id: "escalate", title: "Только подсказки", desc: "Бот ничего не отправляет, но показывает, что ответить." },
  ];

  const AI_KNOWLEDGE = [
    { id: "catalog", title: "Каталог", desc: "Название, цена, остаток" },
    { id: "delivery", title: "Доставка", desc: "Сроки, цена, пункты выдачи" },
    { id: "payment", title: "Оплата", desc: "Карта, перевод, счёт" },
    { id: "booking", title: "Запись и выезд", desc: "Окна мастера и часы работы" },
    { id: "warranty", title: "Гарантия", desc: "12/24/6 месяцев по типу" },
  ];

  const AI_MACROS = ["{имя}", "{товар}", "{цена}", "{адрес}", "{магазин}"];

  const CHANNELS = {
    telegram: {
      id: "telegram",
      title: "Telegram",
      letter: "T",
      className: "telegram",
      bot: "@autor_notify_bot",
      desc: "Короткие оповещения и кнопка «Взять диалог» прямо в сообщении.",
      hint: "Откройте бота, отправьте /start и вставьте код привязки в поле ниже.",
    },
    max: {
      id: "max",
      title: "MAX",
      letter: "M",
      className: "max",
      bot: "@autor_bot",
      desc: "Уведомления в мессенджер MAX — если команда сидит там, а не в Telegram.",
      hint: "Найдите бота по имени в MAX, отправьте /start и вставьте код привязки.",
    },
  };

  function aiCfg() {
    const settings = state.settings;
    if (!settings.ai || typeof settings.ai !== "object") settings.ai = {};
    const cfg = settings.ai;
    if (!cfg.mode) cfg.mode = "auto";
    if (!cfg.model) cfg.model = "deepseek-flash";
    if (typeof cfg.qualify !== "boolean") cfg.qualify = true;
    if (typeof cfg.noPrice !== "boolean") cfg.noPrice = true;
    if (typeof cfg.disclose !== "boolean") cfg.disclose = false;
    if (!Array.isArray(cfg.stopWords)) cfg.stopWords = ["менеджер", "человек", "оптов", "возврат"];
    if (!cfg.knowledge || typeof cfg.knowledge !== "object") cfg.knowledge = {};
    AI_KNOWLEDGE.forEach((item) => {
      if (typeof cfg.knowledge[item.id] !== "boolean") cfg.knowledge[item.id] = true;
    });
    return cfg;
  }

  function channelState(kind) {
    const settings = state.settings;
    if (!settings.channels || typeof settings.channels !== "object") settings.channels = {};
    if (!settings.channels[kind] || typeof settings.channels[kind] !== "object") {
      settings.channels[kind] = { connected: false, target: "" };
    }
    return settings.channels[kind];
  }

  function notificationLog() {
    const settings = state.settings;
    if (!Array.isArray(settings.notificationLog)) settings.notificationLog = [];
    return settings.notificationLog;
  }

  function aiPanelMarkup() {
    const cfg = aiCfg();
    const used = window.AutoRFeatures && window.AutoRFeatures.aiUsed ? window.AutoRFeatures.aiUsed() : 0;
    const limit = window.AutoRFeatures && window.AutoRFeatures.aiLimit ? window.AutoRFeatures.aiLimit() : 500;
    const share = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return `<div class="settings-panel">
      <div class="settings-section">
        <div class="settings-section-head"><h2>Режим работы бота</h2><p>Насколько самостоятельно бот отвечает покупателям.</p></div>
        <div class="ai-modes">
          ${AI_MODES.map(
            (mode) => `<button class="ai-mode ${cfg.mode === mode.id ? "active" : ""}" type="button" data-ai-mode="${mode.id}">
              <span class="ai-mode-top"><strong>${mode.title}</strong><span class="ai-mode-check">${iconSprite("i-check")}</span></span>
              <span class="ai-mode-desc">${mode.desc}</span>
            </button>`
          ).join("")}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-head"><h2>Что бот знает</h2><p>Выключенный раздел бот не трогает и честно зовёт менеджера.</p></div>
        ${AI_KNOWLEDGE.map(
          (item) => `<div class="setting-row"><div class="setting-row-main"><strong>${item.title}</strong><span>${item.desc}</span></div><label class="switch"><input type="checkbox" data-ai-knowledge="${item.id}" ${cfg.knowledge[item.id] ? "checked" : ""}/><span class="switch-track"></span></label></div>`
        ).join("")}
      </div>

      <div class="settings-section">
        <div class="settings-section-head"><h2>Как отвечает</h2><p>Поведение бота в короткой переписке.</p></div>
        <div class="setting-row"><div class="setting-row-main"><strong>Сначала выясняет потребность</strong><span>Один уточняющий вопрос до цены и наличия.</span></div><label class="switch"><input type="checkbox" data-ai-toggle="qualify" ${cfg.qualify ? "checked" : ""}/><span class="switch-track"></span></label></div>
        <div class="setting-row"><div class="setting-row-main"><strong>Не называет цену без запроса</strong><span>Цена появляется, когда покупатель спросил сам.</span></div><label class="switch"><input type="checkbox" data-ai-toggle="noPrice" ${cfg.noPrice ? "checked" : ""}/><span class="switch-track"></span></label></div>
        <div class="setting-row"><div class="setting-row-main"><strong>Представляется ассистентом магазина</strong><span>Снимает претензии «это бот» и соответствует политике площадки.</span></div><label class="switch"><input type="checkbox" data-ai-toggle="disclose" ${cfg.disclose ? "checked" : ""}/><span class="switch-track"></span></label></div>
        <div class="settings-grid-2" style="margin-top:14px">
          <div class="field"><label class="field-label">Модель</label>
            <div class="ai-model-static"><strong>DeepSeek Flash</strong><span>через сервер AutoR</span></div>
            <span class="field-hint">Ответ за 1–2 секунды. Локальную модель на телефоне пока не подключаем: на слабых весах качество торга и расчёта смет падает.</span>
          </div>
          <div class="field"><label class="field-label">Лимит ответов ИИ</label>
            <div class="ai-usage"><div class="ai-usage-bar"><i style="width:${share}%"></i></div><span>${used} из ${Number.isFinite(limit) ? limit : "∞"}</span></div>
            <span class="field-hint">Лимит зависит от тарифа и обнуляется в начале месяца.</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-head"><h2>Передача человеку</h2><p>Фразы, после которых диалог сразу уходит вам.</p></div>
        <div class="ai-stopwords">${cfg.stopWords.map((word) => `<span class="ai-stopword">${esc(word)}<button type="button" data-ai-stopword-remove="${esc(word)}" aria-label="Убрать">${iconSprite("i-close")}</button></span>`).join("") || '<span class="field-hint">Стоп-слов пока нет</span>'}</div>
        <div class="ai-stopword-add"><input class="input" id="ai-stopword-input" type="text" placeholder="Добавить фразу" maxlength="24"/><button class="btn btn-white btn-sm" type="button" data-ai-stopword-add>${iconSprite("i-plus")} Добавить</button></div>
        <span class="field-hint">Порог сомнений — ${esc(String(state.settings.handoffThreshold))} ответа подряд. Меняется в «Автопилоте».</span>
      </div>

      <div class="settings-section">
        <div class="settings-section-head"><h2>Макросы</h2><p>Подставляются в ответ автоматически — шаблоны остаются короткими.</p></div>
        <div class="ai-macros">${AI_MACROS.map((macro) => `<button class="ai-macro" type="button" data-ai-macro="${esc(macro)}">${esc(macro)}${iconSprite("i-plus")}</button>`).join("")}</div>
      </div>

      <div class="settings-foot"><span class="settings-foot-note">${iconSprite("i-sparkles")} Ответы строятся по каталогу и этим правилам</span><div class="settings-foot-actions"><button class="btn btn-white btn-sm" type="button" data-test-bot>${iconSprite("i-bolt")} Проверить бота</button><button class="btn btn-primary btn-sm" type="button" data-ai-done>Сохранить</button></div></div>
    </div>`;
  }

  function bindAiPanel() {
    const cfg = aiCfg();
    $$("[data-ai-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        cfg.mode = button.getAttribute("data-ai-mode");
        saveState();
        renderRoute();
      });
    });
    $$("[data-ai-knowledge]").forEach((input) => {
      input.addEventListener("change", () => {
        cfg.knowledge[input.getAttribute("data-ai-knowledge")] = input.checked;
        saveState();
      });
    });
    $$("[data-ai-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        cfg[input.getAttribute("data-ai-toggle")] = input.checked;
        saveState();
      });
    });
    $("[data-ai-stopword-add]")?.addEventListener("click", () => {
      const input = $("#ai-stopword-input");
      const word = (input?.value || "").trim().toLowerCase();
      if (!word) return;
      if (!cfg.stopWords.includes(word)) cfg.stopWords.push(word);
      saveState();
      renderRoute();
    });
    $("#ai-stopword-input")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("[data-ai-stopword-add]")?.click();
      }
    });
    $$("[data-ai-stopword-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        cfg.stopWords = cfg.stopWords.filter((word) => word !== button.getAttribute("data-ai-stopword-remove"));
        saveState();
        renderRoute();
      });
    });
    $$("[data-ai-macro]").forEach((button) => {
      button.addEventListener("click", () => {
        const macro = button.getAttribute("data-ai-macro");
        navigator.clipboard?.writeText(macro).catch(() => {});
        toast("Макрос скопирован", `${macro} — вставьте в текст сценария.`, "success");
      });
    });
    $("[data-ai-done]")?.addEventListener("click", () => {
      saveState();
      toast("Настройки ИИ сохранены", "Бот ответит по новым правилам со следующего сообщения.", "success");
    });
  }

  function channelsMarkup() {
    return Object.values(CHANNELS)
      .map((channel) => {
        const current = channelState(channel.id);
        return `<div class="integration-card ${current.connected ? "" : "muted"}">
          <span class="integration-logo ${channel.className}">${channel.letter}</span>
          <div class="integration-body"><strong>${channel.title} <span class="badge ${current.connected ? "badge-green" : "badge-gray"}">${current.connected ? "подключено" : "не подключено"}</span></strong><span>${
            current.connected ? `Оповещения идут в ${esc(channel.title)} · ${esc(current.target || channel.bot)}` : channel.desc
          }</span></div>
          <div class="integration-side">${
            current.connected
              ? `<button class="btn btn-white btn-sm" type="button" data-channel-test="${channel.id}">Тест</button><button class="btn btn-white btn-sm" type="button" data-channel-off="${channel.id}">Отключить</button>`
              : `<button class="btn btn-primary btn-sm" type="button" data-channel-on="${channel.id}">Подключить</button>`
          }</div>
        </div>`;
      })
      .join("");
  }

  function openChannelModal(kind) {
    const channel = CHANNELS[kind];
    if (!channel) return;
    openModal(
      `${modalHeader(`Подключить ${channel.title}`, channel.desc)}
      <div class="modal-body">
        <ol class="channel-steps">
          <li>Откройте <strong>${esc(channel.bot)}</strong> в ${esc(channel.title)} и отправьте <code>/start</code>.</li>
          <li>Бот пришлёт код привязки — например <code>AR-4471</code>.</li>
          <li>Вставьте код ниже: уведомления начнут приходить в этот чат.</li>
        </ol>
        <div class="field"><label class="field-label" for="channel-code">Код привязки или @username</label><input class="input" id="channel-code" type="text" placeholder="AR-4471" autocomplete="off"/><span class="field-hint">${esc(channel.hint)}</span></div>
        <div class="audit-review-note">${iconSprite("i-lock")} Код одноразовый, ключи хранятся на сервере и не попадают в кабинет.</div>
      </div>
      <div class="modal-foot"><span class="foot-note">${esc(state.shop.name)}</span><button class="btn btn-white btn-sm" type="button" data-modal-close>Отмена</button><button class="btn btn-primary btn-sm" type="button" data-channel-connect="${channel.id}">Подключить</button></div>`,
      {
        onMount: (modal) => {
          const input = $("#channel-code", modal);
          $("[data-channel-connect]", modal)?.addEventListener("click", () => {
            const value = (input?.value || "").trim();
            if (!value) {
              toast("Нужен код", "Без кода не привяжем чат — попросите его у бота.", "error");
              input?.focus();
              return;
            }
            const current = channelState(channel.id);
            current.connected = true;
            current.target = value.startsWith("@") ? value : `${channel.title} · ${value}`;
            notificationLog().unshift({ channel: channel.title, text: "Канал подключён", time: "только что" });
            saveState();
            closeModal();
            renderRoute();
            toast(`${channel.title} подключён`, "Пришлём тестовое уведомление в течение минуты.", "success");
          });
        },
      }
    );
  }

  function bindChannels() {
    $$("[data-channel-on]").forEach((button) => {
      button.addEventListener("click", () => openChannelModal(button.getAttribute("data-channel-on")));
    });
    $$("[data-channel-off]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.getAttribute("data-channel-off");
        const current = channelState(kind);
        current.connected = false;
        current.target = "";
        saveState();
        renderRoute();
        toast("Канал отключён", "Уведомления туда больше не приходят.", "info");
      });
    });
    $$("[data-channel-test]").forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.getAttribute("data-channel-test");
        const channel = CHANNELS[kind];
        notificationLog().unshift({ channel: channel.title, text: "Новый диалог: Ксения Морозова — кондиционер", time: "только что" });
        saveState();
        renderRoute();
        toast(`Тест в ${channel.title}`, "Сообщение с кнопкой «Взять диалог» отправлено.", "success");
      });
    });
  }

  function renderSettings() {
    const panels = {
      profile: profilePanelMarkup,
      autopilot: autopilotPanelMarkup,
      ai: aiPanelMarkup,
      notifications: notificationsPanelMarkup,
      integrations: integrationsPanelMarkup,
      demo: demoPanelMarkup,
    };
    const tab = panels[ui.settingsTab] ? ui.settingsTab : "profile";
    return `<div class="page">
      <div class="page-head">
        <div class="page-head-copy">
          <div class="eyebrow"><span class="demo-dot"></span> Настройки</div>
          <h1 class="page-title">Настройки</h1>
          <p class="page-sub">Как магазин общается с покупателями и что бот умеет делать сам.</p>
        </div>
        <div class="page-actions"><button class="btn btn-white" type="button" data-open-help>${iconSprite("i-help")} Помощь</button></div>
      </div>
      <div class="settings-layout">
        ${settingsNavMarkup()}
        <div id="settings-panel">${panels[tab]()}</div>
      </div>
    </div>`;
  }

  function updateTonePreview() {
    const text = $("[data-tone-preview-text]");
    if (text) text.textContent = TONE_COPY[state.settings.tone] || TONE_COPY.friendly;
  }

  function bindSettings() {
    bindAiPanel();
    bindChannels();

    $$("[data-settings-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        ui.settingsTab = button.getAttribute("data-settings-tab");
        renderRoute();
      });
    });

    $("[data-save-profile]")?.addEventListener("click", () => {
      const shop = state.shop;
      shop.name = $("#set-shop-name").value.trim() || shop.name;
      shop.tagline = $("#set-shop-tagline").value.trim() || shop.tagline;
      shop.owner = $("#set-owner").value.trim() || shop.owner;
      shop.city = $("#set-city").value.trim() || shop.city;
      shop.email = $("#set-email").value.trim() || shop.email;
      shop.phone = $("#set-phone").value.trim() || shop.phone;
      shop.description = $("#set-description").value.trim();
      saveState();
      syncShell();
      toast("Профиль сохранён", "Изменения применились к магазину.", "success");
    });

    $$("input[name='tone']").forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        state.settings.tone = input.value;
        saveState();
        updateTonePreview();
      });
    });

    $("[data-setting-emoji]")?.addEventListener("change", (event) => {
      state.settings.emoji = event.target.checked;
      saveState();
      updateTonePreview();
      toast(event.target.checked ? "Эмодзи включены" : "Эмодзи выключены", event.target.checked ? "Бот может добавлять дружелюбные эмодзи." : "Ответы будут строже.", "info");
    });

    $("#set-delay")?.addEventListener("input", (event) => {
      const value = event.target.value;
      const output = $("[data-delay-output]");
      if (output) output.textContent = `${value} сек`;
      const hint = $("#set-delay")?.parentElement?.querySelector(".field-hint");
      if (hint) hint.textContent = `Ответ появится через ${value} секунд.`;
    });

    $("[data-save-autopilot]")?.addEventListener("click", () => {
      const settings = state.settings;
      const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      const from = ($("#set-schedule-from")?.value || "").trim();
      const to = ($("#set-schedule-to")?.value || "").trim();
      if (!timePattern.test(from) || !timePattern.test(to)) {
        toast("Проверьте рабочее время", "Укажите время в формате ЧЧ:ММ, например 10:00.", "info");
        return;
      }
      settings.delay = Number($("#set-delay")?.value || settings.delay);
      settings.handoffThreshold = Number($("#set-handoff")?.value || settings.handoffThreshold);
      settings.schedule.from = from;
      settings.schedule.to = to;
      settings.schedule.days = $$("[data-schedule-day]")
        .filter((input) => input.checked)
        .map((input) => Number(input.getAttribute("data-schedule-day")));
      saveState();
      toast("Автопилот сохранён", `Задержка ${settings.delay} сек, тон «${TONE_OPTIONS.find((tone) => tone.id === settings.tone)?.title || ""}».`, "success");
    });

    $$("[data-setting-notification]").forEach((input) => {
      input.addEventListener("change", () => {
        state.settings.notifications[input.getAttribute("data-setting-notification")] = input.checked;
        saveState();
      });
    });

    $("[data-notifications-done]")?.addEventListener("click", () => toast("Настройки уведомлений сохранены", "Уведомления придут в выбранные каналы.", "success"));
    $("[data-integrations-done]")?.addEventListener("click", () => toast("Подключения сохранены", "Настройки интеграций обновлены.", "success"));
    $("[data-test-bot]")?.addEventListener("click", openBotTestModal);
  }
  /* ========================================================================
     Init
     ======================================================================== */

  window.AutoRApp = {
    get state() { return state; }, ui, saveState, renderRoute, navigate, toast, openModal, closeModal, modalHeader,
    esc, iconSprite, uid, formatPrice, formatNumber, plural, getProduct, getChat, getRule, chatProduct, buyerFirstName,
    getActiveChat, updateGlobalBadges, refreshConversation, refreshCatalogGrid, openBotTestModal, openAddProductModal,
  };
  bindShell();
  if (!location.hash) {
    history.replaceState(null, "", "#/dashboard");
  }
  renderRoute();

})();
