// Vice Cover Studio's editor: wires the sidebar controls, the photo tray and
// the canvas gestures to the cover renderer, and exports the finished PNG.
//
// The canvas is the live preview, held at the exact export size, so what the
// user frames is byte-for-byte what the Export button downloads. Photos are
// read from the user's own machine and never leave it.
import { layoutById, panelIndexAt } from './panels.js';
import { renderCover } from './render.js';

const SAMPLE_PHOTOS = [
  { src: 'samples/skyline.jpg', name: 'Sunset Skyline' },
  { src: 'samples/boulevard.jpg', name: 'The Boulevard' },
  { src: 'samples/pier.jpg', name: 'The Pier' },
  { src: 'samples/palms.jpg', name: 'Beach Palms' },
  { src: 'samples/neonstreet.jpg', name: 'Neon Street' },
];

const canvas = document.getElementById('cover');
const tray = document.getElementById('tray');
const status = document.getElementById('status');
const zoomRange = document.getElementById('zoomRange');

const photos = []; // every loaded photo, samples first, as drawable images
const state = {
  layout: 'poster',
  grade: 'sunset',
  size: { w: 1080, h: 1080 },
  caption: 'VICE CITY DREAMS',
  subtitle: 'EST. 2026 · LEON COUNTY',
  captionColor: '#ffffff',
  captionSize: 1,
  captionPos: 'bottom',
  spread: false,
  spreadPhoto: 0,
  spreadZoom: 1,
  spreadPanX: 0,
  spreadPanY: 0,
  slots: [],
};
let selectedPanel = 0;

/** A blank placement for one panel: no photo, unzoomed, centred. */
function emptySlot() {
  return { photo: -1, zoom: 1, panX: 0, panY: 0 };
}

/** Keeps the slots array matched to the current layout's panel count. */
function syncSlots() {
  const count = layoutById(state.layout).panels.length;
  while (state.slots.length < count) state.slots.push(emptySlot());
  state.slots.length = count;
  if (selectedPanel >= count) selectedPanel = 0;
}

/** The placement the pointer and zoom controls edit: a slot, or the spread. */
function activePlacement() {
  if (state.spread) {
    return {
      get zoom() { return state.spreadZoom; },
      set zoom(v) { state.spreadZoom = v; },
      get panX() { return state.spreadPanX; },
      set panX(v) { state.spreadPanX = v; },
      get panY() { return state.spreadPanY; },
      set panY(v) { state.spreadPanY = v; },
    };
  }
  return state.slots[selectedPanel];
}

/** Repaints the preview canvas at the current export size. */
function redraw() {
  const { w, h } = state.size;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.setProperty('--ar', String(w / h));
  renderCover(canvas.getContext('2d'), state, photos, w, h, selectedPanel);
  zoomRange.value = String(activePlacement().zoom);
  markTraySelection();
}

/** Loads an image from a URL or object URL, resolving once it can be drawn. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Rebuilds the photo tray: one thumbnail button per loaded photo. */
function buildTray() {
  tray.replaceChildren();
  photos.forEach((img, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = img.dataset.name ?? `Photo ${i + 1}`;
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = button.title;
    button.append(thumb);
    button.addEventListener('click', () => placePhoto(i));
    tray.append(button);
  });
  markTraySelection();
}

/** Outlines the tray photo that currently fills the selected panel. */
function markTraySelection() {
  const current = state.spread ? state.spreadPhoto : state.slots[selectedPanel]?.photo;
  [...tray.children].forEach((button, i) => button.classList.toggle('placed', i === current));
}

/** Puts tray photo `index` into the selected panel (or makes it the spread). */
function placePhoto(index) {
  if (state.spread) {
    state.spreadPhoto = index;
  } else {
    state.slots[selectedPanel].photo = index;
  }
  status.textContent = '';
  redraw();
}

/** Adds user-picked files to the tray and fills empty panels with them. */
async function addPhotoFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  for (const file of images) {
    const img = await loadImage(URL.createObjectURL(file));
    img.dataset.name = file.name;
    photos.push(img);
    const slot = state.slots.find((s) => s.photo === -1);
    if (slot) slot.photo = photos.length - 1;
  }
  if (images.length) status.textContent = `${images.length} photo${images.length > 1 ? 's' : ''} added — click a panel, then a photo, to arrange them.`;
  buildTray();
  redraw();
}

/** Marks one button of a segmented control as the chosen one. */
function chooseSegment(container, button) {
  [...container.children].forEach((b) => b.classList.toggle('on', b === button));
}

