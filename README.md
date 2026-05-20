# Live Data Hub

Display live MQTT and REST API data directly inside your Obsidian notes.

> Turn any note into a live dashboard: room temperatures from your smart home, server status from a REST endpoint, the current Bitcoin price — all updating in real time, right where you read them.

## Features

- **MQTT over WebSockets** (`ws://` / `wss://`) — works on desktop and mobile.
- **MQTT over TCP** (`mqtt://` / `mqtts://`) — desktop only.
- **REST API polling** with configurable interval, caching, retries.
- **Unified `livedata` code block** with `source: mqtt | rest` discriminator.
- **Display variants:** `number`, `text`, `badge`, `toggle` (more in roadmap).
- **Subscription pooling:** one MQTT subscribe per topic, fan-out to all widgets.
- **Status indicator:** live / stale / offline with configurable thresholds.
- **Relative timestamp** with absolute hover tooltip.
- **Insert Wizard:** command-palette modal to compose blocks visually.
- **Migration command:** convert legacy `mqtt` / `rest` / `api` / `live-data` blocks to the new syntax.
- **Sidebar overview:** all active data points at a glance.
- **Credentials in OS keychain** (Electron `safeStorage`) on desktop, session-only on mobile.

## Quick start

````markdown
```livedata
source: mqtt
topic: home/livingroom/temperature
display: number
label: Living room
unit: °C
path: value
```
````

````markdown
```livedata
source: rest
url: https://api.example.com/status.json
display: badge
label: API
path: data.status
interval: 30
```
````

## Settings

Open **Settings → Live Data Hub** to configure:

- Broker host, port, TLS, path
- Auto-connect, default QoS
- REST defaults (interval, caching, retries)
- Credential storage (OS keychain on desktop, session-only on mobile)
- Debug mode

## Commands

- **Live Data Hub: Insert Widget** — visual wizard
- **Live Data Hub: Migrate old blocks** — convert legacy syntax
- **Live Data Hub: Open Overview** — sidebar panel
- **Live Data Hub: Connect / Disconnect** — manual MQTT control
- **Live Data Hub: Refresh All REST API Blocks**
- **Live Data Hub: Clear Stored Credentials**

## Roadmap

See [docs/feature_request.md](docs/feature_request.md).

## Install

### From the Obsidian Community Store (planned)

Search for "Live Data Hub" in **Settings → Community plugins → Browse**.

### Beta via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Add the repo URL `https://github.com/chefrocker/obsidian-awesome-livedata-plugin`.
3. BRAT will install the latest release and keep it up to date.

## License

MIT — see [LICENSE](LICENSE).
