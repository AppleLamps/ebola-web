import { MAP_BASE_VIEW } from "../config.js";

let markerLayer;
let weatherLayer;
let choroplethLayer;

function colorByRisk(riskLevel) {
  if (riskLevel === "high") {
    return "#ff5d5d";
  }

  if (riskLevel === "medium") {
    return "#ffc85f";
  }

  return "#55d69d";
}

function weatherHaloColor(rainSum) {
  if (!Number.isFinite(rainSum) || rainSum <= 0.2) {
    return "#4fc3f7";
  }

  if (rainSum < 5) {
    return "#29b6f6";
  }

  if (rainSum < 15) {
    return "#0288d1";
  }

  return "#01579b";
}

function weatherHaloRadius(rainSum) {
  if (!Number.isFinite(rainSum)) {
    return 10;
  }

  return Math.max(10, Math.min(28, 10 + rainSum * 0.9));
}

function choroplethColor(value) {
  if (!Number.isFinite(value)) {
    return "#213147";
  }

  if (value < 75) {
    return "#8c510a";
  }

  if (value < 95) {
    return "#d8b365";
  }

  if (value < 115) {
    return "#5ab4ac";
  }

  if (value < 135) {
    return "#3288bd";
  }

  return "#1d4e89";
}

function choroplethLabel(value) {
  if (!Number.isFinite(value)) {
    return "No matched rainfall record";
  }

  if (value < 75) {
    return "Much drier than baseline";
  }

  if (value < 95) {
    return "Slightly drier than baseline";
  }

  if (value < 115) {
    return "Near baseline";
  }

  if (value < 135) {
    return "Wetter than baseline";
  }

  return "Much wetter than baseline";
}

export function createMap(containerId) {
  const map = L.map(containerId).setView(MAP_BASE_VIEW.center, MAP_BASE_VIEW.zoom);

  map.createPane("choroplethPane");
  map.getPane("choroplethPane").style.zIndex = 320;
  map.createPane("weatherPane");
  map.getPane("weatherPane").style.zIndex = 410;
  map.createPane("markerPane");
  map.getPane("markerPane").style.zIndex = 430;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 9,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  weatherLayer = L.layerGroup().addTo(map);
  return map;
}

export function renderMapMarkers(map, countries) {
  if (!map || !markerLayer || !weatherLayer) {
    return;
  }

  markerLayer.clearLayers();
  weatherLayer.clearLayers();

  countries
    .filter((country) => Array.isArray(country.coordinates))
    .forEach((country) => {
      const weatherMarker = L.circleMarker(country.coordinates, {
        pane: "weatherPane",
        radius: weatherHaloRadius(country.forecastRainSum),
        fillColor: weatherHaloColor(country.forecastRainSum),
        fillOpacity: 0.15,
        color: weatherHaloColor(country.forecastRainSum),
        weight: 2,
      });
      weatherMarker.addTo(weatherLayer);

      const radius = Math.max(8, Math.sqrt(country.confirmed) * 1.1);
      const marker = L.circleMarker(country.coordinates, {
        pane: "markerPane",
        radius,
        fillColor: colorByRisk(country.riskLevel),
        fillOpacity: 0.6,
        color: "#f8fbff",
        weight: 1,
      });

      marker.bindPopup(`
        <strong>${country.name}</strong><br>
        Confirmed: ${country.confirmed}<br>
        Deaths: ${country.deaths}<br>
        Risk: ${country.riskLevel.toUpperCase()}<br>
        Recent reports: ${country.reportMentions}<br>
        WHO updates: ${country.whoMentions}<br>
        Temp: ${Number.isFinite(country.currentTemperature) ? `${country.currentTemperature.toFixed(1)}°C` : "n/a"}<br>
        Forecast rain (24h): ${Number.isFinite(country.forecastRainSum) ? `${country.forecastRainSum.toFixed(1)} mm` : "n/a"}
      `);
      marker.addTo(markerLayer);
    });

  weatherLayer.bringToFront();
  markerLayer.bringToFront();
}

export function renderSubnationalOverlay(map, overlay) {
  if (!map) {
    return;
  }

  if (choroplethLayer) {
    map.removeLayer(choroplethLayer);
    choroplethLayer = null;
  }

  if (!overlay?.available || !overlay.geojson?.features?.length) {
    return;
  }

  choroplethLayer = L.geoJSON(overlay.geojson, {
    pane: "choroplethPane",
    style: (feature) => ({
      fillColor: choroplethColor(feature?.properties?.rainfallAnomalyPct),
      fillOpacity: 0.45,
      color: "rgba(216, 232, 252, 0.72)",
      weight: 1,
      dashArray: feature?.properties?.rainfallJoinStatus === "missing" ? "4 4" : null,
    }),
    onEachFeature: (feature, layer) => {
      const value = feature?.properties?.rainfallAnomalyPct;
      layer.bindPopup(`
        <strong>${feature?.properties?.shapeName ?? "ADM1 region"}</strong><br>
        Rainfall anomaly: ${Number.isFinite(value) ? `${value.toFixed(1)}%` : "n/a"}<br>
        Status: ${choroplethLabel(value)}<br>
        Period end: ${feature?.properties?.rainfallObservedEnd ? feature.properties.rainfallObservedEnd.slice(0, 10) : "n/a"}
      `);
    },
  }).addTo(map);

  const bounds = choroplethLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds.pad(0.08));
  }

  weatherLayer?.bringToFront();
  markerLayer?.bringToFront();
}

export function clearSubnationalOverlay(map) {
  if (choroplethLayer && map) {
    map.removeLayer(choroplethLayer);
    choroplethLayer = null;
  }
}
