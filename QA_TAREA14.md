# Tarea 14 — QA visual y performance

## Objetivo
Validar estabilidad visual y costo de ejecución del componente `ST4RT Scroll Ghost Text` en un escenario de scroll continuo (desktop), revisando señales de FPS, carga del hilo principal y memoria JS.

## Escenario probado
- Preview local con 2 variantes:
  - Modo multi-línea (`data-sgt-multiline="true"`, animación de opacidad).
  - Modo single-line (`data-sgt-multiline="false"`, animación de escala + opacidad).
- Scroll sintético en múltiples pasos para forzar recalculo y render.

## Métricas capturadas (Playwright + Performance APIs)
- `raf_samples`: **207**
- `avg_frame_ms`: **16.52 ms**
- `p95_frame_ms`: **18.40 ms**
- `approx_fps`: **60.5 FPS**
- `long_tasks`: **0**
- `heap_mb`: **9.54 MB** (Chromium con `performance.memory` disponible)

## Resultado
- Rendimiento visual consistente en scroll con FPS aproximado en el rango objetivo de 60.
- Sin long tasks detectadas durante la ventana de prueba.
- Uso de memoria observado estable para el escenario evaluado.

## Notas
- Esta validación corresponde a un smoke/perf check de QA técnico local.
- Para cierre final en tienda real, se recomienda repetir en Theme Editor de Shopify con contenido real (texto largo, reorder/select, móvil iOS).
