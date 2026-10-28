extends CanvasLayer
class_name Hud
## The in-game HUD: Theron's life, dash charges, the wave and big centred messages. It only shows what it is told
## (main.gd connects it to the game); the layout lives in scenes/ui/hud.tscn and can be edited there.

@onready var _hp_label: Label = %HpLabel
@onready var _hp_bar: ProgressBar = %HpBar
@onready var _dash_label: Label = %DashLabel
@onready var _wave_label: Label = %WaveLabel
@onready var _message: Label = %Message
var _msg_tween: Tween

func set_hp(hp: int, max_hp: int) -> void:
	_hp_bar.max_value = max_hp
	_hp_bar.value = hp
	_hp_label.text = "Theron  %d / %d" % [hp, max_hp]

func set_dash(charges: int, max_charges: int) -> void:
	_dash_label.text = "Impulso  " + "◆ ".repeat(charges) + "◇ ".repeat(max_charges - charges)

func set_wave(n: int) -> void:
	_wave_label.text = "Oleada %d" % n

## A big message at the top; hold <= 0 keeps it on screen.
func show_message(text: String, hold: float) -> void:
	_message.text = text
	if _msg_tween:
		_msg_tween.kill()
	_msg_tween = create_tween()
	_msg_tween.tween_property(_message, "modulate:a", 1.0, 0.15)
	if hold > 0.0:
		_msg_tween.tween_property(_message, "modulate:a", 0.0, 0.4).set_delay(hold)
