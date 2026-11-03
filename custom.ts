//% block="IoT Lab" color=#1E90FF icon="\uf1eb"
//% groups='["WiFi", "ThingSpeak", "HTTP"]'
namespace iotlab {
    let wifiOk = false
    let lastOk = false
    let lastEntry = 0
    let lastUploadTime = 0
    let hasUploaded = false

    // Read from the ESP8266 until one of the targets appears or the timeout passes.
    // Keeps only the tail of the reply to save memory on micro:bit V1.
    function waitFor(targets: string[], timeout: number): string {
        let resp = ""
        let start = input.runningTime()
        while (input.runningTime() - start < timeout) {
            resp += serial.readString()
            if (resp.length > 400) resp = resp.substr(resp.length - 400)
            for (let t of targets) {
                if (resp.indexOf(t) >= 0) return resp
            }
            basic.pause(20)
        }
        return resp
    }

    function sendAT(cmd: string, targets: string[], timeout: number): string {
        serial.readString() // flush
        serial.writeString(cmd + "\r\n")
        return waitFor(targets, timeout)
    }

    /**
     * Start the ESP8266 and join a 2.4 GHz WiFi network. Retries up to 3 times.
     */
    //% block="connect to WiFi|SSID %ssid|password %password"
    //% weight=100
    //% group="WiFi"
    export function connectWifi(ssid: string, password: string): void {
        serial.setRxBufferSize(254)
        serial.redirect(SerialPin.P8, SerialPin.P12, BaudRate.BaudRate115200)
        basic.pause(1000)
        sendAT("AT", ["OK"], 1000)
        sendAT("AT+CWMODE=1", ["OK", "ERROR"], 1000)
        wifiOk = false
        for (let attempt = 0; attempt < 3 && !wifiOk; attempt++) {
            let r = sendAT("AT+CWJAP=\"" + ssid + "\",\"" + password + "\"", ["OK", "FAIL", "ERROR"], 20000)
            wifiOk = r.indexOf("GOT IP") >= 0 || r.indexOf("OK") >= 0
            if (r.indexOf("FAIL") >= 0 || r.indexOf("ERROR") >= 0) wifiOk = false
            if (!wifiOk) basic.pause(2000)
        }
        sendAT("AT+CIPMUX=0", ["OK", "ERROR"], 1000)
    }

    /**
     * Upload up to 4 values to a ThingSpeak channel.
     * Automatically waits so uploads are at least 15 s apart (free-account limit).
     */
    //% block="upload to ThingSpeak|write key %key|field1 %f1||field2 %f2|field3 %f3|field4 %f4"
    //% expandableArgumentMode="enabled" inlineInputMode=external
    //% weight=90
    //% group="ThingSpeak"
    export function upload(key: string, f1: number, f2?: number, f3?: number, f4?: number): void {
        lastOk = false
        lastEntry = 0
        if (!wifiOk) return

        if (hasUploaded) {
            let wait = 15500 - (input.runningTime() - lastUploadTime)
            if (wait > 0) basic.pause(wait)
        }

        let query = "api_key=" + key + "&field1=" + f1
        if (f2 !== undefined) query += "&field2=" + f2
        if (f3 !== undefined) query += "&field3=" + f3
        if (f4 !== undefined) query += "&field4=" + f4

        let s = sendAT("AT+CIPSTART=\"TCP\",\"api.thingspeak.com\",80", ["CONNECT", "ERROR", "CLOSED"], 10000)
        if (s.indexOf("CONNECT") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }

        let req = "GET /update?" + query + " HTTP/1.1\r\nHost: api.thingspeak.com\r\nConnection: close\r\n\r\n"
        s = sendAT("AT+CIPSEND=" + req.length, [">", "ERROR"], 3000)
        if (s.indexOf(">") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }

        serial.readString()
        serial.writeString(req)
        s = waitFor(["CLOSED"], 10000)
        hasUploaded = true
        lastUploadTime = input.runningTime()

        // Body comes after the blank line that ends the headers; ThingSpeak returns the entry id (0 = rejected)
        // find the LAST blank line (MakeCode strings have no lastIndexOf)
        let bodyStart = -1
        let p = s.indexOf("\r\n\r\n")
        while (p >= 0) {
            bodyStart = p
            p = s.indexOf("\r\n\r\n", p + 1)
        }
        if (bodyStart < 0) return
        let id = 0
        let i = bodyStart + 4
        while (i < s.length && (s.charAt(i) == "\r" || s.charAt(i) == "\n" || s.charAt(i) == " ")) i++
        while (i < s.length) {
            let c = s.charCodeAt(i)
            if (c < 48 || c > 57) break
            id = id * 10 + (c - 48)
            i++
        }
        lastEntry = id
        lastOk = id > 0
    }

    /**
     * True if the last WiFi connection attempt succeeded.
     */
    //% block="WiFi connected"
    //% weight=80
    //% group="WiFi"
    export function isWifiConnected(): boolean {
        return wifiOk
    }

    /**
     * True if ThingSpeak accepted the last upload.
     */
    //% block="last upload succeeded"
    //% weight=70
    //% group="ThingSpeak"
    export function lastUploadOk(): boolean {
        return lastOk
    }

    /**
     * The entry number ThingSpeak gave the last upload (0 if it failed).
     */
    //% block="last entry ID"
    //% weight=60
    //% group="ThingSpeak"
    export function lastEntryId(): number {
        return lastEntry
    }

