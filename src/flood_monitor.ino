/**
 * IoT Flood Early-Warning System — ESP8266 NodeMCU Firmware
 * ============================================================
 * Dual-validation flood monitoring using:
 *   - Non-contact ultrasonic ranging (HC-SR04 / JSN-SR04T)
 *   - Contact-based analog water-level sensor (resistive probe)
 *
 * Outputs:
 *   - Local HTTP dashboard (auto-refreshing, every 2 s)
 *   - Telegram Bot notification on critical threshold (hysteresis)
 *   - Local buzzer/LED alarm (independent of network)
 *
 * Target: Arduino IDE v1.8.19+ / v2.x with ESP8266 board package
 * Libraries required (Arduino Library Manager):
 *   - UniversalTelegramBot  by Brian Lough
 *   - ArduinoJson            by Benoit Blanchon  (v6.x)
 *
 * References: see docs/ and the accompanying IEEE paper.
 */

// ============================================================================
//  Includes
// ============================================================================
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiClientSecure.h>
#include <UniversalTelegramBot.h>

// ============================================================================
//  Wi-Fi / Telegram credentials  (EDIT THESE BEFORE UPLOADING)
// ============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BOT_TOKEN     = "YOUR_TELEGRAM_BOT_TOKEN";   // from @BotFather
const char* CHAT_ID       = "YOUR_TELEGRAM_CHAT_ID";      // from @userinfobot

// ============================================================================
//  Pin assignments  (see docs/wiring.md, Table III in the paper)
// ============================================================================
#define TRIG_PIN    D5   // GPIO14 — HC-SR04 / JSN-SR04T Trigger
#define ECHO_PIN    D6   // GPIO12 — HC-SR04 / JSN-SR04T Echo  (via resistor divider)
#define ANALOG_PIN  A0   // ADC0   — analog contact water sensor (0–1.0 V range)
#define BUZZER_PIN  D1   // GPIO5  — active buzzer (+)

// ============================================================================
//  Calibration constants  (Section VI of the paper)
// ============================================================================
const float SOUND_SPEED    = 0.0343;   // cm/µs  (≈ 343 m/s at 20 °C)
const float SENSOR_HEIGHT  = 13.0;     // cm — vertical distance sensor-face → channel bed
                                       //      (measure once at installation)

const int   ALERT_HIGH_PCT = 85;       // % — rising-edge Telegram alert threshold
const int   ALERT_LOW_PCT  = 80;       // % — falling-edge reset threshold (5-pt hysteresis)
const int   WET_RAW_TH     = 500;      // calibrated raw ADC threshold for MOIST/SUBMERGED

// ============================================================================
//  Global objects & runtime state
// ============================================================================
ESP8266WebServer server(80);
WiFiClientSecure secureClient;
UniversalTelegramBot bot(BOT_TOKEN, secureClient);

float distanceCm    = -1.0;   // cm — latest ultrasonic distance (or -1.0 on fault)
float waterHeight   = 0.0;    // cm — computed water height above channel bed
int   waterPercent  = 0;      // %   — computed fill percentage
int   rawAnalog     = 0;      // raw ADC reading from contact sensor
bool  alertSent     = false;  // hysteresis state: true while alert is active
unsigned long lastPollMs = 0;
const unsigned long POLL_INTERVAL_MS = 2000;  // poll sensors every 2 s

// ============================================================================
//  Non-contact ultrasonic ranging  (HC-SR04 / JSN-SR04T)
// ============================================================================
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // 30,000 µs timeout bounds the wait and prevents main-loop stall on
  // disconnected sensor or pulse absorbed by debris; returns -1.0 on fault.
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;

  return (duration * SOUND_SPEED) / 2.0;   // round-trip → one-way distance
}

// ============================================================================
//  Height / percentage conversion  (Section VI-B)
// ============================================================================
void updateHeightAndPercent(float dist) {
  float height = SENSOR_HEIGHT - dist;
  if (height < 0)           height = 0;
  if (height > SENSOR_HEIGHT) height = SENSOR_HEIGHT;

  waterHeight = height;

  float pct = (height / SENSOR_HEIGHT) * 100.0;
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  waterPercent = (int)pct;
}

// ============================================================================
//  Contact-sensor qualitative status
// ============================================================================
String contactStatus(int raw) {
  if (raw > WET_RAW_TH)          return "SUBMERGED";
  if (raw > WET_RAW_TH / 3)      return "MOIST";
  return "DRY";
}

// ============================================================================
//  Hysteresis-based Telegram alert  (Listing 1 / Section V)
// ============================================================================
void checkAndSendTelegramAlert(int percentage, float height) {
  if (percentage >= ALERT_HIGH_PCT && !alertSent) {
    String msg = "FLOOD WARNING ALERT!\n";
    msg += "Water Level: " + String(percentage) + "%\n";
    msg += "Water Height: " + String(height, 1) + " cm\n";
    msg += "Status: CRITICAL - Exceeded " + String(ALERT_HIGH_PCT) + "% threshold!";
    if (bot.sendMessage(CHAT_ID, msg, "HTML")) {
      alertSent = true;
    }
  } else if (percentage < ALERT_LOW_PCT && alertSent) {
    bot.sendMessage(CHAT_ID, "NOTICE: Water level returned to safe limits.", "HTML");
    alertSent = false;
  }
}

// ============================================================================
//  Local buzzer / LED alarm  (Section V)
// ============================================================================
void updateLocalAlarm(int percentage, int raw) {
  bool ultrasonicTrip = (percentage >= ALERT_HIGH_PCT);
  bool contactTrip    = (raw > WET_RAW_TH);
  digitalWrite(BUZZER_PIN,
               (ultrasonicTrip || contactTrip) ? HIGH : LOW);
}

// ============================================================================
//  Auto-refreshing local web dashboard  (Section VII)
// ============================================================================
void handleRoot() {
  String status = contactStatus(rawAnalog);
  String html = "<html><head>";
  html += "<meta http-equiv='refresh' content='2'>";
  html += "<title>Flood Monitor</title></head><body>";
  html += "<h2>IoT Flood Early-Warning Dashboard</h2>";
  html += "<p>Raw distance: " + String(distanceCm, 1) + " cm</p>";
  html += "<p>Water height: " + String(waterHeight, 1) + " cm</p>";
  html += "<p>Water level: " + String(waterPercent) + " %</p>";
  html += "<p>Raw contact reading: " + String(rawAnalog) + "</p>";
  html += "<p>Contact status: " + status + "</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

// ============================================================================
//  Setup
// ============================================================================
void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN,     OUTPUT);
  pinMode(ECHO_PIN,     INPUT);
  pinMode(BUZZER_PIN,   OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected: " + WiFi.localIP().toString());

  // NOTE: setInsecure() skips certificate verification — suitable for a
  // prototype / demo. For production, install the Telegram CA bundle and
  // use setCACert() instead.
  secureClient.setInsecure();

  server.on("/", handleRoot);
  server.begin();
  Serial.println("HTTP dashboard ready at http://" + WiFi.localIP().toString());
}

// ============================================================================
//  Main loop
// ============================================================================
void loop() {
  server.handleClient();

  unsigned long now = millis();
  if (now - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = now;

    distanceCm = readDistanceCm();
    rawAnalog  = analogRead(ANALOG_PIN);

    if (distanceCm >= 0) {
      updateHeightAndPercent(distanceCm);
    }

    updateLocalAlarm(waterPercent, rawAnalog);

    if (distanceCm >= 0) {
      checkAndSendTelegramAlert(waterPercent, waterHeight);
    }
  }
}
