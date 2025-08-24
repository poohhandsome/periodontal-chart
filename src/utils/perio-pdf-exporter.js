// src/utils/perio-pdf-exporter.js
// EasyPerio — 16×12 table layout with tooth PNGs and mm-accurate overlays,
// with CORRECT crown/root orientation per arch.
// Page 1: Upper arch; Page 2: Lower arch (rows inverted).

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

// --- Configuration & Colors ---
const colorNavy = [15, 23, 42], colorPD = [220, 38, 38], colorRE = [71, 85, 105];
const colorBlue = [37, 99, 235], gridGray = [229, 231, 235], colorMGJ = [0, 0, 0];
const colorTextRed = [220, 38, 38], colorTextOrange = [249, 115, 22];
const colorTextGreen = [34, 197, 94], colorTextBlack = [0, 0, 0];

const PIZZA_SLICE_RED   = [239, 68, 68];   // #EF4444
const PIZZA_SLICE_GRAY  = [243, 244, 246]; // #F3F4F6
const PIZZA_STROKE_GRAY = [209, 213, 219]; // #D1D5DB

// (kept for future sextant summary, not used by the per-tooth grid)
const PIZZA_CHART_COLORS = [
  [26,188,156],[46,204,113],[52,152,219],[155,89,182],[241,196,15],[230,126,34]
];
const PIZZA_CHART_LABELS = [
  'Sextant 1 (18-14)','Sextant 2 (13-23)','Sextant 3 (24-28)',
  'Sextant 4 (38-34)','Sextant 5 (33-43)','Sextant 6 (44-48)'
];

// --- Visual Calibration & Constants ---
const CEJ_VISUAL_OFFSET_MM = 0;
const BOP_DOT_OFFSET_MM = 2;
const LOWER_IMAGE_UPSHIFT_MM = 2;
const PROXIMAL_OFFSET_MM = -0.5;

const LABEL_COL_W = 14;
const ROW_LABELS_BASE = [
  'Tooth (B)', 'Dx/Px', 'MGJ', 'PD (B)', 'RE (B)', 'Buccal',
  'MO', 'F', 'PD (Li)', 'RE (Li)', 'Lingual', 'Tooth (Li)'
];

const SITES_B = { forward: ['mb','b','db'], reverse: ['db','b','mb'] };
const SITES_L = { forward: ['ml','l','dl'], reverse: ['dl','l','ml'] };

const RH = [8,8,8,9,9,28,8,8,9,9,28,8];

const UPPER_ROWS = [
  ['18','17','16','15','14','13','12','11'],
  ['21','22','23','24','25','26','27','28']
];
const LOWER_ROWS = [
  ['48','47','46','45','44','43','42','41'],
  ['31','32','33','34','35','36','37','38']
];

// --- Helper functions ---
const roman = (n) => (n == null ? '' : ['', 'I', 'II', 'III'][Number(n)] || '');

const formatFurcation = (f) => {
  if (!f) return '–';
  const parts = [];
  if (f.b)   parts.push(`${roman(f.b)}(B)`);
  if (f.l)   parts.push(`${roman(f.l)}(Li)`);
  if (f.mli) parts.push(`${roman(f.mli)}(MLi)`);
  if (f.dli) parts.push(`${roman(f.dli)}(DLi)`);
  return parts.length > 0 ? parts.join('/') : '–';
};

// --- BOP stats for page 3 ---
function computeBopStats(map, missingSet) {
  const allFDI = [...UPPER_ROWS[0], ...UPPER_ROWS[1], ...LOWER_ROWS[0], ...LOWER_ROWS[1]];
  const sites = ['db', 'b', 'mb', 'ml', 'l', 'dl'];

  let total = 0;
  let bop = 0;

  for (const fdi of allFDI) {
    if (missingSet.has(fdi)) continue;
    const bl = map[fdi]?.bleeding || {};
    for (const s of sites) {
      total += 1;
      const v = bl[s] ?? bl[s?.toUpperCase?.()] ?? false;
      if (v) bop += 1;
    }
  }
  const pct = total ? (bop / total) * 100 : 0;
  return { bopSites: bop, totalSites: total, percent: pct };
}

// --- Per-tooth BOP “pizza” (matches PizzaChart.jsx) -----------------

