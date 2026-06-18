# 2026 Ebola Outbreak Dashboard (Vanilla JS)

A modular, static dashboard + map site designed for GitHub Pages and Vercel hosting.

## What it includes

- Outbreak KPI cards (suspected, confirmed, deaths, CFR)
- Interactive map (Leaflet + OpenStreetMap) with risk markers and weather halos
- Country-level situation table with dynamic risk levels
- Trend chart drawn with Canvas API (responsive, high-DPI aware)
- Detailed analysis panel generated from current metrics
- Live humanitarian report metadata integration via ReliefWeb (with graceful fallback)
- WHO Disease Outbreak News integration for official outbreak bulletins
- HDX HAPI context integration for population, rainfall, and national risk
- WHO GHO integration for emergency-capacity and workforce indicators
- Open-Meteo integration for live country weather overlays
- Unified timeline blending baseline cases with WHO and ReliefWeb reporting activity
- ADM1 choropleth overlays for countries where geoBoundaries and HDX rainfall anomaly data align cleanly

## Data provenance per panel

| Panel | Primary source | Fallback |
|-------|---------------|----------|
| KPI cards | `src/data/ebola-2026-baseline.json` + computed totals | Always available (static baseline) |
| Geographic spread map | Leaflet + OpenStreetMap tiles; markers from baseline; weather halos from Open-Meteo | Map renders from baseline data if weather unavailable |
| ADM1 choropleth | geoBoundaries (ADM1 polygons) + HDX HAPI (rainfall anomaly, admin_level=1) | Choropleth hidden if either source fails |
| Outbreak trend chart | Baseline timeline + ReliefWeb report counts + WHO DON bulletin counts | Chart renders baseline-only if feeds unavailable |
| Country breakdown table | Baseline + HDX HAPI (risk) + WHO GHO (IHR) + ReliefWeb/WHO mention counts | Falls back to baseline values, indicators show "—" |
| Response context | HDX HAPI (population, national risk, rainfall) + WHO GHO (IHR, doctors) + Open-Meteo (temperature, precipitation) | Each metric shows "—" independently if unavailable |
| Source status | Computed from API response success/failure | Always renders |
| Humanitarian reports feed | ReliefWeb API (POST, Ebola-related, 20 latest) | "No live report feed available" message |
| WHO official updates feed | WHO Disease Outbreak News API (filtered for Ebola/Sudan virus) | "No WHO outbreak bulletin available" message |
| Detailed analysis | Computed from all available data | Always renders with whatever data is available |

## Fallback behavior

All live data fetches use `Promise.allSettled` so a single source failure never crashes the dashboard.

**Cache strategy:**
- Feeds (ReliefWeb, WHO DON): 15-minute TTL with stale fallback
- Weather (Open-Meteo): 30-minute TTL with stale fallback
- Context (HDX HAPI, WHO GHO): 12-hour TTL with stale fallback
- Subnational (geoBoundaries, HDX rainfall ADM1): 12-hour TTL with stale fallback

**Stale-while-revalidate:** If a live fetch fails but a previous cached result exists (even expired), the stale cached data is served rather than showing empty state. Console warnings indicate when stale data is being used.

**Source status panel:** Shows LIVE/FALLBACK status for each source with an explicit error reason when a source fails (e.g., HTTP status code, malformed response).

## Known limitations

1. **ADM1 choropleth** is intentionally limited to South Sudan and Sudan where boundary names cleanly join to HDX admin1 data. Other countries (e.g., DRC) are excluded to avoid misleading partial maps.
2. **WHO DON API** response format may vary; the adapter handles both array and `{value: [...]}` shapes but may miss new format changes.
3. **Canvas chart** uses a fixed 300px height; very long timelines may compress horizontal detail.
4. **Weather data** is point-based (capital coordinates) and doesn't represent national weather distribution.
5. **Baseline data** is bundled and not automatically updated; live sources provide recency signals only.
6. **No offline support** — requires network for live data enrichment (baseline still renders).
7. **HDX pagination** caps at 50,000 rainfall rows per country to avoid excessive load times.

## Project structure

- `index.html` — dashboard shell
- `src/styles/` — separated base, layout, component styling
- `src/js/main.js` — app entry point, refresh orchestration
- `src/js/config.js` — endpoints, coordinates, country mappings
- `src/js/services/cacheService.js` — localStorage cache with stale fallback
- `src/js/services/dataService.js` — snapshot assembly, source status, insights
- `src/js/services/feedAdapters.js` — ReliefWeb + WHO DON normalization
- `src/js/services/contextAdapters.js` — HDX HAPI + WHO GHO context
- `src/js/services/weatherService.js` — Open-Meteo batch weather
- `src/js/services/subnationalService.js` — geoBoundaries + HDX ADM1 choropleth
- `src/js/ui/dashboard.js` — DOM rendering for KPIs, feeds, status, context
- `src/js/ui/mapView.js` — Leaflet map, markers, choropleth layer
- `src/js/ui/chart.js` — Canvas trend chart
- `src/js/ui/analysis.js` — insight list renderer
- `src/js/state/store.js` — simple in-memory state
- `src/js/utils/` — date, number, DOM helpers
- `src/data/ebola-2026-baseline.json` — baseline outbreak dataset
- `vercel.json` — static hosting config

## Run locally

Because ES modules are used, run through any static file server (not opening via `file://`).

Examples:

- VS Code Live Server extension
- Python: `python -m http.server 5173`
- Node: `npx serve .`

Then open `http://localhost:5173`.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import that repo in Vercel.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: leave empty (root static site).

Vercel will host this as a static app. The `vercel.json` sets `Cache-Control: public, max-age=300` for the bundled data files.

## Deploy to GitHub Pages

1. Go to Settings → Pages.
2. Source: Deploy from a branch.
3. Branch: `main`, folder: `/ (root)`.
4. The site will be available at `https://<user>.github.io/<repo>/`.

No build step is required.

## Notes on data quality

- Baseline country/timeline data is bundled in `src/data/ebola-2026-baseline.json`.
- Live report metadata is fetched from ReliefWeb when available.
- WHO official outbreak bulletins are fetched from the Disease Outbreak News API.
- HDX HAPI is used for contextual humanitarian indicators and national risk signals.
- WHO GHO OData is used for country-level capacity indicators such as IHR score and doctors per 10,000.
- Open-Meteo is used to overlay country-level weather conditions and 24-hour rainfall forecasts on the map.
- The trend chart now blends baseline epidemiological points with real-time reporting activity from ReliefWeb and WHO DON.
- geoBoundaries ADM1 polygons are joined to HDX rainfall anomaly data for supported countries to provide a subnational choropleth layer.
- Current ADM1 choropleth support is intentionally limited to countries where the boundary names and HDX admin coverage match cleanly enough to avoid misleading maps.
- For production epidemiology decisions, wire this to official ministry/WHO surveillance endpoints and your validated ETL pipeline.
