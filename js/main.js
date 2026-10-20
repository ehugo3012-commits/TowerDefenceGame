/* Neon Cortex — bootstrap and main loop. */
(function (NC) {
  'use strict';

  NC.UI.init();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      NC.UI.frame(now, dt);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(globalThis.NC);
