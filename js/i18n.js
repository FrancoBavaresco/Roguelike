'use strict';
/* HEXWRIGHT — localization. English is the source text; Latin American Spanish ('es') is layered on top.
   Three mechanisms:
   1. Data overrides (spells, enemies, charms…) swapped in and out of the content tables.
   2. H.t(template, params) for any text built with numbers or names.
   3. A live translator that converts static interface text as it is rendered. */

H.lang = 'en';
const ES = {};

/* ---------- Strings & templates (key = English) ---------- */
ES.str = {
  /* title / hub */
  'forge volatile spells · descend · do it again': 'forja hechizos volátiles · desciende · vuelve a intentarlo',
  'press any key': 'pulsa cualquier tecla', 'tap to begin': 'toca para empezar',
  'Keyboard & mouse · Gamepad · Touch (landscape) · Original game, music and art': 'Teclado y mouse · Control · Táctil (horizontal) · Juego, música y arte originales',
  'the waystone': 'la piedra guía',
  'Bind four spells. Chain seven elements. Break the Wardens of the undercroft, one more chamber at a time.': 'Vincula cuatro hechizos. Encadena siete elementos. Quiebra a los Guardianes de la cripta, una cámara más a la vez.',
  'Descend': 'Descender', 'choose a mode': 'elige un modo', 'Grimoire': 'Grimorio', 'unlock spells & boons': 'desbloquea hechizos y dones',
  'Records': 'Registros', 'milestones & stats': 'hitos y estadísticas', 'How to play': 'Cómo jugar', 'controls & reactions': 'controles y reacciones',
  'Settings': 'Ajustes', 'audio, controls, access': 'audio, controles, accesibilidad', 'gold coins': 'monedas de oro', 'best descent': 'mejor descenso',
  'Not yet descended': 'Aún no has descendido', 'Language': 'Idioma',
  'Depth {d}': 'Profundidad {d}', '{runs} runs · {wins} victories · {w} wardens unmade · {r} reactions': '{runs} partidas · {wins} victorias · {w} guardianes deshechos · {r} reacciones',
  /* modes */
  'choose your descent': 'elige tu descenso', 'Modes': 'Modos', 'Back': 'Volver', 'one rogue': 'un pícaro', 'Solo Descent': 'Descenso en Solitario',
  'Three depths of cursed chambers. Branching routes, elites, trials, hearths and three Wardens. One life.': 'Tres profundidades de cámaras malditas. Rutas que se bifurcan, élites, pruebas, hogares y tres Guardianes. Una sola vida.',
  'Begin descent': 'Comenzar descenso', 'two rogues · local': 'dos pícaros · local', 'Bound Pair': 'Pareja Unida',
  'Share a screen and a fate. Downed rogues can be revived by standing beside them. Foes are hardier.': 'Compartan pantalla y destino. Un pícaro caído revive si su compañero se queda a su lado. Los enemigos son más duros.',
  'Descend together': 'Descender juntos', 'score attack': 'por puntaje', 'The Pit': 'El Foso', 'Siege · waves': 'Asedio · oleadas', 'Vigil · survive': 'Vigilia · sobrevive',
  '1 rogue': '1 pícaro', '2 rogues': '2 pícaros', 'Enter the Pit': 'Entrar al Foso',
  'Escalating waves with a gift every third. Kill quickly to build a combo multiplier. Best: wave {w}, {s} points.': 'Oleadas cada vez más duras, con un regalo cada tres. Mata rápido para subir el multiplicador de combo. Récord: oleada {w}, {s} puntos.',
  'Foes never stop coming. Survive as long as you can. Best: {t}.': 'Los enemigos no dejan de llegar. Sobrevive todo lo que puedas. Récord: {t}.',
  'Rogue I': 'Pícaro I', 'Rogue II': 'Pícaro II', 'Keyboard & mouse': 'Teclado y mouse', 'Gamepad {n}': 'Control {n}', 'change': 'cambiar',
  'Needs a gamepad': 'Necesita un control', 'Press A on a gamepad to join': 'Pulsa A en un control para unirte',
  'Connect a gamepad and press A on it to add Rogue II': 'Conecta un control y pulsa A para sumar al Pícaro II', 'Rogue II joined on gamepad {n}': 'El Pícaro II se unió con el control {n}',
  'First descent?': '¿Primer descenso?',
  'A short primer teaches moving, casting, dashing through danger, interrupting and elemental reactions. It takes about two minutes.': 'Una iniciación breve enseña a moverte, lanzar hechizos, esquivar con impulsos, interrumpir y provocar reacciones elementales. Dura unos dos minutos.',
  'Take the primer': 'Hacer la iniciación', 'Skip it': 'Saltarla', 'Confirm': 'Confirmar', 'Cancel': 'Cancelar',
  /* build */
  'Bind your spells': 'Vincula tus hechizos', 'solo descent': 'descenso en solitario', 'bound pair': 'pareja unida', 'the pit': 'el foso', 'siege': 'asedio', 'vigil': 'vigilia',
  'rogue I': 'pícaro I', 'rogue II': 'pícaro II', 'All': 'Todos', 'locked': 'bloqueado', 'presets': 'predefinidos', 'boon': 'don',
  'No attack spell bound. Reactions and control will have to carry you.': 'No tienes un hechizo de ataque. Las reacciones y el control tendrán que sostenerte.',
  'Tip: a movement or defense spell helps you survive Wardens.': 'Consejo: un hechizo de movimiento o defensa te ayuda a sobrevivir a los Guardianes.',
  'Next: Rogue II': 'Siguiente: Pícaro II', 'cooldown': 'recarga', 'mana': 'maná', 'damage': 'daño', 'range': 'alcance', 'self': 'propio',
  'applies {s}': 'aplica {s}', 'nothing': 'nada', 'interrupts': 'interrumpe', 'knockback': 'empuje', 'Synergy:': 'Sinergia:',
  '{r} with {s}': '{r} con {s}', 'Unlock: milestone “{m}” — {d}': 'Desbloqueo: hito «{m}» — {d}', ' or ': ' o ', 'Unlock: ': 'Desbloqueo: ',
  '{n} gold coins in the Grimoire.': '{n} monedas de oro en el Grimorio.',
  /* results */
  'primer complete': 'iniciación completa', 'You know the forms.': 'Ya conoces las formas.',
  'Every chamber after this one is cursed for real. Remember: telegraphs fill before they strike, channels can be broken, and two statuses on one foe make a reaction.': 'Cada cámara después de esta está maldita de verdad. Recuerda: las señales del suelo se llenan antes de golpear, las canalizaciones se pueden romper y dos estados en un mismo enemigo provocan una reacción.',
  'Milestone: First Sigils': 'Hito: Primeros Sellos', 'Unlocked the boon Spare Breath (+1 dash charge).': 'Desbloqueaste el don Aliento de Reserva (+1 carga de impulso).',
  'Return to the Waystone': 'Volver a la Piedra Guía', 'The Crown Falls': 'La Corona Cae', 'The Pit Claims You': 'El Foso te Reclama', 'Fallen': 'Caído',
  'You unmade the Hollow Regent and walked out of the undercroft. Few rogues ever do.': 'Deshiciste al Regente Hueco y saliste de la cripta. Pocos pícaros lo logran.',
  'You abandoned the descent.': 'Abandonaste el descenso.',
  'Slain by {who} on wave {w}.': 'Te abatió {who} en la oleada {w}.', 'Slain by {who} on wave {w} after {t}.': 'Te abatió {who} en la oleada {w}, tras {t}.',
  'Slain by {who} in Depth {d}, chamber {c} of {n}.': 'Te abatió {who} en la Profundidad {d}, cámara {c} de {n}.',
  'New best score': 'Nuevo récord', 'New best': 'Nuevo récord', 'Score': 'Puntaje', 'Wave': 'Oleada', 'Time': 'Tiempo', 'Kills': 'Bajas', 'Best combo': 'Mejor combo',
  'Reactions': 'Reacciones', 'Depth': 'Profundidad', 'Chambers': 'Cámaras', 'Interrupts': 'Interrupciones', 'Dodges': 'Esquivas', 'Hits taken': 'Golpes recibidos',
  '{s} ticks': 'Ticks de {s}', 'Fire vents': 'Respiraderos de fuego',
  'Milestone: {n}': 'Hito: {n}', '{d} Unlocked: {r}': '{d} Desbloqueado: {r}',
  'Score: chambers {r}×100 · reactions {x}×15 · interrupts {i}×20 · Wardens {w} · the rest from foes slain.': 'Puntaje: cámaras {r}×100 · reacciones {x}×15 · interrupciones {i}×20 · Guardianes {w} · el resto, por enemigos abatidos.',
  '+{n} gold coins': '+{n} monedas de oro', '{n} in your purse.': '{n} en tu bolsa.', 'build performance': 'rendimiento de la build', '{n} casts': '{n} lanzamientos',
  'No damage dealt.': 'No infligiste daño.', 'No reactions this run. Pair two statuses on one foe to trigger one.': 'Sin reacciones en esta partida. Junta dos estados en un enemigo para provocar una.',
  'Retry': 'Reintentar', 'Change build': 'Cambiar build', 'Waystone': 'Piedra Guía',
  'Everything purchasable is unlocked.': 'Ya desbloqueaste todo lo que se puede comprar.', 'You can afford {n} in the Grimoire.': 'Te alcanza para {n} en el Grimorio.', '{c} more for {n}.': 'Te faltan {c} para {n}.',
  /* grimoire / records */
  'unlocks widen your options, never your stats': 'los desbloqueos amplían tus opciones, nunca tus estadísticas',
  'spells': 'hechizos', 'boons (one per run)': 'dones (uno por partida)', 'charms (found in runs)': 'amuletos (se encuentran en partidas)', 'known': 'conocido',
  'Milestone: {n} — {d}': 'Hito: {n} — {d}', ' Or buy:': ' O cómpralo:', 'Buy with gold coins.': 'Cómpralo con monedas de oro.', 'Buy with gold coins to add it to the charm pool.': 'Cómpralo con monedas de oro para sumarlo a los amuletos posibles.',
  'Need {n} more gold coins': 'Te faltan {n} monedas de oro', 'Unlocked {x}': 'Desbloqueado: {x}',
  'what the undercroft remembers': 'lo que la cripta recuerda', 'Runs': 'Partidas', 'Victories': 'Victorias', 'Deepest': 'Más profundo', 'Best score': 'Mejor puntaje',
  'Chambers cleared': 'Cámaras superadas', 'Foes slain': 'Enemigos abatidos', 'Elites slain': 'Élites abatidas', 'Wardens unmade': 'Guardianes deshechos',
  'Siege best': 'Récord de Asedio', 'Vigil best': 'Récord de Vigilia', 'Time below': 'Tiempo bajo tierra', 'Gold earned': 'Monedas de Oro ganadas', 'wave {w} · {s}': 'oleada {w} · {s}',
  'milestones': 'hitos', 'Unlocked: {r}': 'Desbloqueado: {r}', 'Reward: {r}': 'Recompensa: {r}', 'Replay the primer': 'Repetir la iniciación', 'Erase all progress': 'Borrar todo el progreso',
  'Erase all progress?': '¿Borrar todo el progreso?', 'Gold coins, unlocks, milestones and records will be gone. Settings and controls are kept.': 'Se perderán las monedas de oro, desbloqueos, hitos y registros. Se conservan los ajustes y controles.',
  'Erase': 'Borrar', 'Keep it': 'Conservarlo', 'Progress erased': 'Progreso borrado',
  /* how to */
  'the forms': 'las formas', 'keyboard & mouse': 'teclado y mouse', 'Move': 'Moverse', 'Aim': 'Apuntar', 'Mouse': 'Mouse', 'Spells I–IV': 'Hechizos I–IV', 'Dash': 'Impulso',
  'Interact': 'Interactuar', 'Map · Pause': 'Mapa · Pausa', 'gamepad': 'control', 'Move · Aim': 'Moverse · Apuntar', 'Left stick · Right stick': 'Stick izquierdo · Stick derecho',
  'With the right stick idle, spells auto-target the nearest foe (toggle in Settings).': 'Con el stick derecho quieto, los hechizos apuntan solos al enemigo más cercano (se cambia en Ajustes).',
  'touch (landscape)': 'táctil (horizontal)', 'Drag the left half': 'Arrastra en la mitad izquierda', 'Cast': 'Lanzar', 'Tap a spell: auto-aim': 'Toca un hechizo: apunta solo',
  'Aimed cast': 'Lanzar apuntando', 'Drag from a spell, release': 'Arrastra desde un hechizo y suelta', 'Big button': 'Botón grande', 'Hand button when near': 'Botón de mano al acercarte',
  'reading danger': 'leer el peligro', 'Telegraphs': 'Señales',
  'Crimson shapes on the floor fill up before they strike. When full, they hit. Leave, or dash through: you are untouchable mid-dash.': 'Las formas carmesí del suelo se llenan antes de golpear. Cuando se llenan, impactan. Sal de ellas o atraviésalas con un impulso: eres intocable mientras te impulsas.',
  'Channels': 'Canalizaciones',
  'A striped bar over a foe means it is channeling. Break it with any interrupting spell (Gust Fan, Quake Spike, Frost Snare, Hurled Cairn, Gravity Well) or enough damage.': 'Una barra rayada sobre un enemigo indica que está canalizando. Rómpela con cualquier hechizo que interrumpa (Abanico de Ráfaga, Púa Sísmica, Trampa Gélida, Peñasco Arrojado, Pozo Gravitatorio) o con suficiente daño.',
  'Wardens': 'Guardianes', 'Each Warden has phases, arena hazards and a yellow stagger bar. Fill it with damage, reactions and interrupts to stun them.': 'Cada Guardián tiene fases, peligros en la arena y una barra amarilla de aturdimiento. Llénala con daño, reacciones e interrupciones para aturdirlo.',
  'Hostile bolts': 'Proyectiles hostiles', 'Spiky crimson stars with a ground shadow belong to foes. Your spells glow in their element color.': 'Las estrellas carmesí con púas y sombra en el suelo son de los enemigos. Tus hechizos brillan con el color de su elemento.',
  'elements & statuses': 'elementos y estados', 'effects': 'efectos', 'enemy classes': 'clases de enemigos', 'Examples': 'Ejemplos', 'Trait': 'Característica', 'Weakness': 'Debilidad', 'In the undercroft': 'En la cripta', 'RISES AGAIN': 'SE LEVANTA', 'ETHEREAL': 'ETÉREO', 'reactions': 'reacciones', 'the descent': 'el descenso',
  /* settings */
  'tune the undercroft': 'afina la cripta', 'Audio': 'Audio', 'Video': 'Video', 'Controls': 'Controles', 'Accessibility': 'Accesibilidad', 'Gameplay': 'General', 'General': 'General',
  'Master volume': 'Volumen general', 'Music': 'Música', 'Adaptive score that rises with danger.': 'Música adaptativa que crece con el peligro.', 'Sound effects': 'Efectos de sonido',
  'Quality': 'Calidad', 'Low lowers resolution, shadows and particles for phones.': 'Baja reduce resolución, sombras y partículas para celulares.', 'Low': 'Baja', 'Medium': 'Media', 'High': 'Alta',
  'Screen shake': 'Sacudida de pantalla', '0% turns it off.': '0% la desactiva.', 'Damage numbers': 'Números de daño', 'Show frame rate': 'Mostrar FPS', 'Off': 'No', 'On': 'Sí',
  'Aim assistance': 'Asistencia de puntería', 'Gamepad and touch aiming bends toward foes.': 'La puntería con control y táctil se curva hacia los enemigos.',
  'Gamepad auto-target': 'Autoapuntado con control', 'With the right stick idle, aim at the nearest foe.': 'Con el stick derecho quieto, apunta al enemigo más cercano.',
  'Mouse magnetism': 'Magnetismo del mouse', 'Snap to a foe under the cursor.': 'Fija el objetivo en el enemigo bajo el cursor.',
  'Hold to repeat attacks': 'Mantener para repetir ataques', 'Holding an attack spell re-casts it when ready.': 'Mantener un hechizo de ataque lo vuelve a lanzar al recargarse.',
  'Gamepad vibration': 'Vibración del control', 'Touch control size': 'Tamaño de controles táctiles', 'Text size': 'Tamaño del texto',
  'Game speed': 'Velocidad del juego', 'Slows the whole game for more reaction time.': 'Ralentiza todo el juego para tener más tiempo de reacción.',
  'High-contrast telegraphs': 'Señales de alto contraste', 'Opaque striped danger zones instead of glowing ones.': 'Zonas de peligro opacas y rayadas en lugar de luminosas.',
  'Reduce flashing': 'Reducir destellos', 'Dims light bursts from impacts.': 'Atenúa los destellos de los impactos.',
  'Status badges on foes': 'Íconos de estado en enemigos', 'Shape-coded icons, readable without color.': 'Íconos con forma propia, legibles sin color.',
  'Ally effect intensity': 'Intensidad de efectos aliados', 'Co-op: dims Rogue II particles to cut clutter.': 'Cooperativo: atenúa las partículas del Pícaro II para reducir el caos visual.',
  'remap · select a binding, then press the new key or button (Esc cancels)': 'reasignar · elige una acción y pulsa la nueva tecla o botón (Esc cancela)',
  'Action': 'Acción', 'Key': 'Tecla', 'Alt key': 'Tecla alt.', 'Gamepad': 'Control', 'left stick': 'stick izquierdo', 'Reset to defaults': 'Restablecer valores',
  'press button': 'pulsa un botón', 'press key': 'pulsa una tecla', 'Controls reset': 'Controles restablecidos',
  'Replay the primer': 'Repetir la iniciación', 'The two-minute controls tutorial.': 'El tutorial de controles de dos minutos.', 'Start primer': 'Empezar iniciación',
  'Reset all settings': 'Restablecer todos los ajustes', 'Audio, video, accessibility and controls.': 'Audio, video, accesibilidad y controles.', 'Reset settings': 'Restablecer ajustes',
  'Settings reset': 'Ajustes restablecidos', 'Finish or abandon this run first': 'Primero termina o abandona esta partida',
  'English or Latin American Spanish.': 'Inglés o español latinoamericano.',
  /* pause / map */
  'the primer': 'la iniciación', 'Paused': 'En pausa', 'Resume': 'Continuar', 'Chamber map': 'Mapa de cámaras', 'Controls & reactions': 'Controles y reacciones',
  'Skip the primer': 'Saltar la iniciación', 'Abandon run': 'Abandonar partida', 'the pit · wave {w}': 'el foso · oleada {w}', 'depth {d} · {n}': 'profundidad {d} · {n}',
  'Abandon this run?': '¿Abandonar esta partida?', 'It ends now and counts as a defeat. Gold coins earned so far are kept.': 'Termina ahora y cuenta como derrota. Conservas las monedas de oro ganadas hasta aquí.',
  'Abandon': 'Abandonar', 'Keep going': 'Seguir', 'No map here': 'Aquí no hay mapa', 'depth {d} of III': 'profundidad {d} de III', 'Close': 'Cerrar',
  'You are at the gold ring. Pulsing rings are the doors ahead. Wardens wait at the top.': 'Estás en el anillo dorado. Los anillos que laten son las puertas siguientes. Los Guardianes esperan arriba.',
  'The Pit has no map. Only the next wave.': 'El Foso no tiene mapa. Solo la próxima oleada.', 'No map in the primer': 'La iniciación no tiene mapa',
  /* offers */
  'new spell · rank {r}': 'hechizo nuevo · rango {r}', 'rank up': 'subir rango', 'charm': 'amuleto', 'mend': 'curar', 'fortify': 'fortalecer', 'attune': 'afinar', 'risk': 'riesgo', 'safe': 'seguro',
  'Mend wounds': 'Curar heridas', 'Fortify': 'Fortalecer', 'Attune': 'Afinar',
  'Damage {a} → {b}. Cooldown {c}s → {d}s.': 'Daño {a} → {b}. Recarga {c} s → {d} s.', ' Rank III adds an extra jump.': ' El rango III suma un salto extra.', ' Rank III adds an extra pierce.': ' El rango III suma una perforación extra.',
  'Restore {n} HP. You have {h} of {m}.': 'Recupera {n} PV. Tienes {h} de {m}.', '+{n} max HP for the rest of the run.': '+{n} PV máximos por el resto de la partida.',
  'Raise one spell of your choice by a rank.': 'Sube un rango al hechizo que elijas.', 'The doors seal until the trial ends.': 'Las puertas se sellan hasta que termine la prueba.', 'Leave the altar untouched.': 'Deja el altar intacto.',
  'CD {c}s': 'Rec. {c} s', 'Cost {c}': 'Costo {c}', 'Dmg {d}': 'Daño {d}', 'Range {r}m': 'Alc. {r} m',
  '{name} chooses': 'Elige {name}', 'Take nothing': 'No tomar nada', 'new spell · replace one slot': 'hechizo nuevo · reemplaza una ranura',
  'The replaced spell is lost. The new spell keeps the higher of its own rank or the old rank minus one.': 'El hechizo reemplazado se pierde. El nuevo conserva el mayor entre su propio rango y el rango anterior menos uno.',
  'Cooldown {a}s → ': 'Recarga {a} s → ', 'Mana {a} → ': 'Maná {a} → ', 'Damage {a} → ': 'Daño {a} → ', 'Role {a} → {b}': 'Rol {a} → {b}', 'Becomes rank {r}': 'Queda en rango {r}',
  'replace': 'reemplazar', 'Keep my four': 'Conservar mis cuatro', 'Rank {r}': 'Rango {r}', ' · max': ' · máx.', 'something waits': 'algo espera',
  /* HUD */
  'Map': 'Mapa', 'Pause': 'Pausa', 'The Pit · Siege': 'El Foso · Asedio', 'The Pit · Vigil': 'El Foso · Vigilia', 'Wave {w}': 'Oleada {w}', 'Endured {t}': 'Resistido {t}',
  'The Primer': 'La Iniciación', 'Learn the forms': 'Aprende las formas', 'Depth {d} · {n}': 'Profundidad {d} · {n}', 'Chamber {c} of {n} · {t}': 'Cámara {c} de {n} · {t}',
  'combo ×{m}': 'combo ×{m}', '<b>{n}</b> foes remain': 'quedan <b>{n}</b> enemigos', 'Next wave approaches…': 'Se acerca la próxima oleada…', 'Survive. <b>{n}</b> foes in the pit': 'Sobrevive. <b>{n}</b> enemigos en el foso',
  'Step onto the golden sigil to leave the undercroft': 'Pisa el sello dorado para salir de la cripta', 'Step onto the golden sigil to descend to Depth {d}': 'Pisa el sello dorado para bajar a la Profundidad {d}',
  'Clear the chamber · wave <b>{w}</b> of {n} · <b>{a}</b> foes': 'Limpia la cámara · oleada <b>{w}</b> de {n} · <b>{a}</b> enemigos',
  '<b>{c}</b> · {s}s left · ': '<b>{c}</b> · quedan {s} s · ', '<b>{c}</b> · hits {h} of 3 · ': '<b>{c}</b> · golpes {h} de 3 · ',
  'Rest at the Hearth, or move on': 'Descansa en el Hogar o sigue adelante', 'Temper a spell at the Forge Shrine': 'Templa un hechizo en el Santuario de Forja', 'Open the Reliquary': 'Abre el Relicario',
  'Approach the watching Eye': 'Acércate al Ojo que observa', 'The altar offers a Trial. Accept it, or walk past': 'El altar ofrece una Prueba. Acéptala o sigue de largo',
  'Choose a door: ': 'Elige una puerta: ', '(map: {k})': '(mapa: {k})', 'DOWNED': 'CAÍDO',
  'Rest at the Hearth': 'Descansar en el Hogar', 'Use the Forge Shrine': 'Usar el Santuario de Forja', 'Open the Reliquary ': 'Abrir el Relicario', 'Meet the Eye': 'Enfrentar al Ojo', 'Read the Trial': 'Leer la Prueba',
  'interrupt': 'interrumpe', '{a} {n}': '{n} de {a}',
  'primer · {n} of {m}': 'iniciación · {n} de {m}', 'Pause to skip the primer.': 'Pausa para saltar la iniciación.',
  'Use {keys}.': 'Usa {keys}.', 'Drag on the left half of the screen.': 'Arrastra en la mitad izquierda de la pantalla.', 'Use the left stick.': 'Usa el stick izquierdo.',
  'the I button': 'el botón I', 'the II button': 'el botón II', 'the III button': 'el botón III', 'the dash button': 'el botón de impulso',
  /* banners & toasts */
  'Cursed Chamber': 'Cámara Maldita', 'Elite Chamber': 'Cámara de Élite', 'a crowned foe waits': 'un enemigo coronado espera', 'The Hearth': 'El Hogar', 'a moment of warmth': 'un momento de calor',
  'Forge Shrine': 'Santuario de Forja', 'temper your craft': 'templa tu arte', 'Reliquary': 'Relicario', 'spoils of the fallen': 'botín de los caídos', 'Unknown': 'Desconocido',
  'something is watching': 'algo te observa', 'The Trial Altar': 'El Altar de las Pruebas', 'risk for reward': 'riesgo por recompensa', 'Cleared': 'Superada', 'the chamber is quiet': 'la cámara queda en silencio',
  'an elite approaches': 'se acerca una élite', 'phase {p}': 'fase {p}', 'Staggered! Strike now': '¡Aturdido! Ataca ahora', 'Warden Unmade': 'Guardián Deshecho', '{n} falls': 'cae {n}',
  'The way out opens': 'Se abre la salida', 'A descent sigil opens': 'Se abre un sello de descenso', 'the doors seal': 'las puertas se sellan', 'Trial Failed': 'Prueba Fallida',
  'the altar takes its price': 'el altar cobra su precio', '{n} is down. Stand beside them to revive': '{n} cayó. Quédate a su lado para revivirlo', '{n} is back on their feet': '{n} volvió a ponerse de pie',
  'The Pit Wins': 'Gana el Foso', 'slain by {x}': 'te abatió {x}', 'Milestone: {n} · {r}': 'Hito: {n} · {r}', 'Well done': 'Bien hecho', 'survive the waves': 'sobrevive a las oleadas',
  'The Vigil': 'La Vigilia', 'survive as long as you can': 'sobrevive todo lo que puedas', 'Gamepad connected: {n}': 'Control conectado: {n}',
  /* game text */
  'Spoils of the Chamber': 'Botín de la Cámara', 'Choose one. A new spell must replace one of your four.': 'Elige uno. Un hechizo nuevo debe reemplazar a uno de tus cuatro.',
  'Crown Taken': 'Corona Arrebatada', 'The elite drops a charm. Choose one.': 'La élite suelta un amuleto. Elige uno.', 'Trial Overcome': 'Prueba Superada', 'Rich spoils for a cursed trial.': 'Un buen botín por una prueba maldita.',
  'Temper one spell. Each rank adds 24% damage and trims its cooldown.': 'Templa un hechizo. Cada rango suma 24% de daño y acorta su recarga.', 'Claim one relic.': 'Toma una reliquia.',
  'One choice. The fire will not wait twice.': 'Una sola elección. El fuego no espera dos veces.', 'Rest by the fire': 'Descansar junto al fuego', 'Attune a spell': 'Afinar un hechizo', 'Raise one spell by a rank.': 'Sube un hechizo un rango.',
  'Trial of Haste': 'Prueba de la Prisa', 'Trial of Grace': 'Prueba de la Gracia', 'Trial of Blood': 'Prueba de Sangre',
  'Clear three waves within 50 seconds.': 'Supera tres oleadas en menos de 50 segundos.', 'Clear three waves taking no more than 3 hits.': 'Supera tres oleadas recibiendo 3 golpes como máximo.',
  'Foes have 40% more HP for this trial.': 'Los enemigos tienen 40% más de PV en esta prueba.', 'Fail: lose 20% of your current HP.': 'Si fallas: pierdes 20% de tus PV actuales.', 'No penalty, but it is a long fight.': 'Sin castigo, pero es una pelea larga.',
  ' Reward: a charm, a rank II spell or an upgrade, plus gold coins. ': ' Recompensa: un amuleto, un hechizo de rango II o una mejora, y Monedas de Oro. ',
  'Accept the trial': 'Aceptar la prueba', 'Walk past': 'Seguir de largo',
  '{n} is unmade': 'Cae {n}', 'Claim a Warden relic. Your wounds close by 40%.': 'Toma una reliquia del Guardián. Tus heridas sanan un 40%.',
  'Wave {w} survived': 'Oleada {w} superada', 'The crowd of shades throws you a gift. Wounds close by 20%.': 'El público de sombras te lanza un regalo. Tus heridas sanan un 20%.',
  '{t} endured': '{t} resistidos', 'Choose a gift. The vigil goes on.': 'Elige un regalo. La vigilia continúa.',
  'Reweave which spell?': '¿Qué hechizo retejer?', 'It becomes a random spell sharing its role.': 'Se convierte en un hechizo aleatorio del mismo rol.',
  /* events */
  'The Weeping Mirror': 'El Espejo que Llora', 'A mirror weeps black ink. In it, your reflection casts something you have never learned.': 'Un espejo llora tinta negra. En él, tu reflejo lanza algo que nunca aprendiste.',
  'Touch the glass': 'Tocar el cristal', 'Swap a random spell for a new one at +1 rank.': 'Cambia un hechizo al azar por uno nuevo con +1 rango.', 'Shatter it': 'Romperlo', '+10 gold coins. Take 12 damage.': '+10 Monedas de Oro. Recibes 12 de daño.',
  'Walk on': 'Seguir caminando', 'Nothing happens.': 'No pasa nada.',
  'The Chained Pilgrim': 'La Peregrina Encadenada', 'A pilgrim hangs in chains, whispering of a charm hidden in her sleeve. Her jailer sleeps nearby.': 'Una peregrina cuelga encadenada y susurra que esconde un amuleto en la manga. Su carcelero duerme cerca.',
  'Break the chains': 'Romper las cadenas', 'Wake the jailer: an elite fight for a charm.': 'Despiertas al carcelero: una pelea de élite por un amuleto.', 'Leave her': 'Dejarla',
  'Font of Ash': 'La Fuente de Ceniza', 'Warm ash rises from a stone basin. It tastes of iron and old spells.': 'Una ceniza tibia brota de una pila de piedra. Sabe a hierro y a hechizos viejos.',
  'Drink deeply': 'Beber a fondo', '+15 max HP. Your dashes recharge 15% slower.': '+15 PV máximos. Tus impulsos recargan 15% más lento.', 'Wash your hands': 'Lavarte las manos', 'Heal 20 HP.': 'Curas 20 PV.',
  'The Whispering Grimoire': 'El Grimorio que Susurra', 'An open book recites your spells back to you, slightly better, for a price.': 'Un libro abierto te recita tus hechizos, un poco mejorados, a cambio de un precio.',
  'Read aloud': 'Leer en voz alta', 'A random spell gains 2 ranks. Lose 25% current HP.': 'Un hechizo al azar gana 2 rangos. Pierdes 25% de tus PV actuales.', 'Close the book': 'Cerrar el libro',
  "Gambler's Brazier": 'El Brasero del Apostador', 'A brazier burns with blue fire. Offer it blood, and it offers something back.': 'Un brasero arde con fuego azul. Ofrécele sangre y te ofrecerá algo a cambio.',
  'Offer 20 HP': 'Ofrecer 20 PV', 'Gain a random charm.': 'Ganas un amuleto al azar.', 'Warm your hands': 'Calentarte las manos', 'Restore all mana and gain Mending (life rises over 5 s).': 'Recuperas todo el maná y obtienes Sanación (la vida sube durante 5 s).',
  "A Lost Rogue's Satchel": 'El Morral de un Pícaro Perdido', 'Another rogue did not make it this far. Their satchel is still warm.': 'Otro pícaro no llegó más lejos. Su morral todavía está tibio.',
  'Take the salve': 'Tomar el ungüento', 'Heal 30 HP.': 'Curas 30 PV.', 'Take the cursed charm': 'Tomar el amuleto maldito', 'Gain a charm. Foes have +20% HP for the rest of this depth.': 'Ganas un amuleto. Los enemigos tienen +20% de PV por el resto de esta profundidad.',
  'The Sigil Loom': 'El Telar de Sellos', 'A loom of light can reweave a spell into another of the same purpose.': 'Un telar de luz puede retejer un hechizo en otro con el mismo propósito.',
  'Reweave a spell': 'Retejer un hechizo', 'Pick a slot; it becomes a random spell of the same role at the same rank.': 'Elige una ranura; se convierte en un hechizo aleatorio del mismo rol y rango.', 'Leave it be': 'Dejarlo así',
  'Echo of a Past Run': 'Eco de una Partida Pasada', 'A shade wearing your face stands here. It remembers how deep you once went.': 'Aquí hay una sombra con tu rostro. Recuerda hasta dónde llegaste alguna vez.',
  'Take its memory': 'Tomar su recuerdo', 'Gain {n} gold coins.': 'Ganas {n} Monedas de Oro.', 'Duel the echo': 'Batirte a duelo con el eco', 'Fight a Hasted elite. Win a rank II spell.': 'Pelea contra una élite de Celeridad. Gana un hechizo de rango II.',
  /* floating text */
  'DODGE': 'ESQUIVA', 'BLOCKED': 'BLOQUEADO', 'DEFLECT': 'DESVIADO', 'INTERRUPTED': 'INTERRUMPIDO', 'PLUNGED': 'AL ABISMO', 'FROZEN': 'CONGELADO', 'ABSORB': 'ABSORBIDO',
  'REVIVED': 'REVIVIDO', 'SECOND WIND': 'SEGUNDO ALIENTO', "REGENT'S ASH": 'CENIZA DEL REGENTE', 'STAGGERED': 'ATURDIDO', 'STUNNED': 'ATURDIDO', 'THE CELLS OPEN': 'SE ABREN LAS CELDAS',
  'THE PRIMER FORGIVES': 'LA INICIACIÓN PERDONA', 'TOO CLOSE: BACK OFF': 'MUY CERCA: ALÉJATE', '+{n} GOLD': '+{n} MONEDAS DE ORO',
  /* boss phase banners */
  'The cells unlock': 'Se abren las celdas', 'The kiln wakes': 'El horno despierta', 'Mother of Cinders burns hotter': 'La Madre de las Cenizas arde con más fuerza',
  'Echoes answer the crown': 'Los ecos responden a la corona', 'The court collapses inward': 'La corte se derrumba sobre sí misma',
  /* causes of death */
  "a Husk's lunge": 'la embestida de una Cáscara', 'Bile Spitter bile': 'la bilis de un Escupebilis', 'a Cinder Wisp explosion': 'la explosión de un Fatuo de Ceniza', 'a Hexcaster curse': 'la maldición de un Lanzamaleficios',
  "a Gaol Warden's shield bash": 'el golpe de escudo de un Celador', "a Chain Brute's charge": 'la carga de un Bruto Encadenado', "a Chain Brute's slam": 'el pisotón de un Bruto Encadenado',
  "a Candle Abbess's flame": 'la llama de una Abadesa de las Velas', 'a Hollow Echo lance': 'la lanza de un Eco Hueco', 'a training bolt': 'un proyectil de práctica', 'a Volatile burst': 'un estallido Volátil',
  "the Gaolwright's chain": 'la cadena del Carcelario', "the Gaolwright's slam": 'el golpe del Carcelario', "the Gaolwright's shockwave": 'la onda del Carcelario', "the Gaolwright's hook": 'el garfio del Carcelario',
  'a rotating cell chain': 'una cadena giratoria', 'falling cinders': 'la lluvia de cenizas', 'a cinder pool': 'un charco de cenizas', "the Kiln Saint's spiral": 'la espiral de la Santa del Horno',
  "the Kiln Saint's flare": 'el destello de la Santa del Horno', 'a molten wave': 'una ola fundida', 'molten floor': 'el suelo fundido', "the Regent's void lance": 'la lanza del vacío del Regente',
  "the Regent's orbit": 'la órbita del Regente', "the Regent's descent": 'el descenso del Regente', 'Unmaking': 'el Deshacer', 'the encroaching void': 'el vacío que avanza',
  'a fire vent': 'un respiradero de fuego', 'a hostile bolt': 'un proyectil hostil', 'scorched ground': 'el suelo abrasado', 'flames': 'las llamas', 'the dark': 'la oscuridad', 'Effigy Thrower': 'la Efigie Lanzadora',
  /* primary attack & upgrades */
  'Choose your primary attack': 'Elige tu ataque primario',
  'You start with one attack on your primary button. Every chamber you clear lets you choose more: new spells for the empty slots, upgrades such as Twin Shot or Piercing Shot, or charms.': 'Empiezas con un solo ataque en tu botón principal. Cada cámara que superes te deja elegir más: hechizos nuevos para las ranuras vacías, mejoras como Disparo Doble o Disparo Perforante, o amuletos.',
  'chosen': 'elegido', 'Element abilities: {m}': 'Habilidades del elemento: {m}', 'Ultimate: {m}': 'Definitiva: {m}', 'Inventory': 'Inventario', 'Camera': 'Cámara', 'Art style': 'Estilo gráfico', 'QUICK ATTACK': 'ATAQUE RÁPIDO', 'Illustrated: flat-shaded characters with ink outlines (outlines on High). Applies to characters built from now on.': 'Ilustrado: personajes con sombreado plano y contorno de tinta (contorno en calidad Alta). Se aplica a los personajes que se creen desde ahora.', 'Illustrated': 'Ilustrado', 'Isometric: fixed diagonal view, like Hades. Classic: the original view from the south.': 'Isométrica: vista diagonal fija, estilo Hades. Clásica: la vista original desde el sur.', 'Isometric': 'Isométrica', 'Classic': 'Clásica', 'ultimate': 'definitiva', 'EXECUTED · CHARGE BACK': 'EJECUTADO · CARGA RECUPERADA', 'Its blows cut straight through shields.': 'Sus golpes atraviesan los escudos.', 'Every blow leaves Bleeding.': 'Cada golpe deja Desangramiento.', 'Two-handed Axe': 'Hacha a dos manos', 'Bastard Sword': 'Espada Bastarda', 'attribute · level {n}/{m}': 'atributo · nivel {n}/{m}', 'Veteran': 'Veterano', 'Stamina': 'Estamina', 'Mana': 'Maná', 'NO STAMINA': 'SIN ESTAMINA', 'Shop': 'Tienda', 'buy & sell equipment': 'compra y venta de equipo', "the merchant's stall": 'el puesto del mercader', 'Hero': 'Héroe', 'Buy': 'Comprar', 'Sell': 'Vender', 'All': 'Todo',
  'Purchases go straight to the bag of the hero who can use them: weapons to the Veteran, armour to the hero selected above ({n}).': 'Lo que compres va directo a la mochila del héroe que puede usarlo: las armas al Veterano y la armadura al héroe elegido arriba ({n}).',
  'Free space: {n}': 'Espacio libre: {n}', 'for {n}': 'para {n}',
  "The merchant's purse is bottomless: sell as much as you like. Only items in the bag can be sold; unequip in the Inventory first.": 'La bolsa del mercader no tiene fondo: vendé todo lo que quieras. Solo se venden objetos de la mochila; para vender lo que llevás puesto, sacátelo primero en el Inventario.',
  "{n}'s bag is empty.": 'La mochila de {n} está vacía.', "{n}'s bag is full": 'La mochila de {n} está llena', "Bought {i} → {n}'s bag": 'Compraste {i} → mochila de {n}', 'Sold {i} for {v}': 'Vendiste {i} por {v}', 'Weapon': 'Arma', 'Melee': 'Cuerpo a cuerpo', 'Each hero keeps their own equipment and bag. Everything a hero loots is kept between runs.': 'Cada héroe tiene su propio equipo y mochila. Todo lo que lootea se guarda entre partidas.', 'Only': 'Solo', 'slot {n}': 'ranura {n}', 'basic attack': 'ataque básico', 'Only {n} can wield this.': 'Solo {n} puede empuñar esto.', 'Sword': 'Espada', 'Gold coins': 'Monedas de oro', 'Merchant': 'Mercader', 'CHARGED BLOW': 'GOLPE CARGADO', 'RUSHING SLASH': 'TAJO ACELERADO', 'READY': 'LISTO', 'melee': 'cuerpo a cuerpo', 'hero': 'héroe', 'The Veteran': 'El Veterano', 'A ragged wanderer in a torn brown tunic. Barefoot, bearded, stubborn.': 'Un vagabundo con una túnica marrón raída. Descalzo, barbudo y testarudo.', 'A battered knight in old, rusted plate. He has survived more wars than he remembers.': 'Un caballero curtido en una armadura vieja y oxidada. Sobrevivió a más guerras de las que recuerda.', 'A scarred, grey-bearded soldier who has survived more wars than he remembers. His old armour can be found on the way down.': 'Un soldado canoso y lleno de cicatrices que sobrevivió a más guerras de las que recuerda. Su vieja armadura se encuentra en el descenso.', 'Character': 'Personaje', 'equipment & stats': 'equipo y estadísticas', 'What you wear here goes with you into every descent. Items you find or buy are kept between runs.': 'Lo que equipes acá te acompaña en cada descenso. Los objetos que encontrás o comprás se guardan entre partidas.', 'Spell bar': 'Barra de hechizos', 'Tap two slots to swap them. Each spell remembers its slot for future runs.': 'Tocá dos ranuras para intercambiarlas. Cada hechizo recuerda su ranura para las próximas partidas.', 'Your primary attack always stays on slot I': 'Tu ataque primario siempre queda en la ranura I', 'Trade with the Merchant, or move on': 'Comerciá con el Mercader, o seguí de largo', 'Wandering Merchant': 'Mercader Errante', 'gold coins': 'monedas de oro', 'Embers': 'Monedas de Oro', 'Leave': 'Seguir camino', 'Prices rise with every purchase this run.': 'Los precios suben con cada compra en esta partida.', 'Sold': 'Vendido', 'Bag full': 'Mochila llena', 'Buy': 'Comprar', 'Not enough gold coins': 'No te alcanzan las Monedas de Oro', 'Cloak': 'Capa', 'A cape or a mantle. Cloaks often make you faster.': 'Una capa o un manto. Las capas suelen hacerte más rápido.', 'Max HP': 'Vida máxima', 'Max mana': 'Maná máximo', 'Damage taken': 'Daño recibido', 'Move speed': 'Velocidad', 'Spell damage': 'Daño de hechizos', 'Ember damage': 'Daño de fuego', 'Cooldowns': 'Recarga de hechizos', 'Mana regeneration': 'Regeneración de maná', 'Dash recharge': 'Recarga del impulso', 'Dash invulnerability': 'Invulnerabilidad del impulso', 'Common': 'Común', 'Uncommon': 'Poco común', 'Rare': 'Raro', 'Equip': 'Equipar', 'Unequip': 'Quitar', 'Replaces': 'Reemplaza a', 'Your bag is full': 'Tu mochila está llena', 'BAG FULL': 'MOCHILA LLENA', 'New item: {n}': 'Objeto nuevo: {n}', '{k} to open the inventory': '{k} para abrir el inventario', 'Tap an item to see it. Equip armour on your head, body, legs, feet and back. Cloaks make you faster; iron makes you tougher but slower.': 'Tocá un objeto para verlo. Equipá armadura en cabeza, torso, piernas, pies y espalda. Las capas te hacen más rápido; el hierro te hace más resistente pero más lento.', 'Skip tutorial': 'Saltar tutorial', 'Skip the tutorial?': '¿Saltar el tutorial?', 'You can replay it later from Settings.': 'Podés volver a jugarlo desde Ajustes.', 'Skip': 'Saltar', 'Keep learning': 'Seguir aprendiendo', 'Fullscreen': 'Pantalla completa', 'Fullscreen is not available here': 'La pantalla completa no está disponible acá', 'Head': 'Cabeza', 'Body': 'Torso', 'Legs': 'Piernas', 'Feet': 'Pies', 'Main weapon': 'Arma principal', 'Ring I': 'Anillo I', 'Ring II': 'Anillo II', 'A helmet or a hat.': 'Un casco o un sombrero.', 'A tunic or a chestplate.': 'Una túnica o una pechera.', 'Trousers or greaves.': 'Pantalones o grebas.', 'Boots.': 'Botas.', 'A staff, a spellbook, a wand or a sword.': 'Un bastón, un libro de hechizos, una varita o una espada.', 'Rings empower you.': 'Los anillos te potencian.', 'Bag': 'Mochila', 'Equipment': 'Equipo', 'Equipment you find on your descent will appear here. Equip it on your head, body, legs and feet, carry one main weapon and wear two rings to empower your spells.': 'Acá va a aparecer el equipo que encuentres en tu descenso. Equipá cabeza, torso, piernas y pies, llevá un arma principal y usá dos anillos para potenciar tus hechizos.', 'Empty': 'Vacío', 'Empty space.': 'Espacio vacío.', 'Close': 'Cerrar', 'HP': 'Vida', 'Mana': 'Maná', 'Dash charges': 'Cargas de impulso', 'Charms': 'Amuletos', 'ultimate · unique': 'definitiva · única', 'ULTIMATE': 'DEFINITIVA', 'SUPERNOVA': 'SUPERNOVA', 'Ultimate': 'Definitiva', 'ULT': 'DEF', 'upgrade · level {n}/{m}': 'mejora · nivel {n}/{m}', 'dash passive': 'pasiva del dash', 'More range': 'Más alcance', 'More damage': 'Más daño', 'Bigger impact area': 'Área de impacto mayor', 'Longer duration': 'Mayor duración', 'Upgrades it can roll: {m}': 'Mejoras posibles: {m}', 'new spell · slot {s}': 'hechizo nuevo · ranura {s}', 'primary upgrade': 'mejora del ataque primario',
  'level {n}': 'nivel {n}', 'NEW SPELL · SLOT {n}': 'HECHIZO NUEVO · RANURA {n}', 'Empty slot': 'Ranura vacía', 'Empty slot: clear chambers to earn spells': 'Ranura vacía: supera cámaras para ganar hechizos',
  'Choose one: a new spell for an empty slot, an upgrade for your primary attack, or a charm.': 'Elige una: un hechizo nuevo para una ranura vacía, una mejora para tu ataque primario o un amuleto.',
  'The replaced spell is lost. The new spell keeps the higher of its own rank or the old rank minus one. Your primary attack stays.': 'El hechizo reemplazado se pierde. El nuevo conserva el mayor entre su propio rango y el rango anterior menos uno. Tu ataque primario no se toca.',
  'Start with a single attack. Earn new spells and upgrades on the way down. Break the Wardens of the undercroft, one more chamber at a time.': 'Empiezas con un solo ataque. Gana hechizos y mejoras mientras desciendes. Quiebra a los Guardianes de la cripta, una cámara más a la vez.',
  'Level {n}!': '¡Nivel {n}!', 'LEVEL UP!': '¡SUBISTE DE NIVEL!', 'Level {n}': 'Nivel {n}', 'Press any key to continue': 'Pulsa cualquier tecla para continuar', 'LEVEL {n}': 'NIVEL {n}', 'Lv {n}': 'Nv {n}', 'Lv {n} · {x}/{m} XP': 'Nv {n} · {x}/{m} XP', 'Level': 'Nivel',
  'Choose a new spell, an upgrade for your primary attack, or a charm.': 'Elige un hechizo nuevo, una mejora para tu ataque primario o un amuleto.',
  /* keys */
  'LMB': 'Clic', 'RMB': 'Clic der', 'MMB': 'Clic med', 'Space': 'Espacio', 'L-Shift': 'Mayús izq', 'R-Shift': 'Mayús der', 'L-Ctrl': 'Ctrl izq', 'R-Ctrl': 'Ctrl der', 'L-Alt': 'Alt izq',
  'Bksp': 'Retroceso', 'Caps': 'Bloq Mayús', 'Enter': 'Intro', 'Tap': 'Toca',
  /* misc static */
  'Turn your phone sideways': 'Gira tu teléfono', 'Hexwright plays in landscape.': 'Hexwright se juega en horizontal.', 'Kindling the chambers…': 'Encendiendo las cámaras…',
  'The 3D engine could not load. Check your connection and reload.': 'No se pudo cargar el motor 3D. Revisa tu conexión y recarga.', 'dash': 'impulso'
};

