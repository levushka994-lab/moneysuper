# АвтоЧат — автоответы для Авито

Рабочая версия сайта — `index.html` плюс папка `assets/` со стилями и скриптами.
Сайт статический: сервер не нужен, но для HTTPS и живых ответов ИИ (прокси `/api/chat`)
его лучше выкладывать на сервер.

## Файлы

| Файл | Что это |
|---|---|
| `index.html` | каркас страницы: разметка, иконки, подключение `assets/` |
| `assets/css/` | стили: `foundation`, `components`, `pages/*`, `responsive`, `theme`, `access`, `cabinet`, `features` |
| `assets/img/items/   # фотографии позиций (WebP 800×600, лицензии в CREDITS.txt)
assets/js/` | скрипты: `seed` (данные), `charts` (графики), `app` (кабинет), `billing` (доступ и тарифы), `cabinet` (чистый лист и пример магазина), `features` (доработки страниц) |
| `deploy.ps1` | выложить или обновить сайт на сервере (Windows, PowerShell) |
| `server-setup.sh` | установщик на сервере — его отправляет `deploy.ps1` |
| `sync-deploy.sh` | серверный воркер автовыкладки: забирает `main` с GitHub и обновляет сайт |
| `install-sync.sh` | поставить автовыкладку на сервере (systemd-таймер, раз в минуту) |
| `backup.ps1` | бэкап сайта с сервера на компьютер |
| `install-backup-task.ps1` | ежедневный бэкап через Планировщик заданий |
| `README.txt` | подробная инструкция по выкладке и бэкапам |

## Структура

```
index.html                 181   каркас страницы: <head>, иконки (svg-спрайт), разметка кабинета,
                                 подключение стилей и скриптов — без кода приложения
assets/
  css/
    foundation.css         819   шрифты, токены, сброс, каркас
    components.css        1303   кнопки, карточки, таблицы, модалы, тосты — всё переиспользуемое
    pages/
      dashboard.css        754   главная
      chats.css           1084   чаты и композер
      catalog.css          379   товары
      rules.css            340   сценарии
      analytics.css        293   аналитика
      analysis.css         675   анализ диалогов: KPI, карта потерь, разбор, настройки ИИ, каналы
      settings.css         695   настройки
    responsive.css         787   адаптив: планшет и мобильный
    theme.css              260   тема «Пульт автопилота»
    access.css             436   экран входа, тарифы, замки на функциях
    cabinet.css             69   чистый лист и пример магазина
    features.css           363   доработки страниц (путь покупателя, склад, ИИ)
  js/
    seed.js                510   базовые данные (window.AUTOR_SEED): магазин, товары, чаты
    seed-services.js       339   демо-бизнес «УЮТ-СТРОЙ»: услуги (м², выезд, объект) и материалы
    charts.js              203   графики на чистом SVG (window.AutoRCharts)
    app.js                3900   кабинет: состояние, роутер, страницы, модалы, тосты
    billing.js             661   доступ, промокоды, тарифы (window.AutoRBilling)
    cabinet.js             107   чистый кабинет и «Показать пример магазина»
    features.js           1171   доработки страниц (window.AutoRFeatures)
```

Правило простое: **разметка — в `index.html`, внешний вид — в `assets/css`,
поведение — в `assets/js`**. Новый блок стилей — в `components.css`, стили конкретной
страницы — в `pages/<страница>.css`, новая страница-логика — в `features.js`.

### Настройки ИИ: промпт, конструктор и источник модели

- «Настройки → Ответы ИИ → Инструкция для модели» — редактируемый текст промпта (хранится в `state.settings.ai.prompt`, лимит 2000 символов). Пустое поле = стандартная инструкция из `assets/js/features.js` (`DEFAULT_PROMPT`). Каталог, цены, сроки и формулировки продавца всегда добавляются к промпту автоматически.
- «Собрать по шагам» — конструктор промпта (`openPromptWizard` в `assets/js/app.js`): роль → инструкции → задача → приветствие → готовый текст. Собирается локально, без запросов к модели, результат пишется в то же поле и дальше правится руками.
- Подстановки в промпте (`fillMacros` в `assets/js/features.js`): `[[name]]` — имя покупателя, `[[title]]` — позиция из объявления/диалога, `[[price]]` — её цена, `[[shop]]`, `[[city]]`, а также `{магазин}`, `{тон}`, `{товар}`, `{цена}`, `{имя}`, `{город}`.
- «Где считаются ответы» — `server` (DeepSeek Flash через `/api/chat` на сервере) или `local` (`http://127.0.0.1:8080/v1/chat/completions`, модель `mnn-pocket-0.3b` через llama.cpp). Локальная модель 0.3B годится только чтобы проверить связку: качество ответов низкое.

### Стенды на домашнем сервере eta

| адрес | что | откуда выкладывается |
|---|---|---|
| `site-port.ru`, `www.site-port.ru` | прод | `/usr/local/bin/autor-eta-deploy`, ветка `chats-v2`, каталог `/srv/site-port/sites/autor.site-port.ru` |
| `test.site-port.ru` | тестовый стенд | тот же воркер с `/etc/autor-test.env`, каталог `/srv/site-port/sites/test.site-port.ru`, таймер `autor-eta-sync-test.timer` |
| `lead.site-port.ru` | Lefinder (лиды) | отдельный сервис `lefinder.service` на `127.0.0.1:8099`, Caddy проксирует |

Все три имени ходят наружу через один CloudPub-агент (`autor-cloudpub`), Caddy различает их по заголовку `Host`.

### Админка (#/admin)

