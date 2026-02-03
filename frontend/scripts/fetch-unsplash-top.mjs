import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Optional: Unsplash API key. If absent, we fall back to the public NAPI endpoints (best-effort, key-less).
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const args = parseArgs(process.argv.slice(2));
const candidates = Number(args.candidates ?? 1); // how many search results to inspect per country
const delayMs = Number(args.delayMs ?? 1200); // pause after every HTTP request
const limit = args.limit ? Number(args.limit) : Number.POSITIVE_INFINITY;
const startAfter = args.startAfter;
const overwrite = Boolean(args.overwrite);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const countriesFile = path.resolve(__dirname, "../src/data/countriesCities.json");
const outputFile = path.resolve(__dirname, "../src/data/countryImageTop.txt");

const countries = JSON.parse(await fs.readFile(countriesFile, "utf8"));

const existing = overwrite ? new Map() : await loadExisting(outputFile);

let skipping = Boolean(startAfter);
let processed = 0;

for (const country of countries) {
  if (skipping) {
    if (country.name === startAfter) {
      skipping = false; // start with the next country
    }
    continue;
  }

  if (processed >= limit) break;
  if (existing.has(country.name)) {
    console.log(`Skip (already in file): ${country.name}`);
    continue;
  }

  try {
    const top = await fetchTopPhoto(country.name, candidates, delayMs);
    if (!top) {
      console.warn(`No photo found for ${country.name}`);
      continue;
    }

    const line = formatLine(country.name, top);
    await fs.appendFile(outputFile, line + "\n", "utf8");
    existing.set(country.name, line);
    processed += 1;

    console.log(`Saved: ${country.name} -> ${top.photoPage}`);
  } catch (error) {
    console.error(`Failed for ${country.name}:`, error);
  }
}

async function fetchTopPhoto(country, candidateCount, pause) {
  if (ACCESS_KEY) {
    // Authenticated: use official API + per-photo stats for download counts.
    const search = await unsplashApi(
      `/search/photos?query=${encodeURIComponent(country)}&page=1&per_page=${candidateCount}`
    );
    await sleep(pause);

    if (!search.results?.length) return null;

    const shortlist = search.results.slice(0, candidateCount);

    let best = shortlist[0];
    let bestDownloads = await getDownloads(best.id, pause);

    for (const photo of shortlist.slice(1)) {
      const dl = await getDownloads(photo.id, pause);
      if (dl > bestDownloads) {
        best = photo;
        bestDownloads = dl;
      }
    }

    return formatPhoto(best, bestDownloads);
  }

  // Key-less fallback: use Unsplash public NAPI sorted by popularity (downloads proxy).
  const search = await unsplashNapi(
    `/search/photos?query=${encodeURIComponent(country)}&per_page=${candidateCount}&order_by=popular`
  );
  await sleep(pause);

  if (!search.results?.length) return null;
  const best = search.results[0]; // already ordered by popularity
  const downloads = best.downloads ?? 0;
  return formatPhoto(best, downloads);
}

async function getDownloads(photoId, pause) {
  const stats = await unsplashApi(`/photos/${photoId}/statistics`);
  await sleep(pause);
  return stats.downloads?.total ?? 0;
}

async function unsplashApi(endpoint) {
  const res = await fetch(`https://api.unsplash.com${endpoint}`, {
    headers: {
      Authorization: `Client-ID ${ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

async function unsplashNapi(endpoint) {
  const url = `https://unsplash.com/napi${endpoint}`;
  const res = await fetch(url, {
    headers: {
      // Basic headers to mimic a browser; no key required.
      "User-Agent": "Mozilla/5.0 (compatible; CodexBot/1.0)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash NAPI ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json();
}

function formatPhoto(photo, downloads) {
  return {
    id: photo.id,
    description: photo.description ?? photo.alt_description ?? "",
    downloads,
    photoPage: photo.links?.html ?? "",
    imageUrl: photo.urls?.raw ?? "",
    photographer: photo.user?.name ?? "",
  };
}

function formatLine(country, data) {
  const clean = (value) => value.replace(/\s+/g, " ").trim();
  return [
    country,
    data.id,
    data.downloads,
    clean(data.description),
    data.photographer,
    data.photoPage,
    data.imageUrl,
  ].join("\t");
}

async function loadExisting(file) {
  try {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    const map = new Map();
    for (const line of lines) {
      const country = line.split("\t", 1)[0];
      map.set(country, line);
    }
    return map;
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (!arg.startsWith("--")) return acc;
    const [key, raw] = arg.slice(2).split("=");
    acc[key] = raw ?? true;
    return acc;
  }, {});
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