// 0° at 12 o’clock, like your SVG.
const rad = (deg) => (deg - 90) * Math.PI / 180;

// Q2 and Q4 need M↔D flip to match fixed visual layout
const needsFlip = (fdi) => {
  const n = parseInt(fdi, 10);
  return (n >= 21 && n <= 28) || (n >= 41 && n <= 48);
};

// Fill a wedge as a fan of small triangles (robust in jsPDF)
function fillWedge(doc, cx, cy, r, startDeg, endDeg, fillRGB, strokeRGB) {
  doc.setFillColor(...fillRGB);
  doc.setDrawColor(...strokeRGB);
  doc.setLineWidth(0.2);
  const step = 6; // degrees per sub‐triangle
  let px = cx + r * Math.cos(rad(startDeg));
  let py = cy + r * Math.sin(rad(startDeg));
  for (let a = startDeg + step; a <= endDeg + 0.0001; a += step) {
    const x = cx + r * Math.cos(rad(a));
    const y = cy + r * Math.sin(rad(a));
    doc.triangle(cx, cy, px, py, x, y, 'FD'); // fill+stroke
    px = x; py = y;
  }
}

function drawToothPizza(doc, cx, cy, r, fdi, bleeding = {}, isMissing = false, rotationDeg = 0) {
  // background circle
  doc.setFillColor(...PIZZA_SLICE_GRAY);
  doc.setDrawColor(...PIZZA_STROKE_GRAY);
  doc.circle(cx, cy, r, 'FD');

  if (isMissing) return;

  const sites = ['db','b','mb','ml','l','dl'];
  const keyFor = (s) => {
    if (!needsFlip(fdi)) return s;
    if (s === 'db') return 'mb';
    if (s === 'mb') return 'db';
    if (s === 'dl') return 'ml';
    if (s === 'ml') return 'dl';
    return s;
  };

  for (let i = 0; i < 6; i++) {
    const site = sites[i];
    const key  = keyFor(site);
    const hasBOP = !!bleeding[key];
    const start = i * 60 + rotationDeg;
    const end   = start + 60;
    fillWedge(
      doc, cx, cy, r,
      start, end,
      hasBOP ? PIZZA_SLICE_RED : PIZZA_SLICE_GRAY,
      PIZZA_STROKE_GRAY
    );
  }
}

// Draw both arch rows centered on the page; return height used.
function drawBopToothGrid(doc, map, missingSet, pageW, startY) {
  const radius = 6;              // mm
  const pitchX = 14;             // center-to-center horizontally
  const pitchY = 22;             // row spacing
  const gridCols = 16;
  const gridW = pitchX * gridCols;
  const startX = (pageW - gridW) / 2;

  const upperRow = [...UPPER_ROWS[0], ...UPPER_ROWS[1]];
  const lowerRow = [...LOWER_ROWS[0], ...LOWER_ROWS[1]];

  // Upper row
  for (let c = 0; c < gridCols; c++) {
    const fdi = upperRow[c];
    const tooth = map[fdi] || {};
    const miss  = missingSet.has(fdi);
    const cx = startX + c * pitchX + pitchX / 2;
    const cy = startY + radius + 2;
    drawToothPizza(doc, cx, cy, radius, fdi, tooth.bleeding || {}, miss, -90);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...colorNavy);
    doc.text(String(fdi), cx, cy + radius + 6, { align: 'center' });
  }

  // Lower row
  const y2 = startY + pitchY;
  for (let c = 0; c < gridCols; c++) {
    const fdi = lowerRow[c];
    const tooth = map[fdi] || {};
    const miss  = missingSet.has(fdi);
    const cx = startX + c * pitchX + pitchX / 2;
    const cy = y2 + radius + 2;
    drawToothPizza(doc, cx, cy, radius, fdi, tooth.bleeding || {}, miss, +90);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...colorNavy);
    doc.text(String(fdi), cx, cy + radius + 6, { align: 'center' });
  }

  return pitchY + (radius * 2 + 10); // total vertical space consumed
}

function drawClinicalNotes(doc, notes, startY, marginX, pageW) {
  if (!notes || notes.trim() === '') return 0;
  doc.setFont('helvetica','bold');   doc.setFontSize(12); doc.setTextColor(...colorNavy);
  doc.text('Clinical Notes & Impressions', marginX, startY);

  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const splitNotes = doc.splitTextToSize(notes, pageW - marginX * 2);
  doc.text(splitNotes, marginX, startY + 6);
  return (splitNotes.length * 5) + 10;
}

