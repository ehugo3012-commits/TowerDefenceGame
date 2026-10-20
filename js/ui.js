/* Neon Cortex — DOM interface: screens, HUD, side panel, modals and input. */
(function (NC) {
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const sfx = n => NC.Audio.play(n);
  const COLS = NC.COLS;
  const MK = ['', 'MK-I', 'MK-II', 'MK-III'];
  const TARGET_MODES = [['first', 'First'], ['last', 'Last'], ['strong', 'Strong'], ['close', 'Close']];

  function setText(el, v) {
    if (el._v !== v) { el._v = v; el.textContent = v; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const UI = {
    game: null, level: null, renderer: null, menuBg: null, screen: 'menu',
    paused: false, speed: 1, buildType: null, selTower: null, selEnemy: null, hover: null,
    infoKey: '', waveKey: '', previewN: -1, ended: false, endAt: 0, modalKind: null,

    init() {
      NC.Save.load();
      const st = NC.Save.data.settings;
      NC.Audio.setVolumes(st.music, st.sfx);
      NC.Audio.muted = !!st.muted;
      this.renderer = new NC.Renderer($('#game'));
      this.menuBg = new NC.MenuBG($('#bg'));

      document.addEventListener('click', e => {
        const b = e.target.closest('[data-action]');
        if (b) { sfx('click'); this.action(b.dataset.action, b); }
      });
      const unlock = () => { NC.Audio.init(); NC.Audio.startMusic(); };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('resize', () => this.onResize());
      window.addEventListener('keydown', e => this.onKey(e));
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.screen === 'game' && this.game && !this.ended && !this.modalKind) this.openPause();
      });
      this.bindGame();
      this.updateMuteBtn();
      this.show('menu');
    },

    // ------------------------------------------------------------ navigation
    action(name, el) {
      switch (name) {
        case 'menu': this.show('menu'); break;
        case 'sectors': this.closeModal(); this.show('sectors'); break;
        case 'skills': this.closeModal(); this.show('skills'); break;
        case 'briefing': this.openBriefing(false); break;
        case 'settings': this.openSettings(); break;
        case 'respec': this.confirmRespec(); break;
        case 'do-respec': NC.Save.respec(); this.closeModal(); this.renderSkills(); this.refreshFrags(); sfx('sell'); break;
        case 'close-modal': this.closeModal(); break;
        case 'resume': this.closeModal(); break;
        case 'restart': if (this.level) this.startLevel(this.level); break;
        case 'abandon': this.closeModal(); this.game = null; this.show('sectors'); break;
        case 'start-level': {
          const lv = NC.LEVELS.find(l => l.id === el.dataset.id);
          if (lv) this.startLevel(lv);
          break;
        }
        case 'reset-progress': this.confirmReset(); break;
        case 'do-reset': NC.Save.reset(); this.closeModal(); this.show('menu'); break;
      }
    },

    show(name) {
      this.screen = name;
      $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + name));
      this.refreshFrags();
      if (name === 'sectors') this.renderSectors();
      if (name === 'skills') this.renderSkills();
      if (name !== 'game') {
        this.game = null;
        NC.Audio.setIntensity(0);
      }
      $('#bg').style.display = name === 'game' ? 'none' : 'block';
      this.onResize();
    },

    refreshFrags() {
      $$('.frag-count').forEach(el => { el.textContent = NC.Save.data.fragments; });
    },

    onResize() {
      this.menuBg.resize();
      if (this.screen === 'game') {
        const r = $('#canvas-wrap').getBoundingClientRect();
        this.renderer.resize(Math.max(100, r.width - 16), Math.max(60, r.height - 16));
      }
    },

    // ------------------------------------------------------------ sectors
    renderSectors() {
      const list = $('#sector-list');
      list.innerHTML = '';
      NC.LEVELS.forEach(lv => {
        const unlocked = NC.Save.isUnlocked(lv);
        const rec = NC.Save.levelRecord(lv.id);
        let badge;
        if (!unlocked) badge = '<span class="badge lock">🔒 LOCKED</span> <span class="hint">' + (lv.endless ? 'Secure Sector 02 to unlock' : 'Secure the previous sector') + '</span>';
        else if (lv.endless) badge = rec ? '<span class="badge">BEST: WAVE ' + rec.bestWave + '</span>' : '<span class="badge new">UNCHARTED</span>';
        else if (rec && rec.cleared) badge = '<span class="badge">✔ SECURED · BEST INTEGRITY ' + rec.bestIntegrity + '%</span>';
        else badge = '<span class="badge new">' + (rec ? 'NOT YET SECURED' : 'NEW') + '</span>';
        const card = document.createElement('div');
        card.className = 'sector-card' + (unlocked ? '' : ' locked') + (lv.endless ? ' endless' : '');
        card.innerHTML =
          '<div class="code"><span>' + esc(lv.code) + '</span><span class="threat" title="Threat level">' + '▲'.repeat(lv.threat) + '△'.repeat(5 - lv.threat) + '</span></div>' +
          '<h3>' + esc(lv.name) + '</h3><canvas></canvas><p>' + esc(lv.desc) + '</p>' +
          '<div class="sector-meta"><span><em>Waves</em> ' + (lv.endless ? '∞' : lv.waves) + '</span>' +
          '<span><em>Breach points</em> ' + lv.spawns.length + '</span>' +
          '<span><em>Reward</em> ◆ ' + (lv.endless ? '1 per 2 waves' : lv.reward + '+') + '</span></div>' +
          '<div>' + badge + '</div>';
        card.addEventListener('click', () => {
          if (unlocked) { sfx('click'); this.startLevel(lv); } else sfx('error');
        });
        list.appendChild(card);
        this.drawMiniMap(card.querySelector('canvas'), lv);
      });
    },

    drawMiniMap(cv, lv) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const s = 10;
      cv.width = 26 * s * dpr; cv.height = 15 * s * dpr;
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      const m = NC.buildMap(lv);
      ctx.fillStyle = '#03050b';
      ctx.fillRect(0, 0, 26 * s, 15 * s);
      for (let y = 0; y < NC.ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const g = m.grid[y * COLS + x];
          if (g === NC.TILE_GATE) { ctx.fillStyle = 'rgba(130,100,255,0.16)'; ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3); }
        }
      }
      ctx.shadowColor = '#00c8ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(0,220,255,0.85)';
      for (let y = 0; y < NC.ROWS; y++) for (let x = 0; x < COLS; x++) if (m.grid[y * COLS + x] === NC.TILE_PATH) ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      for (let y = 0; y < NC.ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (m.grid[y * COLS + x] !== NC.TILE_PATH) continue;
          if (x + 1 < COLS && m.grid[y * COLS + x + 1] === NC.TILE_PATH) ctx.fillRect(x * s + s - 2, y * s + 3, 4, s - 6);
          if (y + 1 < NC.ROWS && m.grid[(y + 1) * COLS + x] === NC.TILE_PATH) ctx.fillRect(x * s + 3, y * s + s - 2, s - 6, 4);
        }
      }
      ctx.shadowColor = '#ff2a4a';
      ctx.fillStyle = '#ff2a4a';
      lv.spawns.forEach(sp => ctx.fillRect(sp.x * s, sp.y * s, s, s));
      ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc((lv.core.x + 0.5) * s, (lv.core.y + 0.5) * s, s * 0.7, 0, Math.PI * 2); ctx.fill();
    },

    // ------------------------------------------------------------ skill tree
    renderSkills() {
      const tree = $('#skill-tree');
      tree.innerHTML = '';
      const frags = NC.Save.data.fragments;
      NC.SKILL_BRANCHES.forEach(b => {
        const col = document.createElement('div');
        col.className = 'branch';
        col.style.setProperty('--bc', b.color);
        const owned = b.nodes.filter(n => NC.Save.has(n.id)).length;
        col.innerHTML = '<div class="branch-head"><div class="icon">' + b.icon + '</div><h3>' + esc(b.name) + '</h3><small>' + esc(b.tag) + '</small>' +
          '<div class="branch-progress"><div style="width:' + (owned / b.nodes.length * 100) + '%"></div></div></div>';
        const nodes = document.createElement('div');
        nodes.className = 'nodes';
        const prog = owned ? Math.min(100, (owned - 0.5) / (b.nodes.length - 1) * 100) : 0;
        nodes.style.setProperty('--prog', prog + '%');
        col.appendChild(nodes);
        b.nodes.forEach((n, i) => {
          const sk = NC.SKILLS[n.id];
          const has = NC.Save.has(n.id);
          const avail = !has && (!sk.prev || NC.Save.has(sk.prev));
          const node = document.createElement('div');
          node.className = 'skill-node' + (has ? ' owned' : avail ? ' available' : ' locked') + (avail && frags < n.cost ? ' poor' : '') + (n.apex ? ' apex' : '');
          node.innerHTML = '<div class="hex">' + (has ? '✔' : n.apex ? '★' : (i + 1)) + '</div>' +
            '<div class="tier">' + (n.apex ? 'APEX NODE' : 'TIER ' + (sk.tier + 1)) + '</div>' +
            '<div class="name">' + esc(n.name) + '</div>' +
            '<div class="desc">' + esc(n.desc) + '</div>' +
            '<div class="cost">' + (has ? 'INSTALLED' : '◆ ' + n.cost + (avail ? (frags < n.cost ? ' — insufficient fragments' : ' — click to install') : ' — requires previous node')) + '</div>';
          node.addEventListener('click', () => {
            if (NC.Save.unlock(n.id)) {
              sfx('unlock');
              this.renderSkills();
              this.refreshFrags();
            } else if (!has) sfx('error');
          });
          nodes.appendChild(node);
        });
        tree.appendChild(col);
      });
    },

    confirmRespec() {
      const spent = NC.Save.spent();
      this.openModal('confirm',
        '<h2>Respec Skill Tree?</h2><p>All installed nodes will be uninstalled and <b>◆ ' + spent + '</b> Memory Fragments refunded.</p>' +
        '<div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" data-action="do-respec">Respec</button></div>');
    },

    confirmReset() {
      this.openModal('confirm',
        '<h2 class="lose">Wipe All Progress?</h2><p>This permanently erases your Memory Fragments, skill tree and sector records.</p>' +
        '<div class="modal-actions"><button class="btn ghost" data-action="settings">Cancel</button><button class="btn danger" data-action="do-reset">Wipe Progress</button></div>');
    },

    // ------------------------------------------------------------ match lifecycle
    startLevel(lv) {
      this.closeModal(true);
      this.level = lv;
      this.game = new NC.Game(lv, NC.Save.data.skills);
      this.game.autoWave = $('#chk-auto').checked;
      this.renderer.setGame(this.game);
      this.paused = false;
      this.ended = false;
      this.endAt = 0;
      this.buildType = null;
      this.selTower = null;
      this.selEnemy = null;
      this.hover = null;
      this.infoKey = '';
      this.waveKey = '';
      this.previewN = -1;
      $('#toasts').innerHTML = '';
      $('#hud-code').textContent = lv.code;
      $('#hud-sector').textContent = lv.name;
      $('#btn-kill').classList.toggle('hidden', !this.game.has('oc5'));
      this.show('game');
      this.buildBuildList();
      this.setSpeed(1);
      NC.Audio.setIntensity(1);
      this.toast(lv.code + ' — ' + lv.name.toUpperCase(), 'wave');
      if (this.game.openSource) this.toast('OPEN SOURCE ARCHITECTURE: BUILD ANYWHERE', 'gold');
      if (!NC.Save.data.seenBriefing) {
        NC.Save.data.seenBriefing = true;
        NC.Save.write();
        this.openBriefing(true);
      }
    },

    onEnd(won) {
      this.ended = true;
      const g = this.game, lv = this.level;
      const rewards = NC.Save.recordResult(lv, g);
      this.refreshFrags();
      const idx = NC.LEVELS.indexOf(lv);
      const next = NC.LEVELS[idx + 1];
      const nextOk = won && next && NC.Save.isUnlocked(next);
      let title, cls;
      if (lv.endless) { title = 'BREACH OVERRAN — WAVE ' + g.waveNum; cls = 'lose'; }
      else if (won) { title = 'SECTOR SECURED'; cls = 'win'; }
      else { title = 'KERNEL COMPROMISED'; cls = 'lose'; }
      const stat = (l, v) => '<div><label>' + l + '</label><span>' + v + '</span></div>';
      const html =
        '<h2 class="' + cls + '">' + title + '</h2>' +
        '<div class="modal-sub">' + esc(lv.code) + ' — ' + esc(lv.name) + '</div>' +
        '<div class="stat-grid">' +
        stat('WAVES CLEARED', g.wavesCleared) +
        stat('MALWARE PURGED', NC.fmt(g.stats.kills)) +
        stat('CORE INTEGRITY', Math.round(g.coreHp / g.coreMax * 100) + '%') +
        stat('BANDWIDTH EARNED', NC.fmt(g.stats.earned)) +
        stat('TOWERS BUILT', g.stats.built) +
        '</div>' +
        '<h4>MEMORY FRAGMENTS RECOVERED</h4>' +
        '<ul class="reward-list">' + rewards.lines.map(l => '<li><span>' + esc(l[0]) + '</span><span>◆ +' + l[1] + '</span></li>').join('') + '</ul>' +
        '<div class="reward-total"><span>TOTAL</span><span>◆ +' + rewards.total + '</span></div>' +
        '<p class="hint">Balance: ◆ ' + NC.Save.data.fragments + ' — invest them in the Prime Skill Tree for permanent upgrades.</p>' +
        '<div class="modal-actions">' +
        (nextOk ? '<button class="btn primary" data-action="start-level" data-id="' + next.id + '">▶ Next: ' + esc(next.name) + '</button>' : '') +
        '<button class="btn" data-action="restart">↻ ' + (won ? 'Replay' : 'Retry') + '</button>' +
        '<button class="btn gold" data-action="skills">⬡ Skill Tree</button>' +
        '<button class="btn ghost" data-action="sectors">Sectors</button>' +
        '</div>';
      this.openModal('end', html);
      NC.Audio.setIntensity(0);
    },

    // ------------------------------------------------------------ in-game controls
    bindGame() {
      const cv = $('#game');
      const toHover = e => {
        const w = this.renderer.toWorld(e.clientX, e.clientY);
        this.hover = { x: w.x, y: w.y, tx: Math.floor(w.x), ty: Math.floor(w.y) };
        return w;
      };
      cv.addEventListener('pointermove', e => { if (this.game) toHover(e); });
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.hover = null; });
      cv.addEventListener('pointerdown', e => { if (this.game) this.onCanvasDown(e, toHover(e)); });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      $('#btn-wave').addEventListener('click', () => {
        if (this.game && this.game.callWave()) { this.waveKey = ''; sfx('click'); }
      });
      $('#chk-auto').addEventListener('change', e => { if (this.game) this.game.autoWave = e.target.checked; });
      $$('[data-speed]').forEach(b => b.addEventListener('click', () => { sfx('click'); this.setSpeed(+b.dataset.speed); }));
      $('#btn-pause').addEventListener('click', () => { sfx('click'); this.openPause(); });
      $('#btn-mute').addEventListener('click', () => this.toggleMute());
      $('#btn-kill').addEventListener('click', () => { if (this.game) this.game.useKillSwitch(); });
      $('#info-panel').addEventListener('click', e => this.onInfoClick(e));
    },

    onCanvasDown(e, w) {
      const g = this.game;
      if (this.paused || this.ended) return;
      if (e.button === 2) { this.cancel(); return; }
      const tx = Math.floor(w.x), ty = Math.floor(w.y);
      if (this.buildType) {
        if (g.canPlace(tx, ty)) {
          const t = g.placeTower(this.buildType, tx, ty);
          if (t && !e.shiftKey) { this.buildType = null; this.updateBuildCards(); }
        } else {
          const ex = g.inb(tx, ty) ? g.towerGrid[ty * COLS + tx] : null;
          if (ex) { this.buildType = null; this.selTower = ex; this.updateBuildCards(); sfx('click'); }
          else sfx('error');
        }
        this.infoKey = '';
        return;
      }
      let best = null, bd = Infinity;
      for (const en of g.enemies) {
        if (en.dead) continue;
        const d = Math.hypot(en.wx - w.x, en.wy - en.z - w.y);
        if (d < en.size + 0.3 && d < bd) { bd = d; best = en; }
      }
      if (best) {
        this.selEnemy = best;
        this.selTower = null;
        if (g.has('oc4')) g.focus = g.focus === best ? null : best;
        sfx('click');
        this.infoKey = '';
        return;
      }
      const t = g.inb(tx, ty) ? g.towerGrid[ty * COLS + tx] : null;
      if (t) { this.selTower = t === this.selTower ? null : t; this.selEnemy = null; sfx('click'); }
      else { this.selTower = null; this.selEnemy = null; }
      this.infoKey = '';
    },

    cancel() {
      this.buildType = null;
      this.selTower = null;
      this.selEnemy = null;
      this.updateBuildCards();
      this.infoKey = '';
    },

    selectBuild(id) {
      if (!this.game || this.ended) return;
      this.buildType = this.buildType === id ? null : id;
      this.selTower = null;
      this.selEnemy = null;
      sfx('click');
      this.updateBuildCards();
      this.infoKey = '';
    },

    setSpeed(n) {
      this.speed = n;
      $$('[data-speed]').forEach(b => b.classList.toggle('active', +b.dataset.speed === n));
    },

    toggleMute() {
      const m = !NC.Audio.muted;
      NC.Audio.setMuted(m);
      NC.Save.data.settings.muted = m;
      NC.Save.write();
      this.updateMuteBtn();
    },

    updateMuteBtn() {
      const b = $('#btn-mute');
      b.textContent = NC.Audio.muted ? '✕♪' : '♪';
      b.classList.toggle('active', NC.Audio.muted);
    },

    onKey(e) {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
      const k = e.key;
      if (this.modalKind) {
        if (k === 'Escape') {
          if (this.modalKind === 'pause' || this.modalKind === 'briefing' || this.modalKind === 'settings' || this.modalKind === 'confirm') this.closeModal();
        }
        return;
      }
      if (this.screen !== 'game' || !this.game) {
        if (k === 'Escape' && this.screen !== 'menu') this.show('menu');
        return;
      }
      const g = this.game;
      const idx = ['1', '2', '3', '4'].indexOf(k);
      if (idx >= 0) { this.selectBuild(NC.TOWER_ORDER[idx]); return; }
      switch (k) {
        case 'Escape':
          if (this.buildType || this.selTower || this.selEnemy) this.cancel(); else this.openPause();
          break;
        case ' ':
          e.preventDefault();
          if (g.callWave()) this.waveKey = '';
          break;
        case 'p': case 'P': this.openPause(); break;
        case 'u': case 'U':
          if (this.selTower && this.selTower.level < 3) { g.upgradeTower(this.selTower); this.infoKey = ''; }
          break;
        case 's': case 'S': case 'Delete': case 'Backspace':
          if (this.selTower) { g.sellTower(this.selTower); this.selTower = null; this.infoKey = ''; }
          break;
        case 'f': case 'F': this.setSpeed(this.speed % 3 + 1); break;
        case 'k': case 'K': g.useKillSwitch(); break;
        case 'm': case 'M': this.toggleMute(); break;
      }
    },

    // ------------------------------------------------------------ build list
    buildBuildList() {
      const list = $('#build-list');
      list.innerHTML = '';
      NC.TOWER_ORDER.forEach(id => {
        const d = NC.TOWERS[id];
        const b = document.createElement('button');
        b.className = 'build-card';
        b.dataset.type = id;
        b.style.setProperty('--tc', d.color);
        b.title = d.name + ' — ' + d.desc;
        b.innerHTML = '<span class="key">' + d.hotkey + '</span><canvas></canvas><span class="nm">' + esc(d.name) + '</span><span class="cost">◈ ' + d.levels[0].cost + '</span>';
        NC.drawIcon(b.querySelector('canvas'), 'tower', id, { size: 40 });
        b.addEventListener('click', () => this.selectBuild(id));
        list.appendChild(b);
      });
      this.updateBuildCards();
    },

    updateBuildCards() {
      const g = this.game;
      $$('.build-card').forEach(b => {
        b.classList.toggle('active', b.dataset.type === this.buildType);
        if (g) b.classList.toggle('poor', g.bw < NC.TOWERS[b.dataset.type].levels[0].cost);
      });
    },

    // ------------------------------------------------------------ info panel
    infoSignature() {
      const g = this.game;
      const t = this.selTower;
      if (t) {
        const c1 = g.upgradeCost(t, 'A'), c2 = t.level === 3 ? g.upgradeCost(t, 'B') : 0;
        return ['t', t.id, t.level, t.sub, t.targeting, t.disabled > 0, t.discount, t.synergy, t.wavesLeft, g.bw >= c1, g.bw >= c2, g.focus ? 1 : 0].join('|');
      }
      if (this.selEnemy) return 'e|' + this.selEnemy.id + '|' + (g.focus === this.selEnemy);
      if (this.buildType) return 'b|' + this.buildType + '|' + (g.bw >= NC.TOWERS[this.buildType].levels[0].cost);
      return 'none|' + g.has('oc4') + g.openSource;
    },

    statRows(t, s, next) {
      const row = (label, v, nv, fmt) => {
        fmt = fmt || (x => x);
        const nvs = nv != null && nv !== v ? ' <span class="up">→ ' + fmt(nv) + '</span>' : '';
        return '<dt>' + label + '</dt><dd>' + fmt(v) + nvs + '</dd>';
      };
      const n = next || {};
      let h = '';
      if (t.type === 'pulse') {
        const pel = s.pellets ? ' ×' + s.pellets : '';
        h += row('Damage', s.dmg + pel, n.dmg != null ? n.dmg + (n.pellets ? ' ×' + n.pellets : '') : null);
        h += row('Fire rate', (s.rate * (t.synergy || 1)).toFixed(1) + '/s', n.rate != null ? (n.rate * (t.synergy || 1)).toFixed(1) + '/s' : null);
        h += row('Range', s.range, n.range);
        h += row('DPS', Math.round(s.dmg * s.rate * (s.pellets || 1) * (t.synergy || 1) * 0.85), n.dmg != null ? Math.round(n.dmg * n.rate * (n.pellets || 1) * (t.synergy || 1) * 0.85) : null);
      } else if (t.type === 'rail') {
        h += row('Beam damage', s.dmg, n.dmg);
        h += row('Charge time', (s.charge / (t.synergy || 1)).toFixed(2) + 's', n.charge != null ? (n.charge / (t.synergy || 1)).toFixed(2) + 's' : null);
        h += row('Range', s.range, n.range);
        h += row('Pierce', 'unlimited');
      } else if (t.type === 'cryo') {
        h += row('Slow', Math.round(s.slow * 100) + '%', n.slow != null ? Math.round(n.slow * 100) + '%' : null);
        h += row('Field radius', s.range, n.range);
        h += row('Field DPS', s.dps, n.dps);
      } else if (t.type === 'miner') {
        h += row('Income / wave', '◈ ' + s.income, n.income != null ? '◈ ' + n.income : null);
      }
      return h;
    },

    renderInfo() {
      const g = this.game;
      const p = $('#info-panel');
      const t = this.selTower, en = this.selEnemy;
      if (t) {
        const d = NC.TOWERS[t.type];
        const s = NC.towerStats(t);
        const col = NC.towerColor(t);
        const lvl = t.level <= 3 ? MK[t.level] : d.subs[t.sub].name.toUpperCase();
        const next = t.level < 3 ? d.levels[t.level] : null;
        let h = '<div class="info-head"><canvas></canvas><div><div class="t" style="color:' + col + '">' + esc(d.name) + '</div><div class="s">' + lvl + ' · ' + esc(d.role.toUpperCase()) + '</div></div></div>';
        h += '<p class="info-desc">' + esc(t.sub ? d.subs[t.sub].desc : d.desc) + '</p>';
        h += '<dl class="stats">' + this.statRows(t, s, next);
        if (d.attacks || t.type === 'cryo') h += '<dt>Kills</dt><dd id="ti-kills">0</dd><dt>Damage dealt</dt><dd id="ti-dealt">0</dd>';
        if (g.openSource) h += '<dt>Hull</dt><dd id="ti-hp"></dd>';
        h += '</dl>';
        if (t.disabled > 0) h += '<div class="status-line bad">🔒 ENCRYPTED BY RANSOMWARE — OFFLINE</div>';
        if (t.synergy > 1) h += '<div class="status-line good">⚡ SYNERGY LINK +' + Math.round((t.synergy - 1) * 100) + '% FIRE RATE</div>';
        if (t.discount < 1) h += '<div class="status-line good">SPATIAL EFFICIENCY: −' + Math.round((1 - t.discount) * 100) + '% NEXT UPGRADE</div>';
        if (t.type === 'miner' && t.sub === 'A') h += '<div class="status-line gold">⚠ SELF-DESTRUCTS IN ' + t.wavesLeft + ' WAVE' + (t.wavesLeft === 1 ? '' : 'S') + '</div>';
        if (t.type === 'miner' && t.sub === 'B') h += '<div class="status-line good">LINKED TOWERS: ' + t.links.length + '</div>';
        if (d.attacks) {
          h += '<div class="target-row">' + TARGET_MODES.map(m => '<button class="btn small' + (t.targeting === m[0] ? ' active' : '') + '" data-ui="target" data-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>';
          if (g.has('oc4')) h += '<div class="hint" style="margin:-4px 0 8px">Focus Fire overrides targeting when the marked enemy is in range.</div>';
        }
        h += '<div class="info-actions">';
        if (t.level < 3) {
          const c = g.upgradeCost(t);
          h += '<button class="btn" data-ui="upgrade"' + (g.bw < c ? ' disabled' : '') + '><span>▲ Upgrade to ' + MK[t.level + 1] + ' [U]</span><span>◈ ' + c + '</span></button>';
        } else if (t.level === 3) {
          h += '<div class="hint" style="margin-bottom:2px">Choose a specialised subroutine:</div><div class="sub-choice">';
          for (const k of ['A', 'B']) {
            const sd = d.subs[k];
            const c = g.upgradeCost(t, k);
            h += '<button class="sub-card" style="--sc:' + sd.color + '" data-ui="sub" data-sub="' + k + '"' + (g.bw < c ? ' disabled' : '') + '>' +
              '<canvas data-sub="' + k + '"></canvas><span class="nm">' + k + ': ' + esc(sd.name) + '</span><span class="ds">' + esc(sd.desc) + '</span><span class="cost">◈ ' + c + '</span></button>';
          }
          h += '</div>';
        }
        h += '<button class="btn danger" data-ui="sell"><span>✖ Sell [S]</span><span>+◈ ' + g.sellValue(t) + '</span></button>';
        h += '</div>';
        p.innerHTML = h;
        NC.drawIcon(p.querySelector('.info-head canvas'), 'tower', t.type, { size: 42, level: t.level, sub: t.sub });
        p.querySelectorAll('canvas[data-sub]').forEach(c => NC.drawIcon(c, 'tower', t.type, { size: 34, level: 4, sub: c.dataset.sub }));
      } else if (en) {
        const d = en.def;
        let h = '<div class="info-head"><canvas></canvas><div><div class="t" style="color:' + d.color + '">' + esc(d.name) + '</div><div class="s">MALWARE' + (en.wave ? ' · WAVE ' + en.wave.n : '') + '</div></div></div>';
        h += '<p class="info-desc">' + esc(d.desc) + '</p>';
        h += '<dl class="stats"><dt>Integrity</dt><dd id="ei-hp"></dd><dt>Armor</dt><dd id="ei-armor"></dd>' +
          '<dt>Speed</dt><dd>' + d.speed + ' tiles/s</dd><dt>Core damage</dt><dd>' + d.coreDmg + '</dd><dt>Bounty</dt><dd>◈ ' + en.reward + '</dd></dl>';
        if (en.vuln > 1) h += '<div class="status-line good">FEEDBACK LOOP: SIGNATURE LOGGED (+10% DMG TAKEN)</div>';
        if (d.adapt) {
          h += '<div class="hint">ADAPTIVE RESISTANCES</div><div class="resist-bars">' +
            ['rapid', 'beam', 'aoe'].map(c => '<div class="rb" style="color:' + NC.DAMAGE_CATS[c].color + '">' + NC.DAMAGE_CATS[c].name + ' <span id="er-' + c + '"></span> <small style="color:var(--muted)">(' + NC.DAMAGE_CATS[c].hint + ')</small><div><i id="eb-' + c + '" style="background:' + NC.DAMAGE_CATS[c].color + '"></i></div></div>').join('') + '</div>';
        }
        if (g.has('oc4')) {
          h += g.focus === en ? '<div class="status-line bad">◎ FOCUS FIRE TARGET — towers +20% fire rate</div>' : '<div class="hint">Click this enemy again to mark it for Focus Fire.</div>';
        }
        p.innerHTML = h;
        NC.drawIcon(p.querySelector('.info-head canvas'), 'enemy', en.type, { size: 42 });
      } else if (this.buildType) {
        const d = NC.TOWERS[this.buildType];
        const fake = { type: this.buildType, level: 1, synergy: 1 };
        let h = '<div class="info-head"><canvas></canvas><div><div class="t" style="color:' + d.color + '">' + esc(d.name) + '</div><div class="s">DEPLOYING · ' + esc(d.role.toUpperCase()) + '</div></div></div>';
        h += '<p class="info-desc">' + esc(d.desc) + '</p><dl class="stats">' + this.statRows(fake, d.levels[0], null) + '<dt>Cost</dt><dd>◈ ' + d.levels[0].cost + '</dd></dl>';
        h += '<div class="hint">Subroutines at MK-III: <b>' + esc(d.subs.A.name) + '</b> or <b>' + esc(d.subs.B.name) + '</b>.</div>';
        h += '<p class="info-empty" style="margin-top:10px">Click a <b>logic gate</b> to deploy' + (g.openSource ? ' — or anywhere, including the data stream to force a reroute' : '') + '. <kbd>Shift</kbd>-click to place several. <kbd>Esc</kbd> / right-click cancels.</p>';
        p.innerHTML = h;
        NC.drawIcon(p.querySelector('.info-head canvas'), 'tower', this.buildType, { size: 42 });
      } else {
        p.innerHTML = '<h3>ARCHITECT CONSOLE</h3><div class="info-empty">' +
          'Select a tower above (<kbd>1</kbd>–<kbd>4</kbd>) and click a glowing <b>logic gate</b> beside the data stream to deploy it.<br><br>' +
          'Click a tower to upgrade it to <b>MK-III</b>, then choose subroutine <b>A</b> or <b>B</b>.<br><br>' +
          'Click malware to inspect it' + (g.has('oc4') ? ' and mark it for <b>Focus Fire</b>' : '') + '.<br><br>' +
          '<kbd>Space</kbd> initiate wave · <kbd>F</kbd> speed · <kbd>P</kbd> pause' + (g.has('oc5') ? ' · <kbd>K</kbd> Kill Switch' : '') + '</div>';
      }
    },

    updateInfoLive() {
      const g = this.game;
      const t = this.selTower, en = this.selEnemy;
      const p = $('#info-panel');
      if (t) {
        const k = p.querySelector('#ti-kills'); if (k) setText(k, String(t.kills));
        const dd = p.querySelector('#ti-dealt'); if (dd) setText(dd, NC.fmt(t.dealt));
        const hp = p.querySelector('#ti-hp'); if (hp) setText(hp, Math.ceil(t.hp) + ' / ' + t.maxHp);
      } else if (en) {
        const hp = p.querySelector('#ei-hp'); if (hp) setText(hp, NC.fmt(Math.max(0, en.hp)) + ' / ' + NC.fmt(en.maxHp));
        const ar = p.querySelector('#ei-armor'); if (ar) setText(ar, en.armor.toFixed(1).replace('.0', ''));
        if (en.def.adapt) {
          for (const c of ['rapid', 'beam', 'aoe']) {
            const s = p.querySelector('#er-' + c); if (s) setText(s, Math.round(en.resist[c] * 100) + '%');
            const b = p.querySelector('#eb-' + c); if (b) b.style.width = (en.resist[c] / 0.6 * 100) + '%';
          }
        }
      }
      void g;
    },

    onInfoClick(e) {
      const b = e.target.closest('[data-ui]');
      if (!b || !this.game || !this.selTower || b.disabled) return;
      const g = this.game, t = this.selTower;
      switch (b.dataset.ui) {
        case 'upgrade': g.upgradeTower(t); break;
        case 'sub': g.upgradeTower(t, b.dataset.sub); break;
        case 'sell': g.sellTower(t); this.selTower = null; break;
        case 'target': t.targeting = b.dataset.mode; sfx('click'); break;
      }
      this.infoKey = '';
    },

    // ------------------------------------------------------------ HUD / waves
    refreshWave() {
      const g = this.game;
      const active = g.activeWaves() > 0;
      const key = g.waveNum + '|' + active + '|' + g.state;
      if (key === this.waveKey) return;
      this.waveKey = key;
      const btn = $('#btn-wave');
      const prev = $('#wave-preview');
      if (g.waveNum >= g.totalWaves) {
        btn.disabled = true;
        btn.textContent = 'ALL WAVES DEPLOYED';
        btn.classList.remove('pulse');
        prev.innerHTML = '<span class="hint">Purge the remaining malware to secure the sector.</span>';
        $('#wave-tag').textContent = '';
        return;
      }
      const n = g.waveNum + 1;
      btn.disabled = g.state !== 'playing';
      btn.innerHTML = active ? '⏩ Call Wave ' + n + ' Early <small style="color:var(--gold)">+' + (10 + 2 * n) + ' BW</small>' : '▶ Initiate Wave ' + n + ' <small style="opacity:.6">[Space]</small>';
      btn.classList.toggle('pulse', !active && g.state === 'playing');
      if (this.previewN !== n) {
        this.previewN = n;
        const def = g.nextWavePreview();
        prev.innerHTML = '';
        NC.waveSummary(def).forEach(it => {
          const el = document.createElement('div');
          el.className = 'wp-item';
          el.title = NC.ENEMIES[it.type].name;
          el.innerHTML = '<canvas></canvas><span>×' + it.count + '</span>';
          NC.drawIcon(el.querySelector('canvas'), 'enemy', it.type, { size: 26 });
          prev.appendChild(el);
        });
        $('#wave-tag').textContent = def.boss ? '⚠ BOSS-WARE' : 'HP ×' + def.hpMul.toFixed(2);
      }
    },

    tickHud(dt) {
      const g = this.game;
      setText($('#hud-core'), Math.ceil(g.coreHp) + ' / ' + g.coreMax);
      const cb = $('#hud-core-bar');
      const w = Math.max(0, g.coreHp / g.coreMax * 100).toFixed(1) + '%';
      if (cb._w !== w) { cb._w = w; cb.style.width = w; }
      setText($('#hud-bw'), NC.fmt(g.bw));
      setText($('#hud-wave'), g.lv.endless ? String(g.waveNum) : g.waveNum + ' / ' + g.totalWaves);
      if (g.has('oc5')) {
        const kb = $('#btn-kill');
        const ready = g.killSwitchReady();
        const cd = g.killSwitchCd;
        setText($('#kill-cd'), ready ? 'READY' : Math.floor(cd / 60) + ':' + String(Math.floor(cd % 60)).padStart(2, '0'));
        kb.classList.toggle('ready', ready);
        kb.disabled = !ready;
      }
      if (this.selTower && !g.towers.includes(this.selTower)) { this.selTower = null; this.infoKey = ''; }
      if (this.selEnemy && this.selEnemy.dead) { this.selEnemy = null; this.infoKey = ''; }
      const sig = this.infoSignature();
      if (sig !== this.infoKey) { this.infoKey = sig; this.renderInfo(); }
      this.updateInfoLive();
      this.updateBuildCards();
      this.refreshWave();
      for (const ev of g.events) {
        if (ev.kind === 'toast') this.toast(ev.text, ev.style);
        else if (ev.kind === 'end') { this.endAt = performance.now() + 1600; this.endWon = ev.won; }
      }
      g.events.length = 0;
      if (this.endAt && !this.ended && performance.now() >= this.endAt) {
        this.endAt = 0;
        this.onEnd(this.endWon);
      }
    },

    toast(text, style) {
      const box = $('#toasts');
      while (box.children.length > 3) box.firstChild.remove();
      const el = document.createElement('div');
      el.className = 'toast ' + (style || '');
      el.textContent = text;
      box.appendChild(el);
      setTimeout(() => el.remove(), 2900);
    },

    // ------------------------------------------------------------ modals
    openModal(kind, html) {
      this.modalKind = kind;
      $('#modal-box').innerHTML = html;
      $('#modal').classList.remove('hidden');
      if (this.screen === 'game') this.paused = true;
    },

    closeModal(force) {
      if (!this.modalKind && !force) return;
      const wasPause = this.modalKind === 'pause';
      this.modalKind = null;
      $('#modal').classList.add('hidden');
      if (this.screen === 'game' && this.game && !this.ended) {
        this.paused = false;
        if (wasPause) NC.Audio.setIntensity(1);
      }
    },

    openPause() {
      if (!this.game || this.ended) return;
      const st = NC.Save.data.settings;
      this.openModal('pause',
        '<h2>SYSTEM PAUSED</h2><div class="modal-sub">' + esc(this.level.code) + ' — ' + esc(this.level.name) + '</div>' +
        this.volumeControls(st) +
        '<div class="modal-actions">' +
        '<button class="btn primary" data-action="resume">▶ Resume</button>' +
        '<button class="btn" data-action="briefing">ⓘ Briefing</button>' +
        '<button class="btn" data-action="restart">↻ Restart</button>' +
        '<button class="btn danger" data-action="abandon">Abandon Sector</button>' +
        '</div>');
      this.bindVolume();
    },

    volumeControls(st) {
      return '<div class="setting-row"><label>MUSIC</label><input type="range" min="0" max="1" step="0.05" id="vol-music" value="' + st.music + '"></div>' +
        '<div class="setting-row"><label>EFFECTS</label><input type="range" min="0" max="1" step="0.05" id="vol-sfx" value="' + st.sfx + '"></div>';
    },

    bindVolume() {
      const st = NC.Save.data.settings;
      const m = $('#vol-music'), s = $('#vol-sfx');
      const apply = () => {
        st.music = +m.value; st.sfx = +s.value;
        NC.Audio.setVolumes(st.music, st.sfx);
        NC.Save.write();
      };
      m.addEventListener('input', apply);
      s.addEventListener('input', apply);
      s.addEventListener('change', () => sfx('coin'));
    },

    openSettings() {
      const st = NC.Save.data.settings;
      this.openModal('settings',
        '<h2>SETTINGS</h2><div class="modal-sub">Audio is fully synthesized in real time.</div>' +
        this.volumeControls(st) +
        '<h4>DATA</h4><p class="hint">Progress is stored locally in this browser. Lifetime fragments earned: ◆ ' + NC.Save.data.lifetime + '</p>' +
        '<div class="modal-actions"><button class="btn primary" data-action="close-modal">Done</button><button class="btn danger" data-action="reset-progress">Wipe Progress</button></div>');
      this.bindVolume();
    },

    openBriefing(first) {
      const wasPause = this.modalKind === 'pause';
      const towerItems = NC.TOWER_ORDER.map(id => {
        const d = NC.TOWERS[id];
        return '<div class="brief-item"><canvas data-k="tower" data-id="' + id + '"></canvas><div><b style="color:' + d.color + '">' + esc(d.name) + '</b>' + esc(d.desc) +
          '<br><small style="color:var(--muted)">A: ' + esc(d.subs.A.name) + ' · B: ' + esc(d.subs.B.name) + '</small></div></div>';
      }).join('');
      const enemyItems = NC.ENEMY_ORDER.map(id => {
        const d = NC.ENEMIES[id];
        return '<div class="brief-item"><canvas data-k="enemy" data-id="' + id + '"></canvas><div><b style="color:' + d.color + '">' + esc(d.name) + '</b>' + esc(d.desc) + '</div></div>';
      }).join('');
      this.openModal('briefing',
        '<h2>MISSION BRIEFING</h2><div class="modal-sub">PRIME ARCHITECT // CLEARANCE OMEGA</div>' +
        '<p>Malware pours from <b style="color:#ff6b81">breach points</b> and races along the glowing <b>data streams</b> toward the <b>Core Kernel</b>. Every leak costs Core integrity — reach zero and the mainframe falls.</p>' +
        '<h4>PROTOCOL</h4><ul>' +
        '<li>Spend <b style="color:var(--gold)">Bandwidth</b> to deploy ICE towers on the violet <b>logic gates</b> beside the stream.</li>' +
        '<li>Upgrade towers to <b>MK-III</b>, then install subroutine <b>A</b> or <b>B</b> to specialise them.</li>' +
        '<li>Clear sectors and purge Boss-Ware to earn <b style="color:var(--magenta)">◆ Memory Fragments</b> for the permanent <b>Prime Skill Tree</b>.</li>' +
        '<li>Call waves early for bonus Bandwidth. Polymorphic bosses adapt to your most-used damage type — mix your arsenal.</li></ul>' +
        '<h4>ICE TOWERS</h4><div class="brief-grid">' + towerItems + '</div>' +
        '<h4>KNOWN MALWARE</h4><div class="brief-grid">' + enemyItems + '</div>' +
        '<h4>CONTROLS</h4><p><kbd>1</kbd>–<kbd>4</kbd> select tower · <kbd>Click</kbd> deploy / select · <kbd>Shift</kbd>+click multi-place · <kbd>Right-click</kbd>/<kbd>Esc</kbd> cancel · <kbd>U</kbd> upgrade · <kbd>S</kbd> sell · <kbd>Space</kbd> next wave · <kbd>F</kbd> speed · <kbd>P</kbd> pause · <kbd>K</kbd> Kill Switch · <kbd>M</kbd> mute</p>' +
        '<div class="modal-actions"><button class="btn primary" data-action="' + (wasPause ? 'resume' : 'close-modal') + '">' + (first ? '▶ Engage' : 'Close') + '</button></div>');
      $$('#modal-box canvas[data-k]').forEach(c => NC.drawIcon(c, c.dataset.k, c.dataset.id, { size: 38 }));
    },

    // ------------------------------------------------------------ frame
    frame(now, dt) {
      if (this.screen === 'game' && this.game) {
        const g = this.game;
        if (!this.paused) for (let i = 0; i < this.speed; i++) g.update(dt);
        this.renderer.draw(now, { hover: this.hover, buildType: this.buildType, selTower: this.selTower, selEnemy: this.selEnemy });
        this.tickHud(dt);
      } else {
        this.menuBg.draw(now);
      }
    }
  };

  NC.UI = UI;
})(globalThis.NC = globalThis.NC || {});
