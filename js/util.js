/* Neon Cortex — shared helpers. Works in the browser and in a Node vm (for headless simulation). */
(function (NC) {
  'use strict';

  NC.TILE = 40;
  NC.COLS = 26;
  NC.ROWS = 15;

  NC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NC.lerp = (a, b, t) => a + (b - a) * t;
  NC.rand = (a, b) => a + Math.random() * (b - a);
  NC.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  NC.easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  NC.fmt = n => Math.floor(n).toLocaleString('en-US');

  // Small deterministic PRNG so decorative board details are stable per sector.
  NC.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  NC.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const rgbCache = {};
  NC.rgb = function (hex) {
    let c = rgbCache[hex];
    if (!c) {
      const h = hex.replace('#', '');
      c = rgbCache[hex] = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    return c;
  };
  NC.rgba = function (hex, a) {
    const c = NC.rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };
  NC.mixHex = function (h1, h2, t) {
    const a = NC.rgb(h1), b = NC.rgb(h2);
    const m = i => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
    return '#' + m(0) + m(1) + m(2);
  };
})(globalThis.NC = globalThis.NC || {});
