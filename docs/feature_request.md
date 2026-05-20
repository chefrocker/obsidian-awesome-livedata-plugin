# Live Data Hub – Feature Requests & Roadmap

**Stand:** 20. Mai 2026  
**Status-Legende:** 🟢 geplant · 🟡 in Diskussion · 🔵 Idee · ⚪ Backlog

---

## 🎯 Phase 1: Compliance & Foundation (vor Plugin-Store-Submission)

### F-01 🟢 Code-Compliance-Refactor
- Entfernung eigener Kryptografie → Electron `safeStorage` (Desktop) bzw. Session-only (Mobile).
- Beschränkung auf `ws://`/`wss://` auf Mobilgeräten bzw. alle Schemas (Desktop).
- Vereinheitlichung auf einheitlichen `livedata` Code-Block.
- `innerHTML` → `createEl`/`createDiv`.
- `setInterval` → `registerInterval`.
- Style-Injection entfernen.
- Migration auf GitHub.

### F-02 🟢 Visueller Insert-Wizard
- Command `Live Data Hub: Insert Widget`.
- Modal mit Eingabeformular für alle Parameter.
- Live-Vorschau des Widgets direkt im Dialog.
- Automatisches Einfügen des generierten YAML-Blocks an der Cursorposition.

### F-03 🟢 Widget-Display-Varianten (MVP)
- `number` — Zahl mit Einheit.
- `text` — Beliebiger String.
- `badge` — Farbiger Status (OK/Warn/Error).
- `toggle` — Boolean als On/Off (z.B. 🟢/⚫).

### F-04 🟢 Sidebar-Panel "Live Data Overview"
- Vault-weite Übersicht aller aktiven Datenpunkte.
- Gruppiert nach MQTT / REST.
- Status-Anzeige (live/stale/offline).
- Klick springt direkt zur Notiz.
- Buttons für "Reconnect All" / "Pause All".

### F-05 🟢 Subscription-Pooling
- Mehrfach genutzte MQTT-Topics werden nur einmal abonniert.
- Eintreffende Updates werden im Speicher an alle aktiven Widget-Instanzen verteilt.
- Reduziert Broker-Last und Memory-Footprint.

### F-06 🟢 Update-Timestamp & Status-Indikator
- Footer-Anzeige der letzten Wertaktualisierung.
- Relative Zeitangabe (z.B. "vor X Sek/Min/Std/Tagen"), automatische Aktualisierung alle 10s.
- Hover-Tooltip mit absolutem Datum/Uhrzeit im User-Locale.
- Dreistufiger Status-Indikator (live/stale/offline) mit konfigurierbaren Schwellwerten.

### F-07 🟢 Legacy-Block-Toggle
- Settings-Toggle "Enable legacy block types" (Default: off).
- Reaktiviert alte Prozessoren (`mqtt`, `rest`, `api`, `live-data`) parallel zur neuen Syntax.
- Zeigt eine Deprecation-Warnung in alten Blöcken an.

### F-08 🟢 Migrations-Command
- Command `Live Data Hub: Migrate old blocks`.
- Konvertiert alte Block-Syntax zu neuem `livedata`-Format.
- Geltungsbereich: Entweder aktuelle Notiz oder gesamter Vault.

---

## 🚀 Phase 2: Erweiterte Features (nach Store-Freigabe)

### F-10 🟡 Erweiterte Display-Varianten
- `gauge` — SVG-basierter Halbkreis-Tachometer mit Min/Max-Bereichen.
- `sparkline` — Canvas-basiertes Mini-Liniendiagramm (letzte N Werte).
- `progress` — CSS-basierter horizontaler Fortschrittsbalken.

### F-11 🟡 Bidirektionale MQTT-Steuerung
- Interaktive Steuerungselemente (Buttons, Toggles, Slider) im Widget, die ein MQTT-Publish auslösen.
- Use-Case: Smart-Home-Aktoren (z.B. Licht an/aus) direkt aus einer Obsidian-Notiz steuern.
- Optionale `readonly: true` Eigenschaft zum Schutz vor versehentlicher Betätigung.

### F-12 🟡 Historische Daten / Mini-Charts
- Speicherung der letzten N Werte im lokalen IndexedDB-Speicher des Plugins.
- Visualisierung des Verlaufs direkt im Widget (als Sparkline oder Diagramm).
- Konfigurierbare Speicherdauer (z.B. 1h / 24h / 7 Tage / nie).
- Export der historischen Werte als CSV.

### F-13 🟡 Alerting & Notifications
- Schwellwert-basierte Benachrichtigungen (z.B. "Temperatur > 30°C!").
- Sendet Obsidian-Notices oder nutzt die OS-Benachrichtigungsebene.
- Optional: Automatischer Eintrag in die Daily Note bei Schwellwert-Überschreitung.

