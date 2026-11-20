// The cover renderer: paints a whole cover onto any 2D context at any size.
//
// A render walks the layout's panels, clips each photo into its panel, lays the
// chosen colour grade over it, then strokes the white keylines that separate
// the panels and frames the sheet. The caption goes on last, in Anton with a
// heavy outline and drop shadow. The editor calls this for the live preview
// (with the selected panel highlighted) and again, on an offscreen canvas at
// full export size, for the PNG a user downloads.
import { layoutById, panelBounds } from './panels.js';

export const GRADES = {
  sunset: { label: 'Sunset', filter: 'saturate(1.4) contrast(1.07) brightness(1.04)' },
  neon: { label: 'Neon', filter: 'saturate(1.55) contrast(1.18) brightness(1.03)' },
  noir: { label: 'Noir', filter: 'grayscale(1) contrast(1.28) brightness(1.04)' },
  clean: { label: 'Clean', filter: 'none' },
};

const KEYLINE = 0.0075; // keyline width as a fraction of the cover's short side

/** Traces a panel's polygon as a path on ctx, in pixel coordinates. */
function tracePanelPath(ctx, panel, w, h) {
  ctx.beginPath();
  panel.points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * w, y * h);
    else ctx.lineTo(x * w, y * h);
  });
  ctx.closePath();
}

/** The cover-fit placement of a photo inside a box: size plus top-left corner. */
function coverPlacement(photo, boxW, boxH, zoom, panX, panY) {
  const scale = Math.max(boxW / photo.naturalWidth, boxH / photo.naturalHeight) * zoom;
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  return {
    dw,
    dh,
    dx: (boxW - dw) / 2 + panX * Math.max(0, (dw - boxW) / 2),
    dy: (boxH - dh) / 2 + panY * Math.max(0, (dh - boxH) / 2),
  };
}

/** Placeholder art for a panel with no photo yet: dusk gradient and a photo glyph. */
function drawEmptyPanel(ctx, bounds, w, h) {
  const g = ctx.createLinearGradient(0, bounds.top * h, 0, (bounds.top + bounds.height) * h);
  g.addColorStop(0, '#3a2154');
  g.addColorStop(1, '#1c1030');
  ctx.fillStyle = g;
  ctx.fillRect(bounds.left * w, bounds.top * h, bounds.width * w, bounds.height * h);
  const cx = (bounds.left + bounds.width / 2) * w;
  const cy = (bounds.top + bounds.height / 2) * h;
  const s = Math.min(bounds.width * w, bounds.height * h) * 0.16;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = Math.max(2, s * 0.14);
  ctx.beginPath(); // sun
  ctx.arc(cx - s * 0.55, cy - s * 0.35, s * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); // mountains
  ctx.moveTo(cx - s * 1.15, cy + s * 0.75);
  ctx.lineTo(cx - s * 0.35, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.15, cy + s * 0.4);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.3);
  ctx.lineTo(cx + s * 1.15, cy + s * 0.75);
  ctx.stroke();
}

