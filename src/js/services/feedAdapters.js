import {
  COUNTRY_ALIASES,
  RELIEFWEB_ENDPOINT,
  WHO_DON_ENDPOINT,
} from "../config.js";
import { withCache } from "./cacheService.js";

const FEED_CACHE_MS = 15 * 60 * 1000;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeReliefWebItem(item) {
  const fields = item?.fields ?? {};
  const source = fields?.source?.[0]?.name ?? "Unknown source";
  const countries = unique((fields?.country ?? []).map((entry) => entry?.name));
  const urlAlias = fields?.url_alias;
  const url = urlAlias
    ? `https://reliefweb.int/report/${urlAlias}`
    : fields?.url ?? "https://reliefweb.int";

  return {
    id: item?.id ?? crypto.randomUUID(),
    title: fields?.title ?? "Untitled outbreak report",
    source,
    countries,
    publishedAt: fields?.date?.created ?? new Date().toISOString(),
    url,
    sourceType: "reliefweb",
  };
}

function htmlToText(value) {
  if (!value) {
    return "";
  }

  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(value, "text/html");
    return parsed.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCountriesFromWhoItem(title, summary, overview) {
  const text = `${title} ${summary} ${overview}`.toLowerCase();
  const trailingSegment = title.split(/[–-]/).at(-1)?.trim().toLowerCase() ?? "";

  return Object.entries(COUNTRY_ALIASES)
    .filter(([countryName, aliases]) => {
      if (trailingSegment === countryName.toLowerCase()) {
        return true;
      }

      return aliases.some((alias) => text.includes(alias));
    })
    .map(([countryName]) => countryName);
}

function normalizeWhoDonItem(item) {
  const title = item?.Title ?? item?.OverrideTitle ?? "Untitled WHO update";
  const summary = htmlToText(item?.Summary);
  const overview = htmlToText(item?.Overview);
  const publishedAt = item?.PublicationDateAndTime ?? item?.PublicationDate ?? new Date().toISOString();
  const slug = item?.DonId || item?.UrlName || item?.ItemDefaultUrl?.replace(/^\//, "");

  return {
    id: item?.Id ?? crypto.randomUUID(),
    title,
    summary,
    source: "WHO Disease Outbreak News",
    countries: extractCountriesFromWhoItem(title, summary, overview),
    publishedAt,
    url: slug
      ? `https://www.who.int/emergencies/disease-outbreak-news/item/${slug}`
      : "https://www.who.int/emergencies/disease-outbreak-news",
    sourceType: "who-don",
  };
}

export async function fetchReliefWebReports() {
  return withCache("feed-reliefweb", FEED_CACHE_MS, async () => {
    const body = {
      query: {
        value: "ebola OR ebolavirus OR viral hemorrhagic fever",
      },
      fields: {
        include: ["title", "source.name", "country.name", "date.created", "url_alias"],
      },
      sort: ["date.created:desc"],
      limit: 20,
    };

    try {
      const response = await fetch(RELIEFWEB_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`ReliefWeb fetch failed: ${response.status}`);
      }

      const payload = await response.json();
      const list = payload?.data ?? [];
      return list.map(normalizeReliefWebItem);
    } catch (error) {
      console.warn("ReliefWeb feed unavailable.", error);
      return [];
    }
  });
}

export async function fetchWhoDiseaseOutbreakNews() {
  return withCache("feed-who-don", FEED_CACHE_MS, async () => {
    try {
      const response = await fetch(WHO_DON_ENDPOINT);
      if (!response.ok) {
        throw new Error(`WHO DON fetch failed: ${response.status}`);
      }

      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : [];

      return list
        .map(normalizeWhoDonItem)
        .filter((item) => /ebola|sudan virus|sudan ebolavirus|filovirus/i.test(`${item.title} ${item.summary}`))
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 12);
    } catch (error) {
      console.warn("WHO Disease Outbreak News feed unavailable.", error);
      return [];
    }
  });
}
