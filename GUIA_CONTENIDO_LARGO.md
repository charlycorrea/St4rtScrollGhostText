# Guía de uso — contenido largo en ST4RT Scroll Ghost Text (Tarea 15)

## Cuándo usar `single-line` vs `multi-line`

- **Usa `single-line`** cuando el mensaje sea corto (headline/claim) y quieras un impacto visual fuerte.
- **Usa `multi-line`** cuando el texto supere 45–60 caracteres o incluya formato rich text (negritas, listas, enlaces).

## Recomendaciones editoriales

1. **Longitud sugerida**
   - Single-line: hasta 6–10 palabras.
   - Multi-line: máximo 2–4 líneas visibles en desktop para mantener escaneabilidad.

2. **Alineación**
   - Textos promocionales breves: `center`.
   - Textos descriptivos largos: `left` (mejor lectura continua).

3. **Mayúsculas (`uppercase`)**
   - Activar solo en titulares cortos.
   - En párrafos largos, desactivarlo para mejorar legibilidad y ritmo de lectura.

4. **Ancho máximo (`max_width`)**
   - Para textos largos: preferir **680–980px**.
   - Evitar anchos completos en desktop para reducir fatiga visual.

5. **Tipografía y espaciado**
   - Priorizar `line-height` entre **1.1 y 1.3**.
   - Mantener `letter-spacing` moderado (0–2px) en textos largos.

## Recomendaciones de performance

1. En contenido largo usar `text_layout = multiline` para habilitar modo de menor costo (opacidad sin escala).
2. Mantener `reveal_distance` en rango medio (400–700) para evitar animaciones excesivamente largas.
3. Evitar secciones consecutivas muy densas con el mismo efecto; alternar con bloques estáticos.

## Checklist previo a publicación

- [ ] El texto no se trunca en mobile.
- [ ] El bloque mantiene legibilidad en 320px y 390px de ancho.
- [ ] El color de texto conserva contraste suficiente respecto al fondo.
- [ ] En Theme Editor, cambios de `text_layout`, `align` y tipografía se reflejan sin parpadeos.
- [ ] Scroll fluido sin saltos perceptibles en móvil y desktop.

## Valores iniciales sugeridos (preset rápido)

- `text_layout`: `multiline` (para contenido editorial)
- `size_mobile`: 26–34
- `size_desktop`: 44–60
- `line_height`: 1.2
- `letter_spacing`: 0–1
- `max_width`: 820
- `uppercase`: desactivado

---

Esta guía complementa el análisis técnico (`ANALISIS_COMPONENTE.md`) y la validación de QA (`QA_TAREA14.md`) para facilitar uso consistente por equipos de contenido.