- Две вкладки: «Пользователи» (кто работает в кабинете — роль, тариф, статус, приглашение и отключение) и «Промокоды».
- Промокоды генерируются на месте (`promoCode()` в `assets/js/app.js`): код вида `AUTOR-XXXX-XXXX-XXXX`, хеш PBKDF2 считается тем же `kdf`, что и в окне доступа, и складывается в `localStorage` (`autor.codes.v1`). Такой код сразу проходит проверку `AutoRBilling.redeem` в этом браузере.
- Стили — `assets/css/pages/admin.css`; состояние — `state.admin` (пользователи и выданные коды).

## Автовыкладка (как сайт обновляется сам)

На сервере включён systemd-таймер `autor-sync.timer`: раз в минуту он делает `git fetch`
ветки `main` и, если файлы сайта изменились, собирает папку (`index.html` + `assets/`)
и подменяет `/var/www/autor` целиком. Прошлая версия `index.html` остаётся рядом как
`index.prev.html`. Ничего не делает, если изменений нет.

Порядок работы:

```
правим index.html или assets/  ->  git commit  ->  git push origin main  ->  в течение минуты на сайте
```

Ручной прогон и логи:

```
systemctl start autor-sync.service        # прогнать сейчас
tail -f /var/log/autor-sync.log           # что происходит
systemctl list-timers autor-sync.timer    # когда следующий запуск
```

Настройки (репозиторий, ветка) — в `/etc/autor/sync.env`. Для приватного репозитория
там же можно указать адрес с токеном. Поставить всё на чистый сервер: `bash install-sync.sh`
(от root). Отключить: `systemctl disable --now autor-sync.timer`.

Перед выкладкой воркер проверяет сборку: размер `index.html`, наличие `<html>`, слова АвтоЧат
и всех файлов, на которые тот ссылается. Если чего-то не хватает — сайт не трогается,
в лог пишется ошибка. Если менялся `server-setup.sh` (конфиг nginx), воркер пишет
предупреждение — установщик запускается вручную.

## Доступ из дома (eta + CloudPub)

Сайт кроме VPS живёт на домашнем сервере `eta` (Arch, Caddy на `:8080`, сайт в
`/srv/site-port/sites/autor.site-port.ru`). Туда же смотрит автовыкладка из ветки `chats-v2`
через `/usr/local/bin/autor-eta-deploy` и таймер `autor-eta-sync.timer` (раз в 5 минут).

Наружу домашний сервер не открывается — только исходящие туннели:

- **CloudPub** (контейнер `autor-cloudpub`, `cloudpub/cloudpub`, `--net=host`, токен в
  `/home/eta/.cloudpub.env`): публичный адрес вида `https://<name>.cloudpub.ru`, запросы
  приходят с принудительным `Host: autor.site-port.ru`, поэтому Caddy отдаёт блок АвтоЧат;
- **свой SSH-туннель** на VPS (`autor-tunnel.service`): `127.0.0.1:8090` → nginx
  `autor.site-port.ru`. Домашние порты 80/8000/8080/8123/8443 закрыты nftables
  (`/etc/autor/autor-guard.nft`), доступны только из LAN и tailnet.

На eta Caddy сам проксирует `POST /api/chat` в DeepSeek (ключ в `/etc/caddy/autor.env`,
600, подключается через `EnvironmentFile=` в drop-in `caddy.service`), поэтому ИИ работает
и без VPS.

Ветки `tools/` и `docs/` на сервер не выкладываются (исключены в `sync-deploy.sh`,
`deploy-eta.sh`, `server-setup.sh`) — там планы и скрипты, им нечего делать в вебе.

## Выложить на сервер вручную

```
cd папка-с-файлами
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

По умолчанию сервер `root@site-port.ru`, домен `site-port.ru`. Другие: `-Server root@домен -Domain домен`.

## Тарифы

Доступ 999 ₽ навсегда (+ MAXIMUM на 30 дней в подарок), VIP 299 ₽/мес, MAXIMUM 799 ₽/мес. Сценарии: Бесплатный — до 10, VIP — до 25, MAXIMUM — без лимита. Промокоды в сайте хранятся только в виде отпечатков; файл с самими кодами в репозиторий не кладётся.

## Если домашний сервер пропал

Симптом: все адреса (`site-port.ru`, `lead.site-port.ru`, `admin.site-port.ru`) отдают **503 Service Unavailable** со страницей «Туннель создан на CloudPub». Это значит, что клиент туннеля на eta не на связи — обычно сама машина выключена или без сети. DNS и CloudPub при этом в порядке, чинить там нечего.

Что проверить, когда машина поднялась:

```bash
ssh eta
systemctl status caddy              # сайт
systemctl is-active lefinder autor-codes
docker ps --filter name=cloudpub    # четыре агента туннеля
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/
curl -s -o /dev/null -w '%{http_code}\n' https://guardedly-unanimous-lamb.cloudpub.ru/
```

После включения всё поднимается само: `caddy` и юниты `enabled`, контейнеры CloudPub созданы с `--restart unless-stopped`. Если публичный адрес всё равно 503 — `docker restart` соответствующего контейнера.

Сторож: `tools/eta-watchdog/` (скрипт + systemd-юнит и таймер на 5 минут). Он проверяет локальный сайт, состояние четырёх агентов CloudPub и публичный адрес, перезапускает то, что упало. Установка:

```bash
doas install -m 755 tools/eta-watchdog/watchdog.sh /usr/local/bin/autor-watchdog
doas install -m 644 tools/eta-watchdog/autor-watchdog.service /etc/systemd/system/
doas install -m 644 tools/eta-watchdog/autor-watchdog.timer   /etc/systemd/system/
doas systemctl daemon-reload && doas systemctl enable --now autor-watchdog.timer
```

Важно: сторож не спасёт, если машина выключена. Внешний мониторинг (любой сервис с проверкой по URL и уведомлением) стоит поставить отдельно — он единственный заметит полное отсутствие хоста.
