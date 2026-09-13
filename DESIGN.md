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

## Modos de juego
- **Deriva (clásico):** la experiencia original descrita arriba.
- **Chill:** sin decaimiento de Luz y sin derrota — se puede comer motas
  infinitamente. Al llegar al máximo, la gota florece como celebración y
  continúa (el medidor se reinicia a un tercio). Los zarcillos son opcionales
  y configurables (ninguno / pocos / normal) para dejar la sesión puramente
  relajante o darle algo de tensión.
- **Niveles:** 5 niveles con objetivo de Luz y límite de tiempo crecientes.
  Superar un nivel desbloquea el siguiente (progreso guardado). Se pierde por
  quedarse sin Luz o por agotar el tiempo.

## Ajustes (persistentes, localStorage)
- Sensibilidad de control: un único valor (0.5x–2.0x) que afecta por igual
  la respuesta al ratón (rigidez del resorte que persigue el puntero) y la
  velocidad efectiva de WASD/flechas.
- Densidad de zarcillos en modo Chill.
- Pantalla completa (tecla F o icono en la esquina), y pausa (Esc) con acceso
  rápido a estos mismos ajustes sin salir de la partida.

## Notas técnicas de calidad visual
- Resolución de canvas ligada a devicePixelRatio (hasta 3x) para texto y
  trazos nítidos en pantallas de alta densidad.
- Los zarcillos se dibujan como una silueta orgánica ahusada (gruesa en la
  base, fina en la punta) con relleno degradado y núcleo oscuro, no como una
  simple línea de grosor uniforme.
- Aparición/desaparición de zarcillos siempre con fundido (alpha in/out de
  ~0.6s) para que ajustar la dificultad nunca se sienta como un "pop" — antes
  un zarcillo podía desvanecerse de golpe a media pantalla; ahora siempre
  se disuelve suavemente.

## Pipeline de render y escalado (revisión a fondo)
- El tamaño del canvas se fija en dos capas: el *backing store* en píxeles
  físicos (`innerWidth/Height * devicePixelRatio`, hasta 3x) para nitidez en
  HiDPI, y el tamaño CSS explícito en píxeles lógicos vía `canvas.style.width/
  height` (no `vw/vh`), para que nunca haya un reescalado adicional del
  navegador entre ambos — esa es la causa más común de blur "misterioso".
- `devicePixelRatio` puede cambiar sin disparar `resize` (zoom del navegador,
  arrastrar la ventana a otro monitor). Un listener de `matchMedia` que se
  reinstala solo detecta ese caso y vuelve a dimensionar el canvas.
- El contexto 2D se resetea explícitamente al inicio de cada frame
  (shadowBlur, shadowColor, alpha, grosores) para que ningún halo o sombra
  de un dibujo anterior pueda filtrarse por accidente a otro.
- Un factor `UI` (0.62x–1.3x, según el tamaño real de la ventana respecto a
  una resolución de referencia) escala tipografía, botones, controles y el
  medidor — así el menú, ajustes, niveles, pausa y HUD mantienen su
  composición y proporciones en ventanas pequeñas, monitores grandes y
  pantalla completa. Deliberadamente NO se aplica a la gota, las motas ni
  los zarcillos: su tamaño en píxeles debe ser estable respecto al puntero,
  no respecto al tamaño del monitor — escalarlos con la ventana cambiaría el
  juego (hitboxes, dificultad) sólo por el tamaño de pantalla, algo que un
  buen juego nunca debería hacer.
- Cursor propio: el sistema oculta el cursor real (la gota hace de puntero
  durante la partida), pero en cualquier pantalla de menú/ajustes/pausa se
  dibuja un cursor propio con el mismo lenguaje visual — antes, en pausa, el
  jugador no tenía forma de ver dónde estaba apuntando.

## Investigación: zarcillo que desaparece entre 6–7
Causa raíz real (no sólo el "pop" ya descrito): el número de zarcillos
objetivo se recalculaba cada frame a partir de la Luz actual. Tras un golpe,
la Luz cae de golpe y ese recálculo podía retirar un zarcillo y, apenas
la Luz se recuperaba un poco, generar uno nuevo casi de inmediato — un
parpadeo de baja/alta población que se percibía como "uno desaparece" aunque
cada transición individual ya tuviera fundido. La correción aplica
histéresis: el número aplicado sólo cambia como máximo una vez cada ~1.4s,
así que la población se siente estable e intencional en vez de nerviosa.
Además se endureció la geometría de la silueta (mínimo de longitud de
tangente al calcular la normal, para que curvas muy cerradas nunca generen
un vector de silueta desbocado) y se subió el grosor/opacidad mínimos de la
punta, para que ningún zarcillo llegue a leerse como "borrado" por su propio
desvanecimiento hacia la punta.

## Investigación: la gota se veía "rara"
Causa raíz: el pulso de crecimiento al comer una mota grande (`popScale`)
deformaba la gota por *dos* caminos a la vez — el radio (`R`) y además el
propio `sx/sy` del squash-stretch de movimiento. Comer una mota grande
mientras se iba rápido sumaba ambas deformaciones y producía una silueta
asimétrica y alargada de forma inconsistente. Ahora `popScale` sólo
engorda el radio (pulso uniforme, "inhalar luz"); el squash-stretch
direccional depende únicamente de la velocidad, sin mezclarse con el pulso
de alimentación.

## Chill: la floración se sentía como "fin de nivel"
El bucle de floración en Chill ya reiniciaba la Luz a un tercio y volvía a
`playing` (nunca a `win`) — no había regresión mecánica al menú. El
problema era de sensación: 2.4s con el personaje congelado en el centro y
un flash a pantalla completa, igual que en Niveles/Clásico, se percibe como
que la partida terminó aunque técnicamente continúe. Se añadió
`cfg.bloomDuration` por modo: Chill florece en 0.9s (pulso rápido de
celebración que no corta el flujo de farmear/relajarse), Niveles y Clásico
mantienen los 2.4s originales (el momento de victoria merece pesar más).
