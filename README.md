# IoT Flood Early-Warning System — ESP8266 NodeMCU

Dual-validation flood monitoring & early-warning firmware for the ESP8266 (NodeMCU) platform.

- Non-contact ultrasonic ranging (HC-SR04 / JSN-SR04T) — primary sensor
- Contact-based analog water-level sensor — cross-validation
- 5-percentage-point hysteresis on Telegram alerts (85% trigger / 80% reset)
- Local HTTP dashboard (auto-refresh, 2 s) — no cloud required
- Local buzzer/LED alarm — works even if the network is down
- Telegram Bot notifications — free, unlimited subscribers via channel

Full design, wiring, pin mapping, mathematical model, and comparative
evaluation are in the accompanying IEEE-style paper
(`IoT_Flood_Monitoring_IEEE_Paper_23refs (1).docx` in the attachments).

---

## Quick start

### 1. Hardware

See `docs/wiring.md` for the complete bill of materials and pin table.

### 2. Software

1. Install **Arduino IDE** v1.8.19+ or v2.x.
2. Add the **ESP8266 board package** via Boards Manager
   (URL: `https://arduino.esp8266.com/stable/package_esp8266com_index.json`).
3. Install two libraries via **Sketch → Include Library → Manage Libraries**:
   - `UniversalTelegramBot` by Brian Lough
   - `ArduinoJson` by Benoit Blanchon (v6.x)
4. Open `src/flood_monitor.ino`, fill in `WIFI_SSID`, `WIFI_PASSWORD`,
   `BOT_TOKEN` (from @BotFather) and `CHAT_ID` (from @userinfobot).
5. Select **NodeMCU 1.0 (ESP-12E Module)** → upload.

### 3. Use

- Open the Serial Monitor at **115200 baud** — the ESP prints its IP when
  Wi-Fi connects.
- Open `http://<ESP-IP>` in any browser on the same Wi-Fi — the dashboard
  auto-refreshes every 2 seconds.
- When water level reaches 85%, a Telegram alert fires. It stays armed until
  the level drops back below 80%.

### 4. Troubleshooting

See Table IV in the paper / the `TROUBLESHOOTING.md` cheat sheet.

| Symptom | Likely cause | Fix |
|---|---|---|
| Garbage in Serial Monitor | Baud mismatch | Set to 115200 |
| `UniversalTelegramBot.h: No such file` | Missing library | Install via Library Manager |
| Ultrasonic reads 0 or times out | Bad wiring / 5 V issue | Check Echo divider + 5 V VCC |
| Telegram messages fail | Bad token/chat ID or no net | Verify with @BotFather / @userinfobot; check Wi-Fi |
| Garbage on Serial at 115200 | Baud mismatch | Match Serial Monitor baud to `Serial.begin(115200)` |

---

## Repository layout

```
.
├── README.md              ← you are here
├── src/
│   └── flood_monitor.ino ← firmware (Arduino IDE / ESP8266 core)
└── docs/
    └── wiring.md          ← BOM, pin table, voltage-divider schematic note
```

---

## Architecture notes

- **Dual validation:** the local buzzer arms on *either* sensor independently;
  the remote Telegram alert arms only on the ultrasonic reading. A spurious
  analog reading (e.g. condensation) sounds the buzzer for inspection but does
  not generate a remote notification.
- **Hysteresis:** a 5-percentage-point dead band (85% / 80%) prevents
  notification flooding when the water level oscillates near the threshold
  (e.g. wave action in an open channel).
- **Fault handling:** the 30,000 µs `pulseIn()` timeout returns a
  distinguishable −1.0 cm value on a disconnected or fouled sensor, so the
  main loop never stalls; the contact sensor continues to report DRY/MOIST/
  SUBMERGED during ultrasonic dropouts.
- **Security note:** the sketch calls `setInsecure()` for the Telegram HTTPS
  connection — fine for a prototype. For deployment, install the Telegram CA
  bundle and switch to `setCACert()`.

---

## Future work

1. **LoRa radio** — extend coverage beyond Wi-Fi range; survives loss of
   internet backhaul (see [21] in the paper).
2. **Solar-charged Li-ion power stage** — remove mains dependency for remote
   drainage-channel deployment.
