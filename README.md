# micro:bit WiFi (ESP8266)

Simple, reliable blocks to connect a micro:bit to WiFi with an ESP8266 module, send **HTTP GET / POST requests to any server**, and upload data to [ThingSpeak](https://thingspeak.com).

Made for the **ELECFREAKS IoT kit** (ESP8266 on P8/P12), but works with any ESP8266 running AT firmware wired the same way.

*Not affiliated with or endorsed by ELECFREAKS.*

## Use as an extension

In MakeCode for micro:bit, open **Extensions** and paste this repository's URL.

## Wiring

| ESP8266 | micro:bit |
|---|---|
| TX | P8 |
| RX | P12 |
| VCC | 3V |
| GND | GND |

The ESP8266 must use AT firmware at **115200 baud**. Only **2.4 GHz** WiFi networks are supported.

## Blocks

### WiFi

```blocks
iotlab.connectWifi("YOUR_WIFI_NAME", "YOUR_WIFI_PASSWORD")
if (iotlab.isWifiConnected()) {
    basic.showIcon(IconNames.Yes)
}
```

Connection is retried up to 3 times.

### HTTP (any server)

```blocks
iotlab.httpGet("example.com", "/")
basic.showNumber(iotlab.httpStatusCode())
basic.showString(iotlab.httpResponse())
```

```blocks
iotlab.httpPost("myserver.local", "/data", "{\"temp\":25}")
```

* **host**: server name or IP address only, without `http://` (for example `192.168.1.10`)
* **path**: path and optional query string
* **port** (optional): default 80
* **content type** (POST, optional): default `application/json`
* **HTTP status code**: 200 = OK, 0 = no reply
* **HTTP response**: first ~500 characters of the reply body

Limitations: plain **http://** only (no https), and long replies are cut to save memory.

### ThingSpeak

```blocks
iotlab.upload("YOUR_WRITE_API_KEY", input.temperature(), input.lightLevel())
if (iotlab.lastUploadOk()) {
    basic.showNumber(iotlab.lastEntryId())
}
```

Uploads up to 4 fields. Uploads are automatically spaced at least 15 seconds apart (ThingSpeak free-account limit).

## Supported targets

* for PXT/microbit

## License

MIT



> Open this page at [https://rebinma.github.io/pxt-microbit-wifi/](https://rebinma.github.io/pxt-microbit-wifi/)

## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://makecode.microbit.org/](https://makecode.microbit.org/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/rebinma/pxt-microbit-wifi** and import

## Edit this project

To edit this repository in MakeCode.

* open [https://makecode.microbit.org/](https://makecode.microbit.org/)
* click on **Import** then click on **Import URL**
* paste **https://github.com/rebinma/pxt-microbit-wifi** and click import

#### Metadata (used for search, rendering)

* for PXT/microbit
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
