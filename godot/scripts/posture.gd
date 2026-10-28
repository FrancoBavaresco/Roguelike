extends SkeletonModifier3D
class_name Posture
## Theron's resting posture, laid over whatever clip is playing (before the arm IK): the upper torso leans back a
## little, the neck juts forward while the head keeps level, the shoulders drop. `weight` fades it in and out
## (player.gd: full when standing still, none while moving, attacking or dashing). Angles in radians, in the model's
## frame: +X is the axis across the body, so a positive angle pitches a bone forward.

@export var lean := { "Spine": -0.04, "Chest": -0.05, "UpperChest": -0.045 }   # torso back
@export var neck_forward := 0.24                                                # neck out
@export var head_level := -0.13                                                 # head back toward level
@export var shoulder_drop := 0.09                                               # both shoulders down
var weight := 0.0

var _bones := {}

func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null or weight <= 0.001:
		return
	if _bones.is_empty():
		for n in ["Spine", "Chest", "UpperChest", "Neck", "Head", "LeftShoulder", "RightShoulder"]:
			_bones[n] = sk.find_bone(n)
	# parent first, so every child turns with what is above it
	for n in lean:
		_turn(sk, _bones[n], Vector3.RIGHT, lean[n] * weight)
	_turn(sk, _bones["Neck"], Vector3.RIGHT, neck_forward * weight)
	_turn(sk, _bones["Head"], Vector3.RIGHT, head_level * weight)
	# the right shoulder is on -X: turning about +Z lowers it with a positive angle, the left one with a negative
	_turn(sk, _bones["RightShoulder"], Vector3.BACK, shoulder_drop * weight)
	_turn(sk, _bones["LeftShoulder"], Vector3.BACK, -shoulder_drop * weight)

func _turn(sk: Skeleton3D, bone: int, axis: Vector3, angle: float) -> void:
	if bone < 0 or absf(angle) < 1e-5:
		return
	var g := sk.get_bone_global_pose(bone)
	g.basis = Basis(axis, angle) * g.basis
	sk.set_bone_global_pose(bone, g)
