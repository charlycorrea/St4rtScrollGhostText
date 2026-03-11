# Análisis del componente `ST4RT Scroll Ghost Text`

## 1) Resumen de arquitectura

El componente está compuesto por:
- **Liquid**: define estructura HTML, `data-*` de configuración y settings de editor Shopify.
- **CSS**: layout tipográfico, espaciado y propiedades para animación.
- **JS**: cálculo de progreso por scroll y aplicación de `transform/opacity` con `requestAnimationFrame`.

## 2) Puntos fuertes

1. **Enfoque performance-first bien encaminado**
   - Usa `requestAnimationFrame` para evitar renders descontrolados en cada evento de scroll.
   - Usa `IntersectionObserver` para activar cómputo solo cerca de viewport.
   - Usa listeners `passive: true` en scroll/touch para reducir bloqueo del hilo principal.

2. **Compatibilidad razonable en iOS/Safari**
   - Incluye soporte para `visualViewport` (`scroll` + `resize`) y eventos de primer gesto para evitar “primer scroll sin render”.

3. **Configurabilidad alta desde Shopify Theme Editor**
   - Distancia, escala inicial, opacidad inicial y easing son personalizables.
   - Tipografía, tamaño, espaciado y alineación también son configurables.

4. **Respeto por accesibilidad de movimiento**
   - Sale tempranamente si `prefers-reduced-motion: reduce` está activo.

## 3) Puntos débiles / riesgos

1. **Posible fuga de observers/listeners en reinit del editor**
   - En `init(true)` se vuelve a llamar `setupIO()` pero no se conserva/desconecta una instancia anterior de `IntersectionObserver`.
   - En sesiones largas del editor puede acumular observadores.

2. **Costo potencial por `querySelector` en cada frame**
   - `computeOne` ejecuta `section.querySelector('[data-sgt-text]')` en cada render por sección activa.
   - Conviene cachear referencia al nodo texto por sección para reducir trabajo por frame.

3. **`will-change` permanente**
   - Mantener `will-change: transform, opacity` siempre activo puede aumentar consumo de memoria/composición.
   - Mejor activarlo solo cuando la sección está activa o en cercanía del viewport.

4. **Inconsistencia en tamaños tipográficos mobile/desktop en CSS**
   - `.st4rt-sgt__text` define `font-size: var(--sgt-size-m)` y luego se sobrescribe globalmente con `font-size: var(--sgt-size-d)` antes del media query.
   - Esto hace que el tamaño mobile no se respete como aparenta el naming.

5. **Usabilidad/legibilidad limitada en textos largos**
   - Se fuerza `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`; para titulares largos puede truncar demasiado y afectar comprensión.

6. **Sin transición clara para usuarios sin JS o con JS tardío**
   - Aunque hay `style` inline inicial, la percepción puede variar si JS carga tarde o si hay layout shifts por fuentes.

## 4) Oportunidades de optimización (performance)

### A. Reducir trabajo por frame
- Cachear por sección:
  - `__sgtTextEl`
  - `__sgtCfg`
- Evitar escrituras de estilo si el valor no cambió (epsilon):
  - comparar escala/opacidad previas y saltar update si diferencia mínima.

### B. Administrar ciclo de vida
- Guardar el observer en `state.io` y hacer `disconnect()` en reinit antes de crear uno nuevo.
- Si se extiende el componente, incluir `shopify:section:unload` para limpiar referencias y evitar leaks.

### C. Afinar listeners
- Consolidar listeners de gesto (`touchstart/touchmove/pointerdown`) para no sobrerreaccionar; mantener solo los estrictamente necesarios.
- En páginas muy pesadas, considerar throttling adicional al rAF trigger en `resize`/`visualViewport`.

### D. Evitar compositing excesivo
- Mover `will-change` a una clase `.is-active` administrada por JS o IO.

### E. Estabilidad visual
- Corregir la jerarquía mobile/desktop en CSS.
- Si hay webfonts pesadas, usar estrategias para minimizar salto visual (por ejemplo, métricas compatibles/fallback más cercano).

## 5) Mejoras de usabilidad

1. **Legibilidad responsive real**
   - Corregir `font-size` mobile vs desktop.
   - Permitir opcionalmente wrap (`white-space: normal`) y multiline para titulares largos.

2. **Controles de accesibilidad**
   - Exponer setting “Desactivar animación” por sección (además de `prefers-reduced-motion`).
   - Añadir límite de escala inicial recomendado para no degradar lectura en pantallas pequeñas.

3. **Feedback en editor Shopify**
   - Render inicial consistente al modificar settings en vivo (recalcular sin parpadeo).

