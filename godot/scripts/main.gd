extends Node3D
## Hexwright (Godot) — first playable slice: one chamber, Theron with his sword combo and dash, waves of Husks.
## Builds everything in code so the scene file stays tiny: input map, light and atmosphere, the room, the camera,
## the HUD, and the combat effects (hit areas, painted slashes, damage numbers, camera shake).

const T := preload("res://scripts/tuning.gd")
const PlayerScript := preload("res://scripts/player.gd")
const HuskScript := preload("res://scripts/husk.gd")
const TEX_FLOOR := preload("res://assets/textures/floor/color_2k.jpg")
const TEX_FLOOR_N := preload("res://assets/textures/floor/nor_gl_2k.jpg")
const TEX_WALL := preload("res://assets/textures/wall/diff_1k.jpg")
const TEX_WALL_N := preload("res://assets/textures/wall/nor_gl_1k.jpg")
const TEX_PILLAR := preload("res://assets/textures/pillar/face03_diff.jpg")
const TEX_PILLAR_N := preload("res://assets/textures/pillar/face03_nor.jpg")
const TEX_SLASH := preload("res://assets/textures/fx/theron_slash_1.png")
const TEX_THRUST := preload("res://assets/textures/fx/thrust_atlas.png")

const ROOM := Vector2(26.0, 18.0)       # inner size (m), x by z
const WALL_H := 3.2

var player: Player
var camera: Camera3D
var enemies: Array[Husk] = []
var wave := 0
var _cam_target := Vector3.ZERO
var _shake := 0.0
var _hud_hp: ProgressBar
var _hud_hp_label: Label
var _hud_wave: Label
var _hud_dash: Label
var _hud_msg: Label
var _between_waves := 0.0
var _fx_root: Node3D
var mouse_aim := true                  # false: something else aims (tests, later a gamepad)

func _ready() -> void:
	randomize()
	_setup_input()
	_build_atmosphere()
	_build_room()
	_fx_root = Node3D.new(); add_child(_fx_root)
	player = PlayerScript.new()
	player.world = self
	add_child(player)
	player.position = Vector3(0, 0, 4)
	player.hp_changed.connect(_on_hp)
	player.died.connect(_on_player_died)
	_build_camera()
	_build_hud()
	_between_waves = 1.0

