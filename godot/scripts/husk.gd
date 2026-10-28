extends CharacterBody3D
class_name Husk
## Husk: walks at Theron, stops close, winds up (it rears back and its eyes flare, a red mark shows where it will
## land), lunges, then recovers. Built from primitives until it gets its own model.

signal killed(husk: Husk)

const T := preload("res://scripts/tuning.gd")

enum State { CHASE, WINDUP, LUNGE, RECOVER, STAGGER, DEAD }
var state := State.CHASE
var hp: int = T.HUSK_HP
var target: Player
var world: Node
var _t := 0.0
var _lunge_dir := Vector3.FORWARD
var _lunge_hit := false
var _knock := Vector3.ZERO
var _flash := 0.0
var _phase := randf() * TAU

var body: Node3D
var _mats: Array[StandardMaterial3D] = []
var _eye_mat: StandardMaterial3D
var _mark: MeshInstance3D
var _mark_mat: StandardMaterial3D

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new(); cap.radius = T.HUSK_RADIUS; cap.height = 1.7
	shape.shape = cap; shape.position.y = 0.85
	add_child(shape)
	_build()

func _mat(c: Color, rough := 0.85) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c; m.roughness = rough
	m.emission_enabled = true; m.emission = Color(1, 1, 1); m.emission_energy_multiplier = 0.0
	_mats.append(m)
	return m

