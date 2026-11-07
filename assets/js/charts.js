/* ==========================================================================
   AutoR — tiny chart toolkit (no dependencies, SVG only)
   ========================================================================== */

window.Charts = (function () {
  "use strict";

  let uid = 0;
  const nextId = (prefix) => `${prefix}${++uid}`;

  function smoothPath(points, tension) {
    tension = tension === undefined ? 0.18 : tension;
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) * tension;
      const c1y = p1[1] + (p2[1] - p0[1]) * tension;
      const c2x = p2[0] - (p3[0] - p1[0]) * tension;
      const c2y = p2[1] - (p3[1] - p1[1]) * tension;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }

  function niceMax(value) {
    if (!value) return 10;
    const step = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / step;
    let nice = 10;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 2.5) nice = 2.5;
    else if (normalized <= 5) nice = 5;
    return nice * step;
  }

  /**
   * Line + area chart.
   * @param {object} options
   * @param {number[]} options.primary
   * @param {number[]} options.secondary
   * @param {string[]} options.labels
   * @param {string} options.primaryColor
   * @param {string} options.secondaryColor
   * @param {number} options.height
   * @param {boolean} options.annotate
   */
  function areaChart(options) {
    const opts = Object.assign(
      {
        primary: [],
        secondary: [],
        labels: [],
        primaryColor: "#121c23",
        secondaryColor: "#e09b00",
        height: 232,
        annotate: true,
        primaryLabel: "Сообщения",
      },
      options || {}
    );

    const values = opts.primary.concat(opts.secondary);
    const W = 820;
    const H = opts.height;
    const left = 34;
    const right = 14;
    const top = 24;
    const bottom = 12;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const max = niceMax(Math.max.apply(null, values) * 1.08);
    const count = Math.max(opts.primary.length, 1);
    const stepX = count > 1 ? plotW / (count - 1) : 0;

    const toPoint = (v, i) => [
      left + stepX * i,
      top + plotH - (v / max) * plotH,
    ];

    const p1 = opts.primary.map(toPoint);
    const p2 = opts.secondary.map(toPoint);
    const linePrimary = smoothPath(p1);
    const lineSecondary = smoothPath(p2);
    const areaId = nextId("areaGrad");
    const areaPath = `${linePrimary} L ${p1[p1.length - 1][0]} ${top + plotH} L ${p1[0][0]} ${top + plotH} Z`;

    const ticks = 4;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const y = top + (plotH / ticks) * i;
      const val = Math.round(max - (max / ticks) * i);
      grid += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W - right}" y2="${y.toFixed(1)}" stroke="#f5f3ee" stroke-width="1" stroke-dasharray="${i === ticks ? "0" : "3 4"}" vector-effect="non-scaling-stroke"/>`;
      grid += `<text x="0" y="${(y + 3).toFixed(1)}" fill="#b7b1a6" font-size="9">${val}</text>`;
    }

    let secondaryPath = "";
    if (p2.length) {
      secondaryPath = `<path d="${lineSecondary}" fill="none" stroke="${opts.secondaryColor}" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round" opacity=".9" vector-effect="non-scaling-stroke"/>`;
    }

    let points = "";
    p1.forEach((pt, i) => {
      points += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="8" fill="transparent"><title>${escapeAttr(opts.labels[i] || "")}: ${opts.primary[i]}</title></circle>`;
      points += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.8" fill="#fffefb" stroke="${opts.primaryColor}" stroke-width="1.8"/>`;
    });
    p2.forEach((pt, i) => {
      points += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="7" fill="transparent"><title>${escapeAttr(opts.labels[i] || "")}: ${opts.secondary[i]}</title></circle>`;
    });

    const last = p1[p1.length - 1] || [W - right, top];
    const annotation = opts.annotate
      ? `<g class="chart-annotation" transform="translate(${Math.min(last[0] - 17, W - right - 34)},${Math.max(last[1] - 31, 2)})">
          <rect width="34" height="19" rx="6" fill="#121c23"/>
          <path d="M15 19h4l-2 4z" fill="#121c23"/>
          <text x="17" y="13" text-anchor="middle" fill="#fffefb" font-size="9.5" font-weight="600">${opts.primary[opts.primary.length - 1]}</text>
        </g>`
      : "";

    const lastHalo = `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="6.5" fill="${opts.primaryColor}" opacity=".14"/>`;

    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none" role="img" aria-label="${escapeAttr(opts.primaryLabel)} за период">
      <defs>
        <linearGradient id="${areaId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${opts.primaryColor}" stop-opacity=".18"/>
          <stop offset="78%" stop-color="${opts.primaryColor}" stop-opacity=".025"/>
          <stop offset="100%" stop-color="${opts.primaryColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#${areaId})"/>
      ${secondaryPath}
      <path d="${linePrimary}" fill="none" stroke="${opts.primaryColor}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      ${lastHalo}
      ${points}
      ${annotation}
    </svg>`;
  }

  function sparkline(values, color, fillColor) {
    const w = 92;
    const h = 34;
    const pad = 3;
    const max = Math.max.apply(null, values);
    const min = Math.min.apply(null, values);
    const range = max - min || 1;
    const step = (w - pad * 2) / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [
      pad + step * i,
      h - pad - ((v - min) / range) * (h - pad * 2),
    ]);
    const line = smoothPath(pts, 0.16);
    const area = `${line} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
    const id = nextId("spark");
    const c = color || "#121c23";
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${fillColor || c}" stop-opacity=".16"/>
        <stop offset="100%" stop-color="${fillColor || c}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.2" fill="#fffefb" stroke="${c}" stroke-width="1.5"/>
    </svg>`;
  }

  function donut(segments, size) {
    size = size || 142;
    const r = 53;
    const stroke = 14;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((acc, s) => acc + (s.value || 0), 0) || 1;
    let acc = 0;
    let circles = "";
    segments.forEach((s) => {
      const part = (s.value / total) * c;
      const gap = 2.4;
      const dash = Math.max(part - gap, 0);
      circles += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" stroke-linecap="butt"><title>${escapeAttr(s.name)}: ${s.value}%</title></circle>`;
      acc += part;
    });
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Распределение вопросов">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#fffaeb" stroke-width="${stroke}"/>
      ${circles}
    </svg>`;
  }

  function escapeAttr(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { areaChart, sparkline, donut };
})();