    // ---------------- HTTP (any server) ----------------
    let httpStatus = 0
    let httpBody = ""

    // UTF-8 byte length: CIPSEND and Content-Length count bytes, not characters
    function byteLength(s: string): number {
        let n = 0
        for (let i = 0; i < s.length; i++) {
            let c = s.charCodeAt(i)
            if (c < 0x80) n += 1
            else if (c < 0x800) n += 2
            else if (c < 0x10000) n += 3
            else n += 4
        }
        return n
    }

    // Remove the "+IPD,<len>:" markers the ESP8266 inserts before each data packet
    function stripIpd(s: string): string {
        let out = ""
        let p = 0
        while (true) {
            let q = s.indexOf("+IPD,", p)
            if (q < 0) break
            let colon = s.indexOf(":", q)
            if (colon < 0) break
            out += s.substr(p, q - p)
            p = colon + 1
        }
        return out + s.substr(p)
    }

    function lastIndexOf(s: string, t: string): number {
        let last = -1
        let p = s.indexOf(t)
        while (p >= 0) {
            last = p
            p = s.indexOf(t, p + 1)
        }
        return last
    }

    function request(method: string, host: string, port: number, path: string, body: string, contentType: string): void {
        httpStatus = 0
        httpBody = ""
        if (!wifiOk) return
        if (!port) port = 80
        if (!path) path = "/"
        if (path.charAt(0) != "/") path = "/" + path

        let s = sendAT("AT+CIPSTART=\"TCP\",\"" + host + "\"," + port, ["CONNECT", "ERROR", "CLOSED"], 10000)
        if (s.indexOf("CONNECT") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }

        // HTTP/1.0 so servers don't reply with chunked encoding
        let req = method + " " + path + " HTTP/1.0\r\nHost: " + host + "\r\nConnection: close\r\n"
        if (method == "POST") {
            req += "Content-Type: " + contentType + "\r\nContent-Length: " + byteLength(body) + "\r\n"
        }
        req += "\r\n" + body

        s = sendAT("AT+CIPSEND=" + byteLength(req), [">", "ERROR"], 3000)
        if (s.indexOf(">") < 0) {
            sendAT("AT+CIPCLOSE", ["OK", "ERROR"], 1000)
            return
        }
        serial.readString()
        serial.writeString(req)

        // Keep the first 600 chars (status line + start of body); watch the tail for CLOSED
        let head = ""
        let tail = ""
        let start = input.runningTime()
        while (input.runningTime() - start < 10000) {
            let chunk = serial.readString()
            if (chunk.length > 0) {
                if (head.length < 600) head += chunk
                tail += chunk
                if (tail.length > 40) tail = tail.substr(tail.length - 40)
                if (tail.indexOf("CLOSED") >= 0) break
            } else {
                basic.pause(20)
            }
        }

        let r = stripIpd(head)
        let h = r.indexOf("HTTP/1.")
        if (h < 0) return
        let sp = r.indexOf(" ", h)
        let code = 0
        for (let i = sp + 1; i < sp + 4 && i < r.length; i++) {
            let c = r.charCodeAt(i)
            if (c < 48 || c > 57) break
            code = code * 10 + (c - 48)
        }
        httpStatus = code

        let b = r.indexOf("\r\n\r\n", h)
        if (b < 0) return
        let text = r.substr(b + 4)
        let e = lastIndexOf(text, "CLOSED")
        if (e >= 0) text = text.substr(0, e)
        while (text.length > 0 && (text.charAt(text.length - 1) == "\n" || text.charAt(text.length - 1) == "\r")) {
            text = text.substr(0, text.length - 1)
        }
        httpBody = text
    }

    /**
     * Send an HTTP GET request to any server (http:// only, not https://).
     * @param host server name or IP address, eg: "example.com"
     * @param path path (and query), eg: "/"
     * @param port server port, eg: 80
     */
    //% block="HTTP GET|host %host|path %path||port %port"
    //% expandableArgumentMode="toggle"
    //% group="HTTP"
    //% weight=50
    export function httpGet(host: string, path: string, port: number = 80): void {
        request("GET", host, port, path, "", "")
    }

    /**
     * Send an HTTP POST request with a body to any server (http:// only, not https://).
     * @param host server name or IP address, eg: "example.com"
     * @param path path, eg: "/data"
     * @param body data to send, eg: "hello"
     * @param contentType body format, eg: "application/json"
     * @param port server port, eg: 80
     */
    //% block="HTTP POST|host %host|path %path|body %body||content type %contentType|port %port"
    //% expandableArgumentMode="toggle"
    //% group="HTTP"
    //% weight=45
    export function httpPost(host: string, path: string, body: string, contentType: string = "application/json", port: number = 80): void {
        request("POST", host, port, path, body, contentType)
    }

    /**
     * HTTP status code of the last request (200 = OK, 0 = no reply).
     */
    //% block="HTTP status code"
    //% group="HTTP"
    //% weight=40
    export function httpStatusCode(): number {
        return httpStatus
    }

    /**
     * Body of the last HTTP response (first ~500 characters).
     */
    //% block="HTTP response"
    //% group="HTTP"
    //% weight=35
    export function httpResponse(): string {
        return httpBody
    }
}