function wireSegment(id, attr, apply) {
  const seg = document.getElementById(id);
  seg.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    chooseSegment(seg, button);
    apply(button.dataset[attr]);
    redraw();
  });
}

wireSegment('layoutSeg', 'layout', (id) => { state.layout = id; syncSlots(); });
wireSegment('gradeSeg', 'grade', (id) => { state.grade = id; });
wireSegment('posSeg', 'pos', (pos) => { state.captionPos = pos; });
wireSegment('sizeSeg', 'size', (value) => {
  const [w, h] = value.split('x').map(Number);
  state.size = { w, h };
});

document.getElementById('swatches').addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  chooseSegment(e.currentTarget, button);
  state.captionColor = button.dataset.color;
  redraw();
});
document.getElementById('captionInput').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
document.getElementById('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('captionSize').addEventListener('input', (e) => { state.captionSize = Number(e.target.value); redraw(); });
document.getElementById('spreadToggle').addEventListener('change', (e) => {
  state.spread = e.target.checked;
  if (state.spread && state.slots[selectedPanel]?.photo >= 0) state.spreadPhoto = state.slots[selectedPanel].photo;
  redraw();
});
zoomRange.addEventListener('input', () => { activePlacement().zoom = Number(zoomRange.value); redraw(); });

const fileInput = document.getElementById('fileInput');
document.getElementById('addPhotos').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { addPhotoFiles(fileInput.files); fileInput.value = ''; });
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  if (e.dataTransfer?.files?.length) addPhotoFiles(e.dataTransfer.files);
});

// Canvas gestures: click selects a panel; dragging pans its photo; the wheel zooms it.
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  const hit = panelIndexAt(layoutById(state.layout), nx, ny);
  if (hit >= 0) selectedPanel = hit;
  const place = activePlacement();
  drag = { x: e.clientX, y: e.clientY, panX: place.panX, panY: place.panY, rect };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const place = activePlacement();
  place.panX = Math.max(-1, Math.min(1, drag.panX + ((e.clientX - drag.x) / drag.rect.width) * 2.4));
  place.panY = Math.max(-1, Math.min(1, drag.panY + ((e.clientY - drag.y) / drag.rect.height) * 2.4));
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const place = activePlacement();
  place.zoom = Math.max(1, Math.min(4, place.zoom * (e.deltaY < 0 ? 1.09 : 0.92)));
  redraw();
}, { passive: false });

document.getElementById('exportBtn').addEventListener('click', () => {
  const { w, h } = state.size;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), state, photos, w, h, -1);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-cover-${w}x${h}.png`;
  }, 'image/png');
});

/** Renders the current cover offscreen at any size and returns it as a data URL. */
function renderExportDataURL(w, h, type = 'image/png', quality) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), state, photos, w, h, -1);
  return off.toDataURL(type, quality);
}

// Startup: load the bundled samples, seat them in the poster layout, paint.
const ready = (async () => {
  for (const sample of SAMPLE_PHOTOS) {
    const img = await loadImage(sample.src);
    img.dataset.name = sample.name;
    photos.push(img);
  }
  syncSlots();
  const opening = [0, 2, 3, 4, 1]; // skyline wide on top; pier, palms, neon below
  state.slots.forEach((slot, i) => { slot.photo = opening[i % opening.length]; });
  buildTray();
  redraw();
  if (document.fonts?.load) {
    await document.fonts.load('100px Anton');
    redraw();
  }
})();

// A small handle for screenshot tooling and curious users alike.
window.ViceCoverStudio = {
  state,
  photos,
  ready,
  redraw,
  renderExportDataURL,
  setLayout(id) { state.layout = id; syncSlots(); redraw(); },
  setGrade(id) { state.grade = id; redraw(); },
  setSize(w, h) { state.size = { w, h }; redraw(); },
  setCaption(main, sub) { state.caption = main; if (sub !== undefined) state.subtitle = sub; redraw(); },
  setCaptionStyle({ color, size, pos } = {}) {
    if (color) state.captionColor = color;
    if (size) state.captionSize = size;
    if (pos) state.captionPos = pos;
    redraw();
  },
  selectPanel(i) { selectedPanel = i; redraw(); },
  assignPhoto(photoIndex, panelIndex) {
    selectedPanel = panelIndex;
    placePhoto(photoIndex);
  },
  setSpread(on, photoIndex) {
    state.spread = on;
    if (photoIndex !== undefined) state.spreadPhoto = photoIndex;
    redraw();
  },
  setPlacement(panelIndex, values) {
    Object.assign(state.slots[panelIndex], values);
    redraw();
  },
};
