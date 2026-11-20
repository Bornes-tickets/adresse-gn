/** Icones de position Viago (vue de dessus, pointant vers le HAUT puis tournees par la carte).
 * Affichage uniquement : une icone ne prouve ni mouvement ni precision GPS. */
export type ViagoMarkerKind = "car" | "motorcycle" | "foot";

const ACCENT = "#ff9f1a";   // orange : se distingue du bleu de la route
const NAVY = "#14263d";
const DARK = "#1b2733";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function withShadow(ctx: CanvasRenderingContext2D, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = "rgba(8, 24, 48, 0.40)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 3;
  draw();
  ctx.restore();
}

function drawCar(ctx: CanvasRenderingContext2D): void {
  withShadow(ctx, () => {
    roundRect(ctx, 37, 8, 54, 112, 22);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  });
  roundRect(ctx, 37, 8, 54, 112, 22);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  // pare-brise, toit, lunette arriere
  ctx.fillStyle = "#17314f";
  ctx.beginPath(); ctx.moveTo(46, 40); ctx.lineTo(82, 40); ctx.lineTo(78, 57); ctx.lineTo(50, 57); ctx.closePath(); ctx.fill();
  roundRect(ctx, 46, 57, 36, 26, 5); ctx.fillStyle = "#ffc766"; ctx.fill();
  ctx.fillStyle = "#223f66";
  ctx.beginPath(); ctx.moveTo(50, 83); ctx.lineTo(78, 83); ctx.lineTo(81, 96); ctx.lineTo(47, 96); ctx.closePath(); ctx.fill();
  // phares et feux
  ctx.fillStyle = "#ffe27a";
  ctx.beginPath(); ctx.arc(49, 19, 4.5, 0, Math.PI * 2); ctx.arc(79, 19, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff5a4d";
  ctx.beginPath(); ctx.arc(49, 109, 4, 0, Math.PI * 2); ctx.arc(79, 109, 4, 0, Math.PI * 2); ctx.fill();
}

function drawMotorcycle(ctx: CanvasRenderingContext2D): void {
  // roues
  withShadow(ctx, () => {
    roundRect(ctx, 58, 6, 12, 38, 6); ctx.fillStyle = DARK; ctx.fill();
    roundRect(ctx, 56, 84, 16, 40, 8); ctx.fillStyle = DARK; ctx.fill();
  });
  // corps
  withShadow(ctx, () => {
    ctx.beginPath(); ctx.ellipse(64, 64, 17, 30, 0, 0, Math.PI * 2); ctx.fillStyle = ACCENT; ctx.fill();
  });
  ctx.lineWidth = 4.5; ctx.strokeStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(64, 64, 17, 30, 0, 0, Math.PI * 2); ctx.stroke();
  // guidon (liseré blanc puis noir)
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(46, 44); ctx.lineTo(82, 44); ctx.stroke();
  ctx.strokeStyle = DARK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(46, 44); ctx.lineTo(82, 44); ctx.stroke();
  // casque du pilote
  ctx.beginPath(); ctx.arc(64, 66, 12, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = NAVY; ctx.stroke();
}

function drawFoot(ctx: CanvasRenderingContext2D): void {
  withShadow(ctx, () => {
    ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  });
  ctx.lineWidth = 6; ctx.strokeStyle = ACCENT;
  ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
  // personne vue de dessus : tete + epaules
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.ellipse(64, 82, 27, 15, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(64, 50, 13, 0, Math.PI * 2); ctx.fill();
}

export function renderMarkerIcon(kind: ViagoMarkerKind): ImageData | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (kind === "car") drawCar(ctx);
  else if (kind === "motorcycle") drawMotorcycle(ctx);
  else drawFoot(ctx);
  return ctx.getImageData(0, 0, 128, 128);
}

/** Pour les tests visuels uniquement. */
export function drawMarkerOnCanvas(ctx: CanvasRenderingContext2D, kind: ViagoMarkerKind): void {
  if (kind === "car") drawCar(ctx); else if (kind === "motorcycle") drawMotorcycle(ctx); else drawFoot(ctx);
}

/** Chevron blanc oriente vers la DROITE (+x) : MapLibre l'aligne avec le sens du trace (symbol-placement: line). */
export function renderRouteChevron(): ImageData | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(22, 14);
  ctx.lineTo(44, 32);
  ctx.lineTo(22, 50);
  ctx.stroke();
  return ctx.getImageData(0, 0, 64, 64);
}

/** Epingle de destination (pointe en BAS : a utiliser avec icon-anchor "bottom"). */
export function renderEndPin(): ImageData | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(64, 152);
    ctx.lineTo(32.9, 87.1);
    ctx.arc(64, 56, 44, 0.75 * Math.PI, 0.25 * Math.PI, false);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = "rgba(8, 24, 48, 0.40)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  path();
  ctx.fillStyle = "#e5392e";
  ctx.fill();
  ctx.restore();
  path();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 56, 17, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return ctx.getImageData(0, 0, 128, 160);
}
