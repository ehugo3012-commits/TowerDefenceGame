/* Neon Cortex — canvas renderer: circuit board, ICE towers, malware, effects and the menu backdrop. */
(function (NC) {
  'use strict';

  const T = NC.TILE, COLS = NC.COLS, ROWS = NC.ROWS;
  const TAU = Math.PI * 2;
  const rgba = NC.rgba;
  const MONO = '"Share Tech Mono", ui-monospace, monospace';
  const DISPLAY = 'Orbitron, "Share Tech Mono", sans-serif';

  // ------------------------------------------------------------ primitives
  const glowCache = {};
  function glowSprite(color) {
    let c = glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, rgba(color, 0.9));
    grd.addColorStop(0.25, rgba(color, 0.35));
    grd.addColorStop(0.6, rgba(color, 0.08));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  }

  function glow(ctx, x, y, r, color, alpha) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  function polyPath(ctx, n, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i * TAU / n;
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function chamferPath(ctx, x, y, w, h, c) {
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function levelPips(ctx, level, col, y) {
    if (level >= 4) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, y - 2.5); ctx.lineTo(3, y); ctx.lineTo(0, y + 2.5); ctx.lineTo(-3, y);
      ctx.closePath(); ctx.fill();
      return;
    }
    for (let i = 0; i < level; i++) {
      ctx.fillStyle = col;
      ctx.fillRect(-7 + i * 5.5, y - 1, 3.5, 2.2);
    }
  }

  // ------------------------------------------------------------ towers
  NC.drawTowerShape = function (ctx, t, time) {
    const def = NC.TOWERS[t.type];
    const col = t.sub ? def.subs[t.sub].color : def.color;
    const dark = '#081221';
    const recoil = -(t.recoil || 0) * 2.5;
    ctx.lineJoin = 'round';

    if (t.type === 'pulse') {
      chamferPath(ctx, -15, -15, 30, 30, 6);
      ctx.fillStyle = dark; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.3); ctx.lineWidth = 1;
      circle(ctx, 0, 0, 10.5); ctx.stroke();
      ctx.fillStyle = rgba(col, 0.55);
      ctx.fillRect(-1, -17, 2, 3); ctx.fillRect(-1, 14, 2, 3); ctx.fillRect(-17, -1, 3, 2); ctx.fillRect(14, -1, 3, 2);
      levelPips(ctx, t.level, col, 11.5);
      ctx.save();
      ctx.rotate(t.angle || 0);
      ctx.fillStyle = col;
      if (t.sub === 'B') {
        for (const a of [-0.34, 0, 0.34]) {
          ctx.save(); ctx.rotate(a);
          ctx.fillRect(3 + recoil, -1.6, 11, 3.2);
          ctx.restore();
        }
      } else {
        ctx.fillRect(3 + recoil, -2.6, 12.5, 5.2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(13 + recoil, -1.2, 2.5, 2.4);
      }
      if (t.sub === 'A') {
        ctx.fillStyle = col;
        const spin = (time || 0) * 7;
        for (let k = 0; k < 8; k++) {
          const a = spin + k * TAU / 8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
          ctx.lineTo(Math.cos(a + 0.25) * 11, Math.sin(a + 0.25) * 11);
          ctx.lineTo(Math.cos(a + 0.45) * 7, Math.sin(a + 0.45) * 7);
          ctx.fill();
        }
      }
      circle(ctx, 0, 0, 6.5);
      ctx.fillStyle = '#0d2236'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      circle(ctx, 0, 0, 2.8);
      ctx.fillStyle = '#e8ffff'; ctx.fill();
      ctx.restore();
    } else if (t.type === 'cryo') {
      polyPath(ctx, 6, 16, Math.PI / 6);
      ctx.fillStyle = dark; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      ctx.rotate((time || 0) * 0.7);
      polyPath(ctx, 6, 10.5, 0);
      ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      if (t.sub === 'A') {
        ctx.strokeStyle = 'rgba(235,250,255,0.7)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 6; k++) {
          const a = k * TAU / 6 + Math.PI / 6;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke();
        }
      }
      const p = 0.85 + 0.15 * Math.sin((time || 0) * 3);
      ctx.beginPath();
      ctx.moveTo(0, -9 * p); ctx.lineTo(5.5 * p, 0); ctx.lineTo(0, 9 * p); ctx.lineTo(-5.5 * p, 0);
      ctx.closePath();
      ctx.fillStyle = rgba(col, 0.9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.8; ctx.stroke();
      if (t.sub === 'B') {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(1, -1); ctx.lineTo(-1, 2); ctx.lineTo(2, 6); ctx.stroke();
      }
      levelPips(ctx, t.level, col, 12.5);
    } else if (t.type === 'rail') {
      ctx.save();
      ctx.rotate(Math.PI / 4);
      chamferPath(ctx, -12, -12, 24, 24, 4);
      ctx.fillStyle = dark; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      levelPips(ctx, t.level, col, 11);
      ctx.save();
      ctx.rotate(t.angle || 0);
      const ch = t.charge == null ? 1 : t.charge;
      const accent = t.sub === 'B' ? '#ff3355' : col;
      ctx.fillStyle = accent;
      ctx.fillRect(-4 + recoil, -5.2, 23, 2.4);
      ctx.fillRect(-4 + recoil, 2.8, 23, 2.4);
      ctx.fillStyle = rgba('#ffffff', 0.25 + ch * 0.75);
      ctx.fillRect(-1 + recoil, -1.2, 19 * ch, 2.4);
      if (t.sub === 'A') {
        ctx.beginPath();
        ctx.moveTo(19 + recoil, -5.5); ctx.lineTo(25 + recoil, 0); ctx.lineTo(19 + recoil, 5.5);
        ctx.closePath();
        ctx.fillStyle = rgba(col, 0.75); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
      } else if (t.sub === 'B') {
        ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(0, -6); ctx.lineTo(-6, -3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(0, 6); ctx.lineTo(-6, 9); ctx.stroke();
      }
      circle(ctx, 0, 0, 6);
      ctx.fillStyle = '#120a22'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      circle(ctx, 0, 0, 2.2 + ch * 1.2);
      ctx.fillStyle = rgba('#ffffff', 0.5 + ch * 0.5); ctx.fill();
      ctx.restore();
    } else if (t.type === 'miner') {
      circle(ctx, 0, 0, 15);
      ctx.fillStyle = dark; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 1.5; ctx.stroke();
      const spin = (time || 0) * 1.2;
      ctx.strokeStyle = rgba(col, 0.6); ctx.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const a = spin + k * TAU / 6;
        ctx.beginPath(); ctx.arc(0, 0, 11.5, a, a + 0.62); ctx.stroke();
      }
      ctx.save();
      ctx.rotate(-spin * 1.4);
      ctx.fillStyle = rgba(col, 0.9);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = dark;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
      levelPips(ctx, t.level, col, 19);
    }
  };

  // ------------------------------------------------------------ malware
  NC.bossColor = function (e) {
    let best = null, bv = 0.12;
    for (const c in e.resist) if (e.resist[c] > bv) { bv = e.resist[c]; best = c; }
    return best ? NC.DAMAGE_CATS[best].color : NC.ENEMIES.boss.color;
  };

  NC.drawEnemyShape = function (ctx, type, r, col, age, e) {
    ctx.lineJoin = 'round';
    if (type === 'virus') {
      ctx.save();
      ctx.rotate(age * 2.2);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const rr = i % 2 ? r * 0.62 : r;
        const a = i * TAU / 16;
        if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(rr, 0);
      }
      ctx.closePath();
      ctx.fillStyle = '#2a0710'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
      circle(ctx, 0, 0, r * 0.34);
      ctx.fillStyle = col; ctx.fill();
    } else if (type === 'worm') {
      ctx.save();
      ctx.rotate(e ? e.angle : 0);
      circle(ctx, 0, 0, r);
      ctx.fillStyle = '#132006'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = '#efffd0';
      ctx.fillRect(r * 0.25, -r * 0.5, 2, 2);
      ctx.fillRect(r * 0.25, r * 0.5 - 2, 2, 2);
      ctx.restore();
    } else if (type === 'trojan') {
      ctx.save();
      ctx.rotate((e ? e.angle : 0) + Math.PI / 6);
      polyPath(ctx, 6, r, 0);
      ctx.fillStyle = '#1f0e03'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.stroke();
      polyPath(ctx, 6, r * 0.6, Math.PI / 6);
      ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1.2; ctx.stroke();
      const plates = e ? Math.ceil(6 * e.armor / Math.max(1, e.baseArmor)) : 6;
      ctx.strokeStyle = '#ffd0a0'; ctx.lineWidth = 2.5;
      for (let k = 0; k < plates; k++) {
        const a = k * TAU / 6 + 0.15;
        ctx.beginPath(); ctx.arc(0, 0, r + 3, a, a + 0.75); ctx.stroke();
      }
      ctx.restore();
      circle(ctx, 0, 0, r * 0.26 * (1 + 0.15 * Math.sin(age * 6)));
      ctx.fillStyle = col; ctx.fill();
    } else if (type === 'ransomware') {
      ctx.save();
      ctx.rotate(Math.PI / 4 + Math.sin(age * 2) * 0.15);
      chamferPath(ctx, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.3);
      ctx.fillStyle = '#25061a'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.26, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(-r * 0.4, -r * 0.12, r * 0.8, r * 0.55);
      ctx.fillStyle = '#25061a';
      ctx.fillRect(-1, r * 0.02, 2, r * 0.22);
    } else if (type === 'boss') {
      const sides = 5 + (Math.floor(age * 0.7) % 4);
      const wob = 1 + 0.05 * Math.sin(age * 5);
      ctx.save();
      ctx.rotate(age * 0.6);
      polyPath(ctx, sides, r * wob, 0);
      ctx.fillStyle = '#1a0010'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.rotate(-age * 1.5);
      polyPath(ctx, sides, r * 0.6, Math.PI / sides);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      for (let k = 0; k < 4; k++) {
        const a = age * 1.8 + k * TAU / 4;
        const sx = Math.cos(a) * r * 1.45, sy = Math.sin(a) * r * 1.45;
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(a);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -2.5); ctx.lineTo(4, 0); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      circle(ctx, 0, 0, r * 0.28 * (1 + 0.2 * Math.sin(age * 8)));
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  };

  // ------------------------------------------------------------ renderer
  const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const CHIP_LABELS = ['QPU-7', 'MEM', 'ICE', '0xFF', 'NEURAL', 'CACHE', 'I/O', 'SYNC', 'Q-BIT', 'ROM'];

  class Renderer {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = COLS * T;
      this.H = ROWS * T;
      this.ps = 1;
      this.scale = 1;
      this.board = null;
      this.game = null;
      this.flowV = -1;
      this.flowDots = [];
    }

    setGame(g) { this.game = g; this.board = null; this.flowV = -1; }

    resize(availW, availH) {
      const s = Math.max(0.2, Math.min(availW / this.W, availH / this.H));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.scale = s;
      this.ps = s * dpr;
      this.c.style.width = Math.floor(this.W * s) + 'px';
      this.c.style.height = Math.floor(this.H * s) + 'px';
      this.c.width = Math.floor(this.W * this.ps);
      this.c.height = Math.floor(this.H * this.ps);
      this.board = null;
    }

    toWorld(clientX, clientY) {
      const r = this.c.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width * this.W / T, y: (clientY - r.top) / r.height * this.H / T };
    }

    // ---------------------------------------------------- static board
    buildBoard() {
      const g = this.game;
      const W = this.W, H = this.H;
      const cv = document.createElement('canvas');
      cv.width = this.c.width; cv.height = this.c.height;
      const b = cv.getContext('2d');
      b.setTransform(this.ps, 0, 0, this.ps, 0, 0);
      const rnd = NC.mulberry32(NC.hashStr(g.lv.id + 'board'));
      const grid = g.grid;
      const isVoid = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && grid[y * COLS + x] === NC.TILE_VOID;

      const grd = b.createRadialGradient(W * 0.5, H * 0.5, 40, W * 0.5, H * 0.5, W * 0.75);
      grd.addColorStop(0, '#0b1528');
      grd.addColorStop(1, '#03050b');
      b.fillStyle = grd;
      b.fillRect(0, 0, W, H);

      b.strokeStyle = 'rgba(70,140,255,0.05)';
      b.lineWidth = 1;
      b.beginPath();
      for (let x = 0; x <= COLS; x++) { b.moveTo(x * T + 0.5, 0); b.lineTo(x * T + 0.5, H); }
      for (let y = 0; y <= ROWS; y++) { b.moveTo(0, y * T + 0.5); b.lineTo(W, y * T + 0.5); }
      b.stroke();
      b.fillStyle = 'rgba(100,170,255,0.14)';
      for (let x = 0; x <= COLS; x++) for (let y = 0; y <= ROWS; y++) b.fillRect(x * T - 1, y * T - 1, 2, 2);

      // decorative copper traces
      b.lineCap = 'round'; b.lineJoin = 'round';
      for (let k = 0; k < 70; k++) {
        let x = Math.floor(rnd() * COLS), y = Math.floor(rnd() * ROWS);
        if (!isVoid(x, y)) continue;
        const pts = [[x, y]];
        let dir = Math.floor(rnd() * 8);
        const len = 2 + Math.floor(rnd() * 7);
        for (let s = 0; s < len; s++) {
          if (rnd() < 0.3) dir = (dir + (rnd() < 0.5 ? 1 : 7)) % 8;
          const nx = x + D8[dir][0], ny = y + D8[dir][1];
          if (!isVoid(nx, ny)) break;
          x = nx; y = ny;
          pts.push([x, y]);
        }
        if (pts.length < 2) continue;
        const col = rnd() < 0.72 ? 'rgba(0,200,255,0.12)' : 'rgba(200,90,255,0.11)';
        b.strokeStyle = col; b.lineWidth = 1.6;
        b.beginPath();
        pts.forEach((p, i) => { if (i) b.lineTo(p[0] * T + T / 2, p[1] * T + T / 2); else b.moveTo(p[0] * T + T / 2, p[1] * T + T / 2); });
        b.stroke();
        for (const p of [pts[0], pts[pts.length - 1]]) {
          b.beginPath(); b.arc(p[0] * T + T / 2, p[1] * T + T / 2, 3, 0, TAU); b.stroke();
        }
      }

      // decorative chips
      const used = new Set();
      for (let k = 0; k < 40; k++) {
        const w = 2 + Math.floor(rnd() * 2), h = 1 + Math.floor(rnd() * 2);
        const x0 = Math.floor(rnd() * (COLS - w)), y0 = Math.floor(rnd() * (ROWS - h));
        let ok = true;
        for (let y = y0; y < y0 + h && ok; y++) for (let x = x0; x < x0 + w; x++) if (!isVoid(x, y) || used.has(y * COLS + x)) { ok = false; break; }
        if (!ok) continue;
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) used.add(y * COLS + x);
        const px = x0 * T + 7, py = y0 * T + 9, pw = w * T - 14, ph = h * T - 18;
        b.fillStyle = 'rgba(10,15,30,0.9)';
        b.fillRect(px, py, pw, ph);
        b.strokeStyle = 'rgba(120,150,255,0.22)';
        b.lineWidth = 1;
        b.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        b.fillStyle = 'rgba(150,170,220,0.22)';
        for (let xx = px + 4; xx < px + pw - 3; xx += 6) { b.fillRect(xx, py - 4, 2, 4); b.fillRect(xx, py + ph, 2, 4); }
        b.fillStyle = 'rgba(140,170,255,0.3)';
        b.font = '8px ' + MONO;
        b.textAlign = 'center'; b.textBaseline = 'middle';
        b.fillText(CHIP_LABELS[Math.floor(rnd() * CHIP_LABELS.length)], px + pw / 2, py + ph / 2);
        if (used.size > 60) break;
      }

      // logic gates (build pads)
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y * COLS + x] !== NC.TILE_GATE) continue;
          const px = x * T + 5, py = y * T + 5, s = T - 10;
          b.fillStyle = 'rgba(18,26,56,0.65)';
          b.fillRect(px, py, s, s);
          b.strokeStyle = 'rgba(130,100,255,0.22)';
          b.lineWidth = 1;
          b.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
          b.strokeStyle = 'rgba(170,130,255,0.55)';
          b.beginPath();
          const c = 5;
          b.moveTo(px, py + c); b.lineTo(px, py); b.lineTo(px + c, py);
          b.moveTo(px + s - c, py); b.lineTo(px + s, py); b.lineTo(px + s, py + c);
          b.moveTo(px + s, py + s - c); b.lineTo(px + s, py + s); b.lineTo(px + s - c, py + s);
          b.moveTo(px + c, py + s); b.lineTo(px, py + s); b.lineTo(px, py + s - c);
          b.stroke();
          b.fillStyle = 'rgba(170,130,255,0.25)';
          b.fillRect(x * T + T / 2 - 1, y * T + T / 2 - 1, 2, 2);
        }
      }

      // data streams
      const segs = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y * COLS + x] !== NC.TILE_PATH) continue;
          const cx = x * T + T / 2, cy = y * T + T / 2;
          segs.push([cx, cy, cx, cy]);
          if (x + 1 < COLS && grid[y * COLS + x + 1] === NC.TILE_PATH) segs.push([cx, cy, cx + T, cy]);
          if (y + 1 < ROWS && grid[(y + 1) * COLS + x] === NC.TILE_PATH) segs.push([cx, cy, cx, cy + T]);
        }
      }
      const pass = (w, style, blur) => {
        b.save();
        b.lineWidth = w; b.strokeStyle = style; b.lineCap = 'round';
        if (blur) { b.shadowBlur = blur * this.ps; b.shadowColor = '#00c8ff'; }
        b.beginPath();
        for (const s of segs) { b.moveTo(s[0], s[1]); b.lineTo(s[2] + 0.01, s[3]); }
        b.stroke();
        b.restore();
      };
      pass(32, 'rgba(0,190,255,0.10)', 24);
      pass(25, 'rgba(0,225,255,0.8)', 10);
      pass(21, '#050c18');
      pass(14, 'rgba(0,160,255,0.05)');
      b.save();
      b.setLineDash([2, 7]);
      pass(1, 'rgba(0,220,255,0.18)');
      b.restore();

      // breach point plates
      for (const sp of g.lv.spawns) {
        const px = sp.x * T, py = sp.y * T;
        b.fillStyle = 'rgba(60,0,15,0.9)';
        b.fillRect(px + 3, py + 3, T - 6, T - 6);
      }
      this.board = cv;
    }

    // ---------------------------------------------------- per-frame passes
    updateFlow() {
      const g = this.game;
      if (this.flowV === g.flowVersion) return;
      this.flowV = g.flowVersion;
      const dots = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (g.grid[i] !== NC.TILE_PATH || i === g.coreIdx) continue;
          let best = null, bd = g.dist[i];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const j = ny * COLS + nx;
            if (g.grid[j] !== NC.TILE_PATH) continue;
            if (g.dist[j] < bd) { bd = g.dist[j]; best = [dx, dy]; }
          }
          if (best) dots.push({ x, y, dx: best[0], dy: best[1], blocked: !!g.towerGrid[i] });
        }
      }
      this.flowDots = dots;
    }

    drawFlow(ctx, t) {
      this.updateFlow();
      ctx.globalCompositeOperation = 'lighter';
      const u = (t * 0.9) % 1;
      for (const d of this.flowDots) {
        for (const off of [0, 0.5]) {
          const v = (u + off) % 1;
          const px = (d.x + 0.5 + d.dx * (v - 0.5)) * T;
          const py = (d.y + 0.5 + d.dy * (v - 0.5)) * T;
          ctx.fillStyle = off ? 'rgba(0,200,255,0.25)' : 'rgba(80,240,255,0.6)';
          ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawSpawns(ctx, t) {
      const g = this.game;
      for (const sp of g.lv.spawns) {
        const cx = (sp.x + 0.5) * T, cy = (sp.y + 0.5) * T;
        glow(ctx, cx, cy, 34, '#ff2a4a', 0.45 + 0.2 * Math.sin(t * 4 + sp.x));
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 1.2);
        ctx.strokeStyle = '#ff2a4a'; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(-15, -9); ctx.lineTo(-15, -15); ctx.lineTo(-9, -15); ctx.stroke();
        }
        ctx.restore();
        const seed = Math.floor(t * 12);
        for (let k = 0; k < 3; k++) {
          const r1 = NC.mulberry32(seed * 7 + k + sp.x * 31)();
          const r2 = NC.mulberry32(seed * 13 + k + sp.y * 17)();
          ctx.fillStyle = k === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,40,80,0.7)';
          ctx.fillRect(cx - 9 + r1 * 14, cy - 9 + r2 * 16, 2 + r2 * 6, 2);
        }
        const label = sp.label;
        ctx.font = 'bold 9px ' + DISPLAY;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width + 10;
        let lx = Math.min(this.W - tw / 2 - 2, Math.max(tw / 2 + 2, cx));
        let ly = sp.y === 0 ? cy + 27 : cy - 27;
        if (sp.x === 0 || sp.x === COLS - 1) { ly = sp.y >= ROWS - 2 ? cy - 27 : cy + 27; }
        ctx.fillStyle = 'rgba(40,0,10,0.85)';
        ctx.fillRect(lx - tw / 2, ly - 7, tw, 14);
        ctx.strokeStyle = 'rgba(255,42,74,0.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(lx - tw / 2 + 0.5, ly - 6.5, tw - 1, 13);
        ctx.fillStyle = '#ff6b81';
        ctx.fillText(label, lx, ly + 0.5);
      }
    }

    drawCore(ctx, t) {
      const g = this.game;
      const c = g.lv.core;
      const cx = (c.x + 0.5) * T, cy = (c.y + 0.5) * T;
      const f = g.coreHp / g.coreMax;
      const col = NC.mixHex('#ff2050', '#00f5ff', Math.max(0, f));
      const beat = 0.5 + 0.5 * Math.sin(t * (f < 0.35 ? 9 : 2.2));
      glow(ctx, cx, cy, 64 + beat * 10, col, 0.45 + g.coreHit * 0.5);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.save();
      ctx.rotate(t * 0.4);
      polyPath(ctx, 6, 25, 0);
      ctx.fillStyle = 'rgba(4,10,20,0.85)'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.rotate(-t * 0.8);
      ctx.setLineDash([5, 4]);
      polyPath(ctx, 6, 18, Math.PI / 6);
      ctx.strokeStyle = rgba(col, 0.65); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.45, col);
      grd.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = grd;
      circle(ctx, 0, 0, 12 + beat * 2); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const a = t * 2.4 + k * TAU / 3;
        ctx.save();
        ctx.rotate(k * Math.PI / 3);
        ctx.strokeStyle = rgba(col, 0.25); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, 31, 11, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        circle(ctx, Math.cos(a) * 31, Math.sin(a) * 11, 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      if (g.coreHit > 0) {
        ctx.strokeStyle = rgba('#ff3860', g.coreHit);
        ctx.lineWidth = 3;
        circle(ctx, cx, cy, 30 + (1 - g.coreHit) * 30); ctx.stroke();
      }
      ctx.font = 'bold 8px ' + DISPLAY;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(col, 0.9);
      const ly = c.y >= ROWS - 2 ? cy - 38 : cy + 38;
      ctx.fillText('CORE KERNEL', cx, ly);
    }

    drawTraps(ctx, t) {
      for (const tr of this.game.traps) {
        const a = 0.14 + 0.1 * Math.sin(tr.t * 3);
        ctx.save();
        ctx.translate(tr.x * T, tr.y * T);
        ctx.rotate(tr.t * 0.5);
        polyPath(ctx, 6, 10, 0);
        ctx.strokeStyle = rgba('#28e0ff', a); ctx.lineWidth = 1.5; ctx.stroke();
        polyPath(ctx, 6, 4, Math.PI / 6);
        ctx.fillStyle = rgba('#28e0ff', a * 0.8); ctx.fill();
        ctx.restore();
      }
    }

    drawFields(ctx, t) {
      const g = this.game;
      for (const tw of g.towers) {
        if (tw.type === 'cryo') {
          const s = NC.towerStats(tw);
          const col = NC.towerColor(tw);
          const r = s.range * T;
          const cx = tw.cx * T, cy = tw.cy * T;
          const off = tw.disabled > 0;
          ctx.fillStyle = rgba(off ? '#555577' : col, 0.06);
          circle(ctx, cx, cy, r); ctx.fill();
          ctx.save();
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = -t * 18;
          ctx.strokeStyle = rgba(off ? '#555577' : col, 0.38);
          ctx.lineWidth = 1.2;
          circle(ctx, cx, cy, r); ctx.stroke();
          ctx.restore();
          if (!off) {
            ctx.fillStyle = rgba(col, 0.5);
            for (let k = 0; k < 7; k++) {
              const a = t * 0.45 + k * TAU / 7;
              const rr = r * (0.45 + 0.35 * Math.sin(t * 0.8 + k * 1.7));
              ctx.fillRect(cx + Math.cos(a) * rr - 1, cy + Math.sin(a) * rr - 1, 2, 2);
            }
          }
        } else if (tw.type === 'miner' && tw.sub === 'B') {
          ctx.save();
          ctx.setLineDash([3, 5]);
          ctx.lineDashOffset = -t * 20;
          ctx.strokeStyle = rgba('#9dff5c', 0.55);
          ctx.lineWidth = 1.5;
          for (const n of tw.links) {
            ctx.beginPath(); ctx.moveTo(tw.cx * T, tw.cy * T); ctx.lineTo(n.cx * T, n.cy * T); ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    drawTowers(ctx, t) {
      const g = this.game;
      for (const tw of g.towers) {
        const cx = tw.cx * T, cy = tw.cy * T;
        const col = NC.towerColor(tw);
        const off = tw.disabled > 0;
        glow(ctx, cx, cy, 30, off ? '#ff2d95' : col, off ? 0.25 : 0.3);
        if (tw.type === 'rail' && tw.charge >= 1 && !off) glow(ctx, cx + Math.cos(tw.angle) * 18, cy + Math.sin(tw.angle) * 18, 14, col, 0.5 + 0.3 * Math.sin(t * 10));
        ctx.save();
        ctx.translate(cx, cy);
        if (off) ctx.globalAlpha = 0.55;
        NC.drawTowerShape(ctx, tw, t);
        ctx.globalAlpha = 1;
        if (off) {
          const fl = Math.sin(t * 20) > -0.3;
          ctx.fillStyle = 'rgba(255,45,149,0.18)';
          ctx.fillRect(-17, -17, 34, 34);
          if (fl) {
            ctx.strokeStyle = '#ff2d95'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(0, -3, 4, Math.PI, 0); ctx.stroke();
            ctx.fillStyle = '#ff2d95';
            ctx.fillRect(-6, -3, 12, 9);
          }
          ctx.fillStyle = '#ff2d95';
          ctx.fillRect(-15, 15, 30 * (tw.disabled / 3), 2);
        }
        ctx.restore();
        if (tw.hp < tw.maxHp) {
          const w = 28, f = Math.max(0, tw.hp / tw.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(cx - w / 2, cy - 22, w, 4);
          ctx.fillStyle = f > 0.5 ? '#7dff6a' : f > 0.25 ? '#ffd23f' : '#ff3860';
          ctx.fillRect(cx - w / 2 + 0.5, cy - 21.5, (w - 1) * f, 3);
        }
        if (tw.discount < 1) {
          ctx.font = 'bold 8px ' + MONO;
          ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          ctx.fillStyle = '#7dff6a';
          ctx.fillText('-' + Math.round((1 - tw.discount) * 100) + '%', cx + 19, cy - 20);
        }
        if (tw.type === 'miner' && tw.sub === 'A') {
          ctx.font = 'bold 10px ' + DISPLAY;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = tw.wavesLeft <= 1 ? (Math.sin(t * 12) > 0 ? '#ff3860' : '#ffffff') : '#ff9f1c';
          ctx.fillText(String(tw.wavesLeft), cx, cy - 23);
        }
      }
    }

    drawEnemies(ctx, t) {
      const g = this.game;
      const list = g.enemies;
      for (let pass = 0; pass < 2; pass++) {
        for (const e of list) {
          if (e.dead) continue;
          if ((pass === 1) !== !!e.def.boss) continue;
          this.drawEnemy(ctx, e, t);
        }
      }
      // enemies chewing on towers (Open Source Architecture)
      for (const e of list) {
        if (!e.attacking || e.dead) continue;
        const a = e.attacking;
        ctx.strokeStyle = rgba(e.def.color, 0.5 + 0.5 * Math.random());
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(e.wx * T, e.wy * T); ctx.lineTo(a.cx * T + (Math.random() - 0.5) * 16, a.cy * T + (Math.random() - 0.5) * 16); ctx.stroke();
      }
    }

    drawEnemy(ctx, e, t) {
      const d = e.def;
      const r = d.size * T;
      const x = e.wx * T, y = (e.wy - e.z) * T;
      const col = d.boss ? NC.bossColor(e) : d.color;
      if (e.z > 0.02) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(e.wx * T, e.wy * T, r, r * 0.45, 0, 0, TAU); ctx.fill();
      }
      if (e.trail && e.trail.length > 1) {
        for (let k = e.trail.length - 1; k >= 1; k--) {
          const p = e.trail[k];
          const rr = r * (1 - k / (e.trail.length + 1)) * 0.9;
          ctx.fillStyle = rgba(col, 0.55 * (1 - k / e.trail.length));
          circle(ctx, p.x * T, p.y * T, rr); ctx.fill();
        }
      }
      glow(ctx, x, y, r * (d.boss ? 3.4 : 2.6), col, d.boss ? 0.7 : 0.5);
      if (e.slow > 0) {
        ctx.strokeStyle = rgba('#6fa8ff', 0.25 + e.slow);
        ctx.lineWidth = 1.5;
        circle(ctx, x, y, r + 4); ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      NC.drawEnemyShape(ctx, e.type, r, col, e.age, e);
      ctx.restore();
      if (e.hitFlash > 0) {
        glow(ctx, x, y, r * 1.6, '#ffffff', e.hitFlash * 0.45);
      }
      if (d.boss) {
        let mr = 0;
        for (const c in e.resist) mr = Math.max(mr, e.resist[c]);
        if (mr > 0.05) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = t * 30;
          ctx.strokeStyle = rgba(col, 0.25 + mr);
          ctx.lineWidth = 2.5;
          circle(ctx, x, y, r * 1.85); ctx.stroke();
          ctx.restore();
        }
      }
      if (e.root > 0) {
        ctx.save();
        ctx.translate(x, y);
        polyPath(ctx, 6, r + 6, t);
        ctx.fillStyle = 'rgba(200,240,255,0.18)'; ctx.fill();
        ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      if (e.brittle) {
        ctx.fillStyle = '#b48cff';
        ctx.fillRect(x + r - 1, y - r - 1, 3, 3);
        ctx.fillRect(x - r - 2, y + r - 3, 3, 3);
      }
      if (e.vuln > 1) {
        ctx.font = 'bold 8px ' + MONO;
        ctx.fillStyle = '#28e0ff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOG', x, y + r + 8);
      }
      if (e.hp < e.maxHp && !d.boss) {
        const w = Math.max(18, r * 2.4), f = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - w / 2, y - r - 8, w, 3.5);
        ctx.fillStyle = f > 0.6 ? '#7dff6a' : f > 0.3 ? '#ffd23f' : '#ff3860';
        ctx.fillRect(x - w / 2, y - r - 8, w * f, 3.5);
        if (e.armor > 0) {
          ctx.fillStyle = '#c9d6e8';
          ctx.fillRect(x - w / 2, y - r - 10, w * Math.min(1, e.armor / 6), 1.5);
        }
      }
    }

    drawProjectiles(ctx) {
      const g = this.game;
      for (const p of g.projectiles) {
        const x = p.x * T, y = p.y * T;
        glow(ctx, x, y, p.kind === 'bolt' ? 10 : 7, p.color, 0.8);
        if (p.kind === 'bolt') {
          const a = p.a || 0;
          ctx.strokeStyle = p.crit ? '#ffe14d' : '#ffffff';
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7); ctx.lineTo(x, y); ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }
    }

    drawBeams(ctx) {
      const g = this.game;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const b of g.beams) {
        const a = b.life / b.max;
        ctx.strokeStyle = rgba(b.color, 0.55 * a);
        ctx.lineWidth = b.width * (0.6 + a);
        ctx.beginPath(); ctx.moveTo(b.x0 * T, b.y0 * T); ctx.lineTo(b.x1 * T, b.y1 * T); ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', a);
        ctx.lineWidth = Math.max(1, b.width * 0.3 * a);
        ctx.beginPath(); ctx.moveTo(b.x0 * T, b.y0 * T); ctx.lineTo(b.x1 * T, b.y1 * T); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawFx(ctx) {
      const g = this.game;
      ctx.globalCompositeOperation = 'lighter';
      ctx.font = 'bold 10px ' + MONO;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of g.fx) {
        const a = p.life / p.max;
        if (p.type === 'spark') {
          ctx.fillStyle = rgba(p.color, a);
          const s = p.size;
          ctx.fillRect(p.x * T - s / 2, p.y * T - s / 2, s, s);
        } else if (p.type === 'ring') {
          const u = 1 - a;
          const rr = p.r * T * (0.15 + 0.85 * (1 - (1 - u) * (1 - u)));
          ctx.strokeStyle = rgba(p.color, a * 0.85);
          ctx.lineWidth = p.width * (0.5 + a);
          circle(ctx, p.x * T, p.y * T, rr); ctx.stroke();
        } else if (p.type === 'bit') {
          ctx.fillStyle = rgba(p.color, a);
          ctx.fillText(p.ch, p.x * T, p.y * T);
        } else if (p.type === 'strike') {
          const x = p.x * T, y = p.y * T;
          ctx.fillStyle = rgba(p.color, a * 0.6);
          ctx.fillRect(x - 7 * a, 0, 14 * a, y);
          ctx.fillStyle = rgba('#ffffff', a);
          ctx.fillRect(x - 2 * a, 0, 4 * a, y);
          ctx.globalAlpha = a;
          ctx.drawImage(glowSprite(p.color), x - 30, y - 30, 60, 60);
          ctx.globalAlpha = 1;
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawTexts(ctx) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const tx of this.game.texts) {
        const a = Math.min(1, tx.life / tx.max * 1.6);
        ctx.font = 'bold ' + tx.size + 'px ' + MONO;
        ctx.globalAlpha = a;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(tx.str, tx.x * T, tx.y * T);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.str, tx.x * T, tx.y * T);
      }
      ctx.globalAlpha = 1;
    }

    rangeCircle(ctx, x, y, r, col, t, alpha) {
      ctx.fillStyle = rgba(col, 0.07 * alpha);
      circle(ctx, x * T, y * T, r * T); ctx.fill();
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 15;
      ctx.strokeStyle = rgba(col, 0.6 * alpha);
      ctx.lineWidth = 1.3;
      circle(ctx, x * T, y * T, r * T); ctx.stroke();
      ctx.restore();
    }

    drawSelection(ctx, t, view) {
      const g = this.game;
      const st = view.selTower;
      if (st && g.towers.includes(st)) {
        const col = NC.towerColor(st);
        const s = NC.towerStats(st);
        if (s.range) this.rangeCircle(ctx, st.cx, st.cy, s.range, col, t, 1);
        else this.adjacency(ctx, st.x, st.y, col);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        const px = st.x * T + 2, py = st.y * T + 2, w = T - 4;
        const c = 7;
        ctx.beginPath();
        ctx.moveTo(px, py + c); ctx.lineTo(px, py); ctx.lineTo(px + c, py);
        ctx.moveTo(px + w - c, py); ctx.lineTo(px + w, py); ctx.lineTo(px + w, py + c);
        ctx.moveTo(px + w, py + w - c); ctx.lineTo(px + w, py + w); ctx.lineTo(px + w - c, py + w);
        ctx.moveTo(px + c, py + w); ctx.lineTo(px, py + w); ctx.lineTo(px, py + w - c);
        ctx.stroke();
      }
      if (!view.buildType && view.hover) {
        const ht = g.inb(view.hover.tx, view.hover.ty) ? g.towerGrid[view.hover.ty * COLS + view.hover.tx] : null;
        if (ht && ht !== st) {
          const s = NC.towerStats(ht);
          if (s.range) this.rangeCircle(ctx, ht.cx, ht.cy, s.range, NC.towerColor(ht), t, 0.45);
        }
      }
    }

    adjacency(ctx, x, y, col) {
      ctx.strokeStyle = rgba(col, 0.5);
      ctx.fillStyle = rgba(col, 0.06);
      ctx.lineWidth = 1;
      ctx.fillRect((x - 1) * T, (y - 1) * T, T * 3, T * 3);
      ctx.strokeRect((x - 1) * T + 0.5, (y - 1) * T + 0.5, T * 3 - 1, T * 3 - 1);
    }

    drawMarkers(ctx, t, view) {
      const g = this.game;
      const mark = (e, col, label, spin) => {
        if (!e || e.dead) return;
        const r = e.def.size * T + 9;
        const x = e.wx * T, y = (e.wy - e.z) * T;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(spin);
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath(); ctx.moveTo(r, -5); ctx.lineTo(r, -r * 0); ctx.lineTo(r - 5, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(r + 4, 0); ctx.lineTo(r + 9, 0); ctx.stroke();
        }
        ctx.restore();
        if (label) {
          ctx.font = 'bold 9px ' + DISPLAY;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = col;
          ctx.fillText(label, x, y - r - 10);
        }
      };
      if (g.focus) mark(g.focus, '#ff3b5c', 'FOCUS', t * 2);
      if (view.selEnemy && view.selEnemy !== g.focus) mark(view.selEnemy, '#ffffff', null, t);
    }

    drawPlacement(ctx, t, view) {
      const g = this.game;
      if (!view.buildType || !view.hover) return;
      const { tx, ty } = view.hover;
      if (!g.inb(tx, ty)) return;
      const def = NC.TOWERS[view.buildType];
      const okTile = g.canPlace(tx, ty);
      const afford = g.bw >= def.levels[0].cost;
      const cx = tx + 0.5, cy = ty + 0.5;
      if (okTile) {
        const s = def.levels[0];
        if (s.range) this.rangeCircle(ctx, cx, cy, s.range, afford ? def.color : '#ff3860', t, 1);
        else this.adjacency(ctx, tx, ty, def.color);
        ctx.save();
        ctx.translate(cx * T, cy * T);
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 6);
        NC.drawTowerShape(ctx, { type: view.buildType, level: 1, sub: null, angle: -Math.PI / 2, charge: 1 }, t);
        ctx.restore();
        ctx.globalAlpha = 1;
        if (!afford) {
          ctx.font = 'bold 9px ' + MONO;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ff3860';
          ctx.fillText('NEED ' + def.levels[0].cost + ' BW', cx * T, ty * T - 6);
        }
        if (g.grid[ty * COLS + tx] === NC.TILE_PATH) {
          ctx.font = 'bold 8px ' + MONO;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffc93b';
          ctx.fillText('BLOCKADE', cx * T, (ty + 1) * T + 7);
        }
      } else {
        ctx.strokeStyle = 'rgba(255,56,96,0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx * T + 4, ty * T + 4, T - 8, T - 8);
        ctx.beginPath();
        ctx.moveTo(tx * T + 12, ty * T + 12); ctx.lineTo(tx * T + T - 12, ty * T + T - 12);
        ctx.moveTo(tx * T + T - 12, ty * T + 12); ctx.lineTo(tx * T + 12, ty * T + T - 12);
        ctx.stroke();
      }
    }

    drawBossBar(ctx) {
      const g = this.game;
      const boss = g.enemies.find(e => e.def.boss && !e.dead);
      if (!boss) return;
      const w = 340, x = this.W / 2 - w / 2, y = 8;
      ctx.fillStyle = 'rgba(10,0,8,0.82)';
      chamferPath(ctx, x - 10, y - 4, w + 20, 52, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,23,68,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = 'bold 10px ' + DISPLAY;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#ff5c7c';
      ctx.fillText('POLYMORPHIC BOSS-WARE', x, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px ' + MONO;
      ctx.fillText(NC.fmt(Math.max(0, boss.hp)) + ' / ' + NC.fmt(boss.maxHp), x + w, y);
      const f = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y + 14, w, 8);
      const grd = ctx.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, '#ff1744'); grd.addColorStop(1, '#ff2bd6');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y + 14, w * f, 8);
      const cats = ['rapid', 'beam', 'aoe'];
      const cw = (w - 20) / 3;
      ctx.font = '9px ' + MONO;
      ctx.textAlign = 'left';
      cats.forEach((c, i) => {
        const dc = NC.DAMAGE_CATS[c];
        const cx = x + i * (cw + 10);
        ctx.fillStyle = rgba(dc.color, 0.85);
        ctx.fillText('RES ' + dc.name.toUpperCase() + ' ' + Math.round(boss.resist[c] * 100) + '%', cx, y + 26);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(cx, y + 38, cw, 4);
        ctx.fillStyle = dc.color;
        ctx.fillRect(cx, y + 38, cw * boss.resist[c] / 0.6, 4);
      });
    }

    drawOverlays(ctx, t) {
      const g = this.game;
      const W = this.W, H = this.H;
      if (g.hurt > 0) {
        const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
        grd.addColorStop(0, 'rgba(255,0,60,0)');
        grd.addColorStop(1, rgba('#ff003c', 0.45 * g.hurt));
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      }
      if (g.state === 'rewind') {
        const u = g.rewindT / g.rewindDur;
        ctx.fillStyle = 'rgba(40,224,255,0.10)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(200,250,255,0.12)';
        for (let k = 0; k < 6; k++) {
          const yy = ((t * 400 + k * 113) % (H + 40)) - 20;
          ctx.fillRect(0, yy, W, 3 + (k % 3) * 2);
        }
        ctx.font = '900 38px ' + DISPLAY;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba('#28e0ff', 0.6 + 0.4 * Math.sin(t * 14));
        ctx.fillText('◀◀  SYSTEM RESTORE', W / 2, H / 2);
        ctx.font = '14px ' + MONO;
        ctx.fillStyle = '#bff6ff';
        ctx.fillText('REWINDING TIMELINE ' + Math.round(u * 100) + '%', W / 2, H / 2 + 34);
      }
      if (g.flash > 0) {
        ctx.fillStyle = rgba(g.flashColor, Math.min(0.7, g.flash * 0.6));
        ctx.fillRect(0, 0, W, H);
      }
    }

    glitchPass() {
      const g = this.game;
      if (g.glitch <= 0) return;
      const ctx = this.ctx;
      const cw = this.c.width, ch = this.c.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const n = 2 + Math.floor(g.glitch * 6);
      for (let k = 0; k < n; k++) {
        const sy = Math.random() * ch, h = 4 + Math.random() * ch * 0.06;
        const dx = (Math.random() - 0.5) * 40 * this.ps * Math.min(1, g.glitch * 2);
        ctx.drawImage(this.c, 0, sy, cw, h, dx, sy, cw, h);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba('#ff003c', 0.08 * Math.min(1, g.glitch * 2));
      ctx.fillRect(0, Math.random() * ch, cw, 6 * this.ps);
      ctx.globalCompositeOperation = 'source-over';
    }

    draw(now, view) {
      const g = this.game;
      if (!g) return;
      if (!this.board) this.buildBoard();
      const ctx = this.ctx;
      const t = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#03050b';
      ctx.fillRect(0, 0, this.c.width, this.c.height);
      const sh = g.shake;
      const sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
      ctx.setTransform(this.ps, 0, 0, this.ps, sx * this.ps, sy * this.ps);
      ctx.drawImage(this.board, 0, 0, this.W, this.H);
      this.drawFlow(ctx, t);
      this.drawTraps(ctx, t);
      this.drawSpawns(ctx, t);
      this.drawFields(ctx, t);
      this.drawSelection(ctx, t, view);
      this.drawTowers(ctx, t);
      this.drawCore(ctx, t);
      this.drawEnemies(ctx, t);
      this.drawProjectiles(ctx);
      this.drawBeams(ctx);
      this.drawFx(ctx);
      this.drawTexts(ctx);
      this.drawMarkers(ctx, t, view);
      this.drawPlacement(ctx, t, view);
      ctx.setTransform(this.ps, 0, 0, this.ps, 0, 0);
      this.drawBossBar(ctx);
      this.drawOverlays(ctx, t);
      this.glitchPass();
    }
  }
  NC.Renderer = Renderer;

  // Small helper used by the UI for tower / enemy icons.
  NC.drawIcon = function (canvas, kind, id, opts) {
    opts = opts || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = opts.size || 44;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    if (kind === 'tower') {
      const s = size / 40;
      const col = opts.sub ? NC.TOWERS[id].subs[opts.sub].color : NC.TOWERS[id].color;
      glow(ctx, 0, 0, size * 0.6, col, 0.35);
      ctx.scale(s, s);
      NC.drawTowerShape(ctx, { type: id, level: opts.level || 1, sub: opts.sub || null, angle: -Math.PI / 4, charge: 1 }, opts.time || 0.6);
    } else {
      const d = NC.ENEMIES[id];
      const r = Math.min(size * 0.32, d.size * 40 * (size / 40));
      glow(ctx, 0, 0, r * 2.6, d.color, 0.5);
      if (id === 'worm') {
        for (let k = 3; k >= 1; k--) {
          ctx.fillStyle = rgba(d.color, 0.5 * (1 - k / 4));
          circle(ctx, -k * r * 0.9, k * r * 0.25, r * (1 - k * 0.18)); ctx.fill();
        }
      }
      NC.drawEnemyShape(ctx, id, r, d.color, opts.time || 0.4, id === 'trojan' ? { angle: 0, armor: 5, baseArmor: 5 } : { angle: 0 });
    }
  };

  // ------------------------------------------------------------ menu backdrop
  class MenuBG {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.traces = [];
      this.pulses = [];
      this.resize();
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.c.width = this.w * dpr; this.c.height = this.h * dpr;
      this.dpr = dpr;
      const rnd = NC.mulberry32(1337);
      this.traces = [];
      const step = 28;
      for (let k = 0; k < 46; k++) {
        let x = Math.floor(rnd() * this.w / step) * step, y = Math.floor(rnd() * this.h * 0.62 / step) * step;
        const pts = [[x, y]];
        let dir = Math.floor(rnd() * 4) * 2;
        for (let s = 0; s < 6 + rnd() * 10; s++) {
          if (rnd() < 0.35) dir = (dir + (rnd() < 0.5 ? 1 : 7)) % 8;
          const len = (1 + Math.floor(rnd() * 4)) * step;
          x += D8[dir][0] * len; y += D8[dir][1] * len;
          pts.push([x, y]);
        }
        let L = 0;
        const segs = [];
        for (let i = 1; i < pts.length; i++) {
          const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          segs.push(l); L += l;
        }
        this.traces.push({ pts, segs, L, col: rnd() < 0.7 ? '#00e5ff' : '#c77dff', speed: 60 + rnd() * 120, off: rnd() * 1000 });
      }
    }

    pointAt(tr, d) {
      for (let i = 0; i < tr.segs.length; i++) {
        if (d <= tr.segs[i]) {
          const u = d / tr.segs[i];
          return [NC.lerp(tr.pts[i][0], tr.pts[i + 1][0], u), NC.lerp(tr.pts[i][1], tr.pts[i + 1][1], u)];
        }
        d -= tr.segs[i];
      }
      return tr.pts[tr.pts.length - 1];
    }

    draw(now) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const t = now / 1000;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#04050c');
      grd.addColorStop(0.6, '#0a0820');
      grd.addColorStop(1, '#14052a');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // circuit traces
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const tr of this.traces) {
        ctx.strokeStyle = rgba(tr.col, 0.09);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        tr.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
        const d = (t * tr.speed + tr.off) % (tr.L + 200);
        if (d < tr.L) {
          const p = this.pointAt(tr, d);
          glow(ctx, p[0], p[1], 18, tr.col, 0.8);
          const q = this.pointAt(tr, Math.max(0, d - 40));
          ctx.strokeStyle = rgba(tr.col, 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        }
      }

      // synthwave floor grid
      const hy = h * 0.66;
      const fg = ctx.createLinearGradient(0, hy, 0, h);
      fg.addColorStop(0, 'rgba(255,43,214,0.0)');
      fg.addColorStop(1, 'rgba(255,43,214,0.10)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, hy, w, h - hy);
      ctx.strokeStyle = 'rgba(255,43,214,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(w, hy); ctx.stroke();
      const vx = w / 2;
      ctx.strokeStyle = 'rgba(255,43,214,0.16)';
      ctx.beginPath();
      for (let k = -24; k <= 24; k++) {
        ctx.moveTo(vx + k * 18, hy);
        ctx.lineTo(vx + k * w * 0.12, h);
      }
      ctx.stroke();
      const sp = (t * 0.35) % 1;
      for (let k = 0; k < 14; k++) {
        const u = (k + sp) / 14;
        const yy = hy + (h - hy) * u * u;
        ctx.strokeStyle = rgba('#ff2bd6', 0.05 + 0.3 * u);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
      }
      glow(ctx, w / 2, hy, Math.max(w, h) * 0.35, '#ff2bd6', 0.25);
    }
  }
  NC.MenuBG = MenuBG;
})(globalThis.NC = globalThis.NC || {});
