import { OPEN_METEO_ENDPOINT } from "../config.js";
import { withCache } from "./cacheService.js";

const WEATHER_CACHE_MS = 30 * 60 * 1000;

function buildBatchUrl(countries) {
  const latitude = countries.map((country) => country.coordinates[0]).join(",");
  const longitude = countries.map((country) => country.coordinates[1]).join(",");

  return `${OPEN_METEO_ENDPOINT}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,weather_code&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
}

function normalizeWeatherEntry(entry) {
  return {
    currentTemperature: Number(entry?.current?.temperature_2m),
    currentPrecipitation: Number(entry?.current?.precipitation),
    cloudCover: Number(entry?.current?.cloud_cover),
    windSpeed: Number(entry?.current?.wind_speed_10m),
    weatherCode: Number(entry?.current?.weather_code),
    forecastRainSum: Number(entry?.daily?.precipitation_sum?.[0]),
    forecastMaxTemp: Number(entry?.daily?.temperature_2m_max?.[0]),
    forecastMinTemp: Number(entry?.daily?.temperature_2m_min?.[0]),
    observedAt: entry?.current?.time ?? null,
    timezone: entry?.timezone ?? null,
  };
}

export async function fetchWeatherContexts(countries) {
  const weatherCountries = countries.filter(
    (country) => Array.isArray(country.coordinates) && country.coordinates.length >= 2,
  );
  const cacheKey = `weather-${weatherCountries.map((country) => country.name).join("-")}`;

  return withCache(cacheKey, WEATHER_CACHE_MS, async () => {
    if (!weatherCountries.length) {
      return {};
    }

    const response = await fetch(buildBatchUrl(weatherCountries));
    if (!response.ok) {
      throw new Error(`Open-Meteo fetch failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || (typeof payload !== "object" && !Array.isArray(payload))) {
      throw new Error("Open-Meteo returned malformed response body");
    }

    const list = Array.isArray(payload) ? payload : [payload];

    return weatherCountries.reduce((acc, country, index) => {
      if (list[index]) {
        acc[country.name] = normalizeWeatherEntry(list[index]);
      }
      return acc;
    }, {});
  });
}