# ---------------------------------------------------------------- input
func _setup_input() -> void:
	var keys := { "move_up": [KEY_W, KEY_UP], "move_down": [KEY_S, KEY_DOWN], "move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT], "dash": [KEY_SPACE], "restart": [KEY_R] }
	for action in keys:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new(); ev.physical_keycode = k
			InputMap.action_add_event(action, ev)
	if not InputMap.has_action("attack"):
		InputMap.add_action("attack")
		var mb := InputEventMouseButton.new(); mb.button_index = MOUSE_BUTTON_LEFT
		InputMap.action_add_event("attack", mb)
		var jk := InputEventKey.new(); jk.physical_keycode = KEY_J
		InputMap.action_add_event("attack", jk)

# ---------------------------------------------------------------- world
func _build_atmosphere() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("0c0f12")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("5f7a80")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.05
	env.ssao_enabled = true
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.08
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	RenderingServer.set_default_clear_color(env.background_color)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("ffe2c4"); sun.light_energy = 1.25
	sun.rotation_degrees = Vector3(-58, 30, 0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)

func _tiled(tex: Texture2D, nor: Texture2D, tile: Vector3, color := Color.WHITE) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex; m.albedo_color = color
	m.normal_enabled = true; m.normal_texture = nor
	m.uv1_scale = tile; m.roughness = 0.9
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m

func _block(size: Vector3, pos: Vector3, mat: Material, visible := true) -> void:
	var sb := StaticBody3D.new(); sb.position = pos; sb.collision_layer = 1
	var cs := CollisionShape3D.new(); var bs := BoxShape3D.new(); bs.size = size; cs.shape = bs; sb.add_child(cs)
	if visible:
		var mi := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = size; mi.mesh = bm; mi.material_override = mat; sb.add_child(mi)
	add_child(sb)

func _build_room() -> void:
	# floor
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = ROOM + Vector2(6, 6)
	floor_mi.mesh = pm
	floor_mi.material_override = _tiled(TEX_FLOOR, TEX_FLOOR_N, Vector3((ROOM.x + 6) / 6.0, (ROOM.y + 6) / 6.0, 1))
	add_child(floor_mi)
	# the dark beyond the walls
	var outer := MeshInstance3D.new(); var om := PlaneMesh.new(); om.size = Vector2(120, 120); outer.mesh = om
	var dark := StandardMaterial3D.new(); dark.albedo_color = Color("0b0d0f"); dark.roughness = 1.0; outer.material_override = dark
	outer.position.y = -0.02
	add_child(outer)
	# walls: tall on the far sides (north, west: the ones the camera sees), a low curb on the near ones
	var wm := _tiled(TEX_WALL, TEX_WALL_N, Vector3(8, 2, 1), Color("b9c2c4"))
	var hx := ROOM.x / 2.0
	var hz := ROOM.y / 2.0
	var t := 1.0
	_block(Vector3(ROOM.x + 2 * t, WALL_H, t), Vector3(0, WALL_H / 2, -hz - t / 2), wm)
	_block(Vector3(t, WALL_H, ROOM.y), Vector3(-hx - t / 2, WALL_H / 2, 0), wm)
	_block(Vector3(ROOM.x + 2 * t, 0.35, t), Vector3(0, 0.175, hz + t / 2), wm)
	_block(Vector3(t, 0.35, ROOM.y), Vector3(hx + t / 2, 0.175, 0), wm)
	_block(Vector3(ROOM.x + 2 * t, 3, t), Vector3(0, 1.5, hz + t / 2), wm, false)    # invisible: keeps everyone in
	_block(Vector3(t, 3, ROOM.y), Vector3(hx + t / 2, 1.5, 0), wm, false)
	# pillars
	var pmat := _tiled(TEX_PILLAR, TEX_PILLAR_N, Vector3(2, 2, 1), Color("c8c0b4"))
	for p in [Vector2(-7, -3.5), Vector2(7, -3.5), Vector2(-7, 4), Vector2(7, 4)]:
		var sb := StaticBody3D.new(); sb.position = Vector3(p.x, 0, p.y)
		var cs := CollisionShape3D.new(); var cyl := CylinderShape3D.new(); cyl.radius = 0.75; cyl.height = 4.0; cs.shape = cyl; cs.position.y = 2.0; sb.add_child(cs)
		var mi := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.65; cm.bottom_radius = 0.75; cm.height = 3.6; cm.radial_segments = 10
		mi.mesh = cm; mi.position.y = 1.8; mi.material_override = pmat; sb.add_child(mi)
		var cap := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.8, 0.35, 1.8); cap.mesh = bm; cap.position.y = 0.17; cap.material_override = pmat; sb.add_child(cap)
		add_child(sb)
	# braziers against the far wall: green fire light (the dungeon's first depth)
	for x in [-6.0, 6.0]:
		_brazier(Vector3(x, 0, -hz + 1.2))

func _brazier(pos: Vector3) -> void:
	var root := Node3D.new(); root.position = pos; add_child(root)
	var metal := StandardMaterial3D.new(); metal.albedo_color = Color("2a3134"); metal.metallic = 0.3; metal.roughness = 0.7
	var bowl := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.6; cm.bottom_radius = 0.25; cm.height = 0.45
	bowl.mesh = cm; bowl.position.y = 0.95; bowl.material_override = metal; root.add_child(bowl)
	var stem := MeshInstance3D.new(); var sm := CylinderMesh.new(); sm.top_radius = 0.14; sm.bottom_radius = 0.3; sm.height = 0.8
	stem.mesh = sm; stem.position.y = 0.4; stem.material_override = metal; root.add_child(stem)
	var fire_mat := StandardMaterial3D.new(); fire_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fire_mat.albedo_color = Color(0.45, 1.0, 0.55); fire_mat.emission_enabled = true; fire_mat.emission = Color(0.3, 1, 0.45); fire_mat.emission_energy_multiplier = 2.5
	var fire := MeshInstance3D.new(); var fm := SphereMesh.new(); fm.radius = 0.35; fm.height = 0.9
	fire.mesh = fm; fire.position.y = 1.45; fire.material_override = fire_mat; root.add_child(fire)
	var light := OmniLight3D.new(); light.light_color = Color(0.45, 1.0, 0.6); light.light_energy = 2.2; light.omni_range = 9.0
	light.position.y = 2.2; light.shadow_enabled = false; root.add_child(light)

