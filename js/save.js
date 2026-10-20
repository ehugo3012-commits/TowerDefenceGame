/* Neon Cortex — persistent meta-progression (Memory Fragments, skills, sector records). */
(function (NC) {
  'use strict';

  const KEY = 'neonCortex.save.v1';

  NC.Save = {
    data: null,

    defaults() {
      return {
        fragments: 0,
        lifetime: 0,
        skills: {},
        levels: {},
        settings: { music: 0.5, sfx: 0.7, muted: false },
        seenBriefing: false
      };
    },

    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
      const d = this.defaults();
      if (raw && typeof raw === 'object') {
        Object.assign(d, raw);
        d.settings = Object.assign(this.defaults().settings, raw.settings || {});
      }
      this.data = d;
      return d;
    },

    write() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
    },

    reset() {
      this.data = this.defaults();
      this.write();
    },

    has(id) { return !!this.data.skills[id]; },

    canUnlock(id) {
      const s = NC.SKILLS[id];
      if (!s || this.has(id)) return false;
      if (s.prev && !this.has(s.prev)) return false;
      return this.data.fragments >= s.cost;
    },

    unlock(id) {
      if (!this.canUnlock(id)) return false;
      this.data.fragments -= NC.SKILLS[id].cost;
      this.data.skills[id] = true;
      this.write();
      return true;
    },

    spent() {
      return Object.keys(this.data.skills).reduce((a, id) => a + (NC.SKILLS[id] ? NC.SKILLS[id].cost : 0), 0);
    },

    respec() {
      this.data.fragments += this.spent();
      this.data.skills = {};
      this.write();
    },

    addFragments(n) {
      this.data.fragments += n;
      this.data.lifetime += n;
      this.write();
    },

    levelRecord(id) { return this.data.levels[id] || null; },

    isUnlocked(lv) {
      const i = NC.LEVELS.indexOf(lv);
      if (i <= 0) return true;
      if (lv.endless) {
        const s2 = this.levelRecord('s2');
        return !!(s2 && s2.cleared);
      }
      const prev = this.levelRecord(NC.LEVELS[i - 1].id);
      return !!(prev && prev.cleared);
    },

    recordResult(lv, game) {
      const rec = this.data.levels[lv.id] || { cleared: false, bestIntegrity: 0, bestWave: 0, plays: 0 };
      const firstClear = !lv.endless && game.state === 'won' && !rec.cleared;
      rec.plays++;
      rec.bestWave = Math.max(rec.bestWave, game.wavesCleared);
      if (game.state === 'won') {
        rec.cleared = true;
        rec.bestIntegrity = Math.max(rec.bestIntegrity, Math.round(game.coreHp / game.coreMax * 100));
      }
      this.data.levels[lv.id] = rec;
      const rewards = game.computeRewards(firstClear);
      this.addFragments(rewards.total);
      return rewards;
    }
  };
})(globalThis.NC = globalThis.NC || {});
