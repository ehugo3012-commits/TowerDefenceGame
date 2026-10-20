/* Neon Cortex — static game data: towers, malware, skill tree, sectors and wave generation. */
(function (NC) {
  'use strict';

  // ---------------------------------------------------------------- ICE Towers
  NC.TOWER_ORDER = ['pulse', 'cryo', 'rail', 'miner'];

  NC.TOWERS = {
    pulse: {
      id: 'pulse', name: 'Pulse Node', role: 'Basic', color: '#00f5ff', hotkey: '1',
      category: 'rapid', attacks: true,
      desc: 'Fires rapid packets of energy. Cheap and reliable.',
      levels: [
        { cost: 50, dmg: 6, rate: 3.0, range: 2.5 },
        { cost: 45, dmg: 9, rate: 3.4, range: 2.7 },
        { cost: 80, dmg: 13, rate: 3.8, range: 2.9 }
      ],
      subs: {
        A: { name: 'Shredder', cost: 140, dmg: 17, rate: 4.2, range: 3.0, shred: 1.5, color: '#ff4d6d',
          desc: 'Packets ignore armor and permanently strip 1.5 armor from the target per hit.' },
        B: { name: 'Scatter', cost: 140, dmg: 9, rate: 1.8, range: 2.8, pellets: 5, spread: 0.8, color: '#5cffc8',
          desc: 'Fires a wide 5-pellet shotgun spread. Shreds swarms and counts as area damage.' }
      }
    },
    cryo: {
      id: 'cryo', name: 'Cryo-Wall', role: 'Crowd Control', color: '#6fa8ff', hotkey: '2',
      category: 'aoe', attacks: false,
      desc: 'Casts a localized stasis field that slows enemy movement.',
      levels: [
        { cost: 70, slow: 0.30, range: 1.6, dps: 3 },
        { cost: 60, slow: 0.38, range: 1.8, dps: 5 },
        { cost: 90, slow: 0.45, range: 2.0, dps: 8 }
      ],
      subs: {
        A: { name: 'Deep Freeze', cost: 150, slow: 0.45, range: 2.1, dps: 10, freezeEvery: 6, freezeDur: 2, color: '#d8f3ff',
          desc: 'Every 6s the field flash-freezes, rooting all enemies inside for 2 seconds (bosses: 1s).' },
        B: { name: 'Brittle Shield', cost: 130, slow: 0.45, range: 2.2, dps: 10, brittle: 0.15, color: '#b48cff',
          desc: 'Enemies inside the stasis field take 15% more damage from every source.' }
      }
    },
    rail: {
      id: 'rail', name: 'Rail-Trace', role: 'Sniper', color: '#c77dff', hotkey: '3',
      category: 'beam', attacks: true,
      desc: 'Charges a high-powered beam that pierces through lines of enemies.',
      levels: [
        { cost: 110, dmg: 55, charge: 2.4, range: 5.0 },
        { cost: 90, dmg: 85, charge: 2.2, range: 5.5 },
        { cost: 140, dmg: 130, charge: 2.0, range: 6.0 }
      ],
      subs: {
        A: { name: 'Prism Beam', cost: 220, dmg: 170, charge: 2.0, range: 6.5, refract: 2, refractMul: 0.5, refractRange: 2.0, color: '#7df9ff',
          desc: 'The beam refracts on impact, splitting into 2 shards that strike adjacent targets for 50% damage.' },
        B: { name: 'Executioner', cost: 200, dmg: 160, charge: 1.9, range: 6.5, execute: 0.3, color: '#ff3355',
          desc: 'Instantly deletes any non-boss malware left under 30% integrity by the beam.' }
      }
    },
    miner: {
      id: 'miner', name: 'Crypto-Miner', role: 'Economy', color: '#ffd23f', hotkey: '4',
      category: null, attacks: false,
      desc: 'Generates passive Bandwidth at the end of every wave.',
      levels: [
        { cost: 90, income: 25 },
        { cost: 70, income: 40 },
        { cost: 100, income: 60 }
      ],
      subs: {
        A: { name: 'Venture', cost: 120, income: 160, lifespan: 5, color: '#ff9f1c',
          desc: 'Generates a massive 160 Bandwidth burst per wave — but self-destructs after 5 waves.' },
        B: { name: 'Synergy', cost: 120, income: 45, synergy: 0.25, color: '#9dff5c',
          desc: 'Boosts the fire rate of all adjacent attacking towers (diagonals included) by 25%.' }
      }
    }
  };

  // ------------------------------------------------------------------ Malware
  NC.ENEMIES = {
    virus: {
      name: 'Virus', hp: 28, speed: 1.5, armor: 0, reward: 4, coreDmg: 1, size: 0.2, color: '#ff3860', atk: 8,
      desc: 'Basic self-replicating code. Weak alone, dangerous in numbers.'
    },
    worm: {
      name: 'Worm', hp: 38, speed: 2.25, armor: 0, reward: 4, coreDmg: 1, size: 0.18, color: '#a6ff00', atk: 6, jump: true,
      desc: 'Fast swarming entity. Periodically leaps across circuit gaps to bypass the data stream.'
    },
    trojan: {
      name: 'Trojan', hp: 260, speed: 0.62, armor: 5, reward: 22, coreDmg: 3, size: 0.36, color: '#ff7b00', atk: 30, payload: 4,
      desc: 'Heavily armored brute. Bursts into 4 viruses when destroyed. Armor blocks 5 damage per hit.'
    },
    ransomware: {
      name: 'Ransomware', hp: 180, speed: 0.95, armor: 2, reward: 16, coreDmg: 2, size: 0.28, color: '#ff2d95', atk: 20,
      disableRange: 1.6, disableDur: 3,
      desc: 'Encrypts adjacent towers as it passes, disabling them for 3 seconds. Space out your defences.'
    },
    boss: {
      name: 'Polymorphic Boss-Ware', hp: 2600, speed: 0.42, armor: 4, reward: 180, coreDmg: 8, size: 0.5, color: '#ff1744', atk: 120,
      boss: true, adapt: true,
      desc: 'Elite adaptive malware. Builds resistance to whatever damage type hits it most. Pivot your firepower.'
    }
  };
  NC.ENEMY_ORDER = ['virus', 'worm', 'trojan', 'ransomware', 'boss'];

  NC.DAMAGE_CATS = {
    rapid: { name: 'Rapid-Fire', color: '#00f5ff', hint: 'Pulse Nodes' },
    beam: { name: 'Beam', color: '#c77dff', hint: 'Rail-Trace' },
    aoe: { name: 'Area', color: '#6fa8ff', hint: 'Cryo, Scatter, EMP' }
  };

  // --------------------------------------------------------------- Skill tree
  NC.SKILL_BRANCHES = [
    {
      id: 'overclock', name: 'Overclock', tag: 'Aggression & Damage', color: '#ff3b5c', icon: '⚡',
      nodes: [
        { id: 'oc1', name: 'High-Voltage Routing', cost: 2, desc: 'Increases base damage of all towers by 5%.' },
        { id: 'oc2', name: 'Capacitor Overload', cost: 3, desc: 'Towers have a 10% chance to deal a critical hit for 150% damage.' },
        { id: 'oc3', name: 'Cascading Errors', cost: 4, desc: 'When an enemy dies it releases a localized EMP, dealing minor damage to nearby enemies.' },
        { id: 'oc4', name: 'Focus Fire Protocol', cost: 6, desc: 'Click an enemy to mark it. Towers in range prioritise it and gain +20% fire rate against it.' },
        { id: 'oc5', name: 'The Kill Switch', cost: 10, apex: true, desc: 'Unlocks a map-wide orbital strike (3 minute cooldown) that wipes out all non-boss enemies on the board. [K]' }
      ]
    },
    {
      id: 'encryption', name: 'Encryption', tag: 'Control & Resilience', color: '#28e0ff', icon: '⬢',
      nodes: [
        { id: 'en1', name: 'Thickened Firewalls', cost: 2, desc: 'The Core Kernel gains +5 base health (survive 5 extra leaks).' },
        { id: 'en2', name: 'Zero-Day Friction', cost: 3, desc: 'All enemies spawn with a permanent 5% movement speed penalty.' },
        { id: 'en3', name: 'Feedback Loop', cost: 4, desc: 'Malware types that damage the Core are logged; every later spawn of that type takes 10% more damage.' },
        { id: 'en4', name: 'Stasis Minefield', cost: 6, desc: 'At the start of every wave, 3 near-invisible stasis traps are deployed on the enemy path.' },
        { id: 'en5', name: 'System Restore', cost: 10, apex: true, desc: 'Once per match, if the Core hits 0, time rewinds: all enemies are pushed back to their spawn points and the Core heals to 50%.' }
      ]
    },
    {
      id: 'datamining', name: 'Data Mining', tag: 'Economy & Utility', color: '#ffc93b', icon: '◈',
      nodes: [
        { id: 'dm1', name: 'Bandwidth Skimming', cost: 2, desc: 'Start every match with +100 Bandwidth.' },
        { id: 'dm2', name: 'Recycled Assets', cost: 3, desc: 'Selling a tower refunds 90% of its cost (up from 60%).' },
        { id: 'dm3', name: 'Interest Rates', cost: 4, desc: 'Unspent Bandwidth at the end of a wave generates 5% bonus Bandwidth (up to 150 per wave).' },
        { id: 'dm4', name: 'Spatial Efficiency', cost: 6, desc: 'Upgrading a tower grants every adjacent tower a 10% discount on its next upgrade (stacks to 50%).' },
        { id: 'dm5', name: 'Open Source Architecture', cost: 10, apex: true, desc: 'Placement restrictions are lifted. Build anywhere — even on the data stream itself, forcing malware to reroute or chew through your towers.' }
      ]
    }
  ];
  NC.SKILLS = {};
  NC.SKILL_BRANCHES.forEach(b => b.nodes.forEach((n, i) => { NC.SKILLS[n.id] = Object.assign({ branch: b.id, tier: i, prev: i ? b.nodes[i - 1].id : null }, n); }));

  // ------------------------------------------------------------------ Sectors
  // Routes are axis-aligned polylines carved into the circuit board as data streams.
  NC.LEVELS = [
    {
      id: 's1', code: 'SECTOR 01', name: 'Home Router', waves: 10, diff: 0.8, reward: 5, startBw: 260, coreHp: 20, threat: 1,
      intro: { worm: 3, trojan: 5, ransomware: 7 }, midBoss: false,
      desc: 'A compromised consumer router leaks a single stream of malware toward the mainframe. Learn the protocols.',
      spawns: [{ x: 0, y: 2, label: 'ROUTER' }], core: { x: 24, y: 12 },
      routes: [[[0, 2], [7, 2], [7, 11], [12, 11], [12, 4], [21, 4], [21, 9], [17, 9], [17, 12], [24, 12]]]
    },
    {
      id: 's2', code: 'SECTOR 02', name: 'USB Port Cluster', waves: 12, diff: 0.92, reward: 7, startBw: 280, coreHp: 20, threat: 2,
      intro: { worm: 3, trojan: 4, ransomware: 6 }, midBoss: true,
      desc: 'Two infected USB ports inject parallel payloads that merge into a single data highway.',
      spawns: [{ x: 0, y: 1, label: 'USB-A' }, { x: 0, y: 13, label: 'USB-C' }], core: { x: 24, y: 10 },
      routes: [[[0, 1], [9, 1], [9, 7], [15, 7], [15, 3], [21, 3], [21, 10], [24, 10]], [[0, 13], [9, 13], [9, 7]]]
    },
    {
      id: 's3', code: 'SECTOR 03', name: 'Phishing Relay', waves: 14, diff: 0.95, reward: 9, startBw: 340, coreHp: 20, threat: 3,
      intro: { worm: 2, trojan: 4, ransomware: 5 }, midBoss: true,
      desc: 'A malicious link forks the data stream into twin relays. Malware splits unpredictably between them.',
      spawns: [{ x: 0, y: 7, label: 'LINK' }, { x: 20, y: 0, label: 'PHISH' }], core: { x: 23, y: 7 },
      routes: [[[0, 7], [4, 7], [4, 1], [15, 1], [15, 7], [23, 7]], [[4, 7], [4, 13], [15, 13], [15, 7]], [[20, 0], [20, 7]]]
    },
    {
      id: 's4', code: 'SECTOR 04', name: 'Quantum Mainframe', waves: 16, diff: 1.12, reward: 12, startBw: 400, coreHp: 20, threat: 4,
      intro: { worm: 2, trojan: 3, ransomware: 5 }, midBoss: true,
      desc: 'The final perimeter. Three breach points converge on the Core Kernel from every direction.',
      spawns: [{ x: 0, y: 2, label: 'ROUTER' }, { x: 25, y: 12, label: 'USB' }, { x: 2, y: 14, label: 'LINK' }], core: { x: 13, y: 7 },
      routes: [
        [[0, 2], [6, 2], [6, 11], [10, 11], [10, 7], [13, 7]],
        [[25, 12], [20, 12], [20, 3], [16, 3], [16, 7], [13, 7]],
        [[2, 14], [2, 13], [14, 13], [14, 9], [13, 9], [13, 7]]
      ]
    },
    {
      id: 'endless', code: '∞ ENDLESS', name: 'The Breach', endless: true, diff: 1.0, reward: 0, startBw: 320, coreHp: 20, threat: 5,
      intro: { worm: 3, trojan: 4, ransomware: 6 },
      desc: 'The swarm never stops. Survive as long as you can — Memory Fragments scale with waves survived.',
      spawns: [{ x: 0, y: 3, label: 'ROUTER' }, { x: 0, y: 11, label: 'USB' }], core: { x: 24, y: 7 },
      routes: [
        [[0, 3], [5, 3], [5, 7], [12, 7]],
        [[0, 11], [5, 11], [5, 7]],
        [[12, 7], [12, 2], [19, 2], [19, 7], [24, 7]],
        [[12, 7], [12, 12], [19, 12], [19, 7]]
      ]
    }
  ];

  // ------------------------------------------------------------ Wave generator
  NC.hpCurve = n => 1 + 0.14 * (n - 1) + 0.010 * (n - 1) * (n - 1);

  NC.genWave = function (n, lv) {
    const S = lv.spawns.length;
    const groups = [];
    let si = (n - 1) % S;
    const add = (type, count, interval, delay, extra) => {
      if (count > 0) groups.push(Object.assign({ type, count, interval, delay, spawn: (si++) % S }, extra || {}));
    };
    const intro = lv.intro;
    const theme = n % 4; // 0: worm swarm, 2: armored push
    const lateBoost = lv.endless ? Math.floor(n / 10) : 0;

    add('virus', 5 + Math.floor(n * 1.4), Math.max(0.3, 0.9 - n * 0.03), 0);
    if (S > 1 && n >= 2) add('virus', 1 + Math.floor(n * 0.6), Math.max(0.35, 0.9 - n * 0.025), 3);
    if (S > 2 && n >= 3) add('virus', 1 + Math.floor(n * 0.45), Math.max(0.35, 0.9 - n * 0.025), 5);
    if (n >= intro.worm) add('worm', (theme === 0 ? 6 : 3) + Math.floor((n - intro.worm) * 0.9) + lateBoost * 2, 0.2, 5);
    if (n >= intro.trojan) add('trojan', 1 + Math.floor((n - intro.trojan) / (theme === 2 ? 1.5 : 2.5)) + lateBoost, 3.4, 7);
    if (n >= intro.ransomware) add('ransomware', 1 + Math.floor((n - intro.ransomware) / 3) + lateBoost, 4.5, 9);

    if (lv.endless) {
      if (n % 10 === 0) add('boss', 1 + Math.floor(n / 30), 6, 12, { hpScale: 1 + (n / 10 - 1) * 0.35 });
      else if (n % 5 === 0) add('boss', 1, 1, 12, { hpScale: 0.45 });
    } else {
      if (n === lv.waves) add('boss', 1, 1, 14, { hpScale: 1 });
      else if (lv.midBoss && n === Math.ceil(lv.waves * 0.6)) add('boss', 1, 1, 12, { hpScale: 0.45 });
    }

    return {
      n, groups,
      hpMul: NC.hpCurve(n) * lv.diff,
      rewardMul: 1 + 0.025 * (n - 1),
      boss: groups.some(g => g.type === 'boss')
    };
  };

  NC.waveSummary = function (def) {
    const counts = {};
    def.groups.forEach(g => { counts[g.type] = (counts[g.type] || 0) + g.count; });
    return NC.ENEMY_ORDER.filter(t => counts[t]).map(t => ({ type: t, count: counts[t] }));
  };
})(globalThis.NC = globalThis.NC || {});