const getPeriodontalDiagnosis = (toothData) => {
  if (!toothData || !toothData.pd || !toothData.re) return { dx: '', px: '-' };
  const pdValues = Object.values(toothData.pd).filter(v => v !== null);
  if (pdValues.length === 0) return { dx: '', px: '-' };
  const maxPd = Math.max(0, ...pdValues);
  let maxCal = 0;
  const allSites = ['db','b','mb','dl','l','ml'];
  allSites.forEach(site => {
    const pd = toothData.pd[site] ?? 0;
    const re = toothData.re[site] ?? 0;
    if (pd > 0) maxCal = Math.max(maxCal, pd + re);
  });
  let pdSeverity = 0;
  if (maxPd >= 7) pdSeverity = 3; else if (maxPd >= 5) pdSeverity = 2; else if (maxPd > 0) pdSeverity = 1;
  let calSeverity = 0;
  if (maxCal >= 5) calSeverity = 3; else if (maxCal >= 3) calSeverity = 2; else if (maxCal >= 1) calSeverity = 1;
  const finalSeverity = Math.max(pdSeverity, calSeverity);
  let dx = '';
  switch (finalSeverity) {
    case 1: dx = 'E'; break;
    case 2: dx = 'M'; break;
    case 3: dx = 'A'; break;
    default: dx = '';
  }
  return { dx, px: '-' };
};

function quadrantOf(fdi) {
  const n = parseInt(fdi, 10);
  if (n >= 11 && n <= 18) return 'Q1';
  if (n >= 21 && n <= 28) return 'Q2';
  if (n >= 31 && n <= 38) return 'Q3';
  if (n >= 41 && n <= 48) return 'Q4';
  return null;
}

function siteOrderFor(fdi, side) {
  const q = quadrantOf(fdi);
  const reverse = (q === 'Q1' || q === 'Q4');
  if (side === 'B') return reverse ? SITES_B.reverse : SITES_B.forward;
  return reverse ? SITES_L.reverse : SITES_L.forward;
}

// --- jsPDF loader ---
async function ensureJsPDF() {
  let C = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!C) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = JSPDF_URL; s.async = true; s.onload = res;
      s.onerror = () => rej(new Error('Failed to load jsPDF'));
      document.head.appendChild(s);
    });
    C = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  }
  if (!C) throw new Error('jsPDF not available');
  return C;
}

// --- PNG caches/loaders ---
const imageCache = new Map();
async function loadToothPNG(fdi) {
  const key = String(fdi);
  if (imageCache.has(key)) return imageCache.get(key);
  try {
    const res = await fetch(`/teeth/${key}.png`, { cache: 'force-cache' });
    if (!res.ok) { imageCache.set(key, null); return null; }
    const blob = await res.blob();
    const dataURL = await new Promise((resolve) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob);
    });
    imageCache.set(key, dataURL);
    return dataURL;
  } catch { imageCache.set(key, null); return null; }
}

// --- Public image loader for /public assets (e.g., /header.png) ---
const publicImgCache = new Map();
async function loadPublicImage(path /* '/header.png' */) {
  if (publicImgCache.has(path)) return publicImgCache.get(path);
  try {
    const res = await fetch(path, { cache: 'force-cache' });
    if (!res.ok) { publicImgCache.set(path, null); return null; }
    const blob = await res.blob();
    const dataURL = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
    publicImgCache.set(path, dataURL);
    return dataURL;
  } catch {
    publicImgCache.set(path, null);
    return null;
  }
}

// Draw logo at top-left; returns baseX to place header text after the logo
function drawHeaderLogo(doc, logoDataURL, marginX = 8, marginY = 0) {
  if (!logoDataURL) return { baseX: marginX, baseY: marginY };
  const LOGO_W = 28;  // mm
  const LOGO_H = 28;  // mm
  doc.addImage(logoDataURL, 'PNG', marginX-4, marginY-10, LOGO_W, LOGO_H);
  return { baseX: marginX + LOGO_W + 6, baseY: marginY };
}

