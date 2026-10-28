extends CharacterBody3D
class_name Player
## Theron: moves (WASD, relative to the screen), aims at the mouse, dashes (Space) and swings the sword's three-hit
## ground combo (left click). The combo hits, timings and numbers are the web version's.

signal hp_changed(hp: int, max_hp: int)
signal died

const T := preload("res://scripts/tuning.gd")
const THERON := preload("res://assets/models/theron.glb")
const SWORD := preload("res://assets/models/longsword.glb")

var hp: int = T.PLAYER_HP
var dead := false
var aim := Vector3(0, 0, -1)          # where the mouse points (flat, unit)
var facing := Vector3(0, 0, -1)
var dash_charges: int = T.DASH_CHARGES
var _dash_recharge := 0.0
var _dash_t := 0.0
var _dash_dir := Vector3.ZERO
var _invuln := 0.0
var _knock := Vector3.ZERO            # pushes (the thrust's step, hits taken)
var _combo_n := 0                     # hits done in the current combo
var _combo_t := 0.0                   # time left to chain the next hit
var _attack_cd := 0.0
var _attack_t := -1.0                 # time since the current swing started (-1 = none)
var _attack_hit := {}                 # the current swing's data
var _attack_done := false
var _attack_dir := Vector3.FORWARD
var _hurt_t := 0.0

var model: Node3D
var anim: AnimationPlayer
var skeleton: Skeleton3D
var _anim_lock := 0.0                 # s the current one-shot clip (attack, hit) keeps the body
var _flash_mats: Array[StandardMaterial3D] = []
var world: Node                       # main.gd: enemies, fx, camera shake
var arm_ik: ArmIK
var _grip_rest := Transform3D()       # hand_R (the grip socket) in RightHand's frame
var _sword_pose := Transform3D()      # model space: the grip, +Y along the blade (smoothed between swings)
var _anim_t := 0.0
var posture: Posture
var _carry := 0.0                     # 0 = sword on the shoulder (standing), 1 = carried low at the side (moving)
var _sway := Vector2.ZERO             # the carried blade's lag (yaw out, pitch up), a damped spring
var _sway_v := Vector2.ZERO
var _prev_vel := Vector3.ZERO

func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	collision_layer = 2
	collision_mask = 1 | 4
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new(); cap.radius = T.PLAYER_RADIUS; cap.height = 1.8
	shape.shape = cap; shape.position.y = 0.9
	add_child(shape)
	_build_model()

func _build_model() -> void:
	model = THERON.instantiate()
	add_child(model)
	# the .glb faces +Z; the body's forward is -Z (Godot's convention), so the model turns half round
	model.rotation.y = PI
	anim = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	skeleton = model.find_child("Skeleton3D", true, false) as Skeleton3D
	for loop_name in ["Combat_Idle", "Idle", "Run"]:
		if anim.has_animation(loop_name):
			anim.get_animation(loop_name).loop_mode = Animation.LOOP_LINEAR
	anim.play("Idle")
	# the resting posture (torso, neck, shoulders) over the clip, then the right arm reaches for the sword's path (IK, after the clip), and the sword sits in the grip bone
	_grip_rest = skeleton.get_bone_rest(skeleton.find_bone("hand_R"))
	posture = Posture.new()
	skeleton.add_child(posture)           # modifiers run in child order: the posture first, the arm IK after it
	arm_ik = ArmIK.new()
	skeleton.add_child(arm_ik)
	_sword_pose = _path_pose(0.0)
	var grip := BoneAttachment3D.new()
	grip.bone_name = "hand_R"
	skeleton.add_child(grip)
	var sword := Node3D.new()
	grip.add_child(sword)
	var file := SWORD.instantiate() as Node3D
	# the file: blade along -X (tip at -1, grip at +0.56..+1), guard across Y. The holder's +Y runs from the grip to
	# the tip, the guard across X; stylised like the web version (0.68 scale, 2.1× wider, 2× thicker)
	var fit := Node3D.new()
	sword.add_child(fit)
	for mi in file.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var copy := MeshInstance3D.new()
		copy.mesh = m.mesh
		for s in m.mesh.get_surface_count():
			var mat := m.mesh.surface_get_material(s)
			if mat is StandardMaterial3D:
				var sm := (mat as StandardMaterial3D).duplicate() as StandardMaterial3D
				sm.metallic = 0.85; sm.roughness = 0.35
				copy.set_surface_override_material(s, sm)
		fit.add_child(copy)
	file.free()
	fit.rotation.z = -PI / 2
	fit.scale = Vector3(0.68, 0.68, 0.68)
	fit.position.y = 0.78 * 0.68 - 0.08
	sword.scale = Vector3(2.1, 1.0, 2.0)
	# hit flash: an emission on the body materials (not the sword's)
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.name.contains("Outline") or grip.is_ancestor_of(m):
			continue
		for s in m.mesh.get_surface_count():
			var mat := m.mesh.surface_get_material(s)
			if mat is StandardMaterial3D:
				var sm := (mat as StandardMaterial3D).duplicate() as StandardMaterial3D
				sm.emission_enabled = true; sm.emission = Color(1, 0.25, 0.25); sm.emission_energy_multiplier = 0.0
				m.set_surface_override_material(s, sm)
				_flash_mats.append(sm)

