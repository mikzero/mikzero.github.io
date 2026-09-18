(() => {
  const canvas = document.getElementById("field");
  if (!canvas) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const view = canvas.getContext("2d", { alpha: false });
  const buffer = document.createElement("canvas");
  const buf = buffer.getContext("2d", { alpha: false });
  if (!view || !buf) return;

  const FELT = [26, 38, 32];
  const DOT = [232, 214, 168];
  const BAYER = [
    0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52,
    11, 59, 7, 55, 40, 24, 36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61,
    34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6, 54, 9, 57, 5, 53, 42, 26, 38, 22,
    41, 25, 37, 21,
  ];

  let mapW = 0;
  let mapH = 0;
  let density = null;
  let frameId = 0;
  let running = false;

  function hash(ix, iy) {
    let n = ix * 374761393 + iy * 668265263;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function fade(t) {
    return t * t * (3 - 2 * t);
  }

  function valueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (d - b - c + a) * fx * fy;
  }

  function fbm(x, y) {
    let v = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < 5; i += 1) {
      v += valueNoise(x * f, y * f) * a;
      a *= 0.5;
      f *= 2;
    }
    return v;
  }

  function sdRoundRect(px, py, cx, cy, hw, hh, radius, rot) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const dx0 = px - cx;
    const dy0 = py - cy;
    const rx = Math.abs(cos * dx0 + sin * dy0) - hw + radius;
    const ry = Math.abs(-sin * dx0 + cos * dy0) - hh + radius;
    const ax = Math.max(rx, 0);
    const ay = Math.max(ry, 0);
    return Math.min(Math.max(rx, ry), 0) + Math.hypot(ax, ay) - radius;
  }

  function sdDiamond(px, py, cx, cy, size) {
    return (Math.abs(px - cx) + Math.abs(py - cy)) / size - 1;
  }

  function soft(dist, k) {
    return fade(Math.max(0, Math.min(1, 1 - dist / k)));
  }

  function paintDensity() {
    density = new Float32Array(mapW * mapH);
    const aspect = mapW / mapH;

    for (let y = 0; y < mapH; y += 1) {
      for (let x = 0; x < mapW; x += 1) {
        const u = x / mapW;
        const v = y / mapH;
        const px = (u - 0.5) * aspect;
        const py = v - 0.5;

        let d = 0.1 + fbm(u * 3.2, v * 3.2) * 0.16;
        d += fbm(u * 7.5 + 8, v * 7.5) * 0.05;

        d += soft(
          sdRoundRect(px, py, -0.42, -0.02, 0.13, 0.22, 0.02, -0.38),
          0.035,
        ) * 0.78;
        d += soft(
          sdRoundRect(px, py, 0.44, 0.05, 0.12, 0.2, 0.02, 0.46),
          0.035,
        ) * 0.74;
        d += soft(
          sdRoundRect(px, py, 0, -0.38, 0.08, 0.14, 0.018, 0.1),
          0.03,
        ) * 0.7;

        d += soft(sdDiamond(px, py, -0.42, -0.1, 0.035), 0.02) * 0.35;
        d += soft(sdDiamond(px, py, 0.44, -0.02, 0.03), 0.02) * 0.32;
        d += soft(sdDiamond(px, py, 0, -0.42, 0.022), 0.016) * 0.4;
        d += soft(sdDiamond(px, py, -0.08, 0.4, 0.018), 0.014) * 0.22;
        d += soft(sdDiamond(px, py, 0.12, 0.36, 0.016), 0.014) * 0.18;

        const lamp = Math.hypot(px * 0.7, py + 0.15);
        d *= 1.05 - Math.min(0.28, lamp * 0.22);

        density[y * mapW + x] = Math.max(0, Math.min(1, d));
      }
    }
  }

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = Math.max(2, Math.sqrt((w * h) / 150000));

    mapW = Math.max(80, Math.round(w / cell));
    mapH = Math.max(80, Math.round(h / cell));
    buffer.width = mapW;
    buffer.height = mapH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.imageSmoothingEnabled = false;
    paintDensity();
    document.body.classList.add("has-field");
  }

  function stamp(time) {
    const pixels = buf.createImageData(mapW, mapH);
    const data = pixels.data;
    const t = time * 0.00028;

    for (let y = 0; y < mapH; y += 1) {
      for (let x = 0; x < mapW; x += 1) {
        const i = y * mapW + x;
        const n =
          Math.sin(x * 0.17 + t) * Math.cos(y * 0.14 - t * 0.75) * 0.5 +
          Math.sin((x + y) * 0.06 + t * 0.45) * 0.5;
        const v = density[i] + n * 0.085;
        const threshold = (BAYER[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
        const on = v > threshold * 0.92 + 0.04;
        const o = i * 4;
        if (on) {
          data[o] = DOT[0];
          data[o + 1] = DOT[1];
          data[o + 2] = DOT[2];
        } else {
          data[o] = FELT[0];
          data[o + 1] = FELT[1];
          data[o + 2] = FELT[2];
        }
        data[o + 3] = 255;
      }
    }

    buf.putImageData(pixels, 0, 0);
    view.drawImage(buffer, 0, 0, window.innerWidth, window.innerHeight);
  }

  function tick(time) {
    stamp(time);
    if (running && !reduce.matches) {
      frameId = requestAnimationFrame(tick);
    }
  }

  function play() {
    if (running || reduce.matches || document.hidden) return;
    running = true;
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  function start() {
    resize();
    if (reduce.matches) {
      stamp(0);
      return;
    }
    play();
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      if (!running) stamp(0);
    }, 120);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else play();
  });

  reduce.addEventListener("change", () => {
    stop();
    start();
  });

  start();
})();