/* ---------- Content overrides ---------- */
ES.data = {
  EL: {
    ember: { name: 'Brasa', blurb: 'Quema con el tiempo. Reacciona con violencia junto a Escarcha y Veneno.' },
    frost: { name: 'Escarcha', blurb: 'El Congelamiento drena vida; con tres cargas el enemigo queda congelado.' },
    volt: { name: 'Voltio', blurb: 'Deja a los enemigos Vulnerables: reciben más daño y conducen reacciones.' },
    venom: { name: 'Veneno', blurb: 'Veneno acumulable. Premia la presión constante.' },
    gale: { name: 'Vendaval', blurb: 'Empuja e interrumpe. Propaga otros estados.' },
    stone: { name: 'Piedra', blurb: 'Quebranta: ralentiza un 60%, tira escudos y destroza a los congelados.' },
    void: { name: 'Vacío', blurb: 'Atrae a los enemigos. Maldice: baja la vida total; Maldito hace colapsar cualquier otro estado.' }
  },
  STATUS: {
    burn: { name: 'Quemadura', desc: 'La vida va bajando de a poco. Acumulable, dura 3 s.' },
    chill: { name: 'Congelamiento', desc: 'La vida va bajando de a poco. Acumulable, dura 6 s. Con tres cargas el enemigo queda congelado.' },
    shock: { name: 'Vulnerable', desc: 'Recibe un 20% más de daño.' },
    poison: { name: 'Envenenamiento', desc: 'La vida va bajando de a poco. Acumulable, dura 5 s.' },
    gust: { name: 'Zarandeado', desc: 'Pierde el equilibrio; los escudos caen.' },
    sunder: { name: 'Quebrantamiento', desc: 'Se mueve un 60% más lento. Los escudos caen.' },
    hex: { name: 'Maldito', desc: 'Vida total reducida un 15%, más un efecto aleatorio adicional.' },
    bleed: { name: 'Desangramiento', desc: 'La vida va bajando de a poco. Acumulable, dura 10 s.' },
    daze: { name: 'Aturdimiento', desc: 'Se mueve un 70% más lento.' },
    flay: { name: 'Desollamiento', desc: 'Vida total reducida en gran parte (40%).' },
    regen: { name: 'Sanación', desc: 'La vida va subiendo de a poco.' },
    heal: { name: 'Curación', desc: 'Cura al instante un porcentaje de la vida total.' }
  },
  CLASSES: {
    undead: { name: 'No muerto', desc: 'Criatura que regresa de la muerte.', ex: 'zombi, esqueleto, momia', trait: 'Al morir puede revivir (máximo 1 vez).', weak: 'Poca vida. Recibe más daño de traumatismo (puños, mazas, hechizos de Piedra). Espadas de plata: daño x2 y no revive.' },
    beast: { name: 'Bestia', desc: 'Animal salvaje.', ex: 'lobo, oso', trait: 'Resistencia media a la magia, alta al frío, velocidad media. Daño alto con probabilidad de Desangramiento.', weak: 'Fuego, armas perforantes (lanzas) y armas a distancia (arco, ballesta).' },
    construct: { name: 'Constructo', desc: 'Ser creado mediante magia o mecanismos.', ex: 'gólem de piedra, gólem de hierro, autómata de engranajes', trait: 'Alta resistencia mágica y física. Inmune a arcos y ballestas. Golpes fuertes en área.', weak: 'Movilidad lenta. Gran cooldown de ataque.' },
    elemental: { name: 'Elemental', desc: 'Ser formado por fuerzas o elementos (fuego, hielo, planta, aire, agua).', ex: 'elemental de fuego, hielo, planta, aire, agua, magma, ácido', trait: 'Sus golpes te dejan el efecto de su elemento.', weak: 'Ataque de corto alcance. Fuego teme al agua; hielo y planta al fuego; aire y agua al daño mágico.' },
    humanoid: { name: 'Humanoide', desc: 'Ser con anatomía y comportamiento similar al humano.', ex: 'bandido, mercenario, caballero corrupto', trait: 'Daño físico, movilidad media. Algunos esquivan con dash o llevan equipo.', weak: 'Los efectos les hacen el doble de daño. Sin armadura, sufren mucho daño físico y mágico.' },
    aberration: { name: 'Aberración', desc: 'Criatura extraña, deforme o antinatural.', ex: 'mutante, engendro, horror tentacular', trait: 'Alta resistencia a la magia (los hechizos hacen 25% menos). Rápida, con ataques moderados.', weak: 'Armas perforantes y espadas de plata.' },
    dragon: { name: 'Dragón', desc: 'Reptiles míticos y criaturas dracónicas.', ex: 'dragón, guiverno', trait: 'Inmune a los ataques físicos. Resistencia media a la magia.', weak: 'Ninguna.' },
    plant: { name: 'Planta', desc: 'Vegetación hostil, criatura vegetal.', ex: 'trepadora carnívora, ente del bosque, lanzaguisantes', trait: 'Regenera vida cada cierto tiempo.', weak: 'Recibe muchísimo daño del fuego y mucho de armas cortantes (espadas, hachas).' },
    spirit: { name: 'Espíritu', desc: 'Entidad incorpórea o mágica.', ex: 'fantasma, espectro, alma errante', trait: 'Se vuelve etéreo cada cierto tiempo (inmune mientras dura).', weak: 'Las armas bendecidas le hacen daño x2 (próximamente).' },
    giant: { name: 'Gigante', desc: 'Criatura de gran tamaño y fuerza física.', ex: 'ogro, trol', trait: 'Gran daño en área. Sus golpes pueden dejarte con Aturdimiento.', weak: 'Movilidad lenta. Gran cooldown de ataque.' },
    insectoid: { name: 'Insectoide', desc: 'Insecto o artrópodo gigante.', ex: 'escarabajo acorazado, mantis gigante', trait: 'Alta movilidad y ataques rápidos difíciles de esquivar.', weak: 'Magia y fuego.' },
    demon: { name: 'Demonio', desc: 'Criatura sobrenatural o de naturaleza infernal.', ex: 'demonio de fuego, guardián infernal, diablillo', trait: 'Ataques malditos (Maldito: menos vida total y un efecto aleatorio). Puede invocar elementales de fuego.', weak: 'Magia blanca y armas bendecidas.' },
    caster: { name: 'Invocador', desc: 'Ser con dones mágicos.', ex: 'Lanzamaleficios, Abadesa de las Velas', trait: 'Canaliza hechizos que se pueden interrumpir.', weak: 'Las interrupciones.' }
  },
  REACTIONS: {
    steam: { name: 'Estallido de Vapor', desc: 'Quemadura + Congelamiento. Una explosión abrasadora golpea todo alrededor.' },
    conduct: { name: 'Conducción', desc: 'Congelamiento + Vulnerable. Un rayo salta a 3 enemigos cercanos y los aturde.' },
    blight: { name: 'Llamarada Pútrida', desc: 'Quemadura + Envenenamiento. Explota y contagia veneno a los vecinos.' },
    paralysis: { name: 'Parálisis', desc: 'Envenenamiento + Vulnerable. Inmoviliza al objetivo durante 2 segundos.' },
    overload: { name: 'Sobrecarga', desc: 'Quemadura + Vulnerable. Una explosión que arroja lejos a los enemigos.' },
    shatter: { name: 'Quiebre', desc: 'Congelamiento o congelado + Quebrantamiento. Daño enorme a un solo objetivo.' },
    tempest: { name: 'Tempestad', desc: 'Vendaval + cualquier estado elemental. Copia ese estado a todos los enemigos cercanos.' },
    collapse: { name: 'Colapso', desc: 'Maldito + cualquier estado elemental. Arrastra a los enemigos hacia dentro y detona todos sus estados.' }
  },
  SPELLS: {
    pyre_supernova: { name: 'Supernova Ígnea', desc: s => `DEFINITIVA. Concentrás fuego un instante y explotás: ${s.dmg} de daño y Quemadura ×3 a todo lo que esté a menos de ${s.radius.toFixed(1)} m. Quema los proyectiles enemigos y deja un anillo de fuego.` },
    fist_strike: { name: 'Golpe de Puños', desc: s => `Un puñetazo rápido: ${s.dmg} de daño a los enemigos justo delante. Golpeá durante un impulso, o justo después, para hasta 3 Ataques Rápidos seguidos (casi sin espera): ${Math.round(s.dmg * 1.9)} de daño a todo alrededor.` },
    axe_chop: { name: 'Hachazo Simple', desc: s => `Un golpe pesado delante tuyo: ${s.dmg} de daño. Atraviesa escudos. Durante un impulso, o justo después, encadenás hasta 3 Ataques Rápidos casi sin espera: ${Math.round(s.dmg * 1.4)} de daño.` },
    axe_sweep: { name: 'Hachazo', desc: s => `Barrés con el hacha de derecha a izquierda todo el semicírculo de adelante (180°): ${s.dmg} de daño y Desangramiento nivel 1. Enfriamiento largo.` },
    axe_smash: { name: 'Golpe Demoledor', desc: s => `Levantás el hacha con las dos manos y la bajás de golpe sobre un solo enemigo: ${s.dmg} de daño y Quebrantamiento.` },
    axe_backhand: { name: 'Revés', desc: s => `Das media vuelta y descargás un tajo fuerte al frente: ${s.dmg} de daño en área, un gran empujón y Aturdimiento.` },
    axe_throw: { name: 'Lanzamiento de Hacha', desc: s => `DEFINITIVA. Arrojás el hacha a un enemigo: ${s.dmg} de daño, rebota en ${s.bounces} enemigos más y vuelve a tus manos.` },
    bastard_slash: { name: 'Tajo Pesado', desc: s => `Un tajo lento y pesado: ${s.dmg} de daño y Desangramiento. Tajeá durante un impulso, o justo después, para hasta 3 Ataques Rápidos seguidos (casi sin espera): ${Math.round(s.dmg * 1.8)} de daño a tu alrededor.` },
    bastard_thrust: { name: 'Estocada Larga', desc: s => `Como la Estocada, con mucho más alcance. Mantené para cargar y soltá para lanzarte atravesando enemigos: ${s.dmg} de daño y Desangramiento.` },
    bastard_cleave: { name: 'Gran Tajo', desc: s => `Un tajo fuerte hacia adelante en un arco de 90° con mucho alcance: ${s.dmg} de daño y Desangramiento.` },
    bastard_spin: { name: 'Gran Giro', desc: s => `Girás a toda velocidad durante ${s.dur.toFixed(0)} s con un radio enorme: ${s.dmg} de daño cada 0,2 s y Desangramiento. Te movés un ${Math.round(s.haste * 100)}% más rápido.` },
    bastard_execute: { name: 'Ejecución', desc: s => `DEFINITIVA · 3 cargas. Un tajo devastador a un enemigo: ${s.dmg} de daño, Quebrantamiento y Desangramiento. Si lo mata de un golpe, recuperás la carga al instante.` },
    sword_slash: { name: 'Tajo', desc: s => `Un tajo rápido y liviano delante tuyo: ${s.dmg} de daño. Tajeá durante un impulso, o justo después, para hasta 3 Ataques Rápidos seguidos (casi sin espera): ${Math.round(s.dmg * 1.9)} de daño a tu alrededor.` },
    sword_thrust: { name: 'Estocada', desc: s => `Mantené apretado para cargar: la flecha del piso muestra exactamente hasta dónde vas a llegar. Soltá para lanzarte a lo largo de ella atravesando a cada enemigo en el camino: ${s.dmg} de daño perforante y Desangramiento. Con carga completa: más rápida y +30% de daño.` },
    sword_cleave: { name: 'Golpe Potente', desc: s => `Un tajo fuerte hacia adelante en un arco de 90° frente a vos (no alrededor): ${s.dmg} de daño y empuje. Enfriamiento largo.` },
    sword_spin: { name: 'Golpe Giratorio', desc: s => `Girás a toda velocidad durante ${s.dur.toFixed(0)} s cortando todo lo que está cerca: ${s.dmg} de daño cada 0,2 s. Mientras girás te movés un ${Math.round(s.haste * 100)}% más rápido.` },
    flamethrower: { name: 'Lanzallamas', desc: s => `Lanzás un chorro de fuego de 45° delante tuyo durante ${s.dur.toFixed(1)} s. Sigue tu puntería, llega a ${s.range.toFixed(1)} m e inflige ${s.dmg} de daño 5 veces por segundo, aplicando Quemadura.` },
    meteor: { name: 'Meteorito', desc: s => `Un meteorito cae del cielo donde apuntas: ${s.dmg} de daño de impacto en un radio de ${s.radius.toFixed(1)} m, y luego el suelo arde.` },
    firestorm: { name: 'Torbellino de Fuego', desc: s => `Invoca un tornado de fuego estático durante ${s.dur.toFixed(1)} s. Atrae a los enemigos e inflige ${s.dmg} varias veces por segundo.` },
    cinder_bolt: { name: 'Saeta de Ceniza', desc: s => `Saeta rápida que inflige ${s.dmg} y aplica Quemadura. No cuesta maná. Durante un impulso, o justo después, encadenás hasta 3 Ataques Rápidos casi sin espera: ${Math.round(s.dmg * 1.4)} de daño.` },
    pyre_nova: { name: 'Nova de Pira', desc: s => `Estalla en un anillo de fuego de ${s.area.toFixed(1)} m: ${s.dmg} de daño, Quemadura ×2 y empuje.` },
    flame_wake: { name: 'Estela de Llamas', desc: s => `Avanzas ${s.range.toFixed(0)} m, intocable, dejando fuego que inflige ${s.dmg}/s y quema.` },
    rime_shard: { name: 'Esquirla de Escarcha', desc: s => `Esquirla perforante: ${s.dmg} a cada enemigo en línea. Aplica Congelamiento.` },
    glacier_ward: { name: 'Égida Glaciar', desc: s => `Un caparazón de hielo absorbe ${Math.round(s.absorb)} de daño durante 5 s. Al romperse o terminar estalla: ${s.dmg} de daño y Congelamiento ×2.` },
    frost_snare: { name: 'Trampa Gélida', desc: s => `Una runa en el objetivo congela todo lo que hay dentro tras 0,45 s (${s.dmg} de daño). Interrumpe.` },
    arc_lash: { name: 'Látigo de Arco', desc: s => `Un rayo se fija y salta entre ${s.jumps + 1} enemigos: ${s.dmg} a cada uno. Electriza.` },
    blink_volt: { name: 'Voltio Fugaz', desc: s => `Teletranspórtate hasta ${s.range.toFixed(0)} m. Ambos extremos descargan ${s.dmg} y electrizan.` },
    storm_totem: { name: 'Tótem de Tormenta', desc: s => `Planta un tótem durante 6 s que fulmina al enemigo más cercano cada 0,5 s por ${s.dmg}. Atrae a los enemigos.` },
    hex_spit: { name: 'Escupitajo Maldito', desc: s => `Rociada corta: ${s.dmg} y Envenenado ×2 a todos los enemigos en un cono.` },
    miasma: { name: 'Miasma', desc: s => `Una nube asfixiante durante 5 s. Ralentiza y acumula Envenenado dos veces por segundo.` },
    gust_fan: { name: 'Abanico de Ráfaga', desc: s => `Empuja a los enemigos, interrumpe lanzamientos y borra proyectiles hostiles en un cono amplio.` },
    zephyr_step: { name: 'Paso de Céfiro', desc: s => `Impulso largo e intocable (${s.range.toFixed(0)} m). Recupera una carga de impulso y zarandea a los enemigos que cruzas.` },
    cyclone: { name: 'Ciclón', desc: s => `Un torbellino errante arrastra a los enemigos durante 2,6 s, ${s.dmg} por golpe. Propaga estados.` },
    quake_spike: { name: 'Púa Sísmica', desc: s => `Brotan púas en línea: ${s.dmg} de daño, aturdimiento breve y Quebrantamiento. Interrumpe.` },
    bastion: { name: 'Bastión', desc: s => `Piel de piedra durante 3,5 s: recibes 65% menos daño, ignoras el empuje y aplicas Quebrantamiento a quien te ataque.` },
    boulder: { name: 'Peñasco Arrojado', desc: s => `Piedra pesada: ${s.dmg} de daño, empuje y Quebrantamiento. Interrumpe.` },
    rift_orb: { name: 'Orbe de Grieta', desc: s => `Orbe lento que atrae a los enemigos y luego colapsa: ${s.dmg} de daño y Maldito.` },
    null_mirror: { name: 'Espejo Nulo', desc: s => `Durante 1,6 s, los proyectiles hostiles que te tocan salen despedidos como saetas de Maldito de ${s.dmg} de daño.` },
    gravity_well: { name: 'Pozo Gravitatorio', desc: s => `Atrae a los enemigos a un punto durante 2,2 s y luego implosiona por ${s.dmg}. Interrumpe.` }
  },
  ROLE_INFO: { attack: { name: 'Ataque' }, movement: { name: 'Movimiento' }, defense: { name: 'Defensa' }, control: { name: 'Control' } },
  CHARMS: {
    kindling: { name: 'Corazón de Yesca', desc: 'La Quemadura inflige 60% más daño y dura 1 s más.' },
    hoarfrost: { name: 'Corona de Escarcha', desc: 'Los enemigos se congelan con 2 cargas de Congelamiento en vez de 3.' },
    static_sigil: { name: 'Sello Estático', desc: 'Golpear a un enemigo Vulnerable lanza un arco de 6 de daño a uno cercano.' },
    spare_breath: { name: 'Aliento de Reserva', desc: '+1 carga de impulso.' },
    quicksilver: { name: 'Venas de Azogue', desc: 'Todas las recargas de hechizos son 12% más cortas.' },
    deep_well: { name: 'Pozo Profundo', desc: '+30 de maná máximo y 25% más de regeneración de maná.' },
    blood_ward: { name: 'Égida de Sangre', desc: 'Curas 3 PV cada vez que provocas una reacción.' },
    catalyst: { name: 'Anillo Catalizador', desc: 'Daño de reacciones +45%.' },
    glass_edge: { name: 'Filo de Cristal', desc: 'Tus hechizos infligen 25% más daño. PV máximos −15.' },
    ironbark: { name: 'Nudo de Corteza Férrea', desc: '+25 PV máximos.' },
    rift_heel: { name: 'Talón de la Grieta', desc: 'Al impulsarte rasgas el aire: 10 de daño y Maldito en tu camino.' },
    venom_ink: { name: 'Tinta Venenosa', desc: 'Los hechizos de ataque también aplican 1 de Envenenado.' },
    second_wind: { name: 'Segundo Aliento', desc: 'Una vez por cámara, un golpe letal te deja con 1 PV.' },
    tempo_loop: { name: 'Bucle de Tempo', desc: 'El primer hechizo dentro de 1,5 s después de un impulso recarga 40% más rápido.' },
    hunters_mark: { name: 'Marca del Cazador', desc: 'Las élites y los Guardianes reciben 18% más daño.' },
    coil: { name: 'Bobina Conductora', desc: 'Los hechizos en cadena saltan una vez más; los proyectiles vuelan 15% más rápido.' },
    ember_bloom: { name: 'Flor de Brasa', desc: 'Los enemigos que mueren con Quemadura explotan por 14 de daño.' },
    cold_blood: { name: 'Sangre Fría', desc: 'Recibir daño aplica Congelamiento a los enemigos cercanos.' }
  },
  BOONS: {
    none: { name: 'Manos Vacías', desc: 'Sin don. La partida en estado puro.' },
    ironbark: { name: 'Semilla de Corteza Férrea', desc: 'Empiezas con +15 PV máximos.' },
    spare_breath: { name: 'Aliento de Reserva', desc: 'Empiezas con +1 carga de impulso.' },
    attuned: { name: 'Inicio Afinado', desc: 'Tu hechizo de la ranura I empieza en rango II.' },
    scholar: { name: 'Ojo del Erudito', desc: 'Las recompensas muestran 4 opciones en vez de 3.' },
    ember_purse: { name: 'Bolsa de Oro', desc: 'Ganas 25% más Monedas de Oro en esta partida.' },
    regent_ash: { name: 'Ceniza del Regente', desc: 'Una vez por partida, revives con 50% de PV.' }
  },
  ENEMIES: {
    bone_stalker: { name: 'Acechador Óseo', desc: 'Te rodea y luego salta adonde estás. Esquivá fuera del círculo de caída.' },
    husk: { name: 'Cáscara', desc: 'Embiste tras una breve preparación.' },
    spitter: { name: 'Escupebilis', desc: 'Mantiene la distancia y escupe bilis en línea.' },
    wisp: { name: 'Fatuo de Ceniza', desc: 'Se lanza sobre ti y detona.' },
    hexcaster: { name: 'Lanzamaleficios', desc: 'Canaliza círculos de maldición. Interrumpe la canalización.' },
    shieldbearer: { name: 'Celador', desc: 'Su escudo de losa bloquea proyectiles de frente. Flanquéalo, atúrdelo o quiébralo.' },
    brute: { name: 'Bruto Encadenado', desc: 'Carga en línea recta. Haz que choque con un pilar para aturdirlo.' },
    summoner: { name: 'Abadesa de las Velas', desc: 'Canaliza para invocar fatuos. Interrúmpela.' },
    dummy: { name: 'Efigie de Práctica' }, turret: { name: 'Efigie Lanzadora' },
    gaolwright: { name: 'El Carcelario', title: 'Guardián de las Celdas Bajas' },
    kiln_saint: { name: 'La Santa del Horno', title: 'Madre de las Cenizas' },
    hollow_regent: { name: 'El Regente Hueco', title: 'Quien Porta la Corona Vacía' },
    regent_echo: { name: 'Eco Hueco' }
  },
  ELITE_AFFIXES: { hasted: { name: 'Celeridad', desc: 'Se mueve y se prepara más rápido.' }, warded: { name: 'Regeneración', desc: 'Se regenera si lo dejas tranquilo.' }, volatile: { name: 'Volatilidad', desc: 'Estalla en proyectiles al morir.' }, splitting: { name: 'División', desc: 'Se divide en dos al morir.' }, vampiric: { name: 'Sangría', desc: 'Se cura cuando te hiere.' } },
  NODES: {
    combat: { name: 'Cámara', desc: 'Un combate. Elige una recompensa después.' },
    elite: { name: 'Cámara de Élite', desc: 'Un enemigo peligroso. Recompensa: un amuleto.' },
    challenge: { name: 'Prueba', desc: 'Acepta una prueba maldita por una gran recompensa, o sigue de largo.' },
    rest: { name: 'Hogar', desc: 'Cúrate, afina un hechizo o fortalécete.' },
    shrine: { name: 'Santuario de Forja', desc: 'Mejora un hechizo.' },
    treasure: { name: 'Relicario', desc: 'Tesoros y Monedas de Oro.' },
    merchant: { name: 'Mercader', desc: 'Un comerciante errante. Compra equipo con Monedas de Oro.' },
    mystery: { name: 'Desconocido', desc: 'Algo espera. Tal vez ayude.' },
    warden: { name: 'Guardián', desc: 'El custodio de esta profundidad.' }
  },
  DEPTHS: { 1: { name: 'La Cripta de la Cárcel' }, 2: { name: 'Las Salas del Horno' }, 3: { name: 'La Corte Hueca' } },
  MILESTONES: {
    first_steps: { name: 'Primeros Sellos', desc: 'Completa la iniciación.', reward: 'Don: Aliento de Reserva' },
    depth2: { name: 'Hacia el Horno', desc: 'Llega a la Profundidad II.', reward: 'Hechizo: Peñasco Arrojado · Don: Bolsa de Oro' },
    warden1: { name: 'Rompecadenas', desc: 'Derrota al Carcelario.', reward: 'Hechizo: Estela de Llamas' },
    warden2: { name: 'Caminante de Ceniza', desc: 'Derrota a la Santa del Horno.', reward: 'Hechizo: Espejo Nulo' },
    warden2b: { name: 'Segunda Ascua', desc: 'Derrota a la Santa del Horno dos veces.', reward: 'Hechizo: Pozo Gravitatorio' },
    victory: { name: 'Corona de Nada', desc: 'Derrota al Regente Hueco.', reward: 'Don: Ceniza del Regente' },
    reactions50: { name: 'Alquimista', desc: 'Provoca 50 reacciones entre todas tus partidas.', reward: 'Hechizo: Tótem de Tormenta' },
    interrupts20: { name: 'Silenciador', desc: 'Interrumpe 20 lanzamientos entre todas tus partidas.', reward: 'Hechizo: Trampa Gélida' },
    arena10: { name: 'Campeón del Foso', desc: 'Llega a la oleada 10 en el Asedio del Foso.', reward: 'Hechizo: Miasma' },
    coopwin: { name: 'Pareja Unida', desc: 'Supera una Profundidad en cooperativo.', reward: 'Hechizo: Ciclón' },
    elite10: { name: 'Rompecoronas', desc: 'Mata a 10 élites entre todas tus partidas.', reward: 'Amuleto: Bucle de Tempo' }
  },
  PRESETS: { 0: { name: 'Ceniza y Escarcha', note: 'Quemadura + Congelamiento = Estallido de Vapor' }, 1: { name: 'Invocatormentas', note: 'Congelamiento + Vulnerable = Conducción' }, 2: { name: 'Tejepútridos', note: 'Envenenamiento + Quemadura = Llamarada Pútrida' }, 3: { name: 'Corazón de Piedra', note: 'Congelamiento + Quebrantamiento = Quiebre' } },
  PASSIVES: {
    fire_dash: { name: 'Dash de Fuego', desc: s => `Al esquivar dejás un rastro de fuego durante ${s.dur.toFixed(1)} s que inflige ${s.dmg} por tick a los enemigos que lo pisan.` }
  },
  ATTRS: {
    vigor: { name: 'Vigor', desc: n => `+15 de estamina máxima (${100 + 15 * n} → ${100 + 15 * (n + 1)}).` },
    second_breath: { name: 'Segundo Aliento', desc: n => `La estamina se recupera un 20% más rápido (+${20 * n}% → +${20 * (n + 1)}%).` },
    thick_skin: { name: 'Piel Curtida', desc: n => `+12 de vida máxima por el resto de la partida.` },
    footwork: { name: 'Juego de Pies', desc: n => `+5% de velocidad de movimiento (+${5 * n}% → +${5 * (n + 1)}%).` },
    battle_rhythm: { name: 'Ritmo de Combate', desc: n => `Todas tus habilidades se recargan un 6% más rápido (−${6 * n}% → −${6 * (n + 1)}%).` }
  },
  BRANCH_LABEL: {
    range: { name: 'Más alcance', fmt: (a, b) => `Alcance ${a.range.toFixed(1)} m → ${b.range.toFixed(1)} m` },
    dmg: { name: 'Más daño', fmt: (a, b) => `Daño ${a.dmg} → ${b.dmg}` },
    area: { name: 'Área de impacto mayor', fmt: (a, b) => `Radio ${a.radius.toFixed(1)} m → ${b.radius.toFixed(1)} m` },
    dur: { name: 'Mayor duración', fmt: (a, b) => `Duración ${a.dur.toFixed(1)} s → ${b.dur.toFixed(1)} s` },
    cd: { name: 'Recarga más rápida', fmt: (a, b) => `Recarga ${a.cd.toFixed(1)} s → ${b.cd.toFixed(1)} s` },
    bounce: { name: 'Más rebotes', fmt: (a, b) => `Rebotes ${a.bounces} → ${b.bounces}` },
    haste: { name: 'Giro más veloz', fmt: (a, b) => `Velocidad al girar +${Math.round(a.haste * 100)}% → +${Math.round(b.haste * 100)}%` }
  },
  ITEMS: {
    iron_helm: { name: 'Casco de Hierro', desc: 'Abollado, pesado y tranquilizador.' },
    witch_hat: { name: 'Sombrero de Brujo', desc: 'Un sombrero alto y torcido que zumba cuando lanzás hechizos.' },
    ash_hood: { name: 'Capucha de Ceniza', desc: 'Tejida con una tela que nunca termina de dejar de humear.' },
    iron_cuirass: { name: 'Pechera de Hierro', desc: 'Placas sólidas. Vas a sentir cada paso.' },
    apprentice_robe: { name: 'Túnica de Aprendiz', desc: 'Manchas de tinta en las mangas y sellos en el ruedo.' },
    ember_scale: { name: 'Cota de Escamas Ígneas', desc: 'Escamas mudadas por algo que vivía en el Horno.' },
    iron_greaves: { name: 'Grebas de Hierro', desc: 'Placas de canilla remachadas sobre cuero.' },
    traveler_pants: { name: 'Pantalones de Viajero', desc: 'Livianos, remendados y hechos para correr.' },
    runesilk_leggings: { name: 'Calzas de Seda Rúnica', desc: 'Seda bordada con runas de presteza.' },
    leather_boots: { name: 'Botas de Cuero', desc: 'Suelas blandas. Pasos silenciosos.' },
    hobnail_boots: { name: 'Botas Herradas', desc: 'Tachas de hierro que se agarran a la piedra de la cripta.' },
    strider_boots: { name: 'Botas de Zancada', desc: 'Cada zancada cae un poco más lejos de lo que debería.' },
    wool_cloak: { name: 'Capa de Viajero', desc: 'Lana abrigada, deshilachada en los bordes.' },
    eagle_cloak: { name: 'Capa de Plumas de Águila', desc: 'Cosida con plumas de un águila enorme. Te sentís liviano.' },
    ember_mantle: { name: 'Manto de Brasas', desc: 'Su ruedo deja una estela de chispas detrás tuyo.' },
    vet_helm: { name: 'Yelmo del Veterano', desc: 'Un yelmo cerrado con una rendija estrecha. Abollado por más golpes de los que nadie contó.' },
    vet_cuirass: { name: 'Placas del Veterano', desc: 'Peto oxidado, hombreras desparejas, mangas de malla y guanteletes castigados.' },
    vet_greaves: { name: 'Grebas del Veterano', desc: 'Calzas de malla, grebas de acero, un cinturón gastado y un tabardo roto.' },
    vet_sabatons: { name: 'Escarpes del Veterano', desc: 'Botas de cuero pesadas con suela de hierro y punteras de acero.' },
    steel_sword: { name: 'Espada de Acero', desc: 'Acero simple y honesto. La afilaron más veces de las que alguien contó.' },
    tempered_sword: { name: 'Espada de Acero Templado', desc: 'Templada dos veces en aceite frío. Mantiene el filo.' },
    master_sword: { name: 'Espada de Acero Maestra', desc: 'La mejor obra de un herrero: guarda dorada y un equilibrio que parece vivo.' },
    woodcutter_axe: { name: 'Hacha de Leñador', desc: 'Hecha para robles, no para hombres. No parece notar la diferencia.' },
    war_axe: { name: 'Hacha de Guerra', desc: 'Mango largo y cabeza barbada, pensada para morder escudos.' },
    headsman_axe: { name: 'Hacha del Verdugo', desc: 'Pesada, de mango negro, con un filo que nunca termina de secarse.' },
    bastard_sword: { name: 'Espada Bastarda', desc: 'Una hoja de mano y media: larga, lenta y despiadada.' },
    oathbreaker: { name: 'Rompejuramentos', desc: 'Forjada para un juramento que se rompió. Las runas del canal todavía arden.' },
    shadow_cloak: { name: 'Capa de Sombras', desc: 'Es difícil golpear lo que apenas está ahí.' }
  },
  ITEM_STATS: { wdmg: { name: 'Daño del arma' }, hp: { name: 'Vida máxima' }, mana: { name: 'Maná máximo' }, armor: { name: 'Daño recibido' }, speed: { name: 'Velocidad' }, spell: { name: 'Daño de hechizos' }, fire: { name: 'Daño de fuego' }, cdr: { name: 'Recarga de hechizos' }, regen: { name: 'Regeneración de maná' }, dash: { name: 'Recarga del impulso' }, iframes: { name: 'Invulnerabilidad del impulso' } },
  RARITY: { common: { name: 'Común' }, uncommon: { name: 'Poco común' }, rare: { name: 'Raro' }, legendary: { name: 'Legendario' } },
  MODS: {
    multishot: { name: 'Disparo Doble', desc: k => k === 'chain' ? 'Tu ataque primario lanza una cadena de rayos extra contra otro enemigo.' : k === 'cone' ? 'Tu rociada primaria es 35% más ancha y pega más fuerte en los bordes.' : 'Tu ataque primario dispara un proyectil más en abanico. Cada uno inflige 80% del daño.' },
    pierce: { name: 'Disparo Perforante', desc: k => k === 'chain' ? 'Tu rayo primario salta a un enemigo más.' : k === 'cone' ? 'Tu rociada primaria llega 1,5 m más lejos.' : 'Tus proyectiles primarios atraviesan 2 enemigos más.' },
    ricochet: { name: 'Rebote', desc: k => 'Cuando un proyectil primario se detendría, rebota hacia el enemigo más cercano.' },
    explosive: { name: 'Bala Explosiva', desc: k => 'Los proyectiles primarios explotan al detenerse e infligen 50% del daño alrededor.' },
    rapid: { name: 'Lanzamiento Rápido', desc: k => 'Tu ataque primario recarga 15% más rápido.' },
    heavy: { name: 'Disparo Pesado', desc: k => 'Tu ataque primario inflige 25% más daño; los proyectiles son más grandes y algo más lentos.' },
    surge: { name: 'Carga Elemental', desc: k => 'Cada golpe primario aplica una carga más de su estado.' }
  },
  ACTION_NAMES: { up: 'Mover arriba', down: 'Mover abajo', left: 'Mover a la izquierda', right: 'Mover a la derecha', cast1: 'Hechizo ranura I', cast2: 'Hechizo ranura II', cast3: 'Hechizo ranura III', cast4: 'Hechizo ranura IV', ult: 'Definitiva', inventory: 'Inventario', dash: 'Impulso', interact: 'Interactuar', map: 'Mapa de cámaras', pause: 'Pausa' },
  TUT_STEPS: {
    0: { title: 'Moverse', text: a => `Camina hasta la runa brillante. ${a.move}` },
    1: { title: 'Apuntar y lanzar', text: a => `Apunta a la efigie y lanza Saeta de Ceniza con ${a.cast1}. Golpéala 3 veces.` },
    2: { title: 'Atraviesa el peligro', text: a => `La efigie lanza proyectiles. Pulsa ${a.dash} para impulsarte: durante el impulso eres intocable. Atraviesa 2 proyectiles.` },
    3: { title: 'Interrumpir', text: a => `El Lanzamaleficios está canalizando. Rompe su hechizo con Abanico de Ráfaga (${a.cast2}) antes de que se llene la barra.` },
    4: { title: 'Reacciones elementales', text: a => `Enfría la efigie con Esquirla de Escarcha (${a.cast3}) y luego quémala con Saeta de Ceniza (${a.cast1}). Quemadura + Congelamiento = Estallido de Vapor.` },
    5: { title: 'Iniciación completa', text: a => 'Ya sabes lo suficiente para morir con dignidad. Cruza la puerta para terminar.' }
  }
};