func _physics_process(dt: float) -> void:
	if dead:
		return
	_invuln = maxf(0.0, _invuln - dt)
	_attack_cd = maxf(0.0, _attack_cd - dt)
	_combo_t = maxf(0.0, _combo_t - dt)
	if _combo_t <= 0.0 and _attack_t < 0.0:
		_combo_n = 0
	if dash_charges < T.DASH_CHARGES:
		_dash_recharge += dt
		if _dash_recharge >= T.DASH_RECHARGE:
			_dash_recharge = 0.0; dash_charges += 1

	var input := _move_input()
	if Input.is_action_just_pressed("dash") and dash_charges > 0 and _dash_t <= 0.0:
		_start_dash(input if input.length() > 0.1 else facing)
	if Input.is_action_just_pressed("attack") and _attack_cd <= 0.0 and _dash_t <= 0.0:
		_start_attack()

	var vel := velocity
	if _dash_t > 0.0:
		_dash_t -= dt
		vel = _dash_dir * (T.DASH_DIST / T.DASH_TIME)
		if _dash_t <= 0.0:
			vel = _dash_dir * T.MOVE_SPEED * 0.5
	else:
		var slow := 0.25 if _attack_t >= 0.0 else 1.0     # swinging roots you (almost)
		var target := input * T.MOVE_SPEED * slow
		var rate := 1.0 / (T.ACCEL_TIME if target.length() > vel.length() else T.DECEL_TIME)
		vel = vel.move_toward(target, T.MOVE_SPEED * rate * dt)
	velocity = vel + _knock
	_knock = _knock.move_toward(Vector3.ZERO, maxf(_knock.length() * 7.0, 4.0) * dt)
	move_and_slide()
	velocity -= _knock
	position.y = 0.0

	# facing: the swing's direction while attacking, else where you move, else where you aim
	if _attack_t >= 0.0:
		facing = _attack_dir
	elif _dash_t > 0.0:
		facing = _dash_dir
	elif velocity.length() > 0.5:
		facing = velocity.normalized()
	rotation.y = lerp_angle(rotation.y, atan2(-facing.x, -facing.z), 1.0 - exp(-dt * 25.0))

	_update_attack(dt)
	_update_anim(dt)
	_update_sword(dt)

func _move_input() -> Vector3:
	var v := Vector2(Input.get_axis("move_left", "move_right"), Input.get_axis("move_up", "move_down"))
	if v.length() < 0.1:
		return Vector3.ZERO
	v = v.limit_length(1.0)
	# screen-relative: up on the screen is away from the camera, flat on the ground
	var cam := get_viewport().get_camera_3d()
	var right := cam.global_basis.x; right.y = 0; right = right.normalized()
	var fwd := -cam.global_basis.z; fwd.y = 0; fwd = fwd.normalized()
	return right * v.x - fwd * v.y

func _start_dash(dir: Vector3) -> void:
	dash_charges -= 1
	_dash_t = T.DASH_TIME
	_dash_dir = Vector3(dir.x, 0, dir.z).normalized()
	_invuln = maxf(_invuln, T.DASH_TIME + 0.05)
	_attack_t = -1.0          # a dash cancels the swing
	_anim_lock = 0.0
	anim.play("Dash", 0.05, 1.6)
	if world: world.dash_fx(global_position, _dash_dir)

func _start_attack() -> void:
	if _combo_t <= 0.0:
		_combo_n = 0
	var hd: Dictionary = T.COMBO[_combo_n]
	_combo_n += 1
	if _combo_n < T.COMBO.size():
		_attack_cd = hd["gap"]; _combo_t = T.COMBO_WINDOW
	else:
		_attack_cd = T.COMBO_RECOVER + hd["delay"]; _combo_t = 0.0; _combo_n = 0
	_attack_hit = hd
	_attack_t = 0.0
	_attack_done = false
	_attack_dir = aim
	facing = aim
	rotation.y = atan2(-aim.x, -aim.z)
	var clip: Array = hd["clip"]
	var length: float = clip[1] - clip[0]
	anim.play("Attack_Combo", 0.04, length / float(hd["swing"]))
	anim.seek(clip[0], true)
	_anim_lock = float(hd["swing"])

