window.WW = window.WW || {};
WW.C = { navy:'#0d2a5c', navy2:'#16407f', sea:'#2a6fb5', mist:'#eaf2fb', orange:'#f26b1d', white:'#ffffff' };
WW.FONT = '"Avenir Next", "Helvetica Neue", Arial, sans-serif';
WW.load = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(src); i.src = src; });
WW.trim = (img) => { // crop transparent/white borders
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let t = c.height, b = 0, l = c.width, r = 0;
  for (let y = 0; y < c.height; y += 2) for (let xx = 0; xx < c.width; xx += 2) {
    const k = (y * c.width + xx) * 4; const a = d[k+3], w = d[k] > 244 && d[k+1] > 244 && d[k+2] > 244;
    if (a > 20 && !w) { if (y < t) t = y; if (y > b) b = y; if (xx < l) l = xx; if (xx > r) r = xx; } }
  if (r <= l) return c; const o = document.createElement('canvas'); o.width = r - l + 1; o.height = b - t + 1;
  o.getContext('2d').drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height); return o; };
WW.rr = (x, X, Y, W, H, R) => { x.beginPath(); x.moveTo(X+R, Y); x.arcTo(X+W, Y, X+W, Y+H, R); x.arcTo(X+W, Y+H, X, Y+H, R); x.arcTo(X, Y+H, X, Y, R); x.arcTo(X, Y, X+W, Y, R); x.closePath(); };
WW.wrap = (x, text, maxW) => { const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines; };
WW.init = async () => { WW.logo = WW.trim(await WW.load('https://cdn.shopify.com/s/files/1/1035/9495/0996/files/8ab183bf-319f-4e98-9b12-df45ce6862b2.png?v=1780527341')); return [WW.logo.width, WW.logo.height]; };
// Variant van render_final.js: zelfde opmaak, maar 3 producten in de witte kaart (post 2 okt)
WW.renderMulti = async (p) => {
  const C = WW.C, F = WW.FONT, W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = C.mist; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, C.navy); g.addColorStop(1, C.navy2);
  x.fillStyle = g; x.fillRect(0, 0, W, 700);
  x.fillStyle = C.mist; x.beginPath(); x.moveTo(0, 700);
  for (let i = 0; i <= W; i += 10) x.lineTo(i, 660 + Math.sin(i / 120) * 14); x.lineTo(W, 700); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 3;
  for (let k = 0; k < 6; k++) { x.beginPath(); for (let i = 0; i <= W; i += 8) { const y = 520 + k * 26 + Math.sin(i / (90 + k * 12) + k) * 9; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); }
  x.font = `700 26px ${F}`; const chip = p.chip.toUpperCase(); x.letterSpacing = '3px';
  const cw = x.measureText(chip).width + 44; x.fillStyle = C.orange; WW.rr(x, 72, 76, cw, 52, 26); x.fill();
  x.fillStyle = C.white; x.textBaseline = 'middle'; x.fillText(chip, 94, 103); x.letterSpacing = '0px';
  let fs = 80, lines; do { x.font = `800 ${fs}px ${F}`; lines = WW.wrap(x, p.head, 936); fs -= 4; } while (lines.length > 3 && fs > 54);
  fs += 4; x.fillStyle = C.white; x.textBaseline = 'alphabetic';
  lines.forEach((l, i) => x.fillText(l, 72, 175 + fs * 0.9 + i * fs * 1.08));
  const cy = 470, ch = 690; x.save(); x.shadowColor = 'rgba(13,42,92,0.22)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.fillStyle = C.white; WW.rr(x, 72, cy, 936, ch, 36); x.fill(); x.restore();
  const colW = 936 / 3;
  for (let i = 0; i < p.items.length; i++) {
    const it = p.items[i], cx = 72 + i * colW, mid = cx + colW / 2;
    if (i) { x.strokeStyle = '#e3ebf4'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy + 50); x.lineTo(cx, cy + ch - 50); x.stroke(); }
    // merk
    x.font = `800 22px ${F}`; x.letterSpacing = '2px'; x.fillStyle = C.sea; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(it.brand.toUpperCase(), mid, cy + 52); x.letterSpacing = '0px';
    // foto
    const im = WW.trim(await WW.load(it.img)); const bw = colW - 56, bh = 330, s = Math.min(bw / im.width, bh / im.height);
    const iw = im.width * s, ih = im.height * s; x.drawImage(im, mid - iw / 2, cy + 82 + (bh - ih) / 2, iw, ih);
    // naam
    x.fillStyle = C.navy; x.font = `600 27px ${F}`; const nl = WW.wrap(x, it.name, colW - 44).slice(0, 3);
    nl.forEach((l, k) => x.fillText(l, mid, cy + 450 + k * 34));
    // prijs
    x.font = `700 32px ${F}`; const pw = x.measureText(it.price).width + 48;
    x.fillStyle = C.navy; WW.rr(x, mid - pw / 2, cy + 572, pw, 68, 34); x.fill();
    x.fillStyle = C.white; x.fillText(it.price, mid, cy + 607);
    x.textAlign = 'left';
  }
  x.textBaseline = 'alphabetic';
  x.fillStyle = C.white; x.fillRect(0, 1190, W, 160); const logo = WW.logo; const lw = 440, lh = logo.height * lw / logo.width; x.drawImage(logo, 60, 1270 - lh / 2, lw, lh);
  x.textAlign = 'right'; x.fillStyle = C.navy; x.font = `700 30px ${F}`; x.fillText('wetterwinkel.nl', 1008, 1250);
  x.font = `500 26px ${F}`; x.fillStyle = C.sea; x.fillText('Advies? Bel 0513-241911', 1008, 1292); x.textAlign = 'left';
  return cv; };

WW.POST17 = { id: 17, chip: "Winterklaar · tank & romp", head: "Tank vers, romp in de was. Klaar voor de winter.",
  items: [
    { brand: "Bardahl", name: "Fuel stabilizer 250 ml", price: "€ 24,45", img: "https://cdn.shopify.com/s/files/1/1035/9495/0996/files/185100335_33535.jpg?v=1790838525" },
    { brand: "Sjippie", name: "Shampoo concentraat 1 L", price: "€ 14,40", img: "https://cdn.shopify.com/s/files/1/1035/9495/0996/files/SJ3038_26545.jpg?v=1790876662" },
    { brand: "Sjippie", name: "Bootwax 1 L", price: "€ 21,55", img: "https://cdn.shopify.com/s/files/1/1035/9495/0996/files/SJ3010_26522.jpg?v=1790876535" }
  ] };
