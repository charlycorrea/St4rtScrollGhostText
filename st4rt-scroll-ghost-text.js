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
    const isMultiline = section.getAttribute('data-sgt-multiline') === 'true';

    return {
      distance: readNum(section, 'data-sgt-distance', 600),
      // En multi-línea evitamos escalar bloques largos para reducir costo de composición/pintado.
      scaleFrom: isMultiline ? 1 : Math.max(1, readNum(section, 'data-sgt-scale-from', 320) / 100),
      opacityFrom: clamp(readNum(section, 'data-sgt-opacity-from', 0) / 100, 0, 1),
      ease: section.getAttribute('data-sgt-ease') || 'easeOut',
      animateScale: !isMultiline
    };
  };

  const STYLE_EPSILON = 0.0005;

  const getViewportHeight = () => {
    if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
      return window.visualViewport.height;
    }
    return window.innerHeight || document.documentElement.clientHeight || 0;
  };

  // Estado global
  const state = {
    sections: [],
    active: new Set(), // solo secciones cerca del viewport
    ticking: false,
    io: null,
    frame: [],
    reinitRaf: 0
  };

  const disconnectIO = () => {
    if (state.io) {
      state.io.disconnect();
      state.io = null;
    }

    state.active.forEach((section) => setWillChange(section, false));
    state.active.clear();
  };

  const setWillChange = (section, enabled) => {
    const text = section.__sgtTextEl || (section.__sgtTextEl = section.querySelector('[data-sgt-text]'));
    if (!text) return;

    const cfg = section.__sgtCfg || (section.__sgtCfg = readCfg(section));
    const next = enabled ? (cfg.animateScale ? 'transform, opacity' : 'opacity') : 'auto';

    if (section.__sgtWillChange !== next) {
      text.style.willChange = next;
      section.__sgtWillChange = next;
    }
  };

  const cleanupSectionCache = (section) => {
    setWillChange(section, false);
    state.active.delete(section);
    section.__sgtCfg = undefined;
    section.__sgtTextEl = undefined;
    section.__sgtPrevScale = undefined;
    section.__sgtPrevOpacity = undefined;
    section.__sgtWillChange = undefined;
  };

  const refreshSections = () => {
    const found = Array.from(document.querySelectorAll('[data-st4rt-sgt]'));

    // Limpia cache de secciones eliminadas para evitar referencias colgantes.
    state.sections
      .filter((section) => !found.includes(section))
      .forEach(cleanupSectionCache);

    state.sections = found;
    state.active.clear();

    state.sections.forEach((section) => {
      section.__sgtCfg = readCfg(section);
      section.__sgtTextEl = section.querySelector('[data-sgt-text]');
      section.__sgtPrevScale = undefined;
      section.__sgtPrevOpacity = undefined;
      section.__sgtWillChange = undefined;
      setWillChange(section, false);
    });

    return found.length > 0;
  };

  const computeOne = (section, viewportCenter) => {
    const text = section.__sgtTextEl || (section.__sgtTextEl = section.querySelector('[data-sgt-text]'));
    if (!text) return null;

    const cfg = section.__sgtCfg || (section.__sgtCfg = readCfg(section));

    const top = section.getBoundingClientRect().top;

    // 0 = fantasma cuando top está lejos por debajo del centro
    // 1 = sólido cuando top llega al centro del viewport
    // y se mantiene en 1 hasta el top (clamp)
    const raw = (cfg.distance - (top - viewportCenter)) / Math.max(1, cfg.distance);
    const t = easeFn(clamp(raw, 0, 1), cfg.ease);

    return {
      section,
      text,
      animateScale: cfg.animateScale,
      scale: cfg.animateScale ? lerp(cfg.scaleFrom, 1, t) : 1,
      opacity: lerp(cfg.opacityFrom, 1, t)
    };
  };

  const render = () => {
    state.ticking = false;
    if (!state.active.size) return;

    // Fase 1: lecturas
    const viewportCenter = getViewportHeight() * 0.5;
    state.frame.length = 0;
    state.active.forEach((section) => {
      const values = computeOne(section, viewportCenter);
      if (values) state.frame.push(values);
    });

    // Fase 2: escrituras (evita intercalar read/write por sección)
    state.frame.forEach(({ section, text, animateScale, scale, opacity }) => {
      const prevScale = section.__sgtPrevScale;
      const prevOpacity = section.__sgtPrevOpacity;

      if (animateScale) {
        if (prevScale === undefined || Math.abs(scale - prevScale) > STYLE_EPSILON) {
          text.style.transform = `translateZ(0) scale(${scale})`;
          section.__sgtPrevScale = scale;
        }
      }

      if (prevOpacity === undefined || Math.abs(opacity - prevOpacity) > STYLE_EPSILON) {
        text.style.opacity = String(opacity);
        section.__sgtPrevOpacity = opacity;
      }
    });
  };

  const requestRender = () => {
    if (state.ticking) return;
    state.ticking = true;
    requestAnimationFrame(render);
  };

  // IntersectionObserver: activa/desactiva cómputo según cercanía
  const setupIO = () => {
    disconnectIO();

    if (!('IntersectionObserver' in window)) {
      // fallback: si no hay IO, consideramos todas activas
      state.active.clear();
      state.sections.forEach((section) => {
        state.active.add(section);
        setWillChange(section, true);
      });
      return;
    }

    state.io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          state.active.add(entry.target);
          setWillChange(entry.target, true);
        } else {
          state.active.delete(entry.target);
          setWillChange(entry.target, false);
        }
      }
      requestRender();
    }, {
      root: null,
      // empieza a animar cuando esté cerca, sin gastar CPU lejos
      rootMargin: '150% 0px 150% 0px',
      threshold: 0.01
    });

    state.sections.forEach((section) => state.io.observe(section));
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

  const scheduleReinit = () => {
    if (state.reinitRaf) cancelAnimationFrame(state.reinitRaf);

    state.reinitRaf = requestAnimationFrame(() => {
      state.reinitRaf = 0;
      reinit();
    });
  };

  const reinit = () => {
    const hasSections = refreshSections();
    if (!hasSections) {
      disconnectIO();
      return;
    }

    setupIO();
    requestRender();
  };

  const removeSection = (event) => {
    const section = event.target && event.target.matches && event.target.matches('[data-st4rt-sgt]')
      ? event.target
      : null;

    if (!section) {
      scheduleReinit();
      return;
    }

    cleanupSectionCache(section);
    state.sections = state.sections.filter((current) => current !== section);

    if (!state.sections.length) {
      disconnectIO();
      return;
    }

    scheduleReinit();
  };

  // Shopify editor: cuando cargas secciones dinámicamente
  const setupShopifyEditorHooks = () => {
    document.addEventListener('shopify:section:load', scheduleReinit);
    document.addEventListener('shopify:section:reorder', scheduleReinit);
    document.addEventListener('shopify:section:unload', removeSection);

    // Cambios live del editor (select/deselect o cambio de bloques)
    // pueden alterar posición/layout sin disparar load/reorder.
    document.addEventListener('shopify:section:select', scheduleReinit);
    document.addEventListener('shopify:section:deselect', scheduleReinit);
    document.addEventListener('shopify:block:select', scheduleReinit);
    document.addEventListener('shopify:block:deselect', scheduleReinit);
  };

  // Init con retry ligero (NO loop infinito) por si Shopify inserta tarde
  const init = () => {
    const hasSections = refreshSections();
    if (!hasSections) return false;

    setupViewportListeners();
    setupShopifyEditorHooks();
    setupIO();
    requestRender();
    return true;
  };

  // DOM ready + retry corto (máximo ~800ms)
  const boot = () => {
    if (init()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (init() || tries >= 8) clearInterval(timer);
    }, 100);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
