/* Neon Cortex — core simulation. No DOM access here so it can be run headless. */
(function (NC) {
  'use strict';

  const COLS = NC.COLS, ROWS = NC.ROWS;
  const VOID = 0, PATH = 1, GATE = 2;
  const BLOCK_COST = 14; // extra path cost for walking through a tower (Open Source Architecture)
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8 = N4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  const rand = NC.rand;
  const sfx = name => { if (NC.Audio) NC.Audio.play(name); };

  NC.TILE_VOID = VOID;
  NC.TILE_PATH = PATH;
  NC.TILE_GATE = GATE;

  NC.buildMap = function (lv) {
    const grid = new Uint8Array(COLS * ROWS);
    const set = (x, y) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = PATH; };
    for (const r of lv.routes) {
      for (let i = 0; i < r.length - 1; i++) {
        let x = r[i][0], y = r[i][1];
        const x1 = r[i + 1][0], y1 = r[i + 1][1];
        const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
        set(x, y);
        while (x !== x1 || y !== y1) { x += dx; y += dy; set(x, y); }
      }
    }
    // Logic gates (build pads) ring the data streams.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y * COLS + x] !== VOID) continue;
        for (const [dx, dy] of N8) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && grid[ny * COLS + nx] === PATH) { grid[y * COLS + x] = GATE; break; }
        }
      }
    }
    return { grid, spawns: lv.spawns, core: lv.core };
  };

  NC.towerStats = function (t) {
    const d = NC.TOWERS[t.type];
    return t.level <= 3 ? d.levels[t.level - 1] : d.subs[t.sub];
  };

  NC.towerColor = function (t) {
    const d = NC.TOWERS[t.type];
    return t.sub ? d.subs[t.sub].color : d.color;
  };

  class Game {
    constructor(lv, skills) {
      this.lv = lv;
      this.map = NC.buildMap(lv);
      this.grid = this.map.grid;
      this.coreIdx = lv.core.y * COLS + lv.core.x;
      this.spawnSet = new Set(lv.spawns.map(s => s.y * COLS + s.x));
      this.skills = Object.assign({}, skills || {});

      this.dmgMul = this.has('oc1') ? 1.05 : 1;
      this.frictionMul = this.has('en2') ? 0.95 : 1;
      this.refundRate = this.has('dm2') ? 0.9 : 0.6;
      this.openSource = this.has('dm5');

      this.coreMax = lv.coreHp + (this.has('en1') ? 5 : 0);
      this.coreHp = this.coreMax;
      this.bw = lv.startBw + (this.has('dm1') ? 100 : 0);

      this.towers = [];
      this.towerGrid = new Array(COLS * ROWS).fill(null);
      this.enemies = [];
      this.projectiles = [];
      this.beams = [];
      this.fx = [];
      this.texts = [];
      this.traps = [];
      this.deathQueue = [];
      this.events = [];

      this.waves = [];
      this.waveNum = 0;
      this.totalWaves = lv.endless ? Infinity : lv.waves;
      this.wavesCleared = 0;
      this.autoWave = false;
      this.autoTimer = 0;

      this.time = 0;
      this.state = 'playing'; // playing | rewind | won | lost
      this.stats = { kills: 0, leaks: 0, bossKills: 0, built: 0, earned: 0 };
      this.logged = {};
      this.restoreUsed = false;
      this.killSwitchCd = 0;
      this.focus = null;
      this.eid = 0;
      this.tid = 0;
      this.flowVersion = 0;

      this.shake = 0;
      this.flash = 0;
      this.flashColor = '#ffffff';
      this.hurt = 0;
      this.glitch = 0;
      this.coreHit = 0;

      this.computeFlow();
    }

    has(id) { return !!this.skills[id]; }
    idx(x, y) { return y * COLS + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
    walkable(i) { return this.grid[i] === PATH; }
    enterCost(i) { return 1 + (this.towerGrid[i] ? BLOCK_COST : 0); }
    toast(text, style) { this.events.push({ kind: 'toast', text, style: style || '' }); }

    // ------------------------------------------------------------ pathing
    computeFlow() {
      const N = COLS * ROWS;
      const dist = new Float64Array(N).fill(Infinity);
      const done = new Uint8Array(N);
      dist[this.coreIdx] = 0;
      for (;;) {
        let u = -1, bd = Infinity;
        for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
        if (u < 0) break;
        done[u] = 1;
        const ux = u % COLS, uy = (u / COLS) | 0;
        const c = this.enterCost(u);
        for (const [dx, dy] of N4) {
          const x = ux + dx, y = uy + dy;
          if (!this.inb(x, y)) continue;
          const v = y * COLS + x;
          if (!this.walkable(v) || done[v]) continue;
          const nd = bd + c;
          if (nd < dist[v]) dist[v] = nd;
        }
      }
      this.dist = dist;
      this.flowVersion++;
    }

    chooseNext(e) {
      const tx = e.tx, ty = e.ty;
      let best = Infinity;
      const cands = [];
      for (const [dx, dy] of N4) {
        const x = tx + dx, y = ty + dy;
        if (!this.inb(x, y)) continue;
        const i = y * COLS + x;
        if (!this.walkable(i)) continue;
        const d = this.dist[i] + this.enterCost(i);
        if (d < best - 1e-6) { best = d; cands.length = 0; cands.push(i); }
        else if (Math.abs(d - best) < 1e-6) cands.push(i);
      }
      if (!cands.length) { e.nx = tx; e.ny = ty; return; }
      const i = cands[(Math.random() * cands.length) | 0];
      e.nx = i % COLS;
      e.ny = (i / COLS) | 0;
    }

    // ------------------------------------------------------------ waves
    nextWavePreview() {
      if (this.waveNum >= this.totalWaves) return null;
      return NC.genWave(this.waveNum + 1, this.lv);
    }

    activeWaves() { return this.waves.filter(w => !w.done).length; }

    callWave() {
      if (this.state !== 'playing' || this.waveNum >= this.totalWaves) return false;
      const n = this.waveNum + 1;
      if (this.activeWaves() > 0) {
        const bonus = 10 + 2 * n;
        this.bw += bonus;
        this.stats.earned += bonus;
        this.toast('EARLY INITIATION +' + bonus + ' BW', 'gold');
      }
      this.waveNum = n;
      const def = NC.genWave(n, this.lv);
      const w = {
        n, hpMul: def.hpMul, rewardMul: def.rewardMul, alive: 0, done: false,
        groups: def.groups.map(g => Object.assign({}, g, { spawned: 0, timer: g.delay }))
      };
      this.waves.push(w);
      this.autoTimer = 0;
      if (this.has('en4')) this.deployTraps();
      if (def.boss) {
        this.toast('⚠ POLYMORPHIC BOSS-WARE DETECTED ⚠', 'boss');
        sfx('boss');
      } else {
        this.toast('WAVE ' + n + (this.lv.endless ? '' : ' / ' + this.totalWaves) + ' INCOMING', 'wave');
        sfx('wave');
      }
      return true;
    }

    updateWaves(dt) {
      for (const w of this.waves) {
        if (w.done) continue;
        let pending = false;
        for (const g of w.groups) {
          if (g.spawned >= g.count) continue;
          g.timer -= dt;
          while (g.timer <= 0 && g.spawned < g.count) {
            const sp = this.lv.spawns[g.spawn];
            this.spawnEnemy(g.type, sp.x + 0.5, sp.y + 0.5, w, { hpScale: g.hpScale, spawn: g.spawn });
            g.spawned++;
            g.timer += g.interval;
          }
          if (g.spawned < g.count) pending = true;
        }
        if (!pending && w.alive <= 0) this.completeWave(w);
      }
      if (this.autoWave && this.state === 'playing' && this.activeWaves() === 0 && this.waveNum < this.totalWaves) {
        this.autoTimer += dt;
        if (this.autoTimer >= 2.5) this.callWave();
      }
      if (!this.lv.endless && this.waveNum >= this.totalWaves && this.activeWaves() === 0 && this.enemies.length === 0) this.win();
    }

    completeWave(w) {
      w.done = true;
      this.wavesCleared++;
      let total = 0;
      if (this.has('dm3')) {
        const interest = Math.min(150, Math.floor(this.bw * 0.05));
        if (interest > 0) {
          total += interest;
          this.text(this.lv.core.x + 0.5, this.lv.core.y - 0.6, '+' + interest + ' INTEREST', '#ffc93b', 13);
        }
      }
      const bonus = 30 + 6 * w.n;
      total += bonus;
      for (const t of this.towers.slice()) {
        if (t.type !== 'miner') continue;
        const s = NC.towerStats(t);
        total += s.income;
        this.text(t.cx, t.cy - 0.5, '+' + s.income, '#ffd23f', 13);
        this.burst(t.cx, t.cy, '#ffd23f', 10, 2.5);
        if (t.sub === 'A') {
          t.wavesLeft--;
          if (t.wavesLeft <= 0) this.ventureExplode(t);
        }
      }
      this.bw += total;
      this.stats.earned += total;
      if (total > 0) sfx('coin');
      this.toast('WAVE ' + w.n + ' PURGED  +' + total + ' BW', 'clear');
    }

    deployTraps() {
      const cands = [];
      let maxD = 0;
      for (let i = 0; i < this.dist.length; i++) if (this.walkable(i) && isFinite(this.dist[i])) maxD = Math.max(maxD, this.dist[i]);
      for (let i = 0; i < this.grid.length; i++) {
        if (!this.walkable(i) || i === this.coreIdx || this.spawnSet.has(i) || this.towerGrid[i]) continue;
        const d = this.dist[i];
        if (d < 3 || d > maxD - 3) continue;
        if (this.traps.some(t => t.i === i)) continue;
        cands.push(i);
      }
      for (let k = 0; k < 3 && cands.length && this.traps.length < 9; k++) {
        const i = cands.splice((Math.random() * cands.length) | 0, 1)[0];
        this.traps.push({ i, x: (i % COLS) + 0.5, y: ((i / COLS) | 0) + 0.5, t: Math.random() * 10 });
      }
    }

    // ------------------------------------------------------------ enemies
    spawnEnemy(type, x, y, wave, opt) {
      opt = opt || {};
      const d = NC.ENEMIES[type];
      const hpMul = (wave ? wave.hpMul : 1) * (opt.hpScale || 1);
      const e = {
        id: ++this.eid, type, def: d,
        x, y, wx: x, wy: y, z: 0,
        tx: Math.floor(x), ty: Math.floor(y), nx: Math.floor(x), ny: Math.floor(y),
        hp: d.hp * hpMul, maxHp: d.hp * hpMul, hpMul,
        armor: d.armor, baseArmor: d.armor, speed: d.speed, size: d.size,
        ox: d.boss ? 0 : rand(-0.15, 0.15), oy: d.boss ? 0 : rand(-0.15, 0.15),
        wave, spawn: opt.spawn || 0,
        slow: 0, root: 0, brittle: false, vuln: this.logged[type] ? 1.1 : 1,
        reward: Math.round(d.reward * (wave ? wave.rewardMul : 1) * (opt.rewardScale != null ? opt.rewardScale : 1)),
        dead: false, angle: 0, hitFlash: 0, age: 0, prog: 0,
        jumpCd: rand(2.2, 4), jump: null, pulseCd: 0.5, spawnCd: 6,
        resist: { rapid: 0, beam: 0, aoe: 0 }, lastHit: { rapid: -9, beam: -9, aoe: -9 }, adaptWarned: {},
        trail: [], trailT: 0, attacking: null, hpScale: opt.hpScale || 1
      };
      if (opt.from) {
        e.tx = opt.from.tx; e.ty = opt.from.ty; e.nx = opt.from.nx; e.ny = opt.from.ny;
        e.x = opt.from.x + rand(-0.08, 0.08); e.y = opt.from.y + rand(-0.08, 0.08);
      } else {
        this.chooseNext(e);
      }
      e.wx = e.x + e.ox; e.wy = e.y + e.oy;
      this.enemies.push(e);
      if (wave) wave.alive++;
      if (d.boss) this.ring(e.x, e.y, '#ff1744', 2.5, 0.8, 4);
      return e;
    }

    updateEnemy(e, dt) {
      e.age += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      e.attacking = null;
      if (e.root > 0) e.root -= dt;
      const d = e.def;

      if (e.jump) {
        const j = e.jump;
        j.t += dt / j.dur;
        const u = Math.min(1, j.t);
        e.x = NC.lerp(j.x0, j.x1, u);
        e.y = NC.lerp(j.y0, j.y1, u);
        e.z = Math.sin(Math.PI * u) * 0.9;
        if (u >= 1) {
          e.jump = null; e.z = 0;
          e.tx = j.tx; e.ty = j.ty;
          this.ring(e.x, e.y, d.color, 0.7, 0.3, 2);
          this.chooseNext(e);
        }
        return;
      }

      if (d.jump && e.root <= 0) {
        e.jumpCd -= dt;
        if (e.jumpCd <= 0) {
          e.jumpCd = rand(3.2, 5.2);
          if (this.tryJump(e)) return;
        }
      }

      if (d.disableRange) {
        e.pulseCd -= dt;
        if (e.pulseCd <= 0) {
          e.pulseCd = 1;
          let hit = false;
          for (const t of this.towers) {
            const dd = Math.hypot(t.cx - e.wx, t.cy - e.wy);
            if (dd <= d.disableRange) {
              if (t.disabled <= 0) hit = true;
              t.disabled = Math.max(t.disabled, d.disableDur);
            }
          }
          this.ring(e.wx, e.wy, d.color, d.disableRange, 0.6, 2);
          if (hit) sfx('disable');
        }
      }

      if (d.boss) {
        e.spawnCd -= dt;
        if (e.spawnCd <= 0) {
          e.spawnCd = 7;
          for (let k = 0; k < 2; k++) this.spawnEnemy('worm', e.x, e.y, e.wave, { from: e, spawn: e.spawn });
          this.ring(e.x, e.y, '#a6ff00', 1.2, 0.4, 2);
        }
        for (const c in e.resist) {
          if (this.time - e.lastHit[c] > 1.5) e.resist[c] = Math.max(0, e.resist[c] - 0.045 * dt);
        }
      }

      let step = e.speed * (1 - e.slow) * this.frictionMul * (e.root > 0 ? 0 : 1) * dt;
      let guard = 0;
      while (step > 0 && guard++ < 8) {
        const ni = e.ny * COLS + e.nx;
        const moving = e.nx !== e.tx || e.ny !== e.ty;
        if (moving && this.towerGrid[ni]) {
          this.attackTower(e, this.towerGrid[ni], dt);
          break;
        }
        const cx = e.nx + 0.5, cy = e.ny + 0.5;
        const dx = cx - e.x, dy = cy - e.y;
        const dd = Math.hypot(dx, dy);
        if (dd > 1e-6) e.angle = Math.atan2(dy, dx);
        if (step >= dd) {
          e.x = cx; e.y = cy; step -= dd;
          e.tx = e.nx; e.ty = e.ny;
          if (e.tx === this.lv.core.x && e.ty === this.lv.core.y) { this.leak(e); return; }
          this.onEnterTile(e);
          this.chooseNext(e);
          if (e.nx === e.tx && e.ny === e.ty) break;
        } else {
          e.x += dx / dd * step;
          e.y += dy / dd * step;
          step = 0;
        }
      }
    }

    tryJump(e) {
      const cur = this.dist[e.ty * COLS + e.tx];
      let best = -1, bd = cur - 4;
      for (let y = e.ty - 3; y <= e.ty + 3; y++) {
        for (let x = e.tx - 3; x <= e.tx + 3; x++) {
          if (!this.inb(x, y)) continue;
          const i = y * COLS + x;
          if (!this.walkable(i) || this.towerGrid[i] || i === this.coreIdx) continue;
          if (Math.hypot(x - e.tx, y - e.ty) > 3.2) continue;
          if (this.dist[i] < bd) { bd = this.dist[i]; best = i; }
        }
      }
      if (best < 0) return false;
      const bx = best % COLS, by = (best / COLS) | 0;
      e.jump = { x0: e.x, y0: e.y, x1: bx + 0.5, y1: by + 0.5, t: 0, dur: 0.6, tx: bx, ty: by };
      this.burst(e.wx, e.wy, e.def.color, 6, 2);
      sfx('jump');
      return true;
    }

    onEnterTile(e) {
      if (!this.traps.length) return;
      const i = e.ty * COLS + e.tx;
      const k = this.traps.findIndex(t => t.i === i);
      if (k < 0) return;
      const trap = this.traps.splice(k, 1)[0];
      for (const o of this.enemies) {
        if (o.dead) continue;
        if (Math.hypot(o.wx - trap.x, o.wy - trap.y) <= 1.5) o.root = Math.max(o.root, o.def.boss ? 1 : 2);
      }
      this.ring(trap.x, trap.y, '#28e0ff', 1.5, 0.6, 3);
      this.burst(trap.x, trap.y, '#bff6ff', 16, 3);
      this.text(trap.x, trap.y - 0.4, 'STASIS', '#28e0ff', 12);
      sfx('trap');
    }

    attackTower(e, t, dt) {
      e.attacking = t;
      t.hp -= e.def.atk * (0.5 + 0.5 * e.hpMul) * dt;
      t.hurt = 0.2;
      if (t.hp <= 0) {
        this.toast(NC.TOWERS[t.type].name.toUpperCase() + ' DESTROYED', 'bad');
        this.destroyTower(t, true);
      }
    }

    leak(e) {
      if (e.dead) return;
      e.dead = true; e.leaked = true;
      if (e.wave) e.wave.alive--;
      this.coreHp = Math.max(0, this.coreHp - e.def.coreDmg);
      this.stats.leaks++;
      this.shake = Math.max(this.shake, e.def.boss ? 14 : 6);
      this.hurt = 1;
      this.glitch = Math.max(this.glitch, e.def.boss ? 0.6 : 0.25);
      this.coreHit = 1;
      const c = this.lv.core;
      this.burst(c.x + 0.5, c.y + 0.5, '#ff3860', 18, 4);
      this.text(c.x + 0.5, c.y - 0.2, '-' + e.def.coreDmg + ' INTEGRITY', '#ff3860', 13);
      sfx('leak');
      if (this.has('en3') && !this.logged[e.type]) {
        this.logged[e.type] = true;
        this.toast('FEEDBACK LOOP: ' + e.def.name.toUpperCase() + ' SIGNATURE LOGGED (+10% DMG TAKEN)', 'info');
      }
      if (this.coreHp <= 0) {
        if (this.has('en5') && !this.restoreUsed) this.startRewind();
        else this.lose();
      }
    }

    // ------------------------------------------------------------ damage
    damage(e, amt, cat, opt) {
      if (e.dead) return 0;
      opt = opt || {};
      amt *= this.dmgMul * e.vuln;
      if (e.brittle) amt *= 1.15;
      if (e.def.adapt && cat) amt *= 1 - e.resist[cat];
      const armor = opt.ignoreArmor ? 0 : e.armor;
      amt = Math.max(amt * 0.2, amt - armor);
      e.hp -= amt;
      if (!opt.dot) e.hitFlash = 1;
      if (opt.tower) opt.tower.dealt += amt;
      if (e.def.adapt && cat) {
        e.resist[cat] = Math.min(0.6, e.resist[cat] + (amt / e.maxHp) * 1.8);
        e.lastHit[cat] = this.time;
        if (e.resist[cat] > 0.35 && !e.adaptWarned[cat]) {
          e.adaptWarned[cat] = true;
          const dc = NC.DAMAGE_CATS[cat];
          this.toast('BOSS ADAPTING TO ' + dc.name.toUpperCase() + ' — PIVOT FIREPOWER', 'boss');
        }
      }
      if (e.hp <= 0) this.kill(e, opt.tower);
      return amt;
    }

    kill(e, tower) {
      if (e.dead) return;
      e.dead = true;
      if (tower) tower.kills++;
      this.deathQueue.push(e);
    }

    processDeaths() {
      let guard = 0;
      while (this.deathQueue.length && guard++ < 2000) {
        const e = this.deathQueue.shift();
        const d = e.def;
        if (e.wave) e.wave.alive--;
        this.bw += e.reward;
        this.stats.earned += e.reward;
        this.stats.kills++;
        if (this.focus === e) this.focus = null;
        this.burst(e.wx, e.wy, d.color, d.boss ? 60 : Math.round(8 + d.size * 20), d.boss ? 7 : 3.5);
        this.bits(e.wx, e.wy, d.color, d.boss ? 16 : 3);
        this.ring(e.wx, e.wy, d.color, d.size * 2.4 + 0.2, 0.35, 2);
        if (d.boss) {
          this.stats.bossKills++;
          this.shake = Math.max(this.shake, 16);
          this.flash = 0.6; this.flashColor = '#ff1744';
          this.ring(e.wx, e.wy, '#ffffff', 5, 1.0, 5);
          this.toast('BOSS-WARE PURGED  +' + e.reward + ' BW', 'clear');
          sfx('bigdie');
        } else {
          sfx('die');
        }
        if (e.reward >= 10) this.text(e.wx, e.wy - 0.3, '+' + e.reward, '#ffd23f', 11);
        if (d.payload && !e.noPayload) {
          for (let k = 0; k < d.payload; k++) {
            const c = this.spawnEnemy('virus', e.x, e.y, e.wave, { from: e, spawn: e.spawn, rewardScale: 0.5 });
            c.ox = rand(-0.22, 0.22); c.oy = rand(-0.22, 0.22);
          }
        }
        if (this.has('oc3') && !e.noEmp) {
          const r = 1.3;
          const dmg = Math.min(80, 8 + e.maxHp * 0.05);
          this.ring(e.wx, e.wy, '#ff3b5c', r, 0.35, 1.5);
          for (const o of this.enemies) {
            if (o.dead || o === e) continue;
            if (Math.hypot(o.wx - e.wx, o.wy - e.wy) <= r) this.damage(o, dmg, 'aoe');
          }
          sfx('emp');
        }
      }
    }

    // ------------------------------------------------------------ towers
    canPlace(x, y) {
      if (!this.inb(x, y)) return false;
      const i = y * COLS + x;
      if (this.towerGrid[i] || i === this.coreIdx || this.spawnSet.has(i)) return false;
      const g = this.grid[i];
      if (g === GATE) return true;
      if (!this.openSource) return false;
      if (g === PATH) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - (x + 0.5)) < 0.62 && Math.abs(e.y - (y + 0.5)) < 0.62) return false;
          if (e.jump && e.jump.tx === x && e.jump.ty === y) return false;
        }
      }
      return true;
    }

    towerMaxHp(t) { return 150 + 100 * (t.level - 1); }

    placeTower(type, x, y) {
      const def = NC.TOWERS[type];
      const cost = def.levels[0].cost;
      if (this.state !== 'playing' && this.state !== 'rewind') return null;
      if (!this.canPlace(x, y)) { sfx('error'); return null; }
      if (this.bw < cost) { sfx('error'); this.toast('INSUFFICIENT BANDWIDTH', 'bad'); return null; }
      this.bw -= cost;
      const t = {
        id: ++this.tid, type, def, x, y, cx: x + 0.5, cy: y + 0.5,
        level: 1, sub: null, invested: cost, angle: -Math.PI / 2,
        cd: 0, charge: 0, disabled: 0, targeting: 'first',
        hp: 150, maxHp: 150, hurt: 0, discount: 1, wavesLeft: null,
        freezeCd: 3, synergy: 1, links: [], kills: 0, dealt: 0, recoil: 0, built: this.time, onPath: this.grid[y * COLS + x] === PATH
      };
      this.towers.push(t);
      this.towerGrid[y * COLS + x] = t;
      this.stats.built++;
      this.refreshLinks();
      if (t.onPath) this.onPathChanged(x, y);
      this.ring(t.cx, t.cy, def.color, 0.9, 0.45, 2.5);
      this.burst(t.cx, t.cy, def.color, 10, 2);
      sfx('place');
      return t;
    }

    onPathChanged(x, y) {
      this.computeFlow();
      for (const e of this.enemies) {
        if (e.dead || e.jump) continue;
        if (e.nx === x && e.ny === y && !(e.tx === x && e.ty === y)) { e.nx = e.tx; e.ny = e.ty; }
      }
    }

    upgradeCost(t, sub) {
      const d = NC.TOWERS[t.type];
      if (t.level >= 4) return null;
      const base = t.level < 3 ? d.levels[t.level].cost : d.subs[sub || 'A'].cost;
      return Math.round(base * t.discount);
    }

    upgradeTower(t, sub) {
      if (t.level >= 4) return false;
      if (t.level === 3 && !sub) return false;
      const cost = this.upgradeCost(t, sub);
      if (this.bw < cost) { sfx('error'); this.toast('INSUFFICIENT BANDWIDTH', 'bad'); return false; }
      this.bw -= cost;
      t.invested += cost;
      t.level++;
      if (t.level === 4) {
        t.sub = sub;
        if (t.type === 'miner' && sub === 'A') t.wavesLeft = NC.TOWERS.miner.subs.A.lifespan;
        this.toast('SUBROUTINE INSTALLED: ' + NC.TOWERS[t.type].subs[sub].name.toUpperCase(), 'info');
      }
      t.discount = 1;
      const nm = this.towerMaxHp(t);
      t.hp += nm - t.maxHp;
      t.maxHp = nm;
      if (this.has('dm4')) {
        for (const n of this.neighbors(t)) n.discount = Math.max(0.5, n.discount - 0.1);
      }
      this.refreshLinks();
      const col = NC.towerColor(t);
      this.ring(t.cx, t.cy, col, 1.1, 0.5, 3);
      this.burst(t.cx, t.cy, col, 16, 3);
      sfx('upgrade');
      return true;
    }

    sellValue(t) { return Math.floor(t.invested * this.refundRate); }

    sellTower(t) {
      const v = this.sellValue(t);
      this.bw += v;
      this.text(t.cx, t.cy - 0.3, '+' + v, '#ffd23f', 12);
      this.destroyTower(t, false);
      sfx('sell');
    }

    destroyTower(t, violent) {
      const i = this.towers.indexOf(t);
      if (i < 0) return;
      this.towers.splice(i, 1);
      this.towerGrid[t.y * COLS + t.x] = null;
      this.burst(t.cx, t.cy, NC.towerColor(t), violent ? 30 : 12, violent ? 4 : 2);
      if (violent) { this.ring(t.cx, t.cy, '#ff7b00', 1.4, 0.5, 3); sfx('bigdie'); this.shake = Math.max(this.shake, 6); }
      this.refreshLinks();
      if (t.onPath) this.computeFlow();
    }

    ventureExplode(t) {
      const r = 2;
      for (const e of this.enemies) {
        if (!e.dead && Math.hypot(e.wx - t.cx, e.wy - t.cy) <= r) this.damage(e, 300, 'aoe');
      }
      this.ring(t.cx, t.cy, '#ff9f1c', r, 0.7, 4);
      this.burst(t.cx, t.cy, '#ff9f1c', 40, 5);
      this.text(t.cx, t.cy - 0.5, 'VENTURE CASHED OUT', '#ff9f1c', 12);
      this.shake = Math.max(this.shake, 8);
      this.destroyTower(t, false);
      sfx('bigdie');
    }

    neighbors(t) {
      const out = [];
      for (const [dx, dy] of N8) {
        const x = t.x + dx, y = t.y + dy;
        if (!this.inb(x, y)) continue;
        const n = this.towerGrid[y * COLS + x];
        if (n) out.push(n);
      }
      return out;
    }

    refreshLinks() {
      for (const t of this.towers) { t.synergy = 1; t.links = []; }
      for (const m of this.towers) {
        if (m.type !== 'miner' || m.sub !== 'B') continue;
        for (const n of this.neighbors(m)) {
          if (!NC.TOWERS[n.type].attacks) continue;
          n.synergy += NC.TOWERS.miner.subs.B.synergy;
          m.links.push(n);
        }
      }
    }

    rateMul(t, target) {
      return t.synergy * (target && target === this.focus && this.has('oc4') ? 1.2 : 1);
    }

    acquire(t, range) {
      const r2 = range * range;
      if (this.focus && !this.focus.dead && this.has('oc4')) {
        const f = this.focus;
        if ((f.wx - t.cx) ** 2 + (f.wy - t.cy) ** 2 <= r2) return f;
      }
      let best = null, bv = Infinity;
      const mode = t.targeting;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d2 = (e.wx - t.cx) ** 2 + (e.wy - t.cy) ** 2;
        if (d2 > r2) continue;
        let v;
        if (mode === 'first') v = e.prog;
        else if (mode === 'last') v = -e.prog;
        else if (mode === 'strong') v = -e.hp;
        else v = d2;
        if (v < bv) { bv = v; best = e; }
      }
      return best;
    }

    rollCrit() { return this.has('oc2') && Math.random() < 0.1; }

    updateTower(t, dt) {
      t.recoil = Math.max(0, t.recoil - dt * 6);
      t.hurt = Math.max(0, t.hurt - dt);
      if (t.disabled > 0) {
        t.disabled = Math.max(0, t.disabled - dt);
        return;
      }
      const s = NC.towerStats(t);
      if (t.type === 'pulse') {
        t.cd -= dt;
        const target = this.acquire(t, s.range);
        if (target) t.angle = Math.atan2(target.wy - t.cy, target.wx - t.cx);
        if (t.cd <= 0) {
          if (target) {
            this.firePulse(t, s, target);
            t.cd += 1 / (s.rate * this.rateMul(t, target));
          } else t.cd = 0;
        }
      } else if (t.type === 'rail') {
        const target = this.acquire(t, s.range);
        t.charge = Math.min(1, t.charge + dt * this.rateMul(t, target) / s.charge);
        if (target) {
          t.angle = Math.atan2(target.wy - t.cy, target.wx - t.cx);
          if (t.charge >= 1) { this.fireRail(t, s, target); t.charge = 0; }
        }
      }
    }

    firePulse(t, s, target) {
      const crit = this.rollCrit();
      const mul = crit ? 1.5 : 1;
      t.recoil = 1;
      const col = NC.towerColor(t);
      if (t.sub === 'B') {
        const base = Math.atan2(target.wy - t.cy, target.wx - t.cx);
        for (let k = 0; k < s.pellets; k++) {
          const a = base + (k / (s.pellets - 1) - 0.5) * s.spread;
          this.projectiles.push({
            kind: 'pellet', x: t.cx + Math.cos(a) * 0.35, y: t.cy + Math.sin(a) * 0.35,
            vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, life: s.range / 11 + 0.08,
            dmg: s.dmg * mul, crit, cat: 'aoe', color: col, tower: t
          });
        }
        sfx('scatter');
      } else {
        this.projectiles.push({
          kind: 'bolt', x: t.cx + Math.cos(t.angle) * 0.4, y: t.cy + Math.sin(t.angle) * 0.4,
          target, tx: target.wx, ty: target.wy, speed: 13,
          dmg: s.dmg * mul, crit, cat: 'rapid', shred: s.shred || 0, ignoreArmor: !!s.shred, color: col, tower: t
        });
        sfx('pulse');
      }
    }

    fireRail(t, s, target) {
      const crit = this.rollCrit();
      const mul = crit ? 1.5 : 1;
      const ang = Math.atan2(target.wy - t.cy, target.wx - t.cx);
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const len = s.range + 0.5;
      const col = NC.towerColor(t);
      const hits = [];
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rx = e.wx - t.cx, ry = e.wy - t.cy;
        const along = rx * dx + ry * dy;
        if (along < 0 || along > len) continue;
        const perp = Math.abs(rx * dy - ry * dx);
        if (perp <= 0.28 + e.size * 0.6) hits.push(e);
      }
      for (const e of hits) {
        const dealt = this.damage(e, s.dmg * mul, 'beam', { tower: t });
        if (!e.dead && s.execute && !e.def.boss && e.hp < e.maxHp * s.execute) {
          this.text(e.wx, e.wy - 0.4, 'EXECUTED', '#ff3355', 12);
          this.burst(e.wx, e.wy, '#ff3355', 12, 3);
          this.kill(e, t);
          sfx('exec');
        } else if (dealt > 0) {
          this.text(e.wx, e.wy - 0.35, (crit ? 'CRIT ' : '') + Math.round(dealt), crit ? '#ffe14d' : '#e9d5ff', crit ? 13 : 10);
        }
        this.burst(e.wx, e.wy, col, 6, 2.5);
      }
      if (s.refract) {
        const hitSet = new Set(hits);
        for (const e of hits) {
          const near = this.enemies
            .filter(o => !o.dead && !hitSet.has(o) && Math.hypot(o.wx - e.wx, o.wy - e.wy) <= s.refractRange)
            .sort((a, b) => Math.hypot(a.wx - e.wx, a.wy - e.wy) - Math.hypot(b.wx - e.wx, b.wy - e.wy))
            .slice(0, s.refract);
          for (const o of near) {
            hitSet.add(o);
            this.damage(o, s.dmg * s.refractMul * mul, 'beam', { tower: t });
            this.beams.push({ x0: e.wx, y0: e.wy, x1: o.wx, y1: o.wy, life: 0.25, max: 0.25, color: '#7df9ff', width: 3 });
            this.burst(o.wx, o.wy, '#7df9ff', 5, 2);
          }
        }
      }
      this.beams.push({ x0: t.cx + dx * 0.45, y0: t.cy + dy * 0.45, x1: t.cx + dx * len, y1: t.cy + dy * len, life: 0.32, max: 0.32, color: col, width: 7 });
      t.recoil = 1;
      this.shake = Math.max(this.shake, 2);
      sfx('rail');
    }

    applyFields(dt) {
      for (const e of this.enemies) { e.slow = 0; e.brittle = false; }
      for (const t of this.towers) {
        if (t.type !== 'cryo' || t.disabled > 0) continue;
        const s = NC.towerStats(t);
        const r2 = s.range * s.range;
        let freeze = false;
        if (s.freezeEvery) {
          t.freezeCd -= dt;
          if (t.freezeCd <= 0) {
            const any = this.enemies.some(e => !e.dead && (e.wx - t.cx) ** 2 + (e.wy - t.cy) ** 2 <= r2);
            if (any) {
              freeze = true;
              t.freezeCd = s.freezeEvery;
              this.ring(t.cx, t.cy, '#d8f3ff', s.range, 0.6, 4);
              this.burst(t.cx, t.cy, '#d8f3ff', 24, s.range * 2.5);
              sfx('freeze');
            } else t.freezeCd = 0;
          }
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if ((e.wx - t.cx) ** 2 + (e.wy - t.cy) ** 2 > r2) continue;
          e.slow = Math.max(e.slow, e.def.boss ? s.slow * 0.6 : s.slow);
          if (s.brittle) e.brittle = true;
          if (freeze) e.root = Math.max(e.root, e.def.boss ? s.freezeDur * 0.5 : s.freezeDur);
          this.damage(e, s.dps * dt, 'aoe', { ignoreArmor: true, dot: true, tower: t });
        }
      }
    }

    updateProjectiles(dt) {
      const ps = this.projectiles;
      let j = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        let alive = true;
        if (p.kind === 'bolt') {
          if (p.target && !p.target.dead) { p.tx = p.target.wx; p.ty = p.target.wy; }
          const dx = p.tx - p.x, dy = p.ty - p.y;
          const d = Math.hypot(dx, dy);
          const step = p.speed * dt;
          if (d <= step + 0.12) {
            alive = false;
            if (p.target && !p.target.dead) this.hitProjectile(p, p.target);
          } else {
            p.x += dx / d * step; p.y += dy / d * step;
            p.a = Math.atan2(dy, dx);
          }
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) alive = false;
          else {
            for (const e of this.enemies) {
              if (e.dead) continue;
              if (Math.hypot(e.wx - p.x, e.wy - p.y) <= e.size + 0.08) {
                this.hitProjectile(p, e);
                alive = false;
                break;
              }
            }
          }
        }
        if (alive) ps[j++] = p;
      }
      ps.length = j;
    }

    hitProjectile(p, e) {
      const dealt = this.damage(e, p.dmg, p.cat, { ignoreArmor: p.ignoreArmor, tower: p.tower });
      if (p.shred && !e.dead) e.armor = Math.max(0, e.armor - p.shred);
      this.burst(p.x, p.y, p.color, 3, 1.6);
      if (p.crit && dealt > 0) this.text(e.wx, e.wy - 0.35, 'CRIT ' + Math.round(dealt), '#ffe14d', 11);
    }

    // ------------------------------------------------------------ abilities
    killSwitchReady() { return this.has('oc5') && this.killSwitchCd <= 0 && this.state === 'playing'; }

    useKillSwitch() {
      if (!this.killSwitchReady()) return false;
      const targets = this.enemies.filter(e => !e.dead && !e.def.boss);
      this.killSwitchCd = 180;
      for (const e of targets) {
        e.noPayload = true; e.noEmp = true;
        this.fx.push({ type: 'strike', x: e.wx, y: e.wy, life: 0.7, max: 0.7, color: '#ff3b5c' });
        this.kill(e, null);
      }
      this.flash = 1; this.flashColor = '#ffffff';
      this.shake = Math.max(this.shake, 18);
      this.toast('☢ KILL SWITCH ENGAGED — ' + targets.length + (targets.length === 1 ? ' THREAT' : ' THREATS') + ' DELETED', 'boss');
      sfx('killswitch');
      return true;
    }

    startRewind() {
      this.restoreUsed = true;
      this.state = 'rewind';
      this.rewindT = 0;
      this.rewindDur = 2;
      this.projectiles.length = 0;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const sp = this.lv.spawns[e.spawn] || this.lv.spawns[0];
        e.jump = null; e.z = 0;
        e.rw = { x0: e.x, y0: e.y, x1: sp.x + 0.5, y1: sp.y + 0.5, sx: sp.x, sy: sp.y };
      }
      this.toast('◀◀ SYSTEM RESTORE — TIMELINE REWOUND', 'info');
      sfx('restore');
    }

    updateRewind(dt) {
      this.rewindT += dt;
      const u = NC.easeInOut(Math.min(1, this.rewindT / this.rewindDur));
      this.coreHp = Math.max(this.coreHp, Math.ceil(this.coreMax * 0.5 * u));
      for (const e of this.enemies) {
        if (!e.rw) continue;
        e.x = NC.lerp(e.rw.x0, e.rw.x1, u);
        e.y = NC.lerp(e.rw.y0, e.rw.y1, u);
        e.wx = e.x + e.ox; e.wy = e.y + e.oy;
      }
      if (this.rewindT >= this.rewindDur) {
        for (const e of this.enemies) {
          if (!e.rw) continue;
          e.tx = e.rw.sx; e.ty = e.rw.sy; e.x = e.tx + 0.5; e.y = e.ty + 0.5;
          e.rw = null;
          this.chooseNext(e);
        }
        this.coreHp = Math.ceil(this.coreMax * 0.5);
        this.state = 'playing';
      }
    }

    win() {
      if (this.state === 'won' || this.state === 'lost') return;
      this.state = 'won';
      this.events.push({ kind: 'end', won: true });
      sfx('victory');
    }

    lose() {
      if (this.state === 'won' || this.state === 'lost') return;
      this.state = 'lost';
      this.shake = 20;
      this.glitch = 1.5;
      this.events.push({ kind: 'end', won: false });
      sfx('defeat');
    }

    computeRewards(firstClear) {
      const lines = [];
      const won = this.state === 'won';
      const lv = this.lv;
      if (lv.endless) {
        lines.push(['Waves survived: ' + this.wavesCleared, Math.floor(this.wavesCleared / 2)]);
      } else if (won) {
        lines.push(['Sector secured', lv.reward]);
        const eff = this.coreHp / this.coreMax;
        lines.push(['Efficiency (' + Math.round(eff * 100) + '% integrity)', Math.round(eff * 4)]);
        if (this.stats.leaks === 0) lines.push(['Zero-breach bonus', 2]);
        if (firstClear) lines.push(['First clear bonus', 5]);
      } else {
        lines.push(['Partial data recovered (' + this.wavesCleared + ' waves)', Math.floor(this.wavesCleared / 3)]);
      }
      if (this.stats.bossKills) lines.push(['Boss-Ware purged ×' + this.stats.bossKills, this.stats.bossKills * 3]);
      const total = lines.reduce((a, l) => a + l[1], 0);
      return { lines, total };
    }

    // ------------------------------------------------------------ fx helpers
    burst(x, y, color, n, spd) {
      if (this.fx.length > 1400) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = Math.random() * spd;
        const life = rand(0.25, 0.6);
        this.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: rand(1.2, 2.6) });
      }
    }
    bits(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const life = rand(0.6, 1.1);
        this.fx.push({ type: 'bit', x: x + rand(-0.2, 0.2), y, vx: rand(-0.6, 0.6), vy: rand(-1.6, -0.6), life, max: life, color, ch: Math.random() < 0.5 ? '0' : '1' });
      }
    }
    ring(x, y, color, r, life, width) {
      this.fx.push({ type: 'ring', x, y, r, life, max: life, color, width: width || 2 });
    }
    text(x, y, str, color, size) {
      if (this.texts.length > 80) this.texts.shift();
      this.texts.push({ x, y, str, color, size: size || 11, life: 1, max: 1 });
    }

    updateFx(dt) {
      const fx = this.fx;
      let j = 0;
      for (let i = 0; i < fx.length; i++) {
        const p = fx[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        if (p.vx !== undefined) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = Math.max(0, 1 - 3 * dt);
          p.vx *= k; p.vy *= k;
        }
        fx[j++] = p;
      }
      fx.length = j;
      let k = 0;
      for (let i = 0; i < this.texts.length; i++) {
        const t = this.texts[i];
        t.life -= dt;
        t.y -= dt * 0.6;
        if (t.life > 0) this.texts[k++] = t;
      }
      this.texts.length = k;
      let b = 0;
      for (let i = 0; i < this.beams.length; i++) {
        const bm = this.beams[i];
        bm.life -= dt;
        if (bm.life > 0) this.beams[b++] = bm;
      }
      this.beams.length = b;
      for (const t of this.traps) t.t += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 1.8);
      this.hurt = Math.max(0, this.hurt - dt * 1.6);
      this.glitch = Math.max(0, this.glitch - dt);
      this.coreHit = Math.max(0, this.coreHit - dt * 2.5);
    }

    // ------------------------------------------------------------ main step
    update(dt) {
      if (this.state === 'won' || this.state === 'lost') { this.updateFx(dt); return; }
      this.time += dt;
      if (this.state === 'rewind') { this.updateRewind(dt); this.updateFx(dt); return; }

      this.killSwitchCd = Math.max(0, this.killSwitchCd - dt);
      this.updateWaves(dt);
      this.applyFields(dt);
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead) continue;
        this.updateEnemy(e, dt);
        if (this.state !== 'playing') break;
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        e.wx = e.x + e.ox; e.wy = e.y + e.oy;
        e.prog = this.dist[e.ny * COLS + e.nx] + Math.hypot(e.nx + 0.5 - e.x, e.ny + 0.5 - e.y);
        if (e.def.jump) {
          e.trailT -= dt;
          if (e.trailT <= 0) {
            e.trailT = 0.045;
            e.trail.unshift({ x: e.wx, y: e.wy - e.z });
            if (e.trail.length > 6) e.trail.pop();
          }
        }
      }
      if (this.state !== 'playing') { this.updateFx(dt); return; }
      for (const t of this.towers) this.updateTower(t, dt);
      this.updateProjectiles(dt);
      this.processDeaths();
      if (this.enemies.some(e => e.dead)) this.enemies = this.enemies.filter(e => !e.dead);
      if (this.focus && this.focus.dead) this.focus = null;
      this.updateFx(dt);
    }
  }

  NC.Game = Game;
})(globalThis.NC = globalThis.NC || {});