### F-14 🔵 Farbverlauf nach Wertebereich
- Konfigurierbare Farb-Ranges (z. B. grün < 22°C < gelb < 28°C < rot).
- Dynamische Einfärbung von `number`, `gauge` und `progress` Widgets.

### F-15 🔵 Templating / Bulk-Widgets
- Generierung mehrerer Widgets aus einer einzigen Liste im Codeblock, um Platz zu sparen:
```yaml
source: mqtt
template: true
items:
  - { topic: wz/temp, label: Wohnzimmer }
  - { topic: ku/temp, label: Küche }
  - { topic: sz/temp, label: Schlafzimmer }
```

### F-16 🔵 OAuth2 / API-Key-Profile
- Wiederverwendbare Auth-Profile für REST-APIs.
- Unterstützung für: Bearer Token, API Key, Basic Auth, OAuth2.
- Sichere Speicherung der Token via OS-Keychain (Desktop).

### F-17 🔵 Dataview-Integration
- Macht Live-Werte in Dataview-Abfragen verfügbar.
- Beispiel: `TABLE live("temp_wohnzimmer") AS Temperatur`.

---

## 💡 Neue Feature-Ideen (Community-Vorschläge)

### F-31 🔵 Persistent Offline-Caching
- **Beschreibung:** Letzten bekannten Wert lokal zwischenspeichern.
- **Details:** Beim Öffnen von Obsidian oder einer Notiz wird nicht "Loading..." angezeigt, sondern sofort der letzte bekannte Wert aus einem Cache (`data.json` oder LocalStorage) geladen. Ein dezenter Indikator zeigt an, dass es sich um Offline-Daten handelt, bis eine neue Verbindung steht oder ein neuer Abruf erfolgt.

---

## 🌌 Phase 3: Vision (langfristig)

### F-20 ⚪ Multi-Broker-Support
- Unterstützung für mehrere MQTT-Broker gleichzeitig (z. B. lokaler Smart-Home-Broker + Cloud-Broker).
- Auswahl des Brokers pro Block via `broker: home` / `broker: cloud`.

### F-21 ⚪ WebSocket-API als Datenquelle
- Generische WebSocket-Verbindungen (nicht MQTT) für Custom-APIs, die JSON-Daten über WebSockets streamen.

### F-22 ⚪ Server-Sent Events (SSE)
- Unterstützung für Server-Sent Events als effiziente Alternative zu Polling bei REST-APIs.

### F-23 ⚪ Aktionen & Automationen (Scripting)
- Trigger-basierte Skripte direkt in Obsidian ausführen (z. B. "Wenn Stromverbrauch > 3000W, führe Shell-Befehl aus oder benachrichtige via Templater").

### F-24 ⚪ Web-Dashboard-Export
- Export einer Notiz als interaktives Read-Only-Dashboard. Startet einen lokalen Mini-Webserver oder generiert eine eigenständige HTML-Datei inklusive der WebSocket-Logik zum Teilen außerhalb von Obsidian.

---

## 📊 Priorisierungs-Matrix

| Feature-ID | Feature-Name | Impact | Aufwand | Priorität |
| :--- | :--- | :--- | :--- | :--- |
| **F-01** | Compliance-Refactor | Kritisch | Mittel | 🔴 Muss |
| **F-02** | Insert-Wizard | Hoch | Mittel | 🔴 Muss |
| **F-03** | Display MVP | Hoch | Niedrig | 🔴 Muss |
| **F-06** | Timestamp & Status | Hoch | Niedrig | 🔴 Muss |
| **F-04** | Sidebar-Panel | Mittel | Mittel | 🟡 Soll |
| **F-05** | Subscription-Pooling | Mittel | Niedrig | 🟡 Soll |
| **F-07** | Legacy-Toggle | Mittel | Niedrig | 🟡 Soll |
| **F-08** | Migrations-Command | Mittel | Niedrig | 🟡 Soll |
| **F-31** | Offline-Caching | Hoch | Niedrig | 🟡 Soll |
| **F-10** | Erweiterte Displays | Mittel | Hoch | 🟢 Kann |
| **F-11** | Bidirektionale Steuerung | Hoch | Hoch | 🟢 Kann |
| **F-12** | Historie & Charts | Mittel | Hoch | 🟢 Kann |
| **F-13** | Alerting | Mittel | Mittel | 🟢 Kann |

---

## 📝 Changelog dieser Datei

| Datum | Änderung |
| :--- | :--- |
| **20. Mai 2026** | Initiale Erstellung und Strukturierung der Roadmap. |
| **20. Mai 2026** | Bereinigung von Formatierungsfehlern, Korrektur der Tabellen und Ergänzung neuer Feature-Ideen (F-30 bis F-33). |
| **20. Mai 2026** | Entfernung der Feature-Ideen F-30, F-32 und F-33 auf Kundenwunsch. |