export const APP_TITLE = "2026 Ebola Outbreak Tracker";
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export const RELIEFWEB_ENDPOINT =
  "https://api.reliefweb.int/v1/reports?appname=2026-ebola-dashboard";
export const WHO_DON_ENDPOINT = "https://www.who.int/api/news/diseaseoutbreaknews";
export const WHO_GHO_BASE = "https://ghoapi.azureedge.net/api";
export const HDX_HAPI_BASE = "https://hapi.humdata.org/api/v2";
export const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const GEOBOUNDARIES_API_BASE = "https://www.geoboundaries.org/api/current/gbOpen";
export const HDX_APP_IDENTIFIER =
  "MjAyNiBFYm9sYSBEYXNoYm9hcmQ6ZGVtb0BleGFtcGxlLmNvbQ==";

export const COUNTRY_COORDS = {
  "Democratic Republic of the Congo": [-2.88, 23.65],
  Uganda: [1.37, 32.29],
  Sudan: [12.86, 30.22],
  "South Sudan": [6.88, 31.31],
  Rwanda: [-1.94, 29.87],
  Kenya: [-0.02, 37.9],
  Tanzania: [-6.37, 34.88],
  Guinea: [9.95, -9.7],
  "Sierra Leone": [8.46, -11.78],
  Liberia: [6.42, -9.43],
  Congo: [-0.84, 15.22],
  Nigeria: [9.08, 8.68],
};

export const COUNTRY_ISO3 = {
  "Democratic Republic of the Congo": "COD",
  Uganda: "UGA",
  "South Sudan": "SSD",
  Sudan: "SDN",
  Rwanda: "RWA",
  Kenya: "KEN",
  Tanzania: "TZA",
  Guinea: "GIN",
  "Sierra Leone": "SLE",
  Liberia: "LBR",
  Congo: "COG",
  Nigeria: "NGA",
};

export const COUNTRY_ALIASES = {
  "Democratic Republic of the Congo": [
    "democratic republic of the congo",
    "democratic republic of congo",
    "dr congo",
    "drc",
  ],
  Uganda: ["uganda"],
  "South Sudan": ["south sudan"],
  Sudan: ["the sudan", "republic of the sudan"],
  Rwanda: ["rwanda"],
  Kenya: ["kenya"],
  Tanzania: ["tanzania"],
  Guinea: ["guinea"],
  "Sierra Leone": ["sierra leone"],
  Liberia: ["liberia"],
  Congo: ["republic of the congo", "congo-brazzaville"],
  Nigeria: ["nigeria"],
};

export const GHO_INDICATORS = [
  {
    key: "ihrScore",
    code: "SDGIHR",
    label: "WHO IHR core capacity",
    unit: "/100",
  },
  {
    key: "doctorsPer10k",
    code: "HWF_0001",
    label: "Medical doctors",
    unit: "per 10,000",
  },
];

export const MAP_BASE_VIEW = {
  center: [4.5, 18],
  zoom: 4,
};

export const SUBNATIONAL_OVERLAY_COUNTRIES = {
  "South Sudan": {
    label: "South Sudan",
    ignoredBoundaryNames: [],
    boundaryNameAliases: {},
  },
  Sudan: {
    label: "Sudan",
    ignoredBoundaryNames: ["Abyei PCA"],
    boundaryNameAliases: {
      Gezira: "Aj Jazirah",
    },
  },
};