# ---------------------------------------------------------------- camera
func _build_camera() -> void:
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = T.CAM_SIZE
	camera.near = 0.1; camera.far = 200.0
	add_child(camera)
	_cam_target = player.global_position
	_place_camera(0.0)

func _place_camera(dt: float) -> void:
	if dt > 0.0:
		_cam_target = _cam_target.lerp(player.global_position, 1.0 - exp(-dt * T.CAM_FOLLOW))
	var yaw := deg_to_rad(T.CAM_YAW)
	var pitch := deg_to_rad(T.CAM_PITCH)
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * 40.0
	var shake := Vector3.ZERO
	if _shake > 0.0:
		shake = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * _shake * 0.35
	camera.global_position = _cam_target + Vector3(0, 0.8, 0) + off + shake
	camera.look_at(_cam_target + Vector3(0, 0.8, 0) + shake, Vector3.UP)

func _process(dt: float) -> void:
	_shake = maxf(0.0, _shake - dt * 2.5)
	_place_camera(dt)
	_update_aim()
	_update_waves(dt)
	if Input.is_action_just_pressed("restart"):
		get_tree().reload_current_scene()
	_hud_dash.text = "Impulso  " + "◆ ".repeat(player.dash_charges) + "◇ ".repeat(T.DASH_CHARGES - player.dash_charges)

func _update_aim() -> void:
	if not mouse_aim:
		return
	var mp := get_viewport().get_mouse_position()
	var from := camera.project_ray_origin(mp)
	var dir := camera.project_ray_normal(mp)
	if absf(dir.y) < 1e-4:
		return
	var hit := from + dir * ((1.0 - from.y) / dir.y)      # the plane at blade height
	var a := hit - player.global_position; a.y = 0
	if a.length() > 0.05:
		player.aim = a.normalized()

func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)

# ---------------------------------------------------------------- waves
func _update_waves(dt: float) -> void:
	enemies = enemies.filter(func(e): return is_instance_valid(e) and e.state != Husk.State.DEAD)
	if player.dead:
		return
	if enemies.is_empty():
		if _between_waves <= 0.0:
			_between_waves = 1.6
			if wave > 0:
				_message("Oleada %d superada" % wave, 1.4)
		_between_waves -= dt
		if _between_waves <= 0.0:
			_spawn_wave()

func _spawn_wave() -> void:
	wave += 1
	_hud_wave.text = "Oleada %d" % wave
	var n := 2 + wave * 2
	for i in n:
		var e: Husk = HuskScript.new()
		e.target = player; e.world = self
		var side := i % 3
		var p := Vector3.ZERO
		match side:
			0: p = Vector3(randf_range(-11, 11), 0, -7.5)
			1: p = Vector3(-11.5, 0, randf_range(-7, 7))
			_: p = Vector3(randf_range(-11, 11), 0, 7.5)
		if p.distance_to(player.global_position) < 5.0:
			p = -p
		e.position = p
		add_child(e)
		enemies.append(e)
		_spawn_puff(p)

func _spawn_puff(p: Vector3) -> void:
	var mi := MeshInstance3D.new(); var sm := SphereMesh.new(); sm.radius = 0.8; sm.height = 0.3; mi.mesh = sm
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(0.6, 0.3, 0.8, 0.6); mi.material_override = m; mi.position = p + Vector3(0, 0.1, 0)
	_fx_root.add_child(mi)
	var tw := create_tween(); tw.tween_property(mi, "scale", Vector3(2.2, 1, 2.2), 0.5); tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.5); tw.tween_callback(mi.queue_free)

