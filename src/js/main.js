import { REFRESH_INTERVAL_MS } from "./config.js";
import { getOutbreakSnapshot } from "./services/dataService.js";
import {
  fetchSubnationalRainfallOverlay,
  getSubnationalOverlayOptions,
} from "./services/subnationalService.js";
import { setSnapshot } from "./state/store.js";
import { renderAnalysis } from "./ui/analysis.js";
import { renderTrendChart } from "./ui/chart.js";
import {
  renderContextSummary,
  renderCountryTable,
  renderFeed,
  renderKpis,
  renderOfficialFeed,
  renderSourceStatus,
  renderSubnationalOptions,
  renderSubnationalStatus,
} from "./ui/dashboard.js";
import { clearSubnationalOverlay, createMap, renderMapMarkers, renderSubnationalOverlay } from "./ui/mapView.js";

const map = createMap("map");
const trendCanvas = document.getElementById("trend-canvas");
const analysisList = document.getElementById("analysis-list");
const statusLine = document.getElementById("status-line");
const refreshButton = document.getElementById("refresh-btn");
const choroplethSelect = document.getElementById("choropleth-country");

let selectedChoroplethCountry = "";
let choroplethRequestId = 0;

function syncSubnationalOptions(snapshot) {
  const options = getSubnationalOverlayOptions(snapshot.countries);
  const hasSelectedOption = options.some((option) => option.value === selectedChoroplethCountry);

  if (!hasSelectedOption) {
    selectedChoroplethCountry = options[0]?.value ?? "";
  }

  renderSubnationalOptions(options, selectedChoroplethCountry);
}

async function refreshSubnationalOverlay() {
  const currentRequestId = ++choroplethRequestId;

  if (!selectedChoroplethCountry) {
    clearSubnationalOverlay(map);
    renderSubnationalStatus(null);
    return;
  }

  renderSubnationalStatus({ loading: true });

  try {
    const overlay = await fetchSubnationalRainfallOverlay(selectedChoroplethCountry);
    if (currentRequestId !== choroplethRequestId) {
      return;
    }

    renderSubnationalOverlay(map, overlay);
    renderSubnationalStatus(overlay);
  } catch (error) {
    console.error(error);
    if (currentRequestId !== choroplethRequestId) {
      return;
    }

    clearSubnationalOverlay(map);
    renderSubnationalStatus({
      available: false,
      message: "ADM1 rainfall overlay could not be loaded right now.",
    });
  }
}

async function refreshDashboard() {
  statusLine.textContent = "Refreshing outbreak intelligence feed...";

  try {
    const snapshot = await getOutbreakSnapshot();
    setSnapshot(snapshot);

    renderKpis(snapshot);
    renderCountryTable(snapshot);
    renderFeed(snapshot);
    renderOfficialFeed(snapshot);
    renderContextSummary(snapshot);
    renderSourceStatus(snapshot);
    renderAnalysis(analysisList, snapshot.insights);
    renderMapMarkers(map, snapshot.countries);
    renderTrendChart(trendCanvas, snapshot.unifiedTimeline);
    syncSubnationalOptions(snapshot);
    await refreshSubnationalOverlay();

    statusLine.textContent = `${snapshot.sources.filter((source) => source.status === "live").length}/${snapshot.sources.length} live intelligence sources connected.`;
  } catch (error) {
    console.error(error);
    statusLine.textContent = "Data refresh failed. Please try again.";
  }
}

refreshButton?.addEventListener("click", () => {
  refreshDashboard();
});

choroplethSelect?.addEventListener("change", async (event) => {
  selectedChoroplethCountry = event.target.value;
  await refreshSubnationalOverlay();
});

refreshDashboard();
setInterval(refreshDashboard, REFRESH_INTERVAL_MS);