func _update_attack(dt: float) -> void:
	if _attack_t < 0.0:
		return
	_attack_t += dt
	var hd := _attack_hit
	if not _attack_done and _attack_t >= float(hd["delay"]):
		_attack_done = true
		if world: world.sword_hit(self, hd, _attack_dir)
		if float(hd["step"]) > 0.0:
			get_tree().create_timer(0.06).timeout.connect(func(): _knock += _attack_dir * float(hd["step"]))
	if _attack_t >= float(hd["swing"]):
		_attack_t = -1.0

func _update_anim(dt: float) -> void:
	_hurt_t = maxf(0.0, _hurt_t - dt)
	var flash := clampf(_hurt_t / 0.15, 0.0, 1.0)
	for m in _flash_mats:
		m.emission_energy_multiplier = flash * 1.5
	# a one-shot clip (a combo hit: its slice of Attack_Combo; a hit taken) plays out, then idle / run take over
	if _anim_lock > 0.0:
		_anim_lock -= dt
		return
	if _dash_t > 0.0:
		return
	var speed := Vector2(velocity.x, velocity.z).length()
	if speed > 0.8:
		if anim.current_animation != "Run":
			anim.play("Run", 0.12)
		anim.speed_scale = clampf(speed / 6.0, 0.6, 1.4)
	else:
		anim.speed_scale = 1.0
		if anim.current_animation != "Idle":
			anim.play("Idle", 0.25)

# ---------------------------------------------------------------- the sword's paths
# Model space: the .glb faces +Z, so forward = +Z, up = +Y, Theron's right = -X. Every pose is the grip's place and
# the blade's direction (+Y of the grip) with the flat facing N. The arm (IK) reaches for it; arms are short
# (0.53 m), so the paths stay within reach of the shoulder (about right 0.2, up 1.45).
static func _v(right: float, up: float, fwd: float) -> Vector3:
	return Vector3(-right, up, fwd)

static func _frame(pos: Vector3, blade: Vector3, flat: Vector3) -> Transform3D:
	var y := blade.normalized()
	var z := (flat - y * flat.dot(y)).normalized()
	var x := y.cross(z).normalized()
	return Transform3D(Basis(x, y, z), pos)

static func _ease(x: float) -> float:
	x = clampf(x, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)

## The grip's pose for the current action at time t (s into it).
func _path_pose(t: float) -> Transform3D:
	if _attack_t >= 0.0:
		var shape: String = _attack_hit["shape"]
		var t_hit: float = _attack_hit["delay"]
		if shape == "sweep":
			# wide horizontal cut, right to left, blade flat; the blade is in front when it lands
			var k := _ease(_attack_t / (t_hit * 2.6))
			var a := deg_to_rad(lerpf(105.0, -95.0, k))
			var d := _v(sin(a), -0.08, cos(a))
			return _frame(_v(0.12, 1.22, 0.12) + Vector3(d.x, 0, d.z) * 0.36, d, Vector3.UP)
		elif shape == "cone":
			# overhead chop: up and back, then down in front; blade on edge
			var k := _ease((_attack_t - 0.03) / (t_hit * 1.3))
			var th := deg_to_rad(lerpf(-25.0, 118.0, k))
			var d := _v(0.06, cos(th), sin(th))
			return _frame(_v(0.14, 1.32, 0.08) + d * 0.32, d, _v(1, 0, 0))
		else:
			# thrust: drawn back, then straight out ahead, blade flat
			var wind := _ease(_attack_t / (t_hit * 0.55))
			var go := _ease((_attack_t - t_hit * 0.55) / (t_hit * 0.5))
			var hand := _v(0.32, 1.12, 0.05).lerp(_v(0.28, 1.15, -0.12), wind).lerp(_v(0.1, 1.2, 0.45), go)
			return _frame(hand, _v(-0.04, -0.05, 1.0), Vector3.UP)
	if _dash_t > 0.0:
		return _frame(_v(0.3, 1.0, -0.1), _v(0.1, -0.35, -1.0), Vector3.UP)      # trailing behind
	return _rest_pose().interpolate_with(_carry_pose(), _ease(_carry))

