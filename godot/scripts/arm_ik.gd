extends SkeletonModifier3D
class_name ArmIK
## Two-bone IK for one arm: after the clip has posed the skeleton, the upper and lower arm turn so the hand reaches
## `target` (skeleton space), the elbow bending toward `pole`; the hand then takes the target's orientation, so the
## grip sits in the fist. This is how the web version works too: the sword follows the game's own swing paths and the
## arm reaches for it, so the clips only move the body, legs and the free arm.

@export var upper_name := "RightUpperArm"
@export var lower_name := "RightLowerArm"
@export var hand_name := "RightHand"
var target := Transform3D()           # skeleton space: the hand's wanted position and orientation
var pole := Vector3(0.6, -0.4, 0.4)   # skeleton space: where the elbow points
var weight := 1.0
var hand_offset := Basis()            # hand bone basis = target basis * hand_offset (the fist's turn to the grip)

var _u := -1
var _l := -1
var _h := -1

func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null or weight <= 0.0:
		return
	if _u < 0:
		_u = sk.find_bone(upper_name); _l = sk.find_bone(lower_name); _h = sk.find_bone(hand_name)
		if _u < 0 or _l < 0 or _h < 0:
			weight = 0.0
			return
	var gu := sk.get_bone_global_pose(_u)
	var gl := sk.get_bone_global_pose(_l)
	var gh := sk.get_bone_global_pose(_h)
	var s := gu.origin
	var l1 := s.distance_to(gl.origin)
	var l2 := gl.origin.distance_to(gh.origin)
	var t := gh.origin.lerp(target.origin, weight)
	var to := t - s
	var d := clampf(to.length(), absf(l1 - l2) + 0.001, l1 + l2 - 0.001)
	var dir := to.normalized()
	var a := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var h := sqrt(maxf(0.0, l1 * l1 - a * a))
	var p := pole - dir * pole.dot(dir)
	if p.length() < 1e-4:
		p = Vector3.DOWN - dir * Vector3.DOWN.dot(dir)
	p = p.normalized()
	var elbow := s + dir * a + p * h
	var hand := s + dir * d
	# upper arm: from its current direction to the elbow
	var cur_u := (gl.origin - s).normalized()
	var q1 := Quaternion(cur_u, (elbow - s).normalized())
	gu.basis = Basis(q1) * gu.basis
	sk.set_bone_global_pose(_u, gu)
	# lower arm: its new place, then from its direction to the hand
	gl = sk.get_bone_global_pose(_l)
	var gh2 := sk.get_bone_global_pose(_h)
	var cur_l := (gh2.origin - gl.origin).normalized()
	var q2 := Quaternion(cur_l, (hand - gl.origin).normalized())
	gl.basis = Basis(q2) * gl.basis
	sk.set_bone_global_pose(_l, gl)
	# the hand turns to hold the grip
	gh2 = sk.get_bone_global_pose(_h)
	var want := (target.basis * hand_offset).orthonormalized()
	gh2.basis = gh2.basis.orthonormalized().slerp(want, weight)
	sk.set_bone_global_pose(_h, gh2)
