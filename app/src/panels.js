// Panel layouts for Vice Cover Studio.
//
// Every layout is a set of panels whose corners are given in normalised cover
// coordinates (0..1 on both axes), so the same layout renders at any export
// size. A panel is a polygon: four points for the rectangular layouts, and
// slanted quads for the diagonal one. The renderer clips each photo to its
// panel's polygon and strokes the bold white keylines between them — the
// multi-panel poster look this app is built around.

/** A rectangle panel from its normalised edges. */
function rectPanel(name, left, top, right, bottom) {
  return { name, points: [[left, top], [right, top], [right, bottom], [left, bottom]] };
}

/** A free polygon panel from normalised [x, y] corners, clockwise. */
function polyPanel(name, points) {
  return { name, points };
}

export const LAYOUTS = {
  poster: {
    label: 'Poster',
    panels: [
      rectPanel('Wide top', 0, 0, 1, 0.52),
      rectPanel('Bottom left', 0, 0.52, 1 / 3, 1),
      rectPanel('Bottom middle', 1 / 3, 0.52, 2 / 3, 1),
      rectPanel('Bottom right', 2 / 3, 0.52, 1, 1),
    ],
  },
  grid: {
    label: 'Grid',
    panels: [
      rectPanel('Top left', 0, 0, 0.5, 0.36),
      rectPanel('Top right', 0.5, 0, 1, 0.36),
      rectPanel('Middle left', 0, 0.36, 0.5, 0.68),
      rectPanel('Middle right', 0.5, 0.36, 1, 0.68),
      rectPanel('Wide bottom', 0, 0.68, 1, 1),
    ],
  },
  diagonal: {
    label: 'Diagonal',
    panels: [
      polyPanel('Left slice', [[0, 0], [0.4, 0], [0.22, 1], [0, 1]]),
      polyPanel('Middle slice', [[0.4, 0], [0.78, 0], [0.6, 1], [0.22, 1]]),
      polyPanel('Right slice', [[0.78, 0], [1, 0], [1, 1], [0.6, 1]]),
    ],
  },
  hero: {
    label: 'Hero',
    panels: [
      rectPanel('Hero', 0, 0, 0.66, 1),
      rectPanel('Side top', 0.66, 0, 1, 0.5),
      rectPanel('Side bottom', 0.66, 0.5, 1, 1),
    ],
  },
};

/** The layout object for an id, falling back to the poster layout. */
export function layoutById(id) {
  return LAYOUTS[id] ?? LAYOUTS.poster;
}

/** The axis-aligned bounding box of a panel, in normalised coordinates. */
export function panelBounds(panel) {
  const xs = panel.points.map((p) => p[0]);
  const ys = panel.points.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** True when the normalised point (x, y) falls inside the panel's polygon. */
export function pointInPanel(panel, x, y) {
  let inside = false;
  const pts = panel.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Index of the panel under a normalised point, or -1 when it hits a keyline gap. */
export function panelIndexAt(layout, x, y) {
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    if (pointInPanel(layout.panels[i], x, y)) return i;
  }
  return -1;
}
