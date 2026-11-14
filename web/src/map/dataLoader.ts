// Loads the static city data built by data/build.py from web/public/data/.
// One fetch per file, cached for the life of the page.
import type { Area, CityData, Neighborhood, Site, Store } from "@mcc/shared";

let cached: Promise<CityData> | null = null;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function loadCityData(): Promise<CityData> {
  if (!cached) {
    cached = Promise.all([
      getJson<Area[]>("/data/areas.json"),
      getJson<Store[]>("/data/stores.json"),
      getJson<Site[]>("/data/sites.json"),
      getJson<Neighborhood[]>("/data/neighborhoods.json"),
    ]).then(([areas, stores, sites, neighborhoods]) => ({ areas, stores, sites, neighborhoods }));
    // A failed load should be retryable, not cached forever.
    cached.catch(() => (cached = null));
  }
  return cached;
}
