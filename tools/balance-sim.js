/* Headless balance check: a simple greedy bot plays every sector 3 times.
 * Usage: node tools/balance-sim.js [comma,separated,skill,ids]   e.g. node tools/balance-sim.js oc1,en1,dm1 */
const vm = require('vm'), fs = require('fs');
const root = require('path').join(__dirname, '..', 'js') + '/';
const ctx = { console, Math, Set, Map, Float64Array, Uint8Array, Array, Object, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['util.js', 'data.js', 'game.js']) vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
const NC = ctx.NC;

function run(lvIdx, skills, plan, verbose) {
  const lv = NC.LEVELS[lvIdx];
  const g = new NC.Game(lv, skills); const leaks={}; const ol=g.leak.bind(g); g.leak=e=>{leaks[e.type]=(leaks[e.type]||0)+1; ol(e);};
  const COLS = NC.COLS;
  // gate scores: path tiles within 2.5
  const gates = [];
  for (let i = 0; i < g.grid.length; i++) {
    const x = i % COLS, y = (i / COLS) | 0;
    if (g.grid[i] !== 2) continue;
    let s = 0;
    for (let j = 0; j < g.grid.length; j++) if (g.grid[j] === 1) { const d = Math.hypot((j % COLS) - x, ((j / COLS) | 0) - y); if (d <= 2.6) s += 1 + 0.02 * (40 - Math.min(40, g.dist[j])); }
    gates.push({ x, y, s });
  }
  gates.sort((a, b) => b.s - a.s);
  let ci = 0, t = 0, dt = 1 / 30, maxT = 3600;
  while (g.state === 'playing' || g.state === 'rewind') {
    if (t > maxT) break;
    // bot acts
    const want = plan[ci % plan.length];
    if (g.towers.length < 3 + g.waveNum * 1.3) {
      const cost = NC.TOWERS[want].levels[0].cost;
      if (g.bw >= cost) {
        const gt = gates.find(q => g.canPlace(q.x, q.y));
        if (gt) { g.placeTower(want, gt.x, gt.y); ci++; }
      }
    } else {
      const ups = g.towers.filter(x => x.level < 4).sort((a, b) => a.level - b.level);
      if (ups.length) { const u = ups[0]; const sub = u.type === 'pulse' ? (Math.random()<0.5?'A':'B') : u.type === 'rail' ? 'A' : u.type === 'cryo' ? 'B' : 'B'; const c = g.upgradeCost(u, sub); if (g.bw >= c) g.upgradeTower(u, u.level === 3 ? sub : undefined); }
    }
    if (g.activeWaves() === 0 && g.waveNum < g.totalWaves) g.callWave();
    g.update(dt); t += dt;
    g.events.length = 0;
  }
  return { leaksBy: JSON.stringify(leaks), lv: lv.id, state: g.state, wave: g.waveNum, cleared: g.wavesCleared, core: g.coreHp + '/' + g.coreMax, leaks: g.stats.leaks, kills: g.stats.kills, bw: g.bw, towers: g.towers.length, time: Math.round(t) };
}
const plan = ['pulse', 'pulse', 'cryo', 'rail', 'pulse', 'miner', 'rail', 'pulse', 'cryo', 'rail'];
const args = process.argv.slice(2);
const skills = {};
(args[0] || '').split(',').filter(Boolean).forEach(s => skills[s] = true);
for (let i = 0; i < NC.LEVELS.length; i++) {
  const res = [];
  for (let k = 0; k < 3; k++) res.push(run(i, skills, plan));
  console.log(res.map(r => `${r.lv} ${r.state} w${r.cleared} core ${r.core} leaks ${r.leaksBy} towers ${r.towers} bw ${r.bw}`).join(' | '));
}
