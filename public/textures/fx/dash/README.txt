Theron's dash trail (js/dashfx.js), painted in Krita by the project author: theron_dash_animacion_v2
(8 directions x 20 frames at 40 fps, isometric view, animation "in place").
These sheets hold only the energy layers, frames 02-19 at 448 px, one PNG per direction; dash.json has each
direction's frame size, grid and pivot (body centre). The painted body and its afterimages are left out (the game
draws Theron in 3D); a soft hole where the painted body was lets the model show through; the cloth trail fades from
frame 12, when the trail tears off.
Re-export after editing the .kra files (kept in the artist's folder, krita/theron_dash_<DIR>.kra, ~70 MB):
  python3 tools/dash_frames.py <folder with the 8 .kra> public/textures/fx/dash
then copy the numbers of dash.json into R.dashCfg.dirs / sheetSize if a frame box changed.
