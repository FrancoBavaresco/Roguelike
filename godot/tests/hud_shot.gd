extends Node
## Test (not part of the game): one screenshot of the HUD with damage taken, a dash used and a message.
func _ready() -> void:
	_run.call_deferred()
func _run() -> void:
	var main = $Main
	main._between_waves = 1e9
	await get_tree().create_timer(0.3).timeout
	main.player.take_hit(23, main.player.global_position + Vector3(1, 0, 0))
	main.player.dash_charges = 1
	main.hud.set_wave(3)
	main.hud.show_message("Oleada 2 superada", 5.0)
	await get_tree().create_timer(0.4).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("/tmp/hud.png")
	print("InputMap actions: ", InputMap.get_actions().filter(func(a): return not a.begins_with("ui_")))
	get_tree().quit()
