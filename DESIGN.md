# DERIVA — documento de diseño

## Concepto
Eres una gota de luz bioluminiscente a la deriva en un océano abisal.
El juego es una sola escena, un solo objetivo: reunir suficiente luz para
florecer antes de que la oscuridad te apague.

- **Género:** arcade contemplativo de riesgo/recompensa (2–4 minutos por partida).
- **Mecánica central:** el jugador guía la gota con el puntero (o WASD/flechas).
  La gota persigue el objetivo con inercia/resorte (spring-damper), nunca
  teletransporta — todo el movimiento es continuo y con peso.
- **Objetivo:** absorber motas de plancton luminoso para llenar el medidor de
  Luz. Al llegar al máximo, la gota florece (secuencia de victoria).
- **Amenaza:** zarcillos de sombra que flotan lentamente por la escena. Tocarlos
  drena Luz de golpe y empuja a la gota (impacto físico, screen shake, flash).
  Además la Luz decae muy lentamente sola (presión temporal suave).
- **Derrota:** la Luz llega a cero → fundido a negro → pantalla final.
- **Curva de dificultad:** cuantas más motas grandes existen, cuanta más Luz
  tiene el jugador, más zarcillos aparecen y más rápido se mueven — el propio
  progreso del jugador es lo que aumenta la tensión.

## Dirección artística
- **Paleta:** abismo casi negro (#03050c) con acentos cian-turquesa
  (#5ef1d6) y violeta bioluminiscente (#a06bff) para las amenazas. Un único
  color cálido de acento (#ffd27a) reservado para el clímax de la floración.
- **Iluminación:** todo brilla por *glow* (radial gradients + shadowBlur),
  nunca hay bordes duros. La gota emite luz que ilumina el agua a su
  alrededor (vignette dinámico).
- **Composición:** cámara fija centrada, viñeta oscura en los bordes que se
  abre ligeramente conforme el jugador gana Luz (la luz literalmente empuja
  la oscuridad hacia afuera).
- **Tipografía:** una sola familia sans-serif de trazo fino (system-ui) en
  mayúsculas espaciadas para títulos, minúscula para texto de apoyo — sin
  cuadros ni paneles, el texto flota directamente sobre el agua.
- **Partículas:** motas de plancton con parpadeo suave, estelas de la gota,
  ondas concéntricas al absorber, partículas de "ceniza" oscura al chocar
  con un zarcillo, destello radial en la floración final.
- **Cámara:** leve *drift* ambiental constante + shake de impacto con
  decaimiento exponencial.
- **Sonido:** 100% sintetizado con Web Audio (sin archivos externos) — pad
  ambiental grave, campanas suaves al absorber (tono sube con el tamaño de
  la mota), golpe sordo + ruido al chocar con sombra, acorde ascendente en
  la floración.

## Controles
- Ratón / touch: la gota persigue el puntero.
- Teclado alternativo: WASD / flechas (fuerza direccional constante).
- Un único botón de acción: ninguno — todo el juego es movimiento puro.

## Sensación buscada
Calma tensa. El jugador debe sentir que cada mota importa, que cada zarcillo
evitado por poco fue una decisión suya, y que la floración final es un
alivio ganado, no un checkpoint más.

## Alcance (deliberadamente pequeño)
Una escena, un mecánica, un medidor, dos tipos de mota, un tipo de amenaza,
menú, juego, victoria, derrota, reinicio. Nada más.
