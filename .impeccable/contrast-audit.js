// WCAG contrast audit — paste-able into evaluate_script as the body of a function.
// Walks every visible text node, resolves the effective background (alpha
// compositing up the ancestor chain), computes the WCAG ratio and returns the
// failures. Gradient backgrounds are flagged (ratio computed vs the composited
// solid layers underneath, so treat gradient hits as "verify by eye").
(() => {
  const toRGBA = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
  };
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = Math.max(lum(a), lum(b));
    const l2 = Math.min(lum(a), lum(b));
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const composite = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat([1]);
  };
  const effBg = (el) => {
    const layers = [];
    let node = el;
    let opacity = 1;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      opacity *= Number.parseFloat(cs.opacity || '1');
      const c = toRGBA(cs.backgroundColor);
      if (c && c[3] > 0) layers.push(c);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') layers.push(null);
      node = node.parentElement;
    }
    let result = [255, 255, 255, 1];
    let hadGradient = false;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (!layers[i]) {
        hadGradient = true;
        continue;
      }
      result = composite(layers[i], result);
    }
    return { bg: result, hadGradient, opacity };
  };
  const failures = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const text = t.textContent.trim();
    if (!text) continue;
    const el = t.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('[aria-hidden="true"]') || el.closest('[disabled]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    let fg = toRGBA(cs.color);
    if (!fg) continue;
    const { bg, hadGradient, opacity } = effBg(el);
    fg = [fg[0], fg[1], fg[2], fg[3] * opacity];
    if (fg[3] < 1) fg = composite(fg, bg);
    const r = ratio(fg, bg);
    const size = Number.parseFloat(cs.fontSize);
    const weight = Number.parseInt(cs.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = isLarge ? 3 : 4.5;
    if (r < need) {
      failures.push({
        text: text.slice(0, 30),
        ratio: +r.toFixed(2),
        need,
        size,
        weight,
        color: cs.color,
        bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
        gradient: hadGradient,
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
        tag: el.tagName,
      });
    }
  }
  failures.sort((a, b) => a.ratio - b.ratio);
  return failures.slice(0, 40);
})();
