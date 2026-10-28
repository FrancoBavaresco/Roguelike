extends Node
## Behaviour trace (not part of the game): a fixed seed and a scripted bot fight for TRACE_SECONDS of game time;
## prints one line per second (player, enemies, wave). Run with --fixed-fps so every run is identical, then compare
## the output before and after a refactor: the same lines = the same game.
var main: Node
var frame := 0
var _next := 0.0
func _ready() -> void:
	main = $Main
	seed(20261027)
	main.mouse_aim = false
func _physics_process(dt: float) -> void:
	frame += 1
	var t := frame / 60.0
	var p: Node3D = main.player
	var best: Node3D = null; var bd := 1e9
	for e in get_tree().get_nodes_in_group("enemies") if not get_tree().get_nodes_in_group("enemies").is_empty() else main.enemies:
		if is_instance_valid(e) and e.state != 5:
			var d: float = e.global_position.distance_to(p.global_position)
			if d < bd: bd = d; best = e
	Input.action_release("attack"); Input.action_release("dash")
	if best and not p.dead:
		var a: Vector3 = best.global_position - p.global_position; a.y = 0
		p.aim = a.normalized()
		if frame % 90 == 45: Input.action_press("dash")
		elif bd < 3.0 and t >= _next: Input.action_press("attack"); _next = t + 0.25
	if frame % 60 == 0:
		var hs := 0; var n := 0
		for e in main.enemies:
			if is_instance_valid(e): hs += e.hp; n += 1
		print("T%03d p=(%.2f,%.2f) hp=%d dash=%d wave=%d enemies=%d enemy_hp=%d" % [frame / 60, p.global_position.x, p.global_position.z, p.hp, p.dash_charges, main.wave, n, hs])
	if t >= float(OS.get_environment("TRACE_SECONDS") if OS.get_environment("TRACE_SECONDS") != "" else "60") or p.dead:
		print("END frame=%d dead=%s" % [frame, p.dead]); get_tree().quit()
