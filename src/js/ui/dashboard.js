import { formatDateTime, toIsoDay } from "../utils/date.js";
import { formatCompact, formatDecimal, formatInt, formatPct } from "../utils/number.js";
import { text } from "../utils/dom.js";

function badgeClass(level) {
  if (level === "high") {
    return "badge badge-high";
  }

  if (level === "medium") {
    return "badge badge-medium";
  }

  return "badge badge-low";
}

export function renderKpis(snapshot) {
  text("kpi-suspected", formatInt(snapshot.totals.suspected));
  text("kpi-confirmed", formatInt(snapshot.totals.confirmed));
  text("kpi-deaths", formatInt(snapshot.totals.deaths));
  text("kpi-cfr", formatPct(snapshot.totals.cfr));

  text(
    "last-updated",
    `Last updated: ${formatDateTime(snapshot.meta.fetchedAt)} (UTC)`,
  );
}

export function renderCountryTable(snapshot) {
  const body = document.getElementById("country-table-body");
  if (!body) {
    return;
  }

  body.innerHTML = snapshot.countries
    .sort((a, b) => b.confirmed - a.confirmed)
    .map(
      (country) => `
      <tr>
        <td>${country.name}</td>
        <td>${formatInt(country.suspected)}</td>
        <td>${formatInt(country.confirmed)}</td>
        <td>${formatInt(country.deaths)}</td>
        <td><span class="${badgeClass(country.riskLevel)}">${country.riskLevel.toUpperCase()}</span></td>
        <td>${country.reportMentions}</td>
        <td>${country.whoMentions}</td>
        <td>${Number.isFinite(country.ihrScore) ? formatDecimal(country.ihrScore, 0) : "—"}</td>
      </tr>
    `,
    )
    .join("");
}

export function renderFeed(snapshot) {
  const feed = document.getElementById("reports-feed");
  if (!feed) {
    return;
  }

  if (!snapshot.reports.length) {
    feed.innerHTML =
      "<li>No live report feed available right now. Displaying baseline outbreak dataset only.</li>";
    return;
  }

  feed.innerHTML = snapshot.reports
    .slice(0, 8)
    .map(
      (item) => `
      <li>
        <span class="feed-date">${toIsoDay(item.publishedAt)}</span>
        <a href="${item.url}" target="_blank" rel="noreferrer noopener">${item.title}</a>
        <span class="muted"> — ${item.source}</span>
      </li>
    `,
    )
    .join("");
}

export function renderOfficialFeed(snapshot) {
  const feed = document.getElementById("official-feed");
  if (!feed) {
    return;
  }

  if (!snapshot.officialReports.length) {
    feed.innerHTML =
      "<li>No WHO outbreak bulletin is available right now. The dashboard is still using local and humanitarian sources.</li>";
    return;
  }

  feed.innerHTML = snapshot.officialReports
    .slice(0, 6)
    .map(
      (item) => `
      <li>
        <span class="feed-date">${toIsoDay(item.publishedAt)}</span>
        <a href="${item.url}" target="_blank" rel="noreferrer noopener">${item.title}</a>
        <span class="muted"> — WHO Disease Outbreak News</span>
      </li>
    `,
    )
    .join("");
}

export function renderContextSummary(snapshot) {
  text("ctx-population", formatCompact(snapshot.contextSummary.populationTotal));
  text(
    "ctx-risk",
    Number.isFinite(snapshot.contextSummary.avgRisk)
      ? `${formatDecimal(snapshot.contextSummary.avgRisk, 1)} / 10`
      : "—",
  );
  text(
    "ctx-rainfall",
    Number.isFinite(snapshot.contextSummary.avgRainfallAnomaly)
      ? formatPct(snapshot.contextSummary.avgRainfallAnomaly, 0)
      : "—",
  );
  text(
    "ctx-doctors",
    Number.isFinite(snapshot.contextSummary.avgDoctors)
      ? formatDecimal(snapshot.contextSummary.avgDoctors, 2)
      : "—",
  );
  text(
    "ctx-temp",
    Number.isFinite(snapshot.contextSummary.avgCurrentTemp)
      ? `${formatDecimal(snapshot.contextSummary.avgCurrentTemp, 1)}°C`
      : "—",
  );
  text(
    "ctx-weather-rain",
    Number.isFinite(snapshot.contextSummary.avgForecastRain)
      ? `${formatDecimal(snapshot.contextSummary.avgForecastRain, 1)} mm`
      : "—",
  );

  const list = document.getElementById("indicator-summary-list");
  if (!list) {
    return;
  }

  list.innerHTML = snapshot.contextSummary.indicatorSummary
    .map(
      (indicator) => `
      <li>
        <strong>${indicator.label}:</strong>
        ${Number.isFinite(indicator.average) ? formatDecimal(indicator.average, indicator.unit === "per 10,000" ? 2 : 1) : "—"}
        <span class="muted">${indicator.unit ? ` ${indicator.unit}` : ""} · coverage ${indicator.coverage}</span>
      </li>
    `,
    )
    .join("");
}

export function renderSourceStatus(snapshot) {
  const container = document.getElementById("sources-list");
  if (!container) {
    return;
  }

  container.innerHTML = snapshot.sources
    .map(
      (source) => `
      <article class="source-card">
        <h3>${source.name}</h3>
        <p>${source.detail}</p>
        <span class="status-badge ${source.status === "live" ? "status-live" : "status-fallback"}">
          ${source.status === "live" ? "LIVE" : "FALLBACK"}
        </span>
      </article>
    `,
    )
    .join("");
}

export function renderSubnationalOptions(options, selectedValue) {
  const select = document.getElementById("choropleth-country");
  if (!select) {
    return;
  }

  select.innerHTML = [
    '<option value="">No ADM1 choropleth</option>',
    ...options.map(
      (option) =>
        `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`,
    ),
  ].join("");
}

export function renderSubnationalStatus(overlay) {
  const status = document.getElementById("choropleth-status");
  if (!status) {
    return;
  }

  if (!overlay) {
    status.textContent = "ADM1 rainfall choropleth is available for countries with clean HDX + geoBoundaries joins. Other countries are not yet supported due to data alignment requirements.";
    return;
  }

  if (overlay.loading) {
    status.textContent = "Loading ADM1 rainfall anomaly boundaries...";
    return;
  }

  if (!overlay.available) {
    status.textContent = overlay.message || "ADM1 rainfall data could not be loaded for this country. This may be due to incomplete data coverage or API availability.";
    return;
  }

  const average = Number.isFinite(overlay.summary?.average)
    ? `${formatDecimal(overlay.summary.average, 1)}% avg`
    : "avg n/a";
  const periodEnd = overlay.latestReferenceEnd ? toIsoDay(overlay.latestReferenceEnd) : "n/a";
  const coverage = overlay.totalRegions
    ? ` · ${Math.round(overlay.coveragePct)}% region coverage`
    : "";
  status.textContent = `${overlay.countryName}: ${overlay.message} ${average}${coverage} · latest dekad end ${periodEnd}.`;
}
