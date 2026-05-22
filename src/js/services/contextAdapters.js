import {
  GHO_INDICATORS,
  HDX_APP_IDENTIFIER,
  HDX_HAPI_BASE,
  WHO_GHO_BASE,
} from "../config.js";
import { withCache } from "./cacheService.js";

const HDX_CACHE_MS = 12 * 60 * 60 * 1000;
const GHO_CACHE_MS = 12 * 60 * 60 * 1000;

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function maxBy(items, selector) {
  return items.reduce((best, current) => {
    if (!best) {
      return current;
    }

    return new Date(selector(current)) > new Date(selector(best)) ? current : best;
  }, null);
}

async function fetchHdxJson(url) {
  const response = await fetch(url, {
    headers: {
      "X-HDX-HAPI-APP-IDENTIFIER": HDX_APP_IDENTIFIER,
    },
  });

  if (!response.ok) {
    throw new Error(`HDX request failed: HTTP ${response.status} for ${url.split("?")[0]}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error(`HDX returned malformed response for ${url.split("?")[0]}`);
  }

  return payload;
}

async function fetchHdxCountryContext(iso3) {
  try {
    const [populationPayload, riskPayload, rainfallPayload] = await Promise.all([
      fetchHdxJson(
        `${HDX_HAPI_BASE}/geography-infrastructure/baseline-population?location_code=${iso3}&admin_level=0&limit=100`,
      ),
      fetchHdxJson(
        `${HDX_HAPI_BASE}/coordination-context/national-risk?location_code=${iso3}&limit=10`,
      ),
      fetchHdxJson(`${HDX_HAPI_BASE}/climate/rainfall?location_code=${iso3}&limit=500`),
    ]);

    const populationRows = populationPayload?.data ?? [];
    const riskRows = riskPayload?.data ?? [];
    const rainfallRows = rainfallPayload?.data ?? [];
    const latestRisk = maxBy(riskRows, (entry) => entry.reference_period_end);
    const latestRainfallDate = rainfallRows.reduce((latest, entry) => {
      const current = new Date(entry.reference_period_end).getTime();
      return current > latest ? current : latest;
    }, 0);
    const latestRainfallRows = rainfallRows.filter(
      (entry) => new Date(entry.reference_period_end).getTime() === latestRainfallDate,
    );

    return {
      population: populationRows.reduce(
        (sum, entry) => sum + (Number(entry.population) || 0),
        0,
      ),
      nationalRisk: latestRisk
        ? {
            overallRisk: Number(latestRisk.overall_risk) || null,
            riskClass: latestRisk.risk_class ?? null,
            globalRank: Number(latestRisk.global_rank) || null,
            referencePeriodEnd: latestRisk.reference_period_end,
          }
        : null,
      rainfall: latestRainfallRows.length
        ? {
            rainfallAnomalyPct: average(
              latestRainfallRows.map((entry) => Number(entry.rainfall_anomaly_pct)),
            ),
            rainfall: average(latestRainfallRows.map((entry) => Number(entry.rainfall))),
            referencePeriodEnd: latestRainfallRows[0].reference_period_end,
          }
        : null,
    };
  } catch (error) {
    console.warn(`HDX context unavailable for ${iso3}.`, error);
    return {
      population: null,
      nationalRisk: null,
      rainfall: null,
    };
  }
}

export async function fetchHdxContexts(isoCodes) {
  const cacheKey = `hdx-context-${isoCodes.slice().sort().join("-")}`;

  return withCache(cacheKey, HDX_CACHE_MS, async () => {
    const entries = await Promise.all(
      isoCodes.map(async (iso3) => [iso3, await fetchHdxCountryContext(iso3)]),
    );

    return Object.fromEntries(entries);
  });
}

async function fetchGhoIndicator(indicator, isoCodes) {
  const filter = isoCodes.map((iso3) => `SpatialDim eq '${iso3}'`).join(" or ");
  const url = `${WHO_GHO_BASE}/${indicator.code}?$filter=${encodeURIComponent(filter)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`WHO GHO request failed: HTTP ${response.status} for ${indicator.code}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error(`WHO GHO returned malformed response for ${indicator.code}`);
  }

  const rows = Array.isArray(payload.value) ? payload.value : [];

  return isoCodes.reduce((acc, iso3) => {
    const countryRows = rows.filter((row) => row?.SpatialDim === iso3);
    const latestRow = countryRows.sort((a, b) => Number(b?.TimeDim ?? 0) - Number(a?.TimeDim ?? 0))[0];

    if (latestRow && Number.isFinite(Number(latestRow.NumericValue))) {
      acc[iso3] = {
        value: Number(latestRow.NumericValue),
        year: Number(latestRow.TimeDim),
      };
    }

    return acc;
  }, {});
}

export async function fetchWhoGhoContexts(isoCodes) {
  const cacheKey = `gho-context-${isoCodes.slice().sort().join("-")}`;

  return withCache(cacheKey, GHO_CACHE_MS, async () => {
    const indicatorMaps = await Promise.all(
      GHO_INDICATORS.map((indicator) => fetchGhoIndicator(indicator, isoCodes)),
    );

    const byCountry = isoCodes.reduce((acc, iso3) => {
      acc[iso3] = {};
      GHO_INDICATORS.forEach((indicator, index) => {
        const value = indicatorMaps[index]?.[iso3];
        if (value) {
          acc[iso3][indicator.key] = value.value;
          acc[iso3][`${indicator.key}Year`] = value.year;
        }
      });
      return acc;
    }, {});

    const indicatorsSummary = GHO_INDICATORS.map((indicator) => {
      const values = isoCodes
        .map((iso3) => byCountry[iso3]?.[indicator.key])
        .filter((value) => Number.isFinite(value));

      return {
        label: indicator.label,
        unit: indicator.unit,
        average: average(values),
        coverage: values.length,
      };
    });

    return {
      byCountry,
      indicatorsSummary,
    };
  });
}