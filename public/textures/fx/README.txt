Theron's sword slash (js/slashfx.js), painted in Krita by the project author.
Source: art/theron_slash_v3.kra ("Efecto Golpe Basico Espada"), three paint layers = three stages of the slash:
theron_slash_1.png — Capa de pintura 1: the turquoise sweep (appears first)
theron_slash_2.png — Capa de pintura 2: the blue-white energy arc (over 1)
theron_slash_3.png — Capa de pintura 3: the crystal arc with sparkles (over 2)
All 512x512 RGBA, transparent background. Re-export after editing the .kra with:
  python3 tools/kra_slash.py art/theron_slash_v3.kra public/textures/fx
(a faint stray brush ring in Capa 1 at 270,165 is removed by the script).
Earlier versions (art/theron_slash.kra, art/theron_slash2.png) are kept as source history.