/* ---------- Core API ---------- */
const norm = s => s.replace(/\s+/g, ' ').trim();
H.t = function (key, p) {
  let s = (H.lang === 'es' && ES.str[key] != null) ? ES.str[key] : key;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m));
  return s;
};
// translate an already-rendered English string (exact match, or " · "-joined pieces)
H.tr = function (s) {
  if (H.lang !== 'es') return s;
  const k = norm(s); if (!k) return s;
  let hit = ES.str[k];
  if (hit == null && k.includes(' · ')) { const parts = k.split(' · '); const out = parts.map(x => ES.str[x] != null ? ES.str[x] : x); if (out.some((x, i) => x !== parts[i])) hit = out.join(' · '); }
  if (hit == null || hit.includes('{')) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  return lead + hit + trail;
};

/* ---------- Data swap ---------- */
let enSnap = null;
function snapshot() {
  enSnap = {};
  for (const coll in ES.data) {
    const src = coll === 'TUT_STEPS' ? H.G.TUT_STEPS : H[coll];
    enSnap[coll] = {};
    for (const id in ES.data[coll]) {
      const obj = src[id]; if (obj == null) continue;
      if (typeof obj === 'string') { enSnap[coll][id] = obj; continue; }
      enSnap[coll][id] = {};
      for (const f in ES.data[coll][id]) enSnap[coll][id][f] = obj[f];
    }
  }
}
function applyData(table) {
  for (const coll in table) {
    const dst = coll === 'TUT_STEPS' ? H.G.TUT_STEPS : H[coll];
    for (const id in table[coll]) {
      if (dst[id] == null) continue;
      if (typeof dst[id] === 'string' || typeof table[coll][id] === 'string') dst[id] = table[coll][id];
      else Object.assign(dst[id], table[coll][id]);
    }
  }
}

