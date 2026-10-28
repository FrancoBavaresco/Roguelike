extends Node
## Test driver (not part of the game): plays a scripted fight and saves screenshots to OUT (env HEX_OUT).
var out := "/tmp/hexshots"
var t := 0.0
var shots := {}
var main: Node
var log_lines: Array[String] = []

func _ready() -> void:
	out = OS.get_environment("HEX_OUT") if OS.get_environment("HEX_OUT") != "" else out
	DirAccess.make_dir_recursive_absolute(out)
	main = $Main
	Engine.time_scale = 0.25   # llvmpipe renders ~1 fps: slow the game so it plays smoothly enough to fight

func _aim_at_nearest() -> void:
	var p: Node3D = main.player
	var best: Node3D = null
	var bd := 1e9
	for e in main.enemies:
		if is_instance_valid(e):
			var d: float = e.global_position.distance_to(p.global_position)
			if d < bd: bd = d; best = e
	if best:
		var sp: Vector2 = main.camera.unproject_position(best.global_position + Vector3(0, 1, 0))
		Input.warp_mouse(sp)

func _press(a: String, dur := 0.06) -> void:
	Input.action_press(a)
	await get_tree().create_timer(dur).timeout
	Input.action_release(a)

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + name + ".png")
	log_lines.append("%s t=%.2f hp=%d enemies=%d wave=%d fps=%d" % [name, t, main.player.hp, main.enemies.size(), main.wave, Engine.get_frames_per_second()])

func _process(dt: float) -> void:
	t += dt

func _enter_tree() -> void:
	_run.call_deferred()

func _run() -> void:
	await get_tree().create_timer(1.6).timeout
	await _shot("00_start")
	# walk toward the enemies a little
	Input.action_press("move_up"); await get_tree().create_timer(0.5).timeout; Input.action_release("move_up")
	await _shot("01_walk")
	for c in 3:
		for h in 3:
			_aim_at_nearest()
			_press("attack")
			await get_tree().create_timer(0.09 if h < 2 else 0.18).timeout
			await _shot("02_combo%d_hit%d" % [c, h + 1])
			await get_tree().create_timer(0.15 if h < 2 else 0.45).timeout
		_aim_at_nearest()
		Input.action_press("move_left"); _press("dash"); await get_tree().create_timer(0.08).timeout
		await _shot("03_dash%d" % c)
		await get_tree().create_timer(0.2).timeout; Input.action_release("move_left")
	await get_tree().create_timer(1.0).timeout
	await _shot("04_after")
	print("\n".join(log_lines))
	get_tree().quit()
