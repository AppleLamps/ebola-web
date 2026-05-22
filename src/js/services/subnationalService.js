import {
  COUNTRY_ISO3,
  GEOBOUNDARIES_API_BASE,
  HDX_APP_IDENTIFIER,
  HDX_HAPI_BASE,
  SUBNATIONAL_OVERLAY_COUNTRIES,
} from "../config.js";
import { withCache } from "./cacheService.js";

const SUBNATIONAL_CACHE_MS = 12 * 60 * 60 * 1000;

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function latestRowByAdmin1(rows) {
  const byAdmin1 = new Map();

  rows.forEach((row) => {
    if (!row?.admin1_name || row.admin1_name === "Not provided") {
      return;
    }

    const key = normalizeName(row.admin1_name);
    const current = byAdmin1.get(key);
    if (!current) {
      byAdmin1.set(key, row);
      return;
    }

    const nextStamp = Date.parse(row.reference_period_end ?? row.reference_period_start ?? "");
    const currentStamp = Date.parse(current.reference_period_end ?? current.reference_period_start ?? "");
    if (nextStamp > currentStamp) {
      byAdmin1.set(key, row);
    }
  });

  return byAdmin1;
}

async function fetchGeoBoundariesAdm1(iso3) {
  return withCache(`geoboundaries-${iso3}-adm1`, SUBNATIONAL_CACHE_MS, async () => {
    const metadataResponse = await fetch(`${GEOBOUNDARIES_API_BASE}/${iso3}/ADM1/`);
    if (!metadataResponse.ok) {
      throw new Error(`geoBoundaries metadata fetch failed: HTTP ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();
    if (!metadata || !metadata.simplifiedGeometryGeoJSON) {
      throw new Error("geoBoundaries metadata missing geometry URL");
    }

    const geoJsonResponse = await fetch(metadata.simplifiedGeometryGeoJSON);
    if (!geoJsonResponse.ok) {
      throw new Error(`geoBoundaries geometry fetch failed: HTTP ${geoJsonResponse.status}`);
    }

    const geoJson = await geoJsonResponse.json();
    if (!geoJson || !Array.isArray(geoJson.features)) {
      throw new Error("geoBoundaries returned invalid GeoJSON");
    }

    return geoJson;
  });
}

async function fetchHdxAdmin1Rainfall(iso3) {
  return withCache(`hdx-rainfall-${iso3}-adm1`, SUBNATIONAL_CACHE_MS, async () => {
    const pageLimit = 10000;
    let allRows = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${HDX_HAPI_BASE}/climate/rainfall?location_code=${iso3}&admin_level=1&limit=${pageLimit}&offset=${offset}`,
        {
          headers: {
            "X-HDX-HAPI-APP-IDENTIFIER": HDX_APP_IDENTIFIER,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HDX admin rainfall fetch failed: HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        throw new Error("HDX admin rainfall returned malformed response");
      }

      const rows = Array.isArray(payload.data) ? payload.data : [];
      allRows = allRows.concat(rows);

      // Stop if we got fewer than the limit (no more pages) or exceeded 50k safety cap
      if (rows.length < pageLimit || allRows.length >= 50000) {
        hasMore = false;
      } else {
        offset += pageLimit;
      }
    }

    const byAdmin1 = latestRowByAdmin1(allRows);
    const latestReferenceEnd = [...byAdmin1.values()].reduce((latest, row) => {
      const stamp = Date.parse(row.reference_period_end ?? row.reference_period_start ?? "");
      if (!latest || stamp > latest.stamp) {
        return {
          stamp,
          value: row.reference_period_end ?? row.reference_period_start ?? null,
        };
      }

      return latest;
    }, null);

    return {
      byAdmin1,
      latestReferenceEnd: latestReferenceEnd?.value ?? null,
      totalRowsFetched: allRows.length,
    };
  });
}

function summarize(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return {
      min: null,
      max: null,
      average: null,
    };
  }

  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    average: valid.reduce((sum, value) => sum + value, 0) / valid.length,
  };
}

export function getSubnationalOverlayOptions(countries) {
  return countries
    .filter((country) => SUBNATIONAL_OVERLAY_COUNTRIES[country.name])
    .map((country) => ({
      label: SUBNATIONAL_OVERLAY_COUNTRIES[country.name].label,
      value: country.name,
      iso3: COUNTRY_ISO3[country.name],
    }));
}

export async function fetchSubnationalRainfallOverlay(countryName) {
  const countryConfig = SUBNATIONAL_OVERLAY_COUNTRIES[countryName];
  const iso3 = COUNTRY_ISO3[countryName];

  if (!countryConfig || !iso3) {
    return {
      available: false,
      countryName,
      message: "No ADM1 rainfall choropleth is configured for this country yet.",
    };
  }

  const [geoJson, rainfall] = await Promise.all([
    fetchGeoBoundariesAdm1(iso3),
    fetchHdxAdmin1Rainfall(iso3),
  ]);

  const ignoredNames = new Set(
    (countryConfig.ignoredBoundaryNames ?? []).map((name) => normalizeName(name)),
  );
  const aliasEntries = Object.entries(countryConfig.boundaryNameAliases ?? {}).reduce(
    (acc, [boundaryName, hdxName]) => {
      acc[normalizeName(boundaryName)] = normalizeName(hdxName);
      return acc;
    },
    {},
  );

  let totalRegions = 0;
  let matchedRegions = 0;

  const features = (geoJson.features ?? []).map((feature) => {
    const shapeName = feature?.properties?.shapeName ?? "Unknown region";
    const normalizedShapeName = normalizeName(shapeName);
    const ignored = ignoredNames.has(normalizedShapeName);
    const joinKey = aliasEntries[normalizedShapeName] ?? normalizedShapeName;
    const rainfallRow = ignored ? null : rainfall.byAdmin1.get(joinKey);
    const rainfallAnomalyPct = Number(rainfallRow?.rainfall_anomaly_pct);

    if (!ignored) {
      totalRegions += 1;
    }

    if (!ignored && Number.isFinite(rainfallAnomalyPct)) {
      matchedRegions += 1;
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        rainfallAnomalyPct: Number.isFinite(rainfallAnomalyPct) ? rainfallAnomalyPct : null,
        rainfallObservedEnd: rainfallRow?.reference_period_end ?? null,
        rainfallObservedStart: rainfallRow?.reference_period_start ?? null,
        rainfallJoinStatus: ignored ? "ignored" : rainfallRow ? "matched" : "missing",
        matchedAdmin1Name: rainfallRow?.admin1_name ?? null,
      },
    };
  });

  const summary = summarize(features.map((feature) => feature.properties.rainfallAnomalyPct));

  return {
    available: matchedRegions > 0,
    countryName,
    iso3,
    metricLabel: "Rainfall anomaly vs long-term average",
    units: "%",
    latestReferenceEnd: rainfall.latestReferenceEnd,
    matchedRegions,
    totalRegions,
    coveragePct: totalRegions ? (matchedRegions / totalRegions) * 100 : 0,
    summary,
    geojson: {
      ...geoJson,
      features,
    },
    message:
      matchedRegions > 0
        ? `${matchedRegions}/${totalRegions} ADM1 areas joined to the latest HDX rainfall anomaly records.`
        : "No ADM1 rainfall records could be joined to the geoBoundaries layer.",
  };
}