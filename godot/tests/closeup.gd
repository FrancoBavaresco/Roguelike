extends Node
## Test driver: close-up of Theron (idle, run, each combo hit) to check the model's facing and the sword.
var out := "/tmp/hexclose"
var main: Node
func _ready() -> void:
	out = OS.get_environment("HEX_OUT") if OS.get_environment("HEX_OUT") != "" else out
	DirAccess.make_dir_recursive_absolute(out)
	main = $Main
	_run.call_deferred()
func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var c: Vector2 = main.camera.unproject_position(main.player.global_position + Vector3(0, 1, 0))
	img = img.get_region(Rect2i(int(c.x) - 330, int(c.y) - 300, 660, 600))
	img.save_png(out + "/" + name + ".png")
	var pl = main.player
	print(name, " attack_t=", snappedf(pl._attack_t, 0.01), " shape=", pl._attack_hit.get("shape", "-"), " blade=", pl._sword_pose.basis.y.snapped(Vector3.ONE * 0.01), " grip=", pl._sword_pose.origin.snapped(Vector3.ONE * 0.01), " ik_hand=", pl.skeleton.get_bone_global_pose(pl.skeleton.find_bone("RightHand")).origin.snapped(Vector3.ONE * 0.01), " fps=", Engine.get_frames_per_second())
func _run() -> void:
	main.wave = 99   # no enemies
	main._between_waves = 1e9
	main.camera.size = 4.0
	Engine.time_scale = 0.1   # llvmpipe renders ~1 fps: slow the game so every phase of a swing gets frames
	Input.warp_mouse(Vector2(1500, 540))   # aim to the screen's right
	await get_tree().create_timer(0.6).timeout
	await _shot("idle")
	Input.action_press("move_right"); await get_tree().create_timer(0.35).timeout
	await _shot("run_right"); Input.action_release("move_right")
	Input.action_press("move_down"); await get_tree().create_timer(0.35).timeout
	await _shot("run_down"); Input.action_release("move_down")
	await get_tree().create_timer(0.4).timeout
	for h in 3:
		Input.action_press("attack"); await get_tree().create_timer(0.05).timeout; Input.action_release("attack")
		var ts := [0.03, 0.12, 0.2] if h < 2 else [0.05, 0.15, 0.3]
		var prev := 0.05
		for k in ts.size():
			await get_tree().create_timer(ts[k] - prev).timeout; prev = ts[k]
			await _shot("hit%d_%d" % [h + 1, k])
		await get_tree().create_timer(0.12).timeout
	get_tree().quit()