// --- data normalization ---
function normalizeMap(chartData) {
  if (Array.isArray(chartData)) {
    const m = {};
    chartData.forEach(t => { if (t && t.id != null) m[String(t.id)] = { ...t }; });
    return m;
  }
  if (chartData && typeof chartData === 'object') {
    const m = {};
    Object.entries(chartData).forEach(([k,v]) => { m[String(k)] = { ...v, id: String(k) }; });
    return m;
  }
  return {};
}
const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function drawVerticalMMGrid(doc, x, y, w, h) {
  doc.setDrawColor(...gridGray); doc.setLineWidth(0.1);
  for (let i = 0; i <= Math.floor(h); i += 1) {
    const yy = y + i; doc.line(x, yy, x + w, yy);
  }
}

function makeMmToY(arch, yTop, yBottom, cejOffsetMm) {
  const dir = (arch === 'upper') ? -1 : +1;
  const yCEJ = (yTop + yBottom) / 2 - cejOffsetMm;
  return (mm) => {
    const y = yCEJ + dir * (Number.isFinite(mm) ? mm : 0);
    return Math.max(yTop, Math.min(yBottom, y));
  };
}

function drawSmoothCurveSegments(doc, segments, color, lineWidth) {
  doc.setDrawColor(...color); doc.setLineWidth(lineWidth);
  segments.forEach(segment => {
    if (segment.length === 0) return;
    if (segment.length === 1) {
      const p = segment[0]; doc.line(p.x - 2, p.y, p.x + 2, p.y);
    } else {
      const firstPoint = segment[0]; const lastPoint = segment[segment.length - 1];
      doc.line(firstPoint.x - 2, firstPoint.y, firstPoint.x, firstPoint.y);
      doc.line(lastPoint.x, lastPoint.y, lastPoint.x + 2, lastPoint.y);
      doc.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 0; i < segment.length - 1; i++) {
        const p1 = segment[i], p2 = segment[i+1];
        const c1x = p1.x + (p2.x - p1.x) / 2, c1y = p1.y;
        const c2x = p1.x + (p2.x - p1.x) / 2, c2y = p2.y;
        doc.curveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
      }
    }
  });
  doc.stroke();
}

function drawToothBlock(doc, opts) {
  const { fdi, tooth, x, y, w, h, side, arch, missing } = opts;

  const imgW = w * 0.7;
  const imgH = h * 1.0;
  const imgX = x + (w - imgW) / 2;
  const imgY = y + 1 - (arch === 'lower' ? LOWER_IMAGE_UPSHIFT_MM : 0);

  if (tooth.__png) {
    if (missing) {
      doc.setGState(new doc.GState({ opacity: 0.25 }));
      doc.addImage(tooth.__png, 'PNG', imgX, imgY, imgW, imgH);
      doc.setGState(new doc.GState({ opacity: 1 }));
    } else {
      doc.addImage(tooth.__png, 'PNG', imgX, imgY, imgW, imgH);
    }
  } else {
    doc.setDrawColor(200); doc.setLineWidth(0.2);
    doc.rect(imgX, imgY, imgW, imgH);
  }

  // scale in front
  drawVerticalMMGrid(doc, x + 1.5, y + 1.5, w - 3, h - 3);

  const mmToY = makeMmToY(arch, y + 3, y + h - 3, CEJ_VISUAL_OFFSET_MM);
  const order = siteOrderFor(fdi, side);
  const step = w / 6;
  const siteXs = [x + step * 1.5, x + step * 3, x + step * 4.5];

  for (let i = 0; i < 3; i++) {
    const key = order[i];
    const isProximal = i !== 1;
    const reV = N(tooth.re?.[key]);
    const pdV = N(tooth.pd?.[key]);
    const bop = tooth.bleeding?.[key] ?? tooth.bleeding?.[key?.toUpperCase()];

    if (reV !== null) {
      const adjustedRe = reV + (isProximal ? PROXIMAL_OFFSET_MM : 0);
      const yRed = mmToY(adjustedRe);
      // PD >= 4 (blue segment)
      if (pdV !== null && pdV >= 4) {
        const yEnd = mmToY(adjustedRe + pdV);
        doc.setDrawColor(...colorBlue); doc.setLineWidth(0.8);
        doc.line(siteXs[i], yRed, siteXs[i], yEnd);
      }
      // BOP dot
      if (bop) {
        const yDot = mmToY(adjustedRe - BOP_DOT_OFFSET_MM);
        doc.setFillColor(...colorPD); doc.circle(siteXs[i], yDot, 0.8, 'F');
      }
    }
  }
}

