/*
 WiFi Web Server LED Blink

 A simple web server that lets you blink an LED via the web.
 This sketch will print the IP address of your WiFi Shield (once connected)
 to the Serial monitor. From there, you can open that address in a web browser
 to turn on and off the LED on pin 5.

 If the IP address of your shield is yourAddress:
 http://yourAddress/H turns the LED on
 http://yourAddress/L turns it off

 This example is written for a network using WPA encryption. For
 WEP or WPA, change the Wifi.begin() call accordingly.

 Circuit:
 * WiFi shield attached
 * LED attached to pin 5

 created for arduino 25 Nov 2012
 by Tom Igoe

ported for sparkfun esp32 
31.01.2017 by Jan Hendrik Berlin
 
 */

#include <WiFi.h>
#include <Servo.h>
#include <Wire.h>


#define SERVO_ROLL_PIN 25
#define SERVO_PITCH_PIN 26
#define LASER 27

const char* ssid     = "NSA-data-collection-van-#42";
const char* password = "hackkings314";

WiFiServer server(80);
HardwareSerial Serial2(2); 

Servo servoRoll;
Servo servoPitch;


int realAzimuth = 0;


int azimuth = 0;
int altitude = 0;
int laser = 0;




void setup()
{
    Serial.begin(115200);
    Serial2.begin(115200);
    
    servoPitch.attach(SERVO_PITCH_PIN);
    servoRoll.attach(SERVO_ROLL_PIN);
    pinMode(LASER, OUTPUT);      // set the LED pin mode
    
    
    servoPitch.write(90);
    servoRoll.write(95);
    
    delay(10);

    // We start by connecting to a WiFi network

    Serial.println();
    Serial.println();
    Serial.print("Connecting to ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected.");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
    
    server.begin();

}



void loop(){
  //Serial.println(azimuth);
  WiFiClient client = server.available();   // listen for incoming clients
  serialRead();
  setPosition();
  Serial.println(realAzimuth);
  
  if (client) {                             // if you get a client,
    Serial.println("New Client.");           // print a message out the serial port
    String currentLine = "";                // make a String to hold incoming data from the client
    while (client.connected()) {            // loop while the client's connected
      if (client.available()) {             // if there's bytes to read from the client,
        char c = client.read();             // read a byte, then
        //Serial.write(c);                    // print it out the serial monitor
        if (c == '\n') { 
          
                             // if the byte is a newline character
          int azIndex = currentLine.indexOf("azim=");
          int alIndex = currentLine.indexOf("alt=");
          int lasIndex = currentLine.indexOf("laser=");
          
          if(currentLine.startsWith("GET") && azIndex != -1 && alIndex != -1 && lasIndex != -1){
              azimuth = currentLine.substring(azIndex+5, alIndex).toInt();
              altitude = currentLine.substring(alIndex+4, lasIndex).toInt();
              laser = currentLine.substring(lasIndex+6).toInt();
              
              
              if(altitude > 90) {
                altitude = 90;
              }
              
              if(altitude < -90) {
                altitude = -90;
              }
              
              Serial.print("Azimuth: ");
              Serial.print(azimuth);
              Serial.print(" Altitude: ");
              Serial.print(altitude);
              Serial.print(" Laser: ");
              Serial.println(laser);
            
          }
          
          
          // if the current line is blank, you got two newline characters in a row.
          // that's the end of the client HTTP request, so send a response:
          if (currentLine.length() == 0) {
            // HTTP headers always start with a response code (e.g. HTTP/1.1 200 OK)
            // and a content-type so the client knows what's coming, then a blank line:
            client.println("HTTP/1.1 200 OK");
            client.println("Content-type:text/html");
            client.println();
            
            client.print("Azimuth: ");
            client.print(azimuth);
            client.print(" Altitude: ");
            client.print(altitude);
            client.print(" Laser: ");
            client.print(laser);
            client.print(" DIFF: ");
            client.print(angleDiff(azimuth, realAzimuth));
            client.print(" Last Azimuth: ");
            client.println(realAzimuth);

            // the content of the HTTP response follows the header:
            //client.print("Click <a href=\"/H\">here</a> to turn the LED on pin 5 on.<br>");
            //client.print("Click <a href=\"/L\">here</a> to turn the LED on pin 5 off.<br>");

            // The HTTP response ends with another blank line:
            //client.println();
            // break out of the while loop:
            break;
          } else {    // if you got a newline, then clear currentLine:
            currentLine = "";
          }
        } else if (c != '\r') {  // if you got anything else but a carriage return character,
          currentLine += c;      // add it to the end of the currentLine
        }
        

        // Check to see if the client request was "GET /H" or "GET /L":
        if (currentLine.endsWith("GET /H")) {
                        // GET /H turns the LED on
        }
        if (currentLine.endsWith("GET /L")) {
          digitalWrite(5, LOW);                // GET /L turns the LED off
        }
      }
    }
    // close the connection:
    client.stop();
    Serial.println("Client Disconnected.");
  }
}


void setPosition(){
  servoPitch.write(180 - (altitude+90));
  
  if(laser == 1){
    digitalWrite(LASER, HIGH);
  } else {
    digitalWrite(LASER, LOW);
  }
  
  
  int diff = angleDiff(azimuth, realAzimuth);  
  
  if(diff > 10) {
    servoRoll.write(100); // Must be big 
  } else if(diff < -10) {
    servoRoll.write(80); 
  } else {
    servoRoll.write(90);
  }
  
}


void serialRead(){
  static String buffer = "";
  if(Serial2.available()){
    char c = Serial2.read();
    if(c == '\n'){
      realAzimuth = buffer.toInt();
      buffer = "";
    } else {
      buffer += c;
    }
  }
}



int angleDiff(int xd, int yd){
  int a = xd - yd;
  if(a > 180){
    a -= 360;
  } else if(a < -180){
    a += 360;
  }
  return a;
}
