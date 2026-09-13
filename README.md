# DERIVA

Una gota de luz bioluminiscente a la deriva en un océano abisal. Absorbe
motas de plancton para florecer antes de que la oscuridad te consuma.

Ver [DESIGN.md](DESIGN.md) para las decisiones de diseño y dirección artística.

## Cómo jugar

Abre `index.html` directamente en un navegador moderno (Chrome, Edge,
Firefox). No requiere instalación, build ni servidor — es HTML5 Canvas y
JavaScript puro, sin dependencias externas.

- **Ratón / táctil:** la gota persigue el puntero.
- **Teclado:** WASD o flechas.
- Absorbe la luz cian y violeta, evita los zarcillos de sombra.
- Llena el medidor superior para florecer y ganar. Si tu luz llega a cero,
  la oscuridad te cubre.
- **F** o el icono de la esquina: pantalla completa. **Esc**: pausa y ajustes
  rápidos (sensibilidad de control, densidad de zarcillos en Chill).

## Modos

- **Deriva:** el modo clásico descrito arriba.
- **Chill:** sin derrota, come motas infinitamente; los zarcillos son
  opcionales y configurables en Ajustes.
- **Niveles:** 5 niveles con objetivo y límite de tiempo crecientes; el
  progreso se guarda localmente.

## Estructura

```
index.html       punto de entrada
style.css        estilos mínimos (canvas a pantalla completa)
src/settings.js  ajustes y progreso persistentes (localStorage)
src/audio.js     motor de audio sintetizado (Web Audio API, sin archivos)
src/main.js      lógica del juego, física, partículas, UI y render
DESIGN.md        documento de diseño
```
