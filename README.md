# Scout

[![CI](https://github.com/MohammedAlkindi/scout/actions/workflows/ci.yml/badge.svg)](https://github.com/MohammedAlkindi/scout/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-161b22.svg?style=flat-square)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-Compatible-4B32C3?style=flat-square)](https://modelcontextprotocol.io)
[![PWA](https://img.shields.io/badge/PWA-Offline_Field_Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

Scout is a deterministic solar ephemeris and geospatial multi-criteria ranking engine for outdoor field planning. It turns a current position and a plain-language intent into a ranked map of spots, precise sunlight phase timing, weather viability, and verification caveats — exposed through both a responsive Progressive Web App (PWA) and a Model Context Protocol (MCP) server.

Instead of returning a generic list of tourist spots, Scout calculates solar angles deterministically and scores nearby OpenStreetMap candidates against sunlight phase, weather, distance, terrain friction, and access signals.

Live application: [https://scoutphotography.vercel.app](https://scoutphotography.vercel.app)

---

## Core Capabilities

- **Deterministic Solar Ephemeris**: Calculates sunrise, sunset, golden hour, blue hour, solar noon, and azimuth using a pure Python NOAA formulation with zero external runtime astronomical dependencies.
- **Multi-Criteria Scoring Engine**: Scores place-time windows against solar elevation, cloud ceiling, visibility, precipitation probability, terrain friction, and crowd estimates.
- **Dual Runtime Transports**: Exposes identical recommendation logic over FastAPI HTTP endpoints and native Model Context Protocol (MCP) tools for agent orchestration.
- **Offline-First Field PWA**: Pre-cached service worker architecture (`public/sw.js`) ensures photographers can view their saved shoot timeline, golden-hour chart, and equipment checklist in remote wilderness areas without cellular reception.
- **Travel Style Constraints**: Ranks for targeted travel styles (photographer, sightseeing, family, budget, accessible) with explicit constraint explanations and rejection telemetry.
- **Field Plan Export**: Generates portable, self-contained Markdown shoot briefs and RFC 5545 `.ics` calendar events for golden-hour reservations in device-local time with UTC timestamps.
- **Distributed Edge Cache Support**: In-memory L1 cache with built-in Upstash Redis / Vercel KV REST integration to eliminate upstream API cold-start latency.
- **Resilient Fallback**: Includes a guaranteed Muscat demo flow for walkthroughs and automated testing when third-party upstream providers are slow.

---

## Architecture

Scout enforces strict separation between transport interfaces and deterministic business orchestration. Transport layers (`server/api.py` and `server/mcp_server.py`) parse and validate inputs before delegating to `server/orchestration.py`.

```text
Frontend (TypeScript PWA)
  public/index.html
  public/styles.css
  public/manifest.json
  public/sw.js (Service Worker)
  public/assets/*.js
        |
        +-----------------------+
        |                       |
        v                       v
FastAPI HTTP layer       MCP Server (stdio)
  server/api.py            server/mcp_server.py
        |                       |
        +-----------+-----------+
                    |
                    v
          Shared Orchestration
          server/orchestration.py
                    |
                    v
    +---------------+---------------+---------------+
    |               |               |               |
    v               v               v               v
Solar Ephemeris   Weather Core    POI Ingestion   Scorer Engine
golden_hour.py    weather.py      locations.py    scorer.py
```

---

## MCP Tools

The built-in MCP server (`python -m server.mcp_server`) exposes 5 core tools for AI coding agents and autonomous workflows:

| Tool | Purpose |
| --- | --- |
| `get_golden_hour` | Returns sun position and light-phase windows (dawn, sunrise, golden hour, blue hour, sunset, dusk) for a location and date. |
| `get_conditions` | Returns current weather, atmospheric conditions, and a 24-hour hourly forecast. |
| `get_locations` | Discovers nearby candidates from OpenStreetMap matching an intent and travel radius. |
| `score_window` | Computes a deterministic suitability score (0–100) for a place and time window against weather and sunlight. |
| `build_recommendation` | Executes end-to-end ranking and returns an explainable recommendation set with confidence badges and caveats. |

---

## Data Sources & Resilience

- **Solar Math**: Deterministic suncalc formulation (mean obliquity, ecliptic coordinates, transit angles). Pure math, zero network calls.
- **Weather**: Open-Meteo API (temperature, cloud cover, visibility, wind speed, precipitation). Keyless and privacy-preserving.
- **Places**: OpenStreetMap via [Photon by Komoot](https://photon.komoot.io) and Overpass API.
- **Caching**: Local in-memory `TTLCache` with per-key concurrency locking, with optional Upstash / Vercel KV REST edge persistence.

---

## Running Locally

### 1. Prerequisites
- Python 3.12+
- Node.js 20+

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/MohammedAlkindi/scout.git
cd scout

# Python virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend dependencies and compilation
npm install
npm run build
```

### 3. Run Web Application
```bash
uvicorn server.api:app --reload --port 8420
```
Open [http://127.0.0.1:8420](http://127.0.0.1:8420).

### 4. Run MCP Server
```bash
python -m server.mcp_server
```
See [docs/MCP_SETUP.md](docs/MCP_SETUP.md) for Claude Desktop, Antigravity, and Cursor configuration.

---

## Verification & Testing

Scout enforces strict automated testing across Python, TypeScript, and browser automation:

```bash
# Typecheck TypeScript
npm run typecheck

# Build frontend modules
npm run build

# Run unit and integration tests (134 passed)
pytest -q

# Run end-to-end browser regression tests (Playwright)
npm run test:e2e
```

---

## Documentation

- [Architecture & Design Boundaries](docs/ARCHITECTURE.md)
- [HTTP API Reference](docs/API.md)
- [Deterministic Scoring Formulation](docs/SCORING.md)
- [MCP Setup & Example Prompts](docs/MCP_SETUP.md)
- [Production Deployment](docs/DEPLOYMENT.md)
- [Development Guidelines](docs/DEVELOPMENT.md)
- [Product & Technical Roadmap](docs/ROADMAP.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