# ---------------------------------------------------------------- combat
## One combo hit lands: sweep (arc in front), cone (narrow, shorter), line (the thrust: a strip ahead).
func sword_hit(p: Player, hd: Dictionary, dir: Vector3) -> void:
	var origin := p.global_position
	var dmg := int(round(T.SWORD_DMG * float(hd["dmg_mul"])))
	var hits := 0
	for e in enemies:
		if not is_instance_valid(e) or e.state == Husk.State.DEAD:
			continue
		var d := e.global_position - origin; d.y = 0
		var ok := false
		if hd["shape"] == "line":
			var x0 := origin + dir * 0.3
			var dd := e.global_position - x0; dd.y = 0
			var along := dd.dot(dir)
			var side := absf(dd.cross(dir).y)
			ok = along > -T.HUSK_RADIUS and along < float(hd["len"]) + T.HUSK_RADIUS and side < float(hd["width"]) / 2.0 + T.HUSK_RADIUS
		else:
			var reach := T.SWORD_RANGE * float(hd["range_mul"])
			var half := deg_to_rad(float(hd["angle"])) / 2.0
			var ang := absf(dir.signed_angle_to(d.normalized(), Vector3.UP)) if d.length() > 0.01 else 0.0
			ok = d.length() < reach + T.HUSK_RADIUS and ang < half + atan2(T.HUSK_RADIUS, maxf(d.length(), 0.1)) * 0.5
		if ok:
			var push := (d.normalized() if hd["shape"] != "line" else dir) * float(hd["knock"])
			e.take_hit(dmg, push, hd["shape"] != "sweep")
			hits += 1
	if hd["shape"] == "line":
		_thrust_fx(origin, dir)
	else:
		_slash_fx(origin, dir, hd)
	if hits > 0:
		shake(0.12 if hd["shape"] == "sweep" else 0.2)
		_hitstop(0.045 if hd["shape"] == "sweep" else 0.07)

var _base_time_scale := 1.0
func _hitstop(t: float) -> void:
	if Engine.time_scale >= _base_time_scale * 0.5:
		_base_time_scale = Engine.time_scale
	Engine.time_scale = _base_time_scale * 0.05
	await get_tree().create_timer(t, true, false, true).timeout
	Engine.time_scale = _base_time_scale

## Theron's painted slash (art/theron_slash_v3, layer 1) lying flat at blade height, fading out.
func _slash_fx(origin: Vector3, dir: Vector3, hd: Dictionary) -> void:
	var s := Sprite3D.new()
	s.texture = TEX_SLASH
	s.axis = Vector3.AXIS_Y
	s.shaded = false; s.double_sided = true; s.no_depth_test = false
	s.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
	var size := T.SWORD_RANGE * float(hd["range_mul"]) * 2.1
	s.pixel_size = size / 512.0
	s.modulate = Color(1, 1, 1, 0.95)
	_fx_root.add_child(s)
	s.global_position = origin + Vector3(0, 1.0, 0) + dir * 0.6
	s.rotation.y = atan2(-dir.x, -dir.z)
	if hd["shape"] == "cone":
		s.scale = Vector3(0.7, 1, 1.15)
	var tw := create_tween()
	tw.tween_property(s, "modulate:a", 0.0, 0.22).set_delay(0.06)
	tw.parallel().tween_property(s, "position", s.position + dir * 0.4, 0.28)
	tw.tween_callback(s.queue_free)

## The thrust: the artist's blast drawing (estocada_azul, layer "Capa 10") shooting along the line.
func _thrust_fx(origin: Vector3, dir: Vector3) -> void:
	var s := Sprite3D.new()
	s.texture = TEX_THRUST
	s.region_enabled = true; s.region_rect = Rect2(2, 762, 175, 138)        # the cyan blast
	s.axis = Vector3.AXIS_Y
	s.shaded = false; s.double_sided = true
	s.pixel_size = 0.016
	_fx_root.add_child(s)
	s.global_position = origin + Vector3(0, 1.0, 0) + dir * 1.2
	s.rotation.y = atan2(-dir.x, -dir.z) - PI / 2      # the drawing runs along +X
	var tw := create_tween()
	tw.tween_property(s, "position", s.position + dir * 1.6, 0.2).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(s, "scale", Vector3(1.6, 1, 1), 0.2)
	tw.parallel().tween_property(s, "modulate:a", 0.0, 0.25).set_delay(0.08)
	tw.tween_callback(s.queue_free)

