// src/components/CountryCityPicker.tsx
import React, { useMemo } from "react";
import SearchableSelect, { SelectOption } from "./SearchableSelect";

// put your json here:
import countriesCities from "../data/countriesCities.json";

type CountryCitiesEntry = {
  name: string;
  cities: string[];
};

type Props = {
  country: string;
  city: string;
  onCountryChange: (country: string) => void;
  onCityChange: (city: string) => void;
};

function toOptions(values: string[]): SelectOption[] {
  const seen = new Set<string>();
  const out: SelectOption[] = [];

  for (const v of values) {
    const s = (v || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: s, value: s });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}


export default function CountryCityPicker({
  country,
  city,
  onCountryChange,
  onCityChange,
}: Props) {
  const data = countriesCities as CountryCitiesEntry[];

  const countryOptions = useMemo(() => {
    return data
      .map((c) => c.name)
      .filter(Boolean)
      .map((name) => ({ label: name, value: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  const selectedCountryEntry = useMemo(() => {
    return data.find((c) => c.name === country) ?? null;
  }, [data, country]);

  const cityOptions = useMemo(() => {
    if (!selectedCountryEntry) return [];
    return toOptions(selectedCountryEntry.cities || []);
  }, [selectedCountryEntry]);

  const selectedCountryOpt = country ? { label: country, value: country } : null;
  const selectedCityOpt = city ? { label: city, value: city } : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <SearchableSelect
        label="Destination country"
        placeholder="Search country…"
        value={selectedCountryOpt}
        options={countryOptions}
        required
        onChange={(opt) => {
          const nextCountry = opt?.value ?? "";
          onCountryChange(nextCountry);

          // Reset city if country changed
          if (nextCountry !== country) onCityChange("");
        }}
        />
      </div>
      
      <div style={{ minWidth: 0 }}>
        <SearchableSelect
        label="Main city (optional)"
        placeholder={country ? "Search city…" : "Choose a country first…"}
        value={selectedCityOpt}
        options={cityOptions}
        disabled={!country}
        onChange={(opt) => onCityChange(opt?.value ?? "")}
        />
      </div>
    </div>
  );
}
