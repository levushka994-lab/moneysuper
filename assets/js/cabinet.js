/* ==========================================================================
   AutoR — чистый лист и пример загруженного кабинета
   - Новый пользователь начинает с пустого кабинета (данные — в clean-seed.js).
   - «Показать пример магазина» подставляет магазин «ВОЛЬТ» с диалогами, заказами
     и аналитикой; данные пользователя перед этим откладываются в сторону.
   - «Вернуться к своему кабинету» возвращает их обратно.
   Кнопки: в настройках (шапка страницы и вкладка «Данные кабинета»),
   на пустой главной, в пустых чатах и каталоге, плашка в шапке в режиме примера.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.AUTOR_SEED || !window.AUTOR_SAMPLE_SEED) return;

  var KEY = 'autor.demo.state.v' + window.AUTOR_SEED.version;   // ключ состояния приложения
  var OWN = KEY + '.own';                                         // отложенный кабинет пользователя

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function stored() { try { return JSON.parse(read(KEY) || 'null'); } catch (e) { return null; } }
  function isSample() { var s = stored(); return !!(s && s.sample); }
  function isClean() {
    var s = stored();
    return !isSample() && (!s || ((!s.chats || !s.chats.length) && !(s.stats && s.stats.messages)));
  }
  function go() { location.hash = '#/dashboard'; location.reload(); }

  function showSample() {
    var own = read(KEY);
    if (!write(OWN, own || '') || !write(KEY, JSON.stringify(window.AUTOR_SAMPLE_SEED))) {
      alert('Браузер не даёт сохранить данные — пример магазина открыть не получится.');
      return;
    }
    go();
  }
  function backToOwn() {
    var own = read(OWN);
    write(KEY, own ? own : null);
    write(OWN, null);
    go();
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-sample-load]')) { e.preventDefault(); showSample(); }
    else if (e.target.closest('[data-sample-back]')) { e.preventDefault(); backToOwn(); }
    else if (e.target.closest('[data-confirm-reset]')) write(OWN, null);   // «Очистить кабинет» — отложенный кабинет тоже не нужен
  }, true);

  function icon(id) { return '<svg class="icon" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function button(cls) {
    return isSample()
      ? '<button class="btn btn-white ' + cls + '" type="button" data-sample-back>' + icon('i-arrow-left') + 'Вернуться к своему кабинету</button>'
      : '<button class="btn btn-primary ' + cls + '" type="button" data-sample-load>' + icon('i-eye') + 'Показать пример магазина</button>';
  }

  function decorate() {
    var root = document.documentElement;
    root.classList.toggle('ar-sample', isSample());
    root.classList.toggle('ar-clean', isClean());

    // плашка в шапке, пока открыт пример
    var left = document.querySelector('.topbar-left');
    var pill = document.querySelector('.ar-sample-pill');
    if (isSample() && left && !pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'ar-sample-pill';
      pill.setAttribute('data-sample-back', '');
      pill.innerHTML = '<span>Пример магазина</span><b>' + icon('i-arrow-left') + 'К своему кабинету</b>';
      left.appendChild(pill);
    } else if (!isSample() && pill) pill.remove();

    // в чистом кабинете вместо чужого фото — первая буква профиля
    var s = stored() || window.AUTOR_SEED;
    var letter = ((s.shop && (s.shop.owner || s.shop.name)) || 'А').trim().charAt(0).toUpperCase();
    document.querySelectorAll('.topbar-user .avatar, .side-profile .avatar, .user-popover .avatar').forEach(function (a) {
      if (a.getAttribute('data-initial') !== letter) a.setAttribute('data-initial', letter);
    });

    // настройки: кнопка в шапке страницы и раздел на вкладке «Данные кабинета»
    var view = document.querySelector('#view');
    if (!view || view.getAttribute('data-page') !== 'settings') return;
    var actions = view.querySelector('.page-head .page-actions');
    if (actions && !actions.querySelector('[data-sample-load], [data-sample-back]')) actions.insertAdjacentHTML('afterbegin', button(''));
    var demoHead = Array.prototype.find.call(view.querySelectorAll('.settings-section h2'), function (h) { return h.textContent.indexOf('Состояние кабинета') === 0; });
    var panel = demoHead && demoHead.closest('.settings-panel');
    if (panel && !panel.querySelector('.ar-sample-section')) {
      panel.insertAdjacentHTML('afterbegin',
        '<div class="settings-section ar-sample-section">' +
          '<div class="settings-section-head"><h2>Пример загруженного кабинета</h2>' +
          '<p>' + (isSample()
            ? 'Сейчас открыт пример магазина «ВОЛЬТ». Ваш кабинет сохранён — верните его в один клик.'
            : 'Посмотрите, как выглядит AutoR, когда бот уже работает: сотни сообщений, заказы из чатов, аналитика. Ваш кабинет сохранится — вернуться можно в один клик.') +
          '</p></div>' + button('ar-sample-section__btn') +
        '</div>');
    }
  }

  var queued = false;
  var observer = new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; observer.disconnect(); decorate(); observe(); });
  });
  function observe() { observer.observe(document.body, { childList: true, subtree: true }); }
  decorate();
  observe();
})();
