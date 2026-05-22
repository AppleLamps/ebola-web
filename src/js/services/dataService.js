import { COUNTRY_COORDS, COUNTRY_ISO3 } from "../config.js";
import { fetchHdxContexts, fetchWhoGhoContexts } from "./contextAdapters.js";
import { fetchReliefWebReports, fetchWhoDiseaseOutbreakNews } from "./feedAdapters.js";
import { fetchWeatherContexts } from "./weatherService.js";
import { toIsoDay } from "../utils/date.js";

function toNumber(value) {
  return Number(value) || 0;
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function categorizeRisk(score) {
  if (score >= 700) {
    return "high";
  }

  if (score >= 240) {
    return "medium";
  }

  return "low";
}

function countCountryMentions(reportItems, countryName) {
  return reportItems.filter((item) =>
    (item.countries ?? []).some(
      (country) => country.toLowerCase() === countryName.toLowerCase(),
    ),
  ).length;
}

function computeTotals(countries) {
  const totals = countries.reduce(
    (acc, country) => {
      acc.suspected += toNumber(country.suspected);
      acc.confirmed += toNumber(country.confirmed);
      acc.deaths += toNumber(country.deaths);
      return acc;
    },
    {
      suspected: 0,
      confirmed: 0,
      deaths: 0,
      cfr: 0,
    },
  );

  totals.cfr = totals.confirmed > 0 ? (totals.deaths / totals.confirmed) * 100 : 0;
  return totals;
}

function buildContextSummary(countries, indicatorSummary) {
  return {
    populationTotal: countries.reduce(
      (sum, country) => sum + (Number(country.population) || 0),
      0,
    ),
    avgRisk: average(countries.map((country) => country.nationalRisk)),
    avgRainfallAnomaly: average(countries.map((country) => country.rainfallAnomaly)),
    avgDoctors: average(countries.map((country) => country.doctorsPer10k)),
    avgIhr: average(countries.map((country) => country.ihrScore)),
    avgCurrentTemp: average(countries.map((country) => country.currentTemperature)),
    avgForecastRain: average(countries.map((country) => country.forecastRainSum)),
    indicatorSummary,
  };
}

function buildSources({ reports, officialReports, hdxContexts, ghoContext, weatherByCountry, countries, errors }) {
  const hdxCoverage = countries.filter((country) => {
    const context = hdxContexts[country.iso3];
    return context?.nationalRisk || context?.population || context?.rainfall;
  }).length;
  const ghoCoverage = countries.filter((country) => {
    const context = ghoContext.byCountry[country.iso3] ?? {};
    return Number.isFinite(context.ihrScore) || Number.isFinite(context.doctorsPer10k);
  }).length;
  const weatherCoverage = countries.filter((country) => weatherByCountry[country.name]).length;

  return [
    {
      name: "ReliefWeb",
      status: reports.length ? "live" : "fallback",
      detail: reports.length
        ? `${reports.length} humanitarian reports ingested.`
        : errors.reliefweb
          ? `Unavailable: ${errors.reliefweb}`
          : "No live results returned; baseline dataset still available.",
    },
    {
      name: "WHO Disease Outbreak News",
      status: officialReports.length ? "live" : "fallback",
      detail: officialReports.length
        ? `${officialReports.length} official Ebola / Sudan virus updates loaded.`
        : errors.whoDon
          ? `Unavailable: ${errors.whoDon}`
          : "Official WHO outbreak bulletins unavailable at refresh time.",
    },
    {
      name: "HDX HAPI",
      status: hdxCoverage ? "live" : "fallback",
      detail: hdxCoverage
        ? `${hdxCoverage}/${countries.length} tracked countries returned risk, rainfall, or population context.`
        : errors.hdx
          ? `Unavailable: ${errors.hdx}`
          : `0/${countries.length} tracked countries returned context data.`,
    },
    {
      name: "WHO GHO",
      status: ghoCoverage ? "live" : "fallback",
      detail: ghoCoverage
        ? `${ghoCoverage}/${countries.length} tracked countries returned official capacity indicators.`
        : errors.gho
          ? `Unavailable: ${errors.gho}`
          : `0/${countries.length} tracked countries returned capacity indicators.`,
    },
    {
      name: "Open-Meteo",
      status: weatherCoverage ? "live" : "fallback",
      detail: weatherCoverage
        ? `${weatherCoverage}/${countries.length} tracked countries returned live weather overlay data.`
        : errors.weather
          ? `Unavailable: ${errors.weather}`
          : `0/${countries.length} tracked countries returned weather data.`,
    },
  ];
}

function buildUnifiedTimeline(timeline, reports, officialReports) {
  const baselineMap = new Map(
    timeline.map((point) => [point.date, { ...point, humanitarianCount: 0, whoCount: 0 }]),
  );
  const reportCounts = new Map();
  const whoCounts = new Map();

  reports.forEach((item) => {
    const day = toIsoDay(item.publishedAt);
    if (!day) {
      return;
    }

    reportCounts.set(day, (reportCounts.get(day) ?? 0) + 1);
  });

  officialReports.forEach((item) => {
    const day = toIsoDay(item.publishedAt);
    if (!day) {
      return;
    }

    whoCounts.set(day, (whoCounts.get(day) ?? 0) + 1);
  });

  const allDays = new Set([
    ...baselineMap.keys(),
    ...reportCounts.keys(),
    ...whoCounts.keys(),
  ]);

  const sortedDays = [...allDays].sort();
  let lastConfirmed = 0;
  let lastSuspected = 0;
  let lastDeaths = 0;

  return sortedDays.map((day) => {
    const baseline = baselineMap.get(day);
    if (baseline) {
      lastConfirmed = baseline.confirmed;
      lastSuspected = baseline.suspected;
      lastDeaths = baseline.deaths;
    }

    return {
      date: day,
      suspected: lastSuspected,
      confirmed: lastConfirmed,
      deaths: lastDeaths,
      humanitarianCount: reportCounts.get(day) ?? 0,
      whoCount: whoCounts.get(day) ?? 0,
    };
  });
}

function buildInsights({ countries, totals, timeline, reports, officialReports, advisories, contextSummary }) {
  const sortedByConfirmed = [...countries].sort((a, b) => b.confirmed - a.confirmed);
  const top = sortedByConfirmed.slice(0, 3).map((entry) => entry.name);

  const latestPoint = timeline.at(-1);
  const previousPoint = timeline.at(-2);
  const confirmedGrowth = previousPoint
    ? latestPoint.confirmed - previousPoint.confirmed
    : latestPoint.confirmed;

  return [
    `${top.join(", ")} account for the heaviest confirmed burden and should remain priority response corridors.`,
    `Confirmed cases changed by ${confirmedGrowth >= 0 ? "+" : ""}${confirmedGrowth} in the latest reporting window, with current case fatality at ${totals.cfr.toFixed(1)}%.`,
    `Monitoring pipeline ingested ${reports.length} recent humanitarian intelligence reports to support operational targeting.`,
    `WHO Disease Outbreak News contributed ${officialReports.length} official Ebola-related bulletins, while HDX context suggests an average national risk score of ${(contextSummary.avgRisk ?? 0).toFixed(1)} out of 10 across monitored countries.`,
    `WHO GHO metadata indicates an average IHR core capacity score of ${(contextSummary.avgIhr ?? 0).toFixed(1)} and ${(contextSummary.avgDoctors ?? 0).toFixed(2)} medical doctors per 10,000 across available country records.`,
    ...advisories,
  ];
}

function latestAvailable(value) {
  return Number.isFinite(value) ? value : null;
}

function getSettledValue(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

function getSettledError(result) {
  if (result.status === "rejected") {
    const msg = result.reason?.message ?? String(result.reason ?? "Unknown error");
    return msg;
  }
  return null;
}

async function getBaseline() {
  const response = await fetch("./src/data/ebola-2026-baseline.json");
  if (!response.ok) {
    throw new Error(`Failed to load baseline data: ${response.status}`);
  }

  return response.json();
}

export async function getOutbreakSnapshot() {
  const baseline = await getBaseline();
  const isoCodes = baseline.countries
    .map((country) => COUNTRY_ISO3[country.name])
    .filter(Boolean);

  const [reportsResult, officialReportsResult, hdxResult, ghoResult, weatherResult] = await Promise.allSettled([
    fetchReliefWebReports(),
    fetchWhoDiseaseOutbreakNews(),
    fetchHdxContexts(isoCodes),
    fetchWhoGhoContexts(isoCodes),
    fetchWeatherContexts(baseline.countries),
  ]);

  const reports = getSettledValue(reportsResult, []);
  const officialReports = getSettledValue(officialReportsResult, []);
  const hdxContexts = getSettledValue(hdxResult, {});
  const ghoContext = getSettledValue(ghoResult, {
    byCountry: {},
    indicatorsSummary: [],
  });
  const weatherByCountry = getSettledValue(weatherResult, {});

  const errors = {
    reliefweb: getSettledError(reportsResult),
    whoDon: getSettledError(officialReportsResult),
    hdx: getSettledError(hdxResult),
    gho: getSettledError(ghoResult),
    weather: getSettledError(weatherResult),
  };

  const countries = baseline.countries.map((country) => {
    const iso3 = COUNTRY_ISO3[country.name] ?? null;
    const hdx = iso3 ? hdxContexts[iso3] ?? {} : {};
    const gho = iso3 ? ghoContext.byCountry[iso3] ?? {} : {};
    const reportMentions = countCountryMentions(reports, country.name);
    const whoMentions = countCountryMentions(officialReports, country.name);
    const weather = weatherByCountry[country.name] ?? {};
    const score = clamp(
      toNumber(country.confirmed) * 0.9 +
        toNumber(country.suspected) * 0.2 +
        toNumber(country.deaths) * 1.4 +
        reportMentions * 25 +
        whoMentions * 35 +
        toNumber(hdx?.nationalRisk?.overallRisk) * 20,
      0,
      1000,
    );

    return {
      ...country,
      iso3,
      reportMentions,
      whoMentions,
      riskScore: Math.round(score),
      riskLevel: categorizeRisk(score),
      coordinates: COUNTRY_COORDS[country.name] ?? null,
      population: latestAvailable(hdx?.population),
      nationalRisk: latestAvailable(hdx?.nationalRisk?.overallRisk),
      rainfallAnomaly: latestAvailable(hdx?.rainfall?.rainfallAnomalyPct),
      ihrScore: latestAvailable(gho?.ihrScore),
      ihrScoreYear: latestAvailable(gho?.ihrScoreYear),
      doctorsPer10k: latestAvailable(gho?.doctorsPer10k),
      doctorsPer10kYear: latestAvailable(gho?.doctorsPer10kYear),
      currentTemperature: latestAvailable(weather.currentTemperature),
      currentPrecipitation: latestAvailable(weather.currentPrecipitation),
      cloudCover: latestAvailable(weather.cloudCover),
      windSpeed: latestAvailable(weather.windSpeed),
      forecastRainSum: latestAvailable(weather.forecastRainSum),
      forecastMaxTemp: latestAvailable(weather.forecastMaxTemp),
      forecastMinTemp: latestAvailable(weather.forecastMinTemp),
      weatherCode: latestAvailable(weather.weatherCode),
      weatherObservedAt: weather.observedAt ?? null,
    };
  });

  const totals = computeTotals(countries);
  const contextSummary = buildContextSummary(countries, ghoContext.indicatorsSummary);
  const unifiedTimeline = buildUnifiedTimeline(baseline.timeline, reports, officialReports);
  const sources = buildSources({
    reports,
    officialReports,
    hdxContexts,
    ghoContext,
    weatherByCountry,
    countries,
    errors,
  });

  return {
    meta: {
      ...baseline.meta,
      liveReportsAvailable: reports.length > 0,
      liveOfficialReportsAvailable: officialReports.length > 0,
      fetchedAt: new Date().toISOString(),
    },
    countries,
    totals,
    timeline: baseline.timeline,
    unifiedTimeline,
    reports,
    officialReports,
    contextSummary,
    sources,
    insights: buildInsights({
      countries,
      totals,
      timeline: baseline.timeline,
      reports,
      officialReports,
      advisories: baseline.advisories,
      contextSummary,
    }),
  };
}
