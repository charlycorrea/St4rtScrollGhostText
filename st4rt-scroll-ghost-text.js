/* ST4RT Scroll Ghost Text (Performance-first)
   - Activa el cálculo solo cuando la sección está cerca del viewport (IntersectionObserver)
   - Un solo loop por rAF (no loops permanentes)
   - Soporte iOS: visualViewport scroll/resize + primer gesto (pointer/touch) para forzar primer render
*/

(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  const easeFn = (t, mode) => {
    t = clamp(t, 0, 1);
    if (mode === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    if (mode === 'easeOut') return 1 - Math.pow(1 - t, 2);
    return t; // linear
  };

  const readNum = (el, attr, fallback) => {
    const v = parseFloat(el.getAttribute(attr));
    return Number.isFinite(v) ? v : fallback;
  };

  const readCfg = (section) => {
    return {
      distance: readNum(section, 'data-sgt-distance', 600),
      scaleFrom: Math.max(1, readNum(section, 'data-sgt-scale-from', 320) / 100),
      opacityFrom: clamp(readNum(section, 'data-sgt-opacity-from', 0) / 100, 0, 1),
      ease: section.getAttribute('data-sgt-ease') || 'easeOut'
    };
  };

  // Estado global
  const state = {
    sections: [],
    active: new Set(), // solo secciones cerca del viewport
    ticking: false
  };

  const computeOne = (section) => {
    const text = section.querySelector('[data-sgt-text]');
    if (!text) return;

    const cfg = section.__sgtCfg || (section.__sgtCfg = readCfg(section));

    const top = section.getBoundingClientRect().top;

    // 0 = fantasma cuando top >= distance
    // 1 = sólido cuando top <= 0
    const raw = (cfg.distance - top) / Math.max(1, cfg.distance);
    const t = easeFn(clamp(raw, 0, 1), cfg.ease);

    const scale = lerp(cfg.scaleFrom, 1, t);
    const opacity = lerp(cfg.opacityFrom, 1, t);

    // Escrituras mínimas
    text.style.transform = `translateZ(0) scale(${scale})`;
    text.style.opacity = String(opacity);
  };

  const render = () => {
    state.ticking = false;
    if (state.active.size) {
      state.active.forEach(computeOne);
    }
  };

  const requestRender = () => {
    if (state.ticking) return;
    state.ticking = true;
    requestAnimationFrame(render);
  };

  // IntersectionObserver: activa/desactiva cómputo según cercanía
  const setupIO = () => {
    if (!('IntersectionObserver' in window)) {
      // fallback: si no hay IO, consideramos todas activas (igual es 1 texto)
      state.sections.forEach(s => state.active.add(s));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) state.active.add(e.target);
        else state.active.delete(e.target);
      }
      // al cambiar el set activo, render inmediato
      requestRender();
    }, {
      root: null,
      // empieza a animar cuando esté cerca, sin gastar CPU lejos
      rootMargin: '150% 0px 150% 0px',
      threshold: 0.01
    });

    state.sections.forEach(s => io.observe(s));
  };

  // iOS: visualViewport cambia con la barra, esto mejora MUCHO la consistencia
  const setupViewportListeners = () => {
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender, { passive: true });

    // Primer gesto: forzar render inmediato (soluciona “no renderiza en el primer scroll”)
    window.addEventListener('touchstart', requestRender, { passive: true });
    window.addEventListener('touchmove', requestRender, { passive: true });
    window.addEventListener('pointerdown', requestRender, { passive: true });

    // Back/forward cache
    window.addEventListener('pageshow', requestRender, { passive: true });

    // visualViewport (iOS Safari)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('scroll', requestRender, { passive: true });
      window.visualViewport.addEventListener('resize', requestRender, { passive: true });
    }
  };

  // Shopify editor: cuando cargas secciones dinámicamente
  const setupShopifyEditorHooks = () => {
    document.addEventListener('shopify:section:load', () => init(true));
    document.addEventListener('shopify:section:reorder', () => init(true));
  };

  // Init con retry ligero (NO loop infinito) por si Shopify inserta tarde
  const init = (reinit = false) => {
    const found = Array.from(document.querySelectorAll('[data-st4rt-sgt]'));

    if (!found.length) return false;

    if (reinit) {
      // reset estado sin duplicar listeners
      state.sections = found;
      state.active.clear();
    } else {
      state.sections = found;
      setupViewportListeners();
      setupShopifyEditorHooks();
    }

    // cache cfg y set estado inicial (fantasma) antes de scroll
    state.sections.forEach(s => { s.__sgtCfg = readCfg(s); });

    setupIO();
    requestRender();
    return true;
  };

  // DOM ready + retry corto (máximo ~800ms)
  const boot = () => {
    if (init(false)) return;
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (init(false) || tries >= 8) clearInterval(t);
    }, 100);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();