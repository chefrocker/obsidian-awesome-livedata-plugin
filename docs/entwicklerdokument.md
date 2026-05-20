# Live Data Hub – Entwicklerdokument
## Plugin-Store-Readiness & Architektur-Spezifikation

**Stand:** 20. Mai 2026  
**Version:** 2.0.0 (geplant)  

---

## 1. Compliance-Anforderungen (Obsidian Community Review)

Das Obsidian Community Plugin-System führt automatisierte und manuelle Reviews durch. Folgende Punkte müssen vor der Einreichung erfüllt sein:

### 1.1 GitHub-Migration

| Aktuell | Ziel |
| :--- | :--- |
| GitLab (firmenintern) | Öffentliches GitHub-Repository |

**Begründung:** Obsidian listet ausschließlich GitHub-basierte Plugins im Community Store.

**Aufgaben:**
- [ ] Neues öffentliches GitHub-Repository erstellen.
- [ ] Code migrieren (ohne sensible Firmen-Daten).
- [ ] GitHub Actions für automatische Releases einrichten.
- [ ] README.md mit Screenshots und Beispielen erstellen.
- [ ] LICENSE-Datei hinzufügen (MIT empfohlen).

### 1.2 Manifest-Felder vervollständigen

**Aktuelle Probleme in `manifest.json`:**
```json
{
  "author": "Sandro BaIlarini",
  "authorUrl": "https://gitlab.your-company.com/..."
}
```

**Korrigierte Version:**
```json
{
  "id": "live-data-hub",
  "name": "Live Data Hub",
  "version": "2.0.0",
  "minAppVersion": "0.15.0",
  "author": "[Dein echter Name oder Pseudonym]",
  "authorUrl": "https://github.com/[dein-username]",
  "description": "Display live MQTT and REST API data directly in your notes",
  "isDesktopOnly": false
}
```

### 1.3 Code-Refaktorierung

#### 1.3.1 innerHTML → createEl/createDiv
**Problem:** Direktes `innerHTML` mit dynamischen Daten ist ein XSS-Risiko und wird im Review abgelehnt.

*Vorher (❌):*
```typescript
block.innerHTML = `<div class="widget">${value}</div>`;
```

*Nachher (✅):*
```typescript
const widget = block.createDiv({ cls: 'widget' });
widget.createSpan({ text: value });
```

*Betroffene Stellen:*
- `renderMqttBlock()`
- `renderRestBlock()`
- Alle dynamischen DOM-Manipulationen

#### 1.3.2 setInterval → registerInterval
**Problem:** Direkte `setInterval`-Aufrufe werden bei View-Wechseln nicht automatisch bereinigt, was zu Memory Leaks führt.

*Vorher (❌):*
```typescript
setInterval(() => this.refresh(), 30000);
```

*Nachher (✅):*
```typescript
this.registerInterval(
  window.setInterval(() => this.refresh(), 30000)
);
```

#### 1.3.3 Eigene Kryptografie entfernen
**Problem:** Die selbstgeschriebenen Funktionen `encryptAES`, `decryptAES` und `sha256` sind kryptografisch unsicher (nur XOR + Base64) und werden im Review beanstandet.

