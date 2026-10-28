extends Node
## Test (not part of the game): close-ups of the Husk model walking, winding up, hit and dying.
var main: Node
func _ready() -> void:
	main = $Main
	_run.call_deferred()
func _shot(name: String, zoom: float) -> void:
	main.camera.size = zoom
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/enemy_" + name + ".png")
func _run() -> void:
	Engine.time_scale = 0.15
	main._between_waves = 1e9
	main.wave = 1; main._spawn_wave()        # 4 knights
	var p = main.player
	var i := 0
	for e in main.enemies:
		e.global_position = p.global_position + Vector3(-2.5 + i * 1.7, 0, -2.6 + (i % 2) * 0.8); i += 1
	await get_tree().create_timer(0.15).timeout
	await _shot("walk", 7.0)
	var a: Husk = main.enemies[0]
	a._go(Husk.State.WINDUP)
	await get_tree().create_timer(0.08).timeout
	await _shot("windup", 7.0)
	var b: Husk = main.enemies[1]
	b.take_hit(9, Vector3(0, 0, -3), true)
	await get_tree().create_timer(0.01).timeout
	await _shot("hit", 7.0)
	var c: Husk = main.enemies[2]
	c.take_hit(99, Vector3(0, 0, -4), true)
	await get_tree().create_timer(0.09).timeout
	await _shot("dying", 7.0)
	await _shot("game_zoom", 11.0)
	get_tree().quit()