function cellText(doc, text, x, y, w, h, opts = {}) {
  const { align = 'center', font = 'helvetica', style = 'normal', size = 8, color = colorNavy } = opts;
  doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color);
  doc.text(String(text), x + w / 2, y + h / 2, { align, baseline: 'middle' });
}

function tripletText(doc, fdi, side, tooth, x, y, w, h, kind) {
  const order = siteOrderFor(fdi, side);
  const step = w / 3;
  for (let i = 0; i < 3; i++) {
    const key = order[i];
    const val = kind === 'PD' ? N(tooth.pd?.[key]) : N(tooth.re?.[key]);
    const text = val === null ? '–' : String(val);
    let color = kind === 'RE' ? colorRE : colorNavy;
    if (kind === 'PD' && val >= 4) color = colorTextRed;
    const textX = x + step * (i + 0.5);
    cellText(doc, text, textX - w / 2, y, w, h, { size: 8, color });
  }
}

// --- Page renderer ---
async function renderPage(
  doc,
  { isUpper, patientInfo, map, missingSet, invertRows, exportOptions = {}, headerLogo }
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 8, marginY = 8;

  // Logo + header text (text shown unless patientInfo explicitly false)
  const { baseX } = drawHeaderLogo(doc, headerLogo, marginX, marginY);
  if (exportOptions.patientInfo !== false) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...colorNavy);
    doc.text(`Periodontal Chart — ${isUpper ? 'Upper Arch' : 'Lower Arch'}`, baseX, marginY + 5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const meta = [
      patientInfo?.patientHN ? `HN: ${patientInfo.patientHN}` : '',
      patientInfo?.patientName ? `Name: ${patientInfo.patientName}` : '',
      `Date: ${new Date().toLocaleDateString()}`
    ].filter(Boolean).join('   ');
    doc.text(meta || '—', baseX, marginY + 10);
  }

  // Grid geometry
  const labelX = marginX, labelW = LABEL_COL_W;
  const startX = marginX + labelW;
  const gridW = pageW - marginX * 2 - labelW;
  const gridH = pageH - marginY * 2 - 14;
  const cols  = 16;
  const colW  = gridW / cols;

  const rowHArr = invertRows ? RH.slice().reverse() : RH;
  const totalH = rowHArr.reduce((a, b) => a + b, 0);
  const startY = marginY + 14 + Math.max(0, (gridH - totalH) / 2);

  const rowYs = []; let yAcc = startY;
  for (let r = 0; r < 12; r++) { rowYs[r] = yAcc; yAcc += rowHArr[r]; }

  const phys = (idx) => invertRows ? 11 - idx : idx;
  const yOf  = (idx) => rowYs[phys(idx)];
  const hOf  = (idx) => rowHArr[phys(idx)];

  const rowsFDI = isUpper ? UPPER_ROWS : LOWER_ROWS;
  const columnFDI = [...rowsFDI[0], ...rowsFDI[1]];

  if (exportOptions.visualChart) {
    await Promise.all(columnFDI.map(async (id) => {
      const t = map[id] || (map[id] = {}); t.__png = await loadToothPNG(id);
    }));
  }

  const labels = (invertRows ? ROW_LABELS_BASE.slice().reverse() : ROW_LABELS_BASE);
  if (exportOptions.dataTables) {
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...colorNavy);
    for (let r = 0; r < 12; r++) {
      doc.text(labels[r], labelX + labelW / 2, rowYs[r] + rowHArr[r] / 2,
        { align: 'center', baseline: 'middle' });
    }
  }

  const mgjSegments = [[]];
  const gingivalBuccalSegments = [[]];
  const gingivalLingualSegments = [[]];

  for (let c = 0; c < cols; c++) {
    const fdi = columnFDI[c];
    const tooth = map[fdi] || {};
    const miss = missingSet.has(fdi);
    const xCell = startX + c * colW;

    if (exportOptions.visualChart) {
      const arch = isUpper ? 'upper' : 'lower';
      const yBuccalTop = yOf(5) + 3,  yBuccalBottom = yOf(5)  + hOf(5)  - 3;
      const yLingualTop = yOf(10) + 3, yLingualBottom = yOf(10) + hOf(10) - 3;

      const mmToYBuccal = makeMmToY(arch, yBuccalTop,  yBuccalBottom,  CEJ_VISUAL_OFFSET_MM);
      const mmToYLingual = makeMmToY(arch, yLingualTop, yLingualBottom, CEJ_VISUAL_OFFSET_MM);

      const mgjB = N(tooth.mgj?.b) ?? N(tooth.mgj?.buccal);
      const reMidB = N(tooth.re?.b);

      if (mgjB != null && reMidB != null && !miss) {
        mgjSegments[mgjSegments.length - 1]
          .push({ x: xCell + colW / 2, y: mmToYBuccal(reMidB + mgjB) });
      } else if (mgjSegments[mgjSegments.length - 1].length > 0) {
        mgjSegments.push([]);
      }

      const collectGingivalPoints = (side, segments, mmToY) => {
        const order = siteOrderFor(fdi, side);
        const step = colW / 6;
        const siteXs = [xCell + step * 1.5, xCell + step * 3, xCell + step * 4.5];
        let hasData = false;
        for (let i = 0; i < 3; i++) {
          const key = order[i];
          const reV = N(tooth.re?.[key]);
          if (reV !== null && !miss) {
            const isProximal = i !== 1;
            const adjustedRe = reV + (isProximal ? PROXIMAL_OFFSET_MM : 0);
            segments[segments.length - 1].push({ x: siteXs[i], y: mmToY(adjustedRe) });
            hasData = true;
          }
        }
        if (!hasData && segments[segments.length - 1].length > 0) {
          segments.push([]);
        }
      };

      collectGingivalPoints('B', gingivalBuccalSegments,  mmToYBuccal);
      collectGingivalPoints('L', gingivalLingualSegments, mmToYLingual);
    }

    if (exportOptions.dataTables) {
      cellText(doc, `${fdi}  B`, xCell, yOf(0), colW, hOf(0), { size: 8 });

      const savedDxPx = tooth.dxpx;
      let dxPxText = '–'; let dxPxColor = colorNavy;
      if (savedDxPx) {
        dxPxText = savedDxPx;
        const [dx, px] = savedDxPx.split('/');
        if (px === 'H') dxPxColor = colorTextBlack;
        else if (px === 'Q' || dx === 'A') dxPxColor = colorTextRed;
        else if (px === 'P' || dx === 'M') dxPxColor = colorTextOrange;
        else if (px === 'F' || dx === 'E') dxPxColor = colorTextGreen;
      } else {
        const { dx, px } = getPeriodontalDiagnosis(tooth);
        if (dx) dxPxText = `${dx}/${px}`;
      }
      cellText(doc, dxPxText, xCell, yOf(1), colW, hOf(1), { size: 8, color: dxPxColor });

      const mgjB = N(tooth.mgj?.b) ?? N(tooth.mgj?.buccal);
      const reMidB = N(tooth.re?.b);
      const mgjCellText = (mgjB != null && reMidB != null) ? String(mgjB) : '–';
      const mgjColor = (mgjB != null && mgjB < 2) ? colorTextRed : colorNavy;
      cellText(doc, mgjCellText, xCell, yOf(2), colW, hOf(2), { size: 8, color: mgjColor });

      tripletText(doc, fdi, 'B', tooth, xCell, yOf(3), colW, hOf(3), 'PD');
      tripletText(doc, fdi, 'B', tooth, xCell, yOf(4), colW, hOf(4), 'RE');

      const moText = tooth.mo?.l ?? '–';
      cellText(doc, moText, xCell, yOf(6), colW, hOf(6), { size: 8 });

      const fText = formatFurcation(tooth.f);
      cellText(doc, fText, xCell, yOf(7), colW, hOf(7), { size: 7 });

      tripletText(doc, fdi, 'L', tooth, xCell, yOf(8), colW, hOf(8), 'PD');
      tripletText(doc, fdi, 'L', tooth, xCell, yOf(9), colW, hOf(9), 'RE');
      cellText(doc, `${fdi}  Li`, xCell, yOf(11), colW, hOf(11), { size: 8 });
    }

    if (exportOptions.visualChart) {
      const arch = isUpper ? 'upper' : 'lower';
      drawToothBlock(doc, { fdi, tooth, x: xCell, y: yOf(5),  w: colW, h: hOf(5),  side: 'B', arch, missing: miss });
      drawToothBlock(doc, { fdi, tooth, x: xCell, y: yOf(10), w: colW, h: hOf(10), side: 'L', arch, missing: miss });
    }
  }

  if (exportOptions.visualChart) {
    drawSmoothCurveSegments(doc, mgjSegments,              colorMGJ, 0.6);
    drawSmoothCurveSegments(doc, gingivalBuccalSegments,   colorPD,  0.5);
    drawSmoothCurveSegments(doc, gingivalLingualSegments,  colorPD,  0.5);
  }

  if (exportOptions.dataTables) {
    doc.setDrawColor(200); doc.setLineWidth(0.2);
    doc.line(labelX, startY, labelX, startY + totalH);
    doc.line(labelX + labelW, startY, labelX + labelW, startY + totalH);
    for (let c = 0; c <= cols; c++) {
      const x = startX + c * colW; doc.line(x, startY, x, startY + totalH);
    }
    let yLine = startY;
    for (let r = 0; r <= 12; r++) {
      doc.line(labelX, yLine, startX + gridW, yLine);
      if (r < 12) yLine += rowHArr[r];
    }
    const yTopBound = yOf(0), yBottomBound = yOf(11) + hOf(11);
    doc.setDrawColor(...colorPD); doc.setLineWidth(0.5);
    for (let c = 0; c < cols; c++) {
      const fdi = columnFDI[c];
      if (missingSet.has(fdi)) {
        const xMid = startX + c * colW + colW / 2;
        doc.line(xMid, yTopBound, xMid, yBottomBound);
      }
    }
  }
}

