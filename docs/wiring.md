# Hardware wiring — ESP8266 NodeMCU Flood Monitor

## Bill of materials  (Table II in the paper)

| Component | Qty | Notes |
|---|---|---|
| ESP8266 NodeMCU v1.0 | 1 | Main Wi-Fi-enabled microcontroller |
| HC-SR04 / JSN-SR04T | 1 | Ultrasonic sensor. **JSN-SR04T recommended** for outdoor drainage-channel deployment — its probe is potted for waterproofing. |
| Water level / rain sensor | 1 | Analog resistive contact sensor |
| Active buzzer | 1 | 5 V local sound alarm |
| 1 kΩ and 2 kΩ resistors | 1 pair | Voltage divider on the HC-SR04 Echo line (5 V → 3.3 V logic) |
| Breadboard and jumpers | — | Standard prototyping wiring |
| 5 V / 2 A micro-USB power supply | 1 | Stable power source |

---

## Pin connection table  (Table III in the paper)

| ESP8266 pin | Module | Module pin | Voltage / notes |
|---|---|---|---|
| VIN (5 V) | HC-SR04 / water sensor | VCC | 5 V supply |
| GND | All modules | GND | Common ground |
| D5 (GPIO14) | HC-SR04 ultrasonic | Trig | 3.3 V digital output |
| D6 (GPIO12) | HC-SR04 ultrasonic | Echo | **3.3 V digital input — via resistor divider** |
| A0 (ADC0) | Analog water sensor | Signal / Out | 0–1.0 V analog input |
| D1 (GPIO5) | Active buzzer | VCC (+) | Digital output alarm |

---

## Voltage-level protection — HC-SR04 Echo line

The ESP8266 GPIO pins are rated for **3.3 V logic**, but the HC-SR04 Echo line
outputs a **5 V pulse**. Connecting it directly risks permanent damage to the
microcontroller.

**Fix: resistive voltage divider on the Echo line.**

```
HC-SR04 Echo ───[1 kΩ]───┬─── D6 (GPIO12)  ← 3.3 V safe level
                         │
                         └───[2 kΩ]───┐
                                       │
                                      GND
```

V_out = V_in × R2 / (R1 + R2) = 5 V × 2 kΩ / (1 kΩ + 2 kΩ) ≈ 3.33 V
→ within the ESP8266's input tolerance.

- R1 (series to Echo) = 1 kΩ
- R2 (shunt to GND)   = 2 kΩ

---

## Sensor mounting

- Mount the ultrasonic sensor above the drainage channel / water column so
  `SENSOR_HEIGHT` (the vertical distance from sensor face to channel bed) is
  **13.0 cm** in the prototype — measure once at installation and update
  the `SENSOR_HEIGHT` constant in `flood_monitor.ino` if your setup differs.
- The contact sensor probe goes in the water where the ultrasonic beam
  measures — it provides the cross-validation reading.

---

## Power

The prototype is powered from a stable **5 V / 2 A micro-USB supply**. For
remote deployment without mains (future work), a solar-charged Li-ion stage
is the planned approach.