## Standing: the blade lies on top of the right shoulder (about right 0.22, up 1.56, just behind the joint at
## right 0.26 / up 1.47 in the Idle clip), slanting up and back about 27°; the hand holds the grip a hand's length
## in front of the shoulder, elbow loose. It rises and falls a touch with the breath.
const REST_ON := Vector3(-0.22, 1.56, -0.04)       # the point of the shoulder the blade rests on (model space)
const REST_DIR := Vector3(-0.24, 0.42, -0.87)      # the blade: up, back and out over the shoulder (a diagonal from the front too)
const REST_GRIP := 0.32                            # m from the grip to where the blade meets the shoulder
func _rest_pose() -> Transform3D:
	var breath := sin(_anim_t * 1.7) * 0.008
	var d := REST_DIR.normalized()
	return _frame(REST_ON - d * REST_GRIP + Vector3(0, breath, 0), d, _v(-0.2, 1.0, 0.0))

## Moving: the sword hangs at the right side, a little behind the hip, the point back and slightly out, never down
## to the floor. The hand swings with the stride and the blade lags behind the body's turns and pushes (_sway).
func _carry_pose() -> Transform3D:
	var speed := Vector2(velocity.x, velocity.z).length()
	var amp := clampf(speed / T.MOVE_SPEED, 0.0, 1.0)
	var ph := _stride_phase()
	var hand := _v(0.27, 0.9 + absf(cos(ph)) * 0.015 * amp, -0.06 + sin(ph) * 0.07 * amp)
	var pitch := _sway.y + sin(ph * 2.0) * 0.035 * amp
	var d := _v(0.24 + _sway.x, -0.24 + pitch, -0.92).normalized()
	return _frame(hand, d, _v(1, 0, 0))

## Where the stride is (radians): from the run clip when it plays, so the arm swings with the steps.
func _stride_phase() -> float:
	if anim.current_animation == "Run":
		var a := anim.get_animation("Run")
		return anim.current_animation_position / maxf(a.length, 0.01) * TAU
	return _anim_t * 9.0

func _update_sword(dt: float) -> void:
	_anim_t += dt
	# standing ↔ moving: lower the sword quickly when he sets off, lift it back to the shoulder a little slower
	var speed := Vector2(velocity.x, velocity.z).length()
	var moving := 1.0 if speed > 0.8 else 0.0
	_carry = move_toward(_carry, moving, dt / (0.18 if moving > _carry else 0.3))
	# the carried blade lags: a damped spring pushed by the body's acceleration (in the body's own frame)
	var acc := (velocity - _prev_vel) / maxf(dt, 1e-4)
	_prev_vel = velocity
	var local := global_basis.inverse() * acc               # body frame: forward is -Z, right is +X
	var push := Vector2(clampf(local.x * 0.006, -0.25, 0.25), clampf(-local.z * 0.008, -0.3, 0.3))
	_sway_v += ((push - _sway) * 90.0 - _sway_v * 12.0) * dt
	_sway += _sway_v * dt
	# the resting posture only while standing (it gives way to running, swings and dashes)
	var rest := (1.0 - _ease(_carry)) * (0.0 if (_attack_t >= 0.0 or _dash_t > 0.0) else 1.0)
	posture.weight = lerpf(posture.weight, rest, 1.0 - exp(-dt * 10.0))
	var want := _path_pose(_anim_t)
	if _attack_t >= 0.0 or _dash_t > 0.0:
		_sword_pose = _sword_pose.interpolate_with(want, 1.0 - exp(-dt * 45.0))
	else:
		_sword_pose = _sword_pose.interpolate_with(want, 1.0 - exp(-dt * 14.0))
	# the arm: the grip socket (hand_R) onto the pose, so RightHand goes where the grip's parent must be
	arm_ik.target = _sword_pose * _grip_rest.affine_inverse()
	arm_ik.pole = _v(0.7, -0.6, -0.3)

func take_hit(dmg: int, from: Vector3) -> void:
	if dead or _invuln > 0.0:
		return
	hp = maxi(0, hp - dmg)
	_invuln = T.HURT_INVULN
	_hurt_t = 0.15
	var away := global_position - from; away.y = 0
	_knock += away.normalized() * 6.0
	hp_changed.emit(hp, T.PLAYER_HP)
	if world: world.shake(0.25)
	if hp <= 0:
		dead = true
		anim.play("Hit", 0.05, 0.6)
		died.emit()
	elif _attack_t < 0.0:
		anim.play("Hit", 0.05, 1.4)
		_anim_lock = 0.3

func is_dashing() -> bool:
	return _dash_t > 0.0
