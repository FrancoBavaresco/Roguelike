extends Node
## Test (not part of the game): Theron's postures — standing (front, side, back), running, the transition back to
## the shoulder, a swing and a hit taken — close up in the game's camera. Saves to HEX_OUT (default /tmp/posture).
var out := "/tmp/posture"
var main: Node
var p: Node
func _ready() -> void:
	out = OS.get_environment("HEX_OUT") if OS.get_environment("HEX_OUT") != "" else out
	DirAccess.make_dir_recursive_absolute(out)
	main = $Main
	_run.call_deferred()
func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var c: Vector2 = main.camera.unproject_position(p.global_position + Vector3(0, 1, 0))
	img.get_region(Rect2i(int(c.x) - 300, int(c.y) - 330, 600, 600)).save_png(out + "/" + name + ".png")
func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout
func _walk(action: String, s: float) -> void:
	Input.action_press(action); await _wait(s); Input.action_release(action)
func _run() -> void:
	Engine.time_scale = 0.1
	main._between_waves = 1e9
	main.camera.size = 3.6
	p = main.player
	await _wait(0.3)
	await _walk("move_down", 0.12); await _wait(0.6); await _shot("1_quieto_frente")
	await _walk("move_right", 0.12); await _wait(0.6); await _shot("2_quieto_costado")
	await _walk("move_up", 0.12); await _wait(0.6); await _shot("3_quieto_espalda")
	p.global_position = Vector3(-4, 0, 1)
	Input.action_press("move_right"); await _wait(0.45); await _shot("4_corriendo_costado")
	await _wait(0.12); await _shot("5_corriendo_costado_b"); Input.action_release("move_right")
	p.global_position = Vector3(-3, 0, -2)
	Input.action_press("move_down"); await _wait(0.4); await _shot("6_corriendo_frente"); Input.action_release("move_down")
	await _wait(0.12); await _shot("7_transicion")
	await _wait(0.6); await _shot("8_quieto_otra_vez")
	main.mouse_aim = false; p.aim = Vector3(1, 0, 0)
	Input.action_press("attack"); await _wait(0.03); Input.action_release("attack")
	await _wait(0.06); await _shot("9_ataque")
	await _wait(0.5); await _shot("10_despues_del_ataque")
	p.take_hit(5, p.global_position + Vector3(0, 0, -1))
	await _wait(0.05); await _shot("11_golpe_recibido")
	get_tree().quit()
