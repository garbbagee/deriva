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

## Estructura

```
index.html     punto de entrada
style.css      estilos mínimos (canvas a pantalla completa)
src/audio.js   motor de audio sintetizado (Web Audio API, sin archivos)
src/main.js    lógica del juego, física, partículas y render
DESIGN.md      documento de diseño
```
