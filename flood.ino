// =====================================================
// ARDUINO UNO - HC-SR04 HARDWARE TEST
// =====================================================

#define TRIG_PIN 9
#define ECHO_PIN 8

#define SOUND_SPEED 0.0343
const float SENSOR_HEIGHT = 13.0; // Distance to tank bottom in cm

void setup() {
  Serial.begin(9600); // Standard Baud Rate for Arduino Uno
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println(F("================================="));
  Serial.println(F(" ARDUINO UNO HC-SR04 HARDWARE TEST"));
  Serial.println(F("================================="));
  delay(1000);
}

void loop() {
  // Clear trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Send 10 microsecond pulse to trigger
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read echo duration (timeout set to 30ms)
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  // Check for hardware timeout
  if (duration == 0) {
    Serial.println(F("ERROR: HC-SR04 Timeout - Check wiring or 5V power supply."));
  } else {
    // Calculate distance and height
    float distanceCm = (duration * SOUND_SPEED) / 2.0;
    float waterHeight = SENSOR_HEIGHT - distanceCm;
    
    // Constrain water height between 0 and SENSOR_HEIGHT
    waterHeight = constrain(waterHeight, 0.0, SENSOR_HEIGHT);
    
    // Calculate percentage
    int percentage = (int)((waterHeight / SENSOR_HEIGHT) * 100.0);
    percentage = constrain(percentage, 0, 100);

    // Print to Serial Monitor
    Serial.println(F("-----------------------------"));
    Serial.print(F("Distance:     "));
    Serial.print(distanceCm, 2);
    Serial.println(F(" cm"));

    Serial.print(F("Water Height: "));
    Serial.print(waterHeight, 2);
    Serial.println(F(" cm"));

    Serial.print(F("Water Level:  "));
    Serial.print(percentage);
    Serial.println(F("%"));
  }

  delay(1000); // Read every second
}