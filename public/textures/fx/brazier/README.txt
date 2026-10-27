The braziers' fire (js/brazier.js), from the artist's sketch art/braseros_fuego_verde.kra (one layer per stage).
flame_A.png  small flame (sketch layer "Capa de pintura 3")   — state A
flame_B.png  medium flame (layer 5)                           — state B
flame_C.png  tall flame with side tongues (layer 6)           — state C
sparks.png   4x4 atlas of the green and white flakes (layers 12 and 14), the rising fragments
Only the fire is taken (the cup is built in 3D by the game). Re-export after editing the sketch:
  python3 tools/brazier_sprites.py art/braseros_fuego_verde.kra public/textures/fx/brazier
then copy brazier.json's frame sizes into R.brazierCfg.flames if they changed.
