# Live Data Hub - Obsidian Plugin Übersicht

Dieses Dokument beschreibt die Fähigkeiten, den Einsatzzweck und die Bedienung des "Live Data Hub" Plugins für Obsidian.

## 📖 Nutzerstory: Wofür ist dieses Plugin?

Stell dir vor, du hast ein Smart Home (z. B. mit Home Assistant, ioBroker oder Node-RED) oder du überwachst Server und APIs. Anstatt ständig zwischen Obsidian und anderen Dashboards hin- und herzuwechseln, bringt der **Live Data Hub** diese Informationen direkt in deine Notizen.

**Das Szenario:** Du hast eine Notiz für dein "Home Dashboard" oder deine "Server Dokumentation". Mitten im Text fügst du einen kleinen Code-Block ein. Dieser Block verbindet sich im Hintergrund mit deinem MQTT-Broker oder fragt eine REST-API ab und zeigt dir *live* die aktuelle Raumtemperatur, den Serverstatus oder den aktuellen Bitcoin-Kurs an – direkt beim Lesen der Notiz. Wenn sich der Wert im echten Leben ändert, ändert er sich in derselben Sekunde auch in deinem Text, ohne dass du die Seite neu laden musst.

---

## ⚙️ Wie funktioniert das Plugin?

Das Plugin nutzt Obsidian's "Markdown Post-Processor", um spezielle Codeblöcke beim Rendern abzufangen. Anstatt den Code als Text anzuzeigen, ersetzt das Plugin den Block durch ein interaktives HTML-Element (ein "Widget").

Im Hintergrund baut das Plugin auf zwei Kerntechnologien auf:

1. **MQTT über WebSockets (Echtzeit):** 
   Das Plugin verbindet sich mit einem MQTT-Broker im Netzwerk. Es nutzt dafür WebSockets (`ws://` oder `wss://`). Das bedeutet, dass der Broker so konfiguriert sein muss, dass er MQTT über WebSockets anbietet (standardmäßig oft Port 9001, aber das Plugin unterstützt auch beliebige andere Ports, z. B. **1884** oder **8884**, die oft für HTTP/WebSocket-Verbindungen konfiguriert werden). Wenn die Verbindung steht, abonniert das Plugin die in der Notiz definierten Topics und lauscht auf eingehende Nachrichten.
2. **REST API (Polling):**
   Für Dienste, die kein MQTT unterstützen, kann das Plugin in einem festgelegten Intervall (z.B. alle 30 Sekunden) eine HTTP-Anfrage (GET/POST) an eine URL senden, die Antwort (meistens JSON) analysieren und den relevanten Wert extrahieren und aktualisieren.

---

## 🛠️ Das Einstellungsmenü

Bevor du Datenpunkte anlegen kannst, bietet das Plugin ein dediziertes Einstellungsmenü in den Obsidian-Einstellungen unter "Live Data Hub". Dort lassen sich globale Vorgaben konfigurieren:

*   **Broker Konfiguration:** 
    *   **Broker Host:** IP-Adresse oder Domain (z.B. `192.168.1.100` oder `localhost`).
    *   **Broker Port:** Der WebSocket-Port des Brokers (z.B. `9001`, `1884`, `8884`).
    *   **Use TLS:** Schaltet die Verbindung auf `wss://` um (für verschlüsselte Verbindungen).
    *   **Auto Connect:** Verbindet sich sofort beim Starten von Obsidian automatisch.
*   **Sicherheit & Authentifizierung:**
    *   Hier können Anmeldedaten (Benutzername & Passwort) für den Broker hinterlegt werden. Diese werden lokal mit AES verschlüsselt gespeichert.
    *   **Session Only / Auto Logout:** Du kannst einstellen, dass Logins nach z.B. 30 Minuten Inaktivität sicherheitshalber wieder vergessen werden.
*   **Globale Standards:**
    *   **Default QoS:** Das Standard Quality-of-Service Level für MQTT (0, 1 oder 2).
    *   **Default REST Interval:** Wie oft APIs abgefragt werden sollen (in Sekunden).
    *   **Caching & Timeout:** REST-Anfragen können gecacht werden, um Rate-Limits zu verhindern.
    *   **Debug Mode:** Wenn aktiviert, protokolliert das Plugin nützliche Informationen in der Entwickler-Konsole von Obsidian (Strg+Shift+I).

---

## 📊 Datenpunkte anlegen (Bedienung)

Um einen Datenpunkt in deiner Notiz anzulegen, erstellst du einen Markdown-Codeblock. Je nachdem, ob du MQTT oder REST verwenden willst, wählst du die entsprechende "Sprache" für den Codeblock (`mqtt`, `rest`, `api` oder `live-data`).

### 1. MQTT-Datenpunkt anlegen

Schreibe in deine Notiz Folgendes:

````markdown
```mqtt
topic: wohnzimmer/temperatur
label: Temperatur Wohnzimmer
unit: °C
path: value
```
````

**Die Parameter:**
*   `topic` (Pflichtfeld): Das MQTT-Topic, das abonniert werden soll.
*   `label` (Optional): Ein schöner Name für das Widget.
*   `unit` (Optional): Die Einheit, die hinter dem Wert angezeigt wird (z.B. °C, %, W).
*   `path` (Optional): Falls der Broker einen JSON-String sendet (z.B. `{"value": 22.5, "battery": 100}`), extrahiert `path: value` nur die Zahl 22.5.

### 2. REST API-Datenpunkt anlegen

Schreibe in deine Notiz Folgendes:

````markdown
```rest
url: https://api.coindesk.com/v1/bpi/currentprice.json
label: Bitcoin Kurs
path: bpi.EUR.rate_float
interval: 60
unit: €
```
````

**Die Parameter:**
*   `url` (Pflichtfeld): Die Webadresse, die abgefragt werden soll.
*   `label` & `unit` (Optional): Wie beim MQTT-Block.
*   `path` (Optional): Navigiert durch die JSON-Struktur der Antwort (z.B. `bpi.EUR.rate_float`), um den exakten Wert zu finden.
*   `interval` (Optional): Wie oft die Daten in Sekunden aktualisiert werden sollen (überschreibt die globale Einstellung).

### Die Ansicht in der Notiz
Sobald du den Code-Block schließt, verwandelt er sich in ein "Widget":
- Es hat ein Icon (📡 für MQTT, 🌐 für REST).
- Es zeigt einen Lade-Status an, bis Daten empfangen werden.
- Der Wert pulsiert kurz, sobald ein Update rein kommt.
- Bei REST-Blöcken erscheinen zwei kleine Buttons: **Refresh** (manuelles Neuladen) und **Pause** (stoppt das automatische Abfragen).

---

## ⌨️ Befehle (Command Palette)

Zusätzlich zum Einstellungsmenü kannst du Obsidian's Command Palette (Strg+P / Cmd+P) öffnen und nach "Live Data" suchen. Dort gibt es Schnellbefehle:
*   **Connect to MQTT Broker:** Baut die Verbindung manuell auf.
*   **Disconnect from MQTT Broker:** Trennt die Verbindung.
*   **Clear Stored Credentials:** Löscht gespeicherte Passwörter sicher.
*   **Refresh All REST API Blocks:** Zwingt alle REST-Blöcke in der aktuellen Notiz dazu, sofort neue Daten abzurufen.