/* ---------- Live translator ---------- */
let observer = null;
const SKIP = new Set(['SCRIPT', 'STYLE', 'svg', 'path', 'TEXTAREA']);
function trNode(n) {
  const s = n.data; if (!/[A-Za-z]{2}/.test(s)) return;
  const p = n.parentNode; if (!p || SKIP.has(p.nodeName)) return;
  const out = H.tr(s); if (out !== s) n.data = out;
}
function trTree(root) {
  if (root.nodeType === 3) { trNode(root); return; }
  if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
  if (root.title) { const t = H.tr(root.title); if (t !== root.title) root.title = t; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trNode(n); else if (n.title) { const t = H.tr(n.title); if (t !== n.title) n.title = t; } }
}
function startObserver() {
  if (observer) return;
  const root = document.getElementById('app'); if (!root) return;
  observer = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'characterData') trNode(r.target);
      else if (r.type === 'attributes') { const el = r.target; const t = H.tr(el.title); if (t !== el.title) el.title = t; }
      else for (const n of r.addedNodes) trTree(n);
    }
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['title'] });
  trTree(root);
}
function stopObserver() { if (observer) { observer.disconnect(); observer = null; } }

H.setLang = function (lang) {
  lang = lang === 'es' ? 'es' : 'en';
  if (!enSnap) snapshot();
  H.lang = lang;
  applyData(lang === 'es' ? ES.data : enSnap);
  document.documentElement.lang = lang === 'es' ? 'es-419' : 'en';
  if (lang === 'es') startObserver(); else stopObserver();
};
H.detectLang = function () {
  if (H.settings.lang === 'es' || H.settings.lang === 'en') return H.settings.lang;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return /^es\b/i.test(nav) ? 'es' : 'en';
};