// --- Main Export Function ---
export default async function generatePerioPDF(
  patientInfo,
  chartData,
  missingTeeth = [],
  bopCount = 0,
  exportOptions = {}
) {
  const jsPDFCtor = await ensureJsPDF();
  const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const map = normalizeMap(chartData);
  const missingSet = new Set((missingTeeth || []).map(String));

  // Preload header logo from /public
  const headerLogo = await loadPublicImage('/header.png');

  // Page 1: Upper Arch
  await renderPage(doc, {
    isUpper: true, patientInfo, map, missingSet,
    invertRows: false, exportOptions, headerLogo
  });

  // Page 2: Lower Arch
  doc.addPage('a4', 'landscape');
  await renderPage(doc, {
    isUpper: false, patientInfo, map, missingSet,
    invertRows: true, exportOptions, headerLogo
  });

  // Page 3: Summary and Notes (optional)
  if (exportOptions.chartSummary || exportOptions.clinicalNotes) {
    doc.addPage('a4', 'landscape');

    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 15, marginY = 15;
    let currentY = marginY;

    // Logo at top-left on summary page too
    drawHeaderLogo(doc, headerLogo, marginX-5, marginY-5);

    if (exportOptions.chartSummary) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...colorNavy);
      doc.text('Chart Summary', pageW / 2, currentY, { align: 'center' });
      currentY += 5;

      const { bopSites, percent } = computeBopStats(map, missingSet);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...colorNavy);
      doc.text(
        `Total Bleeding on Probing (BOP): ${bopSites} sites (${percent.toFixed(1)}%)`,
        pageW / 2, currentY, { align: 'center' }
      );

      currentY += 6;
      const usedH = drawBopToothGrid(doc, map, missingSet, pageW, currentY);
      currentY += usedH;
    }

    if (exportOptions.clinicalNotes && patientInfo.clinicalNotes) {
      if (exportOptions.chartSummary) currentY += 10;
      drawClinicalNotes(doc, patientInfo.clinicalNotes, currentY, marginX, pageW);
    }
  }

  doc.setProperties({
    title: 'EasyPerio Periodontal Chart',
    subject: 'Periodontal chart export',
    author: 'EasyPerio',
    creator: 'EasyPerio'
  });

  const { fileName = `PerioChart_${patientInfo?.patientHN || patientInfo?.patientName || 'Patient'}.pdf` } = exportOptions || {};
  doc.save(fileName);
  return { doc };
}