**Lösung:** Siehe [DE-01: Credential-Handling](#de-01-credential-handling) (Verwendung von Electron `safeStorage`).
*Zu entfernen:*
- `encryptAES()` Funktion
- `decryptAES()` Funktion
- `sha256()` Funktion
- `encryptedCredentials` aus dem Settings-Interface

#### 1.3.4 Style-Injection entfernen
**Problem:** `addStyles()` injiziert ein `<style>`-Element via JavaScript, obwohl bereits eine `styles.css` existiert.

**Lösung:**
- `addStyles()` Funktion komplett entfernen.
- Alle Styles in `styles.css` konsolidieren.

#### 1.3.5 console.log hinter Debug-Flag
**Problem:** Produktions-Code sollte keine unnötigen Konsolenausgaben erzeugen.

**Lösung:**
```typescript
if (this.settings.debugMode) {
  console.log('[Live Data Hub]', message);
}
```

#### 1.3.6 NodeJS-Typen → Browser-Typen
**Problem:** `NodeJS.Timeout` existiert nicht im nativen Browser-Kontext (Mobile Kompatibilität).

*Vorher (❌):*
```typescript
private timer: NodeJS.Timeout;
```

*Nachher (✅):*
```typescript
private timer: number;
```

#### 1.3.7 Cleanup in MarkdownRenderChild.onunload()
**Problem:** Aktuell wird Cleanup nur bei `app.workspace.on('quit')` ausgeführt — das greift nicht bei Schließen oder Wechseln von Tabs/Views.

**Lösung:** Widgets als `MarkdownRenderChild` implementieren:
```typescript
class LiveDataWidget extends MarkdownRenderChild {
  onunload() {
    // Cleanup: Subscriptions, Intervals, Event-Listener
    this.unsubscribe();
    this.credentials = { username: '', password: '' }; // RAM nullen
  }
}
```

### 1.4 Disclosures (Deklarationen für den Store-Review)

Folgende Capabilities müssen bei der Einreichung deklariert werden:

| Capability | Begründung |
| :--- | :--- |
| **Network** | MQTT WebSocket + HTTP REST API Calls |
| **Node.js TCP/TLS APIs** | Desktop-only für `mqtt://` und `mqtts://` |
| **Stores credentials** | Optional, OS-encrypted, desktop-only |

### 1.5 Build-Konfiguration

#### esbuild-Setup
```javascript
// esbuild.config.mjs
import esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  external: ['obsidian'], // Obsidian stellt das zur Laufzeit bereit
  format: 'cjs',
  target: 'es2018',
  platform: 'browser',
  sourcemap: 'inline',
  minify: process.env.NODE_ENV === 'production',
});
```

**Wichtig:** `mqtt.js` wird komplett in `main.js` gebündelt. Keine `node_modules` ausliefern.

#### Release-Artefakte
Nur diese drei Dateien werden für ein Release benötigt:
- `main.js` (gebündelt, ~200-500 KB)
- `manifest.json`
- `styles.css`

---

## 2. Designentscheidungen (DE)

### DE-01: Credential-Handling

| Aspekt | Spezifikation |
| :--- | :--- |
| **Default-Verhalten** | Session-only: Credentials nur im RAM, gehen beim Schließen verloren |
| **Optional (Desktop)** | Checkbox "Passwort sicher im System-Schlüsselbund speichern" → Electron `safeStorage` |
| **Mobile-Verhalten** | Checkbox deaktiviert mit Hinweis: *"Permanente Speicherung auf Mobile nicht verfügbar"* |
| **Auto-Connect** | Funktioniert nur mit gespeicherten Credentials (Keychain) oder bei Brokern ohne Auth |
| **Plattform-Erkennung** | `Platform.isMobile` / `Platform.isDesktop` aus Obsidian API |

*Implementierung Electron safeStorage:*
```typescript
import { Platform } from 'obsidian';

if (Platform.isDesktop && this.settings.persistCredentialsToKeychain) {
  const { safeStorage } = (window as any).require('electron').remote;
  const encrypted = safeStorage.encryptString(password);
  // Speichere den encrypted Buffer als base64 in data.json
}
```

### DE-02: MQTT-Transport

| Plattform | Unterstützte Schemas |
| :--- | :--- |
| **Mobile (iOS/Android)** | `ws://`, `wss://` |
| **Desktop (Win/Mac/Linux)** | `mqtt://`, `mqtts://`, `ws://`, `wss://` |

**Begründung:** Die Mobile WebView hat keinen Zugriff auf Raw-TCP-Sockets. Desktop nutzt Electron/Node.js mit `net`/`tls`-Modulen.

*Plattform-Guard im Code:*
```typescript
if (Platform.isMobile && (url.startsWith('mqtt://') || url.startsWith('mqtts://'))) {
  new Notice('MQTT über TCP ist auf Mobile nicht verfügbar. Bitte ws:// oder wss:// verwenden.');
  return;
}
```

*Settings-UI:* Statt URL-Feld → getrennte Felder für Host, Port, Path und ein TLS-Toggle.

### DE-03: Bedienkonzept-Refactor

| Aspekt | Spezifikation |
| :--- | :--- |
| **Neuer Block-Typ** | Einheitlich `livedata` mit `source:`-Diskriminator |
| **Alte Block-Typen** | `mqtt`, `rest`, `api`, `live-data` werden bei v2.0.0 standardmäßig nicht mehr verarbeitet |
| **Legacy-Toggle** | Settings-Option "Enable legacy block types" (Default: off) reaktiviert alte Prozessoren |
| **Migrations-Befehl** | `Live Data Hub: Migrate old blocks` konvertiert alte Syntax vault-weit |

*Neue Syntax:*
```yaml
```livedata
source: mqtt
topic: wohnzimmer/temperatur
display: number
label: Temperatur
unit: °C
path: value
```
```

### DE-04: Update-Timestamp & Status-Indikator

#### Timestamp-Anzeige

| Alter der Daten | Darstellung |
| :--- | :--- |
| **< 60 Sekunden** | "vor 23 Sek." |
| **< 60 Minuten** | "vor 5 Min." |
| **< 24 Stunden** | "vor 2 Std." |
| **< 7 Tage** | "vor 3 Tagen" |
| **≥ 7 Tage** | "20.05.2026, 10:08" (Systemzeit/Locale) |

- **Format:** Systemzeit des Nutzers via `Intl.DateTimeFormat`.
- **Hover-Tooltip:** Absolutes Datum/Uhrzeit.
- **Auto-Refresh:** Alle ~10 Sekunden.

#### Status-Indikator

| Status | Farbe | Bedingung (Default) |
| :--- | :--- | :--- |
| 🟢 **live** | Grün | Letztes Update < 5 Minuten |
| 🟡 **stale** | Gelb | Letztes Update 5:00 – 29:59 Minuten |
| 🔴 **offline** | Rot | Letztes Update ≥ 30 Minuten |

*Konfigurierbarkeit pro Block:*
```yaml
status:
  live: 300      # Sekunden
  stale: 1800    # Sekunden
  offline: 1800  # Sekunden
```

*Kurzform:*
```yaml
status: 60/300/300   # live/stale/offline in Sekunden
```

### DE-05: Datenpunkt-Verwaltung

| Aspekt | Spezifikation |
| :--- | :--- |
| **Modell** | Nur Inline-Konfiguration |
| **Keine zentrale Bibliothek** | Jeder Block enthält die vollständige Konfiguration |
| **Vorteil** | Notizen sind self-contained (eigenständig) und portabel |
| **Nachteil** | Bei globalen Topic-Änderungen ist Suchen & Ersetzen nötig |

---

## 3. Architektur-Spezifikation

### 3.1 Einheitlicher Code-Block-Typ: `livedata`

Registrierung des Prozessors:
```typescript
this.registerMarkdownCodeBlockProcessor('livedata', (source, el, ctx) => {
  const widget = new LiveDataWidget(el, source, this);
  ctx.addChild(widget);
});
```

### 3.2 Block-Parameter-Schema

```yaml
# Pflichtfelder
source: mqtt | rest           # Datenquelle

# Für MQTT
topic: string                 # MQTT Topic

# Für REST
url: string                   # API Endpoint
method: GET | POST            # HTTP Methode (Default: GET)
headers:                      # Optional: Custom Headers
  Authorization: Bearer xxx
body: string                  # Optional: Request Body (bei POST)
interval: number              # Polling-Intervall in Sekunden

# Gemeinsame Felder
display: number | text | badge | toggle  # Anzeige-Typ (Default: number)
label: string                 # Widget-Titel
unit: string                  # Einheit (z.B. °C, %, €)
path: string                  # JSON-Pfad zum Wert (z.B. data.temperature)
icon: string                  # Emoji oder Lucide-Icon-Name
timestamp: relative | absolute | both | hidden # Timestamp-Anzeige
status: 60/300/300            # Schwellwerte (live/stale/offline in Sekunden)
```

### 3.3 Display-Varianten (v2.0.0 MVP)

| Display | Beschreibung | Implementierung |
| :--- | :--- | :--- |
| `number` | Zahl mit Einheit | `createSpan` mit CSS-Klasse |
| `text` | Beliebiger String | `createSpan` |
| `badge` | Farbiger Status | `createDiv` mit dynamischer Hintergrundfarbe |
| `toggle` | Boolean On/Off | Icon-Wechsel (🟢/⚫ oder ✓/✗) |

*Für spätere Versionen (v2.1+):*
- `gauge` — SVG-basierter Halbkreis
- `sparkline` — Canvas-basiertes Mini-Chart
- `progress` — CSS-basierter Fortschrittsbalken

### 3.4 Widget-Design (Card-Layout)

```text
┌─────────────────────────────────────┐
│ 🌡️ Wohnzimmer Temperatur     ● live │
│                                     │
│               22.5 °C               │
│                                     │
│       🕐 vor 3 Min. · QoS 0 ⋮       │
└─────────────────────────────────────┘
```

**CSS-Klassen:**
- `.live-data-widget`
- `.live-data-widget-header`
- `.live-data-widget-status`
- `.live-data-widget-value`
- `.live-data-widget-footer`
- `.live-data-widget-timestamp`

*Theme-Integration:* Ausschließlich Obsidian CSS-Variablen verwenden (z. B. `--background-primary`, `--text-normal`, `--text-accent`, etc.).

### 3.5 Insert-Wizard

- **Command:** `Live Data Hub: Insert Widget`
- **Modal-Struktur:**
  1. Quelle wählen (MQTT / REST)
  2. Parameter eingeben (Topic/URL, Label, Unit, Path)
  3. Display-Typ wählen
  4. Live-Vorschau anzeigen
  5. Einfügen → generiert den korrekten `livedata`-Block in der aktuellen Cursorposition.

### 3.6 Sidebar-Panel "Live Data Overview"

- **View-Typ:** `ItemView` mit ID `live-data-overview`
- **Funktionen:**
  - Liste aller aktiven Datenpunkte im aktuellen Vault.
  - Gruppiert nach MQTT / REST.
  - Live-Statusanzeige pro Datenpunkt.
  - Klick springt direkt zur Notiz und scrollt zum Block.
  - Buttons für "Reconnect All" und "Pause All".

### 3.7 Subscription-Pooling

**Problem:** Das gleiche Topic in 5 verschiedenen Widgets führt zu 5 getrennten Subscriptions und unnötiger Last.

**Lösung:**
```typescript
class SubscriptionManager {
  private subscriptions: Map<string, Set<LiveDataWidget>> = new Map();
  
  subscribe(topic: string, widget: LiveDataWidget) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.mqttClient.subscribe(topic);
    }
    this.subscriptions.get(topic)!.add(widget);
  }
  
  onMessage(topic: string, payload: Buffer) {
    this.subscriptions.get(topic)?.forEach(widget => {
      widget.update(payload);
    });
  }
}
```

### 3.8 Theme-Integration

Keine hartkodierten Farben verwenden. Alle Farben via CSS-Variablen steuern:
```css
.live-data-widget {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  color: var(--text-normal);
}

.live-data-status-live { 
  color: var(--text-success, #4ade80); 
} 

.live-data-status-stale { 
  color: var(--text-warning, #fbbf24); 
} 

.live-data-status-offline { 
  color: var(--text-error, #f87171); 
}
```

---

## 4. Build & Deployment

### 4.1 esbuild-Setup

Siehe Abschnitt 1.5.

### 4.2 GitHub Actions für Releases

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - '*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: softprops/action-gh-release@v1
        with:
          files: |
            main.js
            manifest.json
            styles.css
```

### 4.3 BRAT-Beta-Distribution

Während der Entwicklung kann das Plugin via [BRAT](https://github.com/TfTHacker/obsidian42-brat) verteilt werden:
1. User installiert BRAT.
2. User fügt die GitHub-Repository-URL hinzu.
3. BRAT installiert Beta-Versionen automatisch bei Release-Tags.

---

## 5. Roadmap

Siehe separate Datei: [feature_request.md](file:///c:/Github/obsidian-awesome-livedata-plugin/docs/feature_request.md)

---

## Anhang: Checkliste vor Submission

- [ ] GitHub-Repository öffentlich
- [ ] `manifest.json` vollständig ausgefüllt
- [ ] `README.md` mit Screenshots, Beispielen, Konfigurationsanleitung
- [ ] `LICENSE` Datei (MIT)
- [ ] Alle `innerHTML` durch `createEl`/`createDiv` ersetzt
- [ ] Alle `setInterval` durch `registerInterval` ersetzt
- [ ] Eigene Krypto-Funktionen entfernt
- [ ] Style-Injection entfernt
- [ ] `console.log` hinter Debug-Flag gesetzt
- [ ] NodeJS-Typen durch Browser-Typen ersetzt
- [ ] Cleanup in `MarkdownRenderChild.onunload()` integriert
- [ ] Lokaler Test mit Obsidian ESLint-Plugin
- [ ] Release mit korrekten Assets (main.js, manifest.json, styles.css)
- [ ] Submission via Obsidian Developer Dashboard