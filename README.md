# Hexwright

Roguelike de acción en 3D hecho con HTML, JavaScript y Three.js r128.

## Cómo jugar en local

Servir la carpeta con cualquier servidor estático y abrir `index.html`:

```
python3 -m http.server 8765
```

Three.js r128 se carga desde cdnjs; `GLTFLoader` y `SkeletonUtils` (r128) están en `js/vendor/`.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `index.html` | CSS, capas del HUD y orden de carga de scripts |
| `js/core.js` | Utilidades, guardado, ajustes, entrada, glifos |
| `js/data.js` | Datos: hechizos, armas, objetos, enemigos, estados, clases |
| `js/audio.js` | Sonido sintetizado (WebAudio) |
| `js/render.js` | Escena, cámara, salas, efectos, modelos procedurales y su animación |
| `js/models.js` | Registro y carga de modelos .glb |
| `js/game.js` | Partida, jugadores, ataques, daño, estados, colisiones, oleadas, inventario, tienda |
| `js/enemies.js` | IA de enemigos y jefes |
| `js/ui.js` | Menús, HUD, inventario, tienda |
| `js/main.js` | Bucle principal (paso fijo de 1/60 s) |
| `js/i18n.js` | Textos en español |
