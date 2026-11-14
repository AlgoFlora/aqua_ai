#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

// Pin connections
const int trigPin = 9;
const int echoPin = 10;
const int buzzerPin = 5;

// Full water height
const float targetHeight = 6.3;

float emptyDistance = 0;
bool fullReached = false;

// Read ultrasonic sensor
float getDistance()
{
  float total = 0;
  int count = 0;

  for (int i = 0; i < 5; i++)
  {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);

    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);

    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH, 30000);

    if (duration > 0)
    {
      float d = duration * 0.0343 / 2;

      if (d >= 2 && d <= 400)
      {
        total += d;
        count++;
      }
    }

    delay(30);
  }

  if (count == 0)
    return -1;

  return total / count;
}

// Buzzer
void beep(int times)
{
  for (int i = 0; i < times; i++)
  {
    digitalWrite(buzzerPin, HIGH);
    delay(300);
    digitalWrite(buzzerPin, LOW);
    delay(300);
  }
}

// LCD display
void showLCD(int level, const char* status)
{
  lcd.setCursor(0, 0);
  lcd.print("LEVEL:");

  if (level < 100) lcd.print(" ");
  if (level < 10) lcd.print(" ");

  lcd.print(level);
  lcd.print("% P:ON  ");

  lcd.setCursor(0, 1);
  lcd.print(status);
  lcd.print("                ");
}

void setup()
{
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  digitalWrite(buzzerPin, LOW);

  Serial.begin(9600);

  lcd.init();
  lcd.backlight();

  // EMPTY CONTAINER CALIBRATION
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CALIBRATING...");
  lcd.setCursor(0, 1);
  lcd.print("KEEP EMPTY");

  delay(2000);

  float total = 0;
  int count = 0;

  for (int i = 0; i < 20; i++)
  {
    float d = getDistance();

    if (d > 0)
    {
      total += d;
      count++;
    }

    delay(100);
  }

  if (count == 0)
  {
    lcd.clear();
    lcd.print("SENSOR ERROR");
    while (true);
  }

  emptyDistance = total / count;

  Serial.print("EMPTY DISTANCE: ");
  Serial.println(emptyDistance);

  // EMPTY STATUS
  lcd.clear();
  showLCD(0, "CONTAINER EMPTY");

  // One startup beep
  digitalWrite(buzzerPin, HIGH);
  delay(1000);
  digitalWrite(buzzerPin, LOW);

  delay(1000);

  lcd.clear();
}

void loop()
{
  if (fullReached)
    return;

  float distance = getDistance();

  if (distance < 0)
  {
    lcd.setCursor(0, 1);
    lcd.print("SENSOR ERROR    ");
    Serial.println("NO ECHO");
    delay(500);
    return;
  }

  // Calculate water height
  float waterHeight = emptyDistance - distance;

  if (waterHeight < 0)
    waterHeight = 0;

  // Calculate percentage
  float percentage = (waterHeight / targetHeight) * 100.0;

  percentage = constrain(percentage, 0, 100);

  int level = (int)(percentage + 0.5);

  // Serial Monitor readings
  Serial.print("Empty: ");
  Serial.print(emptyDistance);

  Serial.print(" cm | Current: ");
  Serial.print(distance);

  Serial.print(" cm | Water: ");
  Serial.print(waterHeight);

  Serial.print(" cm | Level: ");
  Serial.print(level);
  Serial.println("%");

  // FULL CONDITION
  if (waterHeight >= targetHeight)
  {
    fullReached = true;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("LEVEL: 100%");
    lcd.setCursor(0, 1);
    lcd.print("CONTAINER FULL");

    beep(2);

    Serial.println("CONTAINER FULL");
    Serial.println("SWITCH OFF PUMP MANUALLY");

    return;
  }

  // LIVE LCD DISPLAY
  showLCD(level, "WATER FILLING");

  delay(500);
}