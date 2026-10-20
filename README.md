# Neon Cortex: The Quantum Breach

A cyberpunk / sci-fi tower defence game for the browser. You are the **Prime Architect**, an Intrusion
Countermeasures (ICE) AI defending the world's last quantum mainframe from adaptive rogue malware.

**Play:** open `index.html` in any modern browser. No build step, dependencies or server needed.
(Fonts load from Google Fonts when online, and fall back to monospace offline.)

## Features

- **Five sectors**, each with a circuit-board map: Home Router, USB Port Cluster, Phishing Relay
  (forked streams), Quantum Mainframe (three breach points), plus an **Endless** mode.
- **Four ICE towers** that upgrade from MK-I to MK-III, then specialise into subroutine A or B:
  - Pulse Node: Shredder (armor strip) / Scatter (shotgun spread)
  - Cryo-Wall: Deep Freeze (periodic 2s root) / Brittle Shield (+15% damage taken)
  - Rail-Trace: Prism Beam (refracting shards) / Executioner (deletes non-bosses under 30%)
  - Crypto-Miner: Venture (big payout, self-destructs after 5 waves) / Synergy (+25% fire rate to neighbours)
- **Malware**
  - Viruses
  - Armored Trojans that burst into viruses
  - Gap-jumping Worms
  - Ransomware that encrypts nearby towers
  - **Polymorphic Boss-Ware** that adapts its resistance to whichever damage type (rapid-fire, beam,
    area) hits it most
- **Meta-progression**: earn ◆ Memory Fragments for clears, efficiency and boss kills, and spend them
  in the 15-node **Prime Skill Tree** (Overclock / Encryption / Data Mining). The tree includes:
  - The Kill Switch orbital strike
  - System Restore time rewind
  - Open Source Architecture, which lets you build on the path itself and turns the game into maze
    building
- Synthesized WebAudio sound effects and a procedural synthwave soundtrack. Progress is saved in
  `localStorage`.

## Controls

| Key | Action |
| --- | --- |
| `1`–`4` | Select tower to build |
| Click | Deploy / select tower / inspect (or Focus-Fire mark) malware |
| `Shift`+click | Place several towers in a row |
| Right-click / `Esc` | Cancel |
| `U` / `S` | Upgrade / sell the selected tower |
| `Space` | Initiate the next wave (early calls pay bonus Bandwidth) |
| `F` | Cycle game speed (1×/2×/3×) |
| `K` | Kill Switch (once unlocked) |
| `P` | Pause |
| `M` | Mute |

## Code layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Towers, malware, skill tree, sector maps, wave generator |
| `js/game.js` | DOM-free simulation (pathing, combat, economy, skills) |
| `js/render.js` | Canvas renderer, procedural art, effects, menu backdrop |
| `js/ui.js` | Screens, HUD, side panel, modals, input |
| `js/audio.js` | Synthesized SFX and music |
| `js/save.js` | Persistent progression |
| `tools/balance-sim.js` | Headless bot that plays every sector, for balance checks (`node tools/balance-sim.js`) |
