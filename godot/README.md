# Hexwright — versión Godot (primera porción jugable)

Proyecto de Godot 4 (probado con **Godot 4.7.1**). Es una primera porción del juego para evaluar el motor; la versión web (carpeta raíz del repo) sigue intacta.

## Cómo abrirlo
1. Abrí Godot → **Importar** → elegí `godot/project.godot`.
2. La primera vez Godot importa los modelos y texturas (tarda unos segundos).
3. **F5** (o el botón ▶) para jugar.

## Controles
- **WASD**: mover (relativo a la pantalla)
- **Mouse**: apuntar
- **Clic izquierdo** (o J): combo de espada de 3 golpes
- **Espacio**: impulso (2 cargas)
- **R**: reiniciar

## Qué incluye
- Una sala con piso, muros, pilares y braseros verdes, y una cámara isométrica ortográfica (45°/40°) como en la web.
- **Theron** (`theron_B.glb`) con sus animaciones y la espada larga.
  - El brazo derecho usa una IK de dos huesos (`scripts/arm_ik.gd`) que sigue la trayectoria de cada golpe, igual que en la web: los clips mueven el cuerpo y la espada sigue los caminos del juego.
- **Combo de 3 golpes** con los mismos números que la web: tajo de 180°, golpe vertical de 25° y estocada en línea de 2 m con paso adelante.
  - Tiene tiempos, empujes, hit-stop y temblor de cámara.
  - Usa el tajo pintado y una ráfaga de la estocada de Krita.
- **Impulso**: 4,8 m en 0,14 s, con 2 cargas.
- **Husks**: persiguen, se preparan (con marca roja en el piso), embisten y se recuperan.
  - Se aturden al recibir golpes y mueren con animación.
- **Oleadas** crecientes, barra de vida, números de daño y pantalla de derrota.

## Estructura
- `scripts/tuning.gd`: todos los números (copiados de `js/data.js`).
- `scripts/player.gd`: Theron (movimiento, impulso, combo, animaciones, trayectorias de la espada).
- `scripts/arm_ik.gd`: IK del brazo de la espada.
- `scripts/husk.gd`: el enemigo.
- `scripts/main.gd`: sala, luz, cámara, oleadas, golpes y efectos, HUD.
- `tests/`: escenas de prueba automáticas (capturas y una partida simulada); no forman parte del juego.

## Próximos pasos sugeridos
- El look pintado (los pases de `js/paint.js`) como shader de pantalla.
- Los efectos pintados completos: tajo en 3 capas, impulso y estocada.
- Más enemigos, generación de salas, habilidades, recompensas y tienda.
- Interfaz y menús, audio, guardado.
- Exportación a Windows y Steamworks.
