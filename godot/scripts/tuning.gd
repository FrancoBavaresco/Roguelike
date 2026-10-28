extends RefCounted
class_name Tuning
## Numbers carried over from the web version (js/data.js), so the slice plays like the original.

# movement (H.MOVE)
const MOVE_SPEED := 7.2          # m/s
const ACCEL_TIME := 0.06         # s to full speed
const DECEL_TIME := 0.08         # s to stop
const DASH_DIST := 4.8           # m
const DASH_TIME := 0.14          # s
const DASH_CHARGES := 2
const DASH_RECHARGE := 0.675     # s per charge

# Theron
const PLAYER_HP := 100
const PLAYER_RADIUS := 0.45
const HURT_INVULN := 0.6         # s of invulnerability after a hit
const MODEL_HEIGHT := 1.92       # m (theron_B)

# the sword's ground combo (H.SPELLS.sword_slash, combo.hits)
const SWORD_DMG := 7
const SWORD_RANGE := 2.9
const COMBO_WINDOW := 0.6        # s to chain the next hit
const COMBO_RECOVER := 0.3       # s pause after the third hit
# shape, angle (deg) / len, width, range multiplier, damage multiplier, knockback, delay (when the blade lands),
# gap (cooldown to the next hit), step (forward push), anim: [clip start, clip end] of Attack_Combo, swing time (s)
const COMBO := [
	{ "shape": "sweep", "angle": 180.0, "range_mul": 1.0, "dmg_mul": 1.0, "knock": 6.0, "delay": 0.05, "gap": 0.14, "step": 0.0, "clip": [0.30, 0.68], "swing": 0.28 },
	{ "shape": "cone", "angle": 25.0, "range_mul": 0.75, "dmg_mul": 1.4, "knock": 3.0, "delay": 0.10, "gap": 0.16, "step": 0.0, "clip": [0.62, 0.98], "swing": 0.28 },
	{ "shape": "line", "len": 2.0, "width": 0.75, "dmg_mul": 1.8, "knock": 12.0, "delay": 0.20, "gap": 0.0, "step": 7.0, "clip": [0.92, 1.40], "swing": 0.42 },
]

# Husk (H.ENEMIES.husk): lunges after a short wind-up
const HUSK_HP := 44
const HUSK_SPEED := 3.6
const HUSK_RADIUS := 0.55
const HUSK_DMG := 11
const HUSK_REACH := 1.9          # starts its wind-up this close
const HUSK_WINDUP := 0.55
const HUSK_LUNGE_TIME := 0.22
const HUSK_LUNGE_SPEED := 10.0
const HUSK_RECOVER := 0.7

# camera (R.ISO): yaw 45°, pitch 40°, orthographic
const CAM_YAW := 45.0
const CAM_PITCH := 40.0
const CAM_SIZE := 11.0           # m of world in the screen's height (the web version shows 18.8)
const CAM_FOLLOW := 9.0          # follow sharpness
