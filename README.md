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

## Créditos de arte de terceros

| Recurso | Archivo | Autor | Licencia |
|---|---|---|---|
| Espada larga | `public/models/weapons/longsword.glb` | "Paladin Longsword [Free Download]" por [Efarys](https://sketchfab.com/Efarys) — [fuente](https://sketchfab.com/3d-models/paladin-longsword-free-download-7baa85e6e5d74526b2dd461d15f2b4ea) | [CC-BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/) |

La espada está modificada (texturas reducidas a 512 px y empaquetadas en GLB; en el juego se ve 2× más ancha y gruesa). Por la licencia CC-BY-SA, el archivo modificado se comparte bajo la misma licencia y hay que mantener el crédito en cualquier lugar donde se publique el juego (también figura en Ajustes › Juego › Créditos).
| Roca de paredes | `public/textures/dark_rock_02/` (color, normal OpenGL y rugosidad, 1024 px) | "Dark Rock 02" de [Poly Haven](https://polyhaven.com/a/dark_rock_02) | CC0 (dominio público) |

| Piso de piedra mezclado | `public/textures/floor_mix/` (16×16 m, generado con `tools/floor_mix.py`) | "grey_cartago_01", "rock_06" y "rock_face_03" de [Poly Haven](https://polyhaven.com) | CC0 (dominio público) |

| Columnas (roca negra y rocas agrietadas) | `public/textures/pillar/` (512 px) | "dark_rock", "rock_06" y "rock_face_03" de [Poly Haven](https://polyhaven.com) | CC0 (dominio público) |

El mármol de los pisos no es un archivo: se genera por código (`R.marbleTextures` en `js/render.js`).
