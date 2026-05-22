# 2026 Ebola Outbreak Dashboard (Vanilla JS)

A modular, static dashboard + map site designed for GitHub and Vercel hosting.

## What it includes

- Outbreak KPI cards (suspected, confirmed, deaths, CFR)
- Interactive map (Leaflet + OpenStreetMap)
- Country-level situation table with dynamic risk levels
- Trend chart drawn with Canvas API
- Detailed analysis panel generated from current metrics
- Live humanitarian report metadata integration via ReliefWeb (with graceful fallback)
- WHO Disease Outbreak News integration for official outbreak bulletins
- HDX HAPI context integration for population, rainfall, and national risk
- WHO GHO integration for emergency-capacity and workforce indicators
- Open-Meteo integration for live country weather overlays
- Unified timeline blending baseline cases with WHO and ReliefWeb reporting activity
- ADM1 choropleth overlays for countries where geoBoundaries and HDX rainfall anomaly data align cleanly

## Project structure

- `index.html` — dashboard shell
- `src/styles/` — separated base, layout, component styling
- `src/js/services/` — data fetching and enrichment
- `src/js/ui/` — map, chart, and dashboard render modules
- `src/data/ebola-2026-baseline.json` — baseline outbreak dataset
- `vercel.json` — static hosting config

## Run locally

Because ES modules are used, run through any static file server (not opening via file://).

Examples:

- VS Code Live Server extension
- Python: `python -m http.server 5173`

Then open `http://localhost:5173`.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import that repo in Vercel.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: leave empty (root static site).

Vercel will host this as a static app.

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
