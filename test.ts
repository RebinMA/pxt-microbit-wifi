// Demo / test program. Not included when this repo is added as an extension.
// Wiring: ESP8266 TX -> P8, ESP8266 RX -> P12, 3V and GND (ESP8266 AT firmware at 115200 baud)
let ssid = "YOUR_WIFI_NAME"
let password = "YOUR_WIFI_PASSWORD"
let writeKey = "YOUR_THINGSPEAK_WRITE_KEY"

basic.showIcon(IconNames.SmallDiamond)
iotlab.connectWifi(ssid, password)
if (iotlab.isWifiConnected()) {
    basic.showIcon(IconNames.Yes)
} else {
    basic.showIcon(IconNames.No)
}

// Button A: HTTP GET to any server, show the status code (200 = OK)
input.onButtonPressed(Button.A, function () {
    iotlab.httpGet("example.com", "/")
    basic.showNumber(iotlab.httpStatusCode())
})

// Button B: upload temperature and light level to ThingSpeak
input.onButtonPressed(Button.B, function () {
    iotlab.upload(writeKey, input.temperature(), input.lightLevel())
    if (iotlab.lastUploadOk()) {
        basic.showIcon(IconNames.Yes)
    } else {
        basic.showIcon(IconNames.Sad)
    }
})