func dash_fx(pos: Vector3, dir: Vector3) -> void:
	for i in 3:
		var mi := MeshInstance3D.new(); var q := QuadMesh.new(); q.size = Vector2(1.6, 0.12); mi.mesh = q
		var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(0.85, 0.95, 1.0, 0.7); m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		mi.material_override = m
		_fx_root.add_child(mi)
		mi.global_position = pos + Vector3(0, 0.5 + i * 0.45, 0) - dir * (0.3 + i * 0.2)
		var tw := create_tween(); tw.tween_property(m, "albedo_color:a", 0.0, 0.25); tw.tween_callback(mi.queue_free)

func damage_number(pos: Vector3, dmg: int) -> void:
	var l := Label3D.new()
	l.text = str(dmg); l.font_size = 64; l.outline_size = 12; l.pixel_size = 0.006
	l.modulate = Color("fff1d6"); l.outline_modulate = Color(0.1, 0.05, 0.05)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED; l.no_depth_test = true
	_fx_root.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 0, 0)
	var tw := create_tween()
	tw.tween_property(l, "position", l.position + Vector3(0, 0.9, 0), 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.3).set_delay(0.35)
	tw.tween_callback(l.queue_free)

# ---------------------------------------------------------------- HUD
func _build_hud() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var box := VBoxContainer.new(); box.position = Vector2(32, 28); cl.add_child(box)
	_hud_hp_label = Label.new(); _hud_hp_label.text = "Theron  %d / %d" % [T.PLAYER_HP, T.PLAYER_HP]; box.add_child(_hud_hp_label)
	_hud_hp = ProgressBar.new(); _hud_hp.custom_minimum_size = Vector2(360, 22); _hud_hp.max_value = T.PLAYER_HP; _hud_hp.value = T.PLAYER_HP; _hud_hp.show_percentage = false
	var fill := StyleBoxFlat.new(); fill.bg_color = Color("b8323a"); _hud_hp.add_theme_stylebox_override("fill", fill)
	var bg := StyleBoxFlat.new(); bg.bg_color = Color(0.08, 0.06, 0.07, 0.85); _hud_hp.add_theme_stylebox_override("background", bg)
	box.add_child(_hud_hp)
	_hud_dash = Label.new(); box.add_child(_hud_dash)
	_hud_wave = Label.new(); _hud_wave.text = ""; box.add_child(_hud_wave)
	for l in [_hud_hp_label, _hud_dash, _hud_wave]:
		l.add_theme_font_size_override("font_size", 22)
		l.add_theme_color_override("font_outline_color", Color.BLACK); l.add_theme_constant_override("outline_size", 6)
	var help := Label.new()
	help.text = "WASD mover · Clic izquierdo combo (3 golpes) · Espacio impulso · R reiniciar"
	help.add_theme_font_size_override("font_size", 18); help.modulate = Color(1, 1, 1, 0.7)
	help.anchor_top = 1.0; help.anchor_bottom = 1.0; help.position = Vector2(32, -48)
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_KEEP_SIZE, 32)
	cl.add_child(help)
	_hud_msg = Label.new()
	_hud_msg.add_theme_font_size_override("font_size", 48)
	_hud_msg.add_theme_color_override("font_outline_color", Color.BLACK); _hud_msg.add_theme_constant_override("outline_size", 10)
	_hud_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hud_msg.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP, Control.PRESET_MODE_KEEP_SIZE, 120)
	_hud_msg.modulate.a = 0.0
	cl.add_child(_hud_msg)

func _message(text: String, hold: float) -> void:
	_hud_msg.text = text
	_hud_msg.reset_size()
	_hud_msg.position.x = (get_viewport().get_visible_rect().size.x - _hud_msg.size.x) / 2.0
	var tw := create_tween()
	tw.tween_property(_hud_msg, "modulate:a", 1.0, 0.15)
	if hold > 0.0:
		tw.tween_property(_hud_msg, "modulate:a", 0.0, 0.4).set_delay(hold)

func _on_hp(hp: int, max_hp: int) -> void:
	_hud_hp.value = hp
	_hud_hp_label.text = "Theron  %d / %d" % [hp, max_hp]

func _on_player_died() -> void:
	_message("Theron cayó en la oleada %d — R para reintentar" % wave, 0.0)
