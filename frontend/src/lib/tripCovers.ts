// src/lib/tripCovers.ts
import countriesCities from "../data/countriesCities.json";

type CountryCitiesEntry = { name: string; cities: string[] };

// map the *country name* to the cover filename you already have
// (the key should match the JSON country "name")
const COUNTRY_TO_COVER: Record<string, string> = {
  Australia: "australia.png",
  China: "china.jpg",
  France: "france.jpg",
  Indonesia: "indonesia.png",
  Italy: "italy.png",
  Japan: "japan.png",
  Korea: "korea.png",
  Malaysia: "malaysia.jpg",
  "New Zealand": "newzealand.png",
  Singapore: "singapore.jpg",
  "South Africa": "southafrica.jpg",
  Switzerland: "switzerland.jpg",
  Taiwan: "taiwan.jpg",
  Thailand: "thailand.jpg",
  USA: "usa.png",
  "United States": "usa.png",
  "United States of America": "usa.png",
};

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

/**
 * Returns a stable cover image path based on the trip’s country.
 * - If country matches a known image: /trip-covers/<filename>
 * - Else: /trip-covers/default.jpg
 */
export function pickTripCover(countryName?: string | null) {
  const data = countriesCities as CountryCitiesEntry[];

  const input = (countryName || "").trim();
  if (!input) return "/trip-covers/default.jpg";

  // Try exact match against JSON name (case-insensitive)
  const match = data.find((c) => normalize(c.name) === normalize(input));
  const canonical = match?.name || input;

  const filename = COUNTRY_TO_COVER[canonical];
  if (filename) return `/trip-covers/${filename}`;

  // Try “best effort” contains match
  const foundKey = Object.keys(COUNTRY_TO_COVER).find(
    (k) => normalize(canonical) === normalize(k) || normalize(canonical).includes(normalize(k))
  );
  if (foundKey) return `/trip-covers/${COUNTRY_TO_COVER[foundKey]}`;

  return "/trip-covers/default.jpg";
}