4. **Contenido semántico**
   - Según contexto, permitir elegir tag (`h1/h2/div`) para SEO y jerarquía visual.

## 6) Prioridad recomendada (quick wins)

1. **Alta prioridad**: corregir bug de `font-size` mobile/desktop.
2. **Alta prioridad**: lifecycle de `IntersectionObserver` en reinit.
3. **Media**: cachear `data-sgt-text` y delta-update de estilos.
4. **Media**: revisar estrategia de truncado (`nowrap/ellipsis`) para UX real.
5. **Baja-media**: activar/desactivar `will-change` dinámicamente.

## 7) KPI sugeridos para validar mejoras

- **FPS durante scroll** en mobile (iOS Safari y Android Chrome).
- **Main-thread time** y recuento de layout/recalculate style por frame.
- **Memory footprint** antes/después de múltiples reorders/loads en editor Shopify.
- **CLS/LCP** (si la sección está above-the-fold).
- **CTR/engagement** de la sección tras ajuste de legibilidad.

## 8) Conclusión

El componente ya está bien orientado a rendimiento (rAF + IO + passive listeners + reduced motion), pero tiene margen claro en **lifecycle management**, **consumo por frame** y **consistencia responsive**. Con 2–3 ajustes puntuales se puede mejorar tanto la fluidez como la usabilidad sin cambiar la idea base del efecto.

## 9) Lista de tareas propuesta (basada en nuevas recomendaciones)

> Objetivo: ejecutar mejoras de forma incremental y validable, una por una.

### Fase 1 — Ajuste de lógica de scroll (prioridad alta)
1. **Redefinir el punto de “100%” del efecto**
   - Cambiar la fórmula de progreso para que el estado final (scale=1, opacity=1) ocurra cuando el bloque esté en el **centro del viewport**.
   - Mantener `t=1` desde ese punto hasta que el bloque llegue al tope (sin retroceder visualmente).
2. **Agregar setting opcional de anclaje de reveal**
   - Nuevo control de configuración: `Top` (comportamiento actual) vs `Centro` (nuevo comportamiento).
   - Valor por defecto sugerido: `Centro`.
3. **Validación cross-device del nuevo umbral**
   - Verificar desktop + iOS Safari (incluyendo `visualViewport`) para confirmar consistencia.

### Fase 2 — Corrección de tipografía/estilos (prioridad alta)
4. **Corregir cascada CSS mobile/desktop**
   - Eliminar la sobrescritura global que fuerza `--sgt-size-d` fuera del media query.
5. **Normalizar aplicación de color/tamaño en rich text**
   - Asegurar que nodos internos (`strong`, `em`, `a`, `span`, etc.) hereden color y tipografía del contenedor.
   - Revisar reglas específicas para fuentes display (ej. Bebas Neue), evitando estilos del tema que pisen el componente.
6. **Definir contrato de estilo robusto para la fuente seleccionada en el editor**
   - Garantizar que `font-family`, `font-size`, `line-height`, `letter-spacing` y `color` se respeten en todos los casos.

### Fase 3 — Soporte multi-línea y mejor usabilidad (prioridad alta)
7. **Habilitar modo multi-línea configurable**
   - Nuevo setting: `Single line` / `Multi-line`.
   - En multi-línea: remover `nowrap/ellipsis` y permitir wrapping natural.
8. **Compatibilizar alineación y formato de editor de texto**
   - Mantener alineación configurable (`left/center/right`) en múltiples líneas.
   - Permitir formato típico de rich text sin romper layout.
9. **Ajustar animación para bloques multi-línea sin degradar performance**
   - Mantener transform/opacity sobre un único wrapper animado.
   - Evitar cálculos por nodo interno.

### Fase 4 — Hardening de performance y lifecycle (prioridad media)
10. **Gestionar ciclo de vida de `IntersectionObserver` en reinit**
    - Guardar instancia en estado global y desconectarla en reinicializaciones.
11. **Cachear nodos y evitar trabajo redundante por frame**
    - Cache de `data-sgt-text` + skip de escrituras cuando no haya cambio significativo.
12. **Optimizar `will-change` dinámico**
    - Activarlo solo en secciones cercanas/activas para reducir costo de composición.

### Fase 5 — QA funcional y release (prioridad media)
13. **Pruebas funcionales en Shopify editor**
    - `section:load`, `section:reorder`, edición en vivo de settings.
14. **Pruebas visuales y de rendimiento**
    - Comparativas antes/después (FPS, main-thread time, memory) en mobile y desktop.
15. **Documentación de uso para contenido largo**
    - Recomendaciones de copy, ancho máximo y modos de multiline para equipos de contenido.
