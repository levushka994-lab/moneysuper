/* ==========================================================================
   AutoR — демо-кабинет сервисного бизнеса: утепление, сантехника, материалы.
   Подключается после seed.js и заменяет содержимое на услуги и товары-расходники:
   у услуг цена за м²/выезд, у товаров — остаток на складе.
   ========================================================================== */
(function () {
  "use strict";
  var S = window.AUTOR_SEED;
  if (!S) return;

  S.version = 6; // новая схема данных: kind/unit/minOrder — старый кэш не подходит

  S.shop = {
    id: "uyut",
    name: "УЮТ-СТРОЙ",
    legalName: "ИП Соколов М. А.",
    tagline: "Утепление, сантехника и материалы",
    city: "Москва и МО",
    owner: "Марина Соколова",
    email: "zakaz@uyut-stroy.ru",
    phone: "+7 999 120-45-45",
    site: "uyut-stroy.ru",
    description: "Утепляем фасады, кровлю и балконы, чиним сантехнику и привозим материалы. Замер бесплатный, работаем с 2019 года.",
    timezone: "Europe/Moscow",
    plan: "Pro",
    avitoAccount: "УЮТ-СТРОЙ · утепление и сантехника",
    avitoConnectedAt: "12 сентября 2026"
  };

  S.stats = {
    messages: 128,
    autoReplies: 112,
    avgResponse: 8,
    orders: 14,
    missed: 0,
    autoShare: 87,
    dayDelta: 18
  };

  S.topics = [
    { name: "Утепление", value: 38, color: "#121c23" },
    { name: "Сантехника", value: 24, color: "#ffc21a" },
    { name: "Цена за м²", value: 22, color: "#f07b3f" },
    { name: "Сроки и замер", value: 16, color: "#8b73f8" }
  ];

  S.products = [
    {
      id: "p1",
      kind: "service",
      name: "Утепление фасада",
      subtitle: "Минвата 100 мм, каркас, обшивка",
      sku: "SRV-FASAD",
      category: "Утепление",
      unit: "м²",
      minOrder: 30,
      duration: "2–4 дня",
      price: 1450,
      oldPrice: 1690,
      stock: 0,
      image: "assets/img/items/facade.webp",
      badge: "Хит",
      inquiries: 34,
      autoReplies: 31,
      auto: true,
      note: "Цена за м² под ключ: утеплитель, каркас, ветрозащита, обшивка. Выезд на замер бесплатный."
    },
    {
      id: "p2",
      kind: "service",
      name: "Утепление кровли",
      subtitle: "Скатная кровля, минвата 150 мм",
      sku: "SRV-ROOF",
      category: "Утепление",
      unit: "м²",
      minOrder: 40,
      duration: "1–3 дня",
      price: 1290,
      stock: 0,
      image: "assets/img/items/roof.webp",
      inquiries: 19,
      autoReplies: 17,
      auto: true,
      note: "Считаем по площади скатов, минимум 40 м². Работаем с деревянными и металлическими стропилами."
    },
    {
      id: "p3",
      kind: "service",
      name: "Утепление балкона",
      subtitle: "Лоджия 6 м² под ключ, с отделкой",
      sku: "SRV-BALKON",
      category: "Утепление",
      unit: "объект",
      minOrder: 0,
      duration: "1 день",
      price: 44900,
      stock: 0,
      image: "assets/img/items/balcony.webp",
      badge: "Популярно",
      inquiries: 22,
      autoReplies: 20,
      auto: true,
      note: "Фиксированная цена за лоджию до 6 м²: утепление, пароизоляция, черновая отделка. Больше 6 м² — считаем по м²."
    },
    {
      id: "p4",
      kind: "service",
      name: "Вызов сантехника",
      subtitle: "Диагностика и мелкий ремонт",
      sku: "SRV-SANTEH",
      category: "Сантехника",
      unit: "выезд",
      minOrder: 0,
      duration: "в день обращения",
      price: 1500,
      stock: 0,
      image: "assets/img/items/plumber.webp",
      inquiries: 41,
      autoReplies: 38,
      auto: true,
      note: "Выезд по Москве в пределах МКАД. Аварийные протечки — в течение 2 часов, наценка за срочность 500 ₽."
    },
    {
      id: "p5",
      kind: "service",
      name: "Замена смесителя",
      subtitle: "Работа мастера, без стоимости смесителя",
      sku: "SRV-MIXER",
      category: "Сантехника",
      unit: "шт",
      minOrder: 0,
      duration: "40–60 минут",
      price: 1800,
      stock: 0,
      image: "assets/img/items/faucet.webp",
      inquiries: 16,
      autoReplies: 15,
      auto: true,
      note: "Меняем на кухне и в ванной. Свой смеситель — можно, гарантия на работу 12 месяцев."
    },
    {
      id: "p6",
      kind: "good",
      name: "Плита ОСП-3, 9 мм",
      subtitle: "2500 × 1250 мм, шпунтованная",
      sku: "MAT-OSB9",
      category: "Стройматериалы",
      unit: "шт",
      minOrder: 0,
      price: 1490,
      stock: 42,
      image: "assets/img/items/osb.webp",
      inquiries: 12,
      autoReplies: 11,
      auto: true,
      note: "Со склада в Москве, самовывоз или доставка. При заказе от 20 листов — бесплатная доставка по МКАД."
    },
    {
      id: "p7",
      kind: "good",
      name: "Минвата Rockwool 100 мм",
      subtitle: "Упаковка 5,76 м², плиты",
      sku: "MAT-WOOL100",
      category: "Стройматериалы",
      unit: "упак",
      minOrder: 0,
      price: 890,
      stock: 18,
      image: "assets/img/items/wool.webp",
      inquiries: 9,
      autoReplies: 8,
      auto: true,
      note: "Плотность 37 кг/м³, для фасадов и кровли. Привезём вместе с монтажом — цена пойдёт в смету."
    }
  ];

  S.rules = [
    {
      id: "r1",
      icon: "i-box",
      accent: "blue",
      name: "Замер и выезд",
      desc: "Уточняет площадь или адрес, объясняет, что замер бесплатный.",
      triggers: ["замер", "выезд", "приехать", "посмотреть"],
      reply: "Замер бесплатный: приедем в удобное время, посчитаем «{{товар}}» на месте. Напишите адрес и когда удобно.",
      used: 46,
      accuracy: 98,
      enabled: true
    },
    {
      id: "r2",
      icon: "i-tag",
      accent: "amber",
      name: "Цена по объёму",
      desc: "Считает стоимость по площади или количеству и называет вилку.",
      triggers: ["цена", "сколько стоит", "смета", "за м2", "квадрат"],
      reply: "«{{товар}}» — {{цена}}. Посчитаю точно по вашим размерам: скажите площадь.",
      used: 38,
      accuracy: 96,
      enabled: true
    },
    {
      id: "r3",
      icon: "i-truck",
      accent: "green",
      name: "Материалы и доставка",
      desc: "Говорит про склад, наличие листов и доставку по Москве и области.",
      triggers: ["доставка", "привезти", "склад", "наличие"],
      reply: "Материалы есть на складе в Москве. Доставка по МКАД — 900 ₽, за МКАД — 35 ₽/км. Можем привезти вместе с монтажом.",
      used: 27,
      accuracy: 94,
      enabled: true
    },
    {
      id: "r4",
      icon: "i-clock",
      accent: "violet",
      name: "Сроки работ",
      desc: "Называет реальные сроки по типу работ и загрузке бригады.",
      triggers: ["срок", "когда", "успеете", "долго"],
      reply: "«{{товар}}» занимает {{срок}}. Ближайшая бригада свободна завтра — можем забронировать дату.",
      used: 21,
      accuracy: 92,
      enabled: true
    },
    {
      id: "r5",
      icon: "i-shield",
      accent: "blue",
      name: "Гарантия на работы",
      desc: "Отвечает про гарантию и документы.",
      triggers: ["гарантия", "договор", "чек", "документы"],
      reply: "Работаем по договору, гарантия на работы 12 месяцев, на материалы — гарантия производителя. Все документы выдаём.",
      used: 14,
      accuracy: 97,
      enabled: true
    },
    {
      id: "r6",
      icon: "i-users",
      accent: "amber",
      name: "Сложный вопрос — менеджеру",
      desc: "Если вопрос про перепланировку, суд или нестандартный объект — передаёт человеку.",
      triggers: ["перепланировка", "суд", "соседи", "нестандарт"],
      reply: "Это лучше обсудить с инженером — передам ваш вопрос и вернусь с ответом в течение дня.",
      used: 6,
      accuracy: 100,
      enabled: true
    }
  ];

  // Фотографии покупателей лежат в демо-наборе (AUTOR_SAMPLE_SEED), а не в пустом сиде.
  var D = window.AUTOR_SAMPLE_SEED || S;
  var avatar = {
    artem: D.chats && D.chats[0] && D.chats[0].buyer && D.chats[0].buyer.avatar,
    ksenia: D.chats && D.chats[1] && D.chats[1].buyer && D.chats[1].buyer.avatar,
    igor: D.chats && D.chats[2] && D.chats[2].buyer && D.chats[2].buyer.avatar,
    denis: D.chats && D.chats[3] && D.chats[3].buyer && D.chats[3].buyer.avatar
  };

  S.chats = [
    {
      id: "c1",
      buyer: { name: "Артём Ковалёв", avatar: avatar.artem, city: "Москва", rating: 4.9, deals: 6, online: true },
      productId: "p1",
      topic: "Утепление фасада",
      unread: 0,
      pinned: true,
      botPaused: false,
      handoff: false,
      updated: "10:46",
      messages: [
        { id: "m1", from: "buyer", text: "Здравствуйте! Нужно утеплить фасад дома, 92 квадрата. Сколько будет стоить?", time: "10:42" },
        { id: "m2", from: "bot", text: "Здравствуйте, Артём! Утепление фасада — 1450 ₽ за м² под ключ. На 92 м² выходит 133 400 ₽: утеплитель, каркас и обшивка уже в цене. Замер и расчёт точной сметы бесплатные.", time: "10:42", rule: "Цена по объёму", confidence: 97, latency: "6 сек" },
        { id: "m3", from: "buyer", text: "А когда сможете начать? Дом в Подольске.", time: "10:44" },
        { id: "m4", from: "bot", text: "Бригада свободна с понедельника, работы займут 3 дня. Подольск — за МКАД, выезд на замер бесплатный, доставка материалов 35 ₽/км. Когда удобно встретиться на объекте?", time: "10:45", rule: "Сроки работ", confidence: 95, latency: "7 сек" },
        { id: "m5", from: "buyer", text: "Давайте в субботу днём. А гарантия на работу есть?", time: "10:46" },
        { id: "m6", from: "bot", text: "Да, гарантия на работы 12 месяцев по договору, документы выдаём. Записал замер на субботу, после 12:00 — инженер позвонит за час.", time: "10:46", rule: "Гарантия на работы", confidence: 96, latency: "8 сек" },
        { id: "m7", from: "buyer", text: "А покажите фото, как это выглядит на доме?", time: "10:47" },
        { id: "m8", from: "bot", text: "Конечно. Вот пирог фасада с нашего объекта: минвата в каркасе, ветрозащита и обшивка. Похоже на ваш дом?", time: "10:47", rule: "Фото с объекта", confidence: 95, latency: "3 сек", attachment: "assets/img/items/facade.webp" }
      ]
    },
    {
      id: "c2",
      buyer: { name: "Ксения Морозова", avatar: avatar.ksenia, city: "Санкт-Петербург", rating: 4.7, deals: 2, online: false },
      productId: "p5",
      topic: "Замена смесителя",
      unread: 2,
      pinned: false,
      botPaused: false,
      handoff: true,
      updated: "10:04",
      messages: [
        { id: "m1", from: "buyer", text: "Смеситель на кухне течёт, заменить сможете? Сколько стоит?", time: "09:58" },
        { id: "m2", from: "bot", text: "Замена смесителя — 1800 ₽ за работу, сам смеситель можно свой или подберём. Мастер приедет в день обращения, займёт около часа. Уточните, пожалуйста, какой у вас смеситель — обычный или с выдвижным душем?", time: "09:58", rule: "Наличие и выезд", confidence: 95, latency: "5 сек" },
        { id: "m3", from: "buyer", text: "А если ещё и труба подтекает — сделаете за один раз?", time: "10:02" },
        { id: "m4", from: "bot", text: "Да, мастер посмотрит на месте и сделает всё за один выезд. Если потребуется замена участка трубы, он назовёт цену до начала работ. Подскажите адрес и когда удобно?", time: "10:03", rule: "Сантехника", confidence: 91, latency: "9 сек" },
        { id: "m5", from: "buyer", text: "А 10% скидки дадите, если сразу два крана поменяете?", time: "10:04" },
        { id: "m6", from: "bot", text: "Скидка выше лимита бота — диалог передан менеджеру", time: "10:04", rule: "Передача менеджеру", confidence: 88, latency: "2 сек" }
      ]
    },
    {
      id: "c3",
      buyer: { name: "Игорь Лебедев", avatar: avatar.igor, city: "Москва", rating: 4.5, deals: 4, online: true },
      productId: "p7",
      topic: "Минвата",
      unread: 0,
      pinned: false,
      botPaused: false,
      handoff: false,
      updated: "09:21",
      messages: [
        { id: "m1", from: "buyer", text: "Сколько стоит минвата 100 мм и есть ли в наличии?", time: "09:18" },
        { id: "m2", from: "bot", text: "Rockwool 100 мм — 890 ₽ за упаковку (5,76 м²). На складе 18 упаковок, привезём завтра. Сколько площади утепляете? Подскажу, сколько упаковок нужно.", time: "09:19", rule: "Материалы и доставка", confidence: 96, latency: "6 сек" },
        { id: "m3", from: "buyer", text: "Спасибо, буду иметь в виду", time: "09:21" }
      ]
    },
    {
      id: "c4",
      buyer: { name: "Денис Орлов", avatar: avatar.denis, city: "Москва", rating: 4.8, deals: 1, online: false },
      productId: "p4",
      topic: "Протечка",
      unread: 1,
      pinned: false,
      botPaused: false,
      handoff: false,
      updated: "08:55",
      messages: [
        { id: "m1", from: "buyer", text: "Здравствуйте, срочно! В ванной течёт с трубы, нужен сантехник сегодня", time: "08:52" },
        { id: "m2", from: "bot", text: "Принял, это аварийный вызов. Выезд 1500 ₽, при аварийной протечке приедем в течение 2 часов. Скажите адрес и перекройте воду — кран в санузле или на вводе в квартиру.", time: "08:53", rule: "Замер и выезд", confidence: 94, latency: "5 сек" },
        { id: "m3", from: "buyer", text: "Улица Пушкина, 12, квартира 34. Воду перекрыл", time: "08:55" },
        { id: "m4", from: "bot", text: "Принял: Пушкина, 12, кв. 34. Мастер выехал, будет в течение 40 минут. Вот как выглядит узел, который обычно меняем — если у вас так же, замена займёт час.", time: "08:56", rule: "Сантехника", confidence: 92, latency: "4 сек", attachment: "assets/img/items/plumber.webp" }
      ]
    }
  ];

  // лента событий кабинета
  S.feed = [
    { id: "f1", type: "answer", icon: "i-sparkles", text: "Бот ответил про цену за м² — Артём Ковалёв", time: "1 мин назад" },
    { id: "f2", type: "handoff", icon: "i-users", text: "Диалог передан менеджеру — Ксения Морозова", time: "9 мин назад" },
    { id: "f3", type: "photo", icon: "i-image", text: "Замер назначен на субботу — Артём Ковалёв", time: "14 мин назад" },
    { id: "f4", type: "answer", icon: "i-sparkles", text: "Бот ответил про минвату — Игорь Лебедев", time: "22 мин назад" }
  ];
})();
