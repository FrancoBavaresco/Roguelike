extends Node
## Headless soak (not part of the game): a bot fights waves for SOAK_SECONDS and reports kills, waves, damage taken.
var main: Node
var t := 0.0
var kills := 0
var _next := 0.0
func _ready() -> void:
	main = $Main
	main.mouse_aim = false
	Engine.time_scale = 4.0
	Engine.physics_ticks_per_second = 60
	Engine.max_physics_steps_per_frame = 32
func _physics_process(dt: float) -> void:
	t += dt
	var p: Node3D = main.player
	if p.dead:
		print("DEAD at t=%.1f wave=%d" % [t, main.wave]); get_tree().quit(); return
	var best: Node3D = null; var bd := 1e9
	for e in main.enemies:
		if is_instance_valid(e):
			var d: float = e.global_position.distance_to(p.global_position)
			if d < bd: bd = d; best = e
	if best:
		var a: Vector3 = best.global_position - p.global_position; a.y = 0
		p.aim = a.normalized()
		if bd > 2.4: Input.action_press("move_right") if a.x > 0.3 else Input.action_release("move_right")
		else: Input.action_release("move_right")
		if t >= _next and bd < 3.0:
			Input.action_press("attack"); _next = t + 0.25
		else:
			Input.action_release("attack")
	if t > float(OS.get_environment("SOAK_SECONDS") if OS.get_environment("SOAK_SECONDS") != "" else "60"):
		print("END t=%.1f wave=%d hp=%d enemies=%d" % [t, main.wave, p.hp, main.enemies.size()]); get_tree().quit()
