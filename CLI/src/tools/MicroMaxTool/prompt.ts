export const MICROMAX_TOOL_NAME = 'MicroMaxSerial'

export const DESCRIPTION = `Interact with MicroMax hardware nodes via the Apex Serial Protocol (ASP).
Use this tool to query telemetry (sensors, uptime) or perform actions (LEDs, relays, servos, buzzer).`

export const PROMPT = `This tool allows you to control and monitor physical hardware via the MicroMax firmware.

Supported Commands:
- query: "WHO_ARE_YOU", "GET_STATUS", "GET_TELEMETRY", "GET_CAPABILITIES"
- action:
  - SET_STATE: value = "IDLE" | "BUSY" | "ALERT" | "DISCONNECTED"
  - SET_ROLE: value = "reflex" | "sentry" | "action"
  - SET_RGB: target = "LED_01", value = [R, G, B], duration = ms (optional)
  - SET_RELAY: target = "RELAY_01" | "RELAY_02", value = 1 (on) | 0 (off)
  - SET_SERVO: target = "SERVO_01", value = 0-180
  - BUZZ: target = "BUZZER_01", frequency = Hz, duration = ms

Safety Rules:
- High-impact actions like toggling relays or moving servos will trigger a user confirmation prompt.
- Always check telemetry first if you need to know the current state of sensors.`