/** The colour grade's painted overlay for one panel, drawn clipped to the panel. */
function paintGradeOverlay(ctx, grade, bounds, w, h) {
  const x = bounds.left * w;
  const y = bounds.top * h;
  const bw = bounds.width * w;
  const bh = bounds.height * h;
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(0, y, 0, y + bh);
    g.addColorStop(0, 'rgba(255, 110, 64, 0.12)');
    g.addColorStop(0.55, 'rgba(255, 64, 120, 0.05)');
    g.addColorStop(1, 'rgba(255, 45, 120, 0.36)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, bw, bh);
  } else if (grade === 'neon') {
    const cyan = ctx.createLinearGradient(x, y, x + bw, y + bh);
    cyan.addColorStop(0, 'rgba(25, 227, 255, 0.26)');
    cyan.addColorStop(0.5, 'rgba(25, 227, 255, 0)');
    cyan.addColorStop(1, 'rgba(255, 45, 149, 0.30)');
    ctx.fillStyle = cyan;
    ctx.fillRect(x, y, bw, bh);
  } else if (grade === 'noir') {
    const v = ctx.createRadialGradient(x + bw / 2, y + bh / 2, Math.min(bw, bh) * 0.35, x + bw / 2, y + bh / 2, Math.max(bw, bh) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = v;
    ctx.fillRect(x, y, bw, bh);
  }
}

/** Draws one panel: its photo (or the spread photo, or a placeholder) plus its grade. */
function drawPanel(ctx, state, photos, panel, slot, w, h) {
  const bounds = panelBounds(panel);
  ctx.save();
  tracePanelPath(ctx, panel, w, h);
  ctx.clip();
  const spreadPhoto = state.spread ? photos[state.spreadPhoto] : null;
  if (spreadPhoto) {
    // Spread: the photo covers the whole sheet and each panel shows the slice
    // of it that lies beneath the panel — one picture flowing across the cuts.
    const place = coverPlacement(spreadPhoto, w, h, state.spreadZoom, state.spreadPanX, state.spreadPanY);
    ctx.filter = GRADES[state.grade].filter;
    ctx.drawImage(spreadPhoto, place.dx, place.dy, place.dw, place.dh);
    ctx.filter = 'none';
  } else if (slot && photos[slot.photo]) {
    const photo = photos[slot.photo];
    const place = coverPlacement(photo, bounds.width * w, bounds.height * h, slot.zoom, slot.panX, slot.panY);
    ctx.filter = GRADES[state.grade].filter;
    ctx.drawImage(photo, bounds.left * w + place.dx, bounds.top * h + place.dy, place.dw, place.dh);
    ctx.filter = 'none';
  } else {
    drawEmptyPanel(ctx, bounds, w, h);
  }
  paintGradeOverlay(ctx, state.grade, bounds, w, h);
  ctx.restore();
}

/** Fits a caption size so the line fits the cover width, honouring the size slider. */
function fitFontSize(ctx, text, baseSize, maxWidth) {
  let size = baseSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size *= 0.94;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/** One lettered line: filled in the caption colour, outlined dark, drop-shadowed. */
function drawCaptionLine(ctx, text, cx, baseline, size, color, letterSpacing) {
  ctx.font = `${size}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${letterSpacing}px`; } catch { /* older engines: no tracking */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(8, 2, 14, 0.55)';
  ctx.shadowBlur = size * 0.14;
  ctx.shadowOffsetY = size * 0.05;
  ctx.strokeStyle = '#150818';
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, cx, baseline);
  ctx.fillStyle = color;
  ctx.fillText(text, cx, baseline);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

/** The caption block: a soft scrim, the subtitle over the main line (or under it at the top). */
function drawCaption(ctx, state, w, h) {
  const main = state.caption.trim().toUpperCase();
  const sub = state.subtitle.trim().toUpperCase();
  if (!main && !sub) return;
  const atBottom = state.captionPos !== 'top';
  const scrimH = h * 0.34;
  const scrim = atBottom
    ? ctx.createLinearGradient(0, h - scrimH, 0, h)
    : ctx.createLinearGradient(0, 0, 0, scrimH);
  scrim.addColorStop(0, 'rgba(10, 3, 18, 0)');
  scrim.addColorStop(1, 'rgba(10, 3, 18, 0.52)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, atBottom ? h - scrimH : 0, w, scrimH);

  const mainSize = fitFontSize(ctx, main || sub, h * 0.105 * state.captionSize, w * 0.92);
  const subSize = mainSize * 0.34;
  const gap = mainSize * 0.28;
  if (atBottom) {
    const mainBase = h * 0.955;
    if (main) drawCaptionLine(ctx, main, w / 2, mainBase, mainSize, state.captionColor, 0);
    if (sub) drawCaptionLine(ctx, sub, w / 2, mainBase - mainSize - gap * 0.4, subSize, state.captionColor, subSize * 0.22);
  } else {
    const mainBase = h * 0.045 + mainSize;
    if (main) drawCaptionLine(ctx, main, w / 2, mainBase, mainSize, state.captionColor, 0);
    if (sub) drawCaptionLine(ctx, sub, w / 2, mainBase + subSize + gap, subSize, state.captionColor, subSize * 0.22);
  }
}

/**
 * Renders the full cover described by `state` onto ctx at w x h.
 * `photos` is the tray's image list; state.slots[i] says which photo fills
 * panel i and how it is zoomed and panned. When `highlight` is a panel index
 * (the editor's live preview), that panel gets a neon outline; exports pass -1.
 */
export function renderCover(ctx, state, photos, w, h, highlight = -1) {
  const layout = layoutById(state.layout);
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => drawPanel(ctx, state, photos, panel, state.slots[i], w, h));

  // Keylines between the panels and around the sheet.
  const lw = Math.max(3, KEYLINE * Math.min(w, h));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  layout.panels.forEach((panel) => {
    tracePanelPath(ctx, panel, w, h);
    ctx.stroke();
  });
  ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw);

  if (highlight >= 0 && layout.panels[highlight]) {
    ctx.save();
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = lw * 0.9;
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = lw * 2.2;
    tracePanelPath(ctx, layout.panels[highlight], w, h);
    ctx.stroke();
    ctx.restore();
  }

  drawCaption(ctx, state, w, h);
}