func _part(mesh: Mesh, mat: Material, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new(); mi.mesh = mesh; mi.material_override = mat; mi.position = pos; mi.rotation = rot
	body.add_child(mi)
	return mi

func _build() -> void:
	body = Node3D.new(); add_child(body)
	var skin := _mat(Color("8a7a92"))
	var rag := _mat(Color("3b3440"))
	var bone := _mat(Color("c9bfae"))
	var torso := CapsuleMesh.new(); torso.radius = 0.33; torso.height = 1.0
	_part(torso, skin, Vector3(0, 1.05, 0), Vector3(0.25, 0, 0))
	var hips := CylinderMesh.new(); hips.top_radius = 0.3; hips.bottom_radius = 0.36; hips.height = 0.35
	_part(hips, rag, Vector3(0, 0.62, 0.02))
	var head := SphereMesh.new(); head.radius = 0.22; head.height = 0.42
	_part(head, bone, Vector3(0, 1.62, -0.12))
	for side in [-1, 1]:
		var arm := CapsuleMesh.new(); arm.radius = 0.09; arm.height = 0.85
		_part(arm, skin, Vector3(0.38 * side, 1.05, -0.18), Vector3(0.9, 0, 0.15 * side))
		var leg := CapsuleMesh.new(); leg.radius = 0.11; leg.height = 0.7
		_part(leg, rag, Vector3(0.16 * side, 0.32, 0))
		var claw := PrismMesh.new(); claw.size = Vector3(0.12, 0.22, 0.06)
		_part(claw, bone, Vector3(0.4 * side, 0.82, -0.55), Vector3(-1.4, 0, 0))
	_eye_mat = StandardMaterial3D.new()
	_eye_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_eye_mat.albedo_color = Color(1.0, 0.25, 0.2)
	for side in [-1, 1]:
		var eye := SphereMesh.new(); eye.radius = 0.045; eye.height = 0.09
		_part(eye, _eye_mat, Vector3(0.08 * side, 1.65, -0.32))
	# the lunge's mark on the floor (shown during the wind-up)
	_mark = MeshInstance3D.new()
	var q := PlaneMesh.new(); q.size = Vector2(1.1, 3.0)
	_mark.mesh = q
	_mark_mat = StandardMaterial3D.new()
	_mark_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mark_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mark_mat.albedo_color = Color(1, 0.15, 0.1, 0.0)
	_mark.material_override = _mark_mat
	_mark.position = Vector3(0, 0.03, -1.5)
	_mark.visible = false
	add_child(_mark)

func _physics_process(dt: float) -> void:
	_t += dt
	_flash = maxf(0.0, _flash - dt * 6.0)
	for m in _mats:
		m.emission_energy_multiplier = _flash * 2.0
	if state == State.DEAD:
		_die_anim(dt)
		return
	var vel := Vector3.ZERO
	var to := Vector3.ZERO
	if is_instance_valid(target) and not target.dead:
		to = target.global_position - global_position; to.y = 0
	match state:
		State.CHASE:
			if to.length() < T.HUSK_REACH and to.length() > 0.01:
				_go(State.WINDUP)
			elif to.length() > 0.01:
				vel = to.normalized() * T.HUSK_SPEED
				_face(to, dt, 10.0)
		State.WINDUP:
			_face(to, dt, 6.0)
			var k := clampf(_t / T.HUSK_WINDUP, 0.0, 1.0)
			body.rotation.x = 0.35 * k                     # rears back
			_eye_mat.albedo_color = Color(1.0, 0.25 + 0.6 * k, 0.2 + 0.5 * k)
			_mark.visible = true; _mark_mat.albedo_color.a = 0.15 + 0.35 * k
			if _t >= T.HUSK_WINDUP:
				_lunge_dir = -global_basis.z; _lunge_dir.y = 0; _lunge_dir = _lunge_dir.normalized()
				_lunge_hit = false
				_go(State.LUNGE)
		State.LUNGE:
			body.rotation.x = -0.45
			_mark.visible = false
			vel = _lunge_dir * T.HUSK_LUNGE_SPEED
			if not _lunge_hit and is_instance_valid(target) and to.length() < T.HUSK_RADIUS + T.PLAYER_RADIUS + 0.35:
				_lunge_hit = true
				target.take_hit(T.HUSK_DMG, global_position)
			if _t >= T.HUSK_LUNGE_TIME:
				_go(State.RECOVER)
		State.RECOVER:
			body.rotation.x = lerpf(body.rotation.x, 0.0, 1.0 - exp(-dt * 8.0))
			_eye_mat.albedo_color = Color(1.0, 0.25, 0.2)
			if _t >= T.HUSK_RECOVER:
				_go(State.CHASE)
		State.STAGGER:
			body.rotation.x = lerpf(body.rotation.x, 0.0, 1.0 - exp(-dt * 8.0))
			if _t >= 0.22:
				_go(State.CHASE)
	# a little sway while it walks
	if state == State.CHASE:
		body.rotation.z = sin(_t * 9.0 + _phase) * 0.08
		body.position.y = absf(sin(_t * 9.0 + _phase)) * 0.05
	velocity = vel + _knock
	_knock = _knock.move_toward(Vector3.ZERO, maxf(_knock.length() * 6.0, 3.0) * dt)
	move_and_slide()
	position.y = 0.0

func _face(dir: Vector3, dt: float, rate: float) -> void:
	if dir.length() < 0.01:
		return
	rotation.y = lerp_angle(rotation.y, atan2(-dir.x, -dir.z), 1.0 - exp(-dt * rate))

func _go(s: State) -> void:
	state = s; _t = 0.0
	if s != State.WINDUP:
		_mark.visible = false

## A sword hit: damage, a white flash, a shove. A heavy hit interrupts the wind-up.
func take_hit(dmg: int, push: Vector3, interrupt: bool) -> void:
	if state == State.DEAD:
		return
	hp -= dmg
	_flash = 1.0
	_knock += push
	if world: world.damage_number(global_position + Vector3(0, 2.1, 0), dmg)
	if hp <= 0:
		_go(State.DEAD)
		collision_layer = 0; collision_mask = 1
		killed.emit(self)
	elif interrupt or state == State.CHASE or state == State.RECOVER:
		_go(State.STAGGER)
		body.rotation.x = 0.3

func _die_anim(dt: float) -> void:
	velocity = _knock; _knock = _knock.move_toward(Vector3.ZERO, 12.0 * dt); move_and_slide()
	body.rotation.x = lerpf(body.rotation.x, 1.45, 1.0 - exp(-dt * 6.0))
	body.position.y = lerpf(body.position.y, -0.3, 1.0 - exp(-dt * 3.0))
	if _t > 0.6:
		scale = Vector3.ONE * maxf(0.01, 1.0 - (_t - 0.6) * 2.5)
	if _t > 1.0:
		queue_free()
