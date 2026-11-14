# data/

Offline pipeline that writes the static city data used by the app.

    uv run --python 3.12 data/build.py

Writes `web/public/data/{areas,stores,sites,neighborhoods}.json` (shapes in `shared/data.ts`).
Downloads are cached in `data/.cache/` (gitignored); delete it to refetch. First run downloads
~260 MB of Census files (streamed and filtered to Jefferson County, ~1 min).

Sources (all public):
- City boundary and block groups: Census TIGERweb REST (place 0107000, county 01073).
- Households, no-vehicle households (B25044), under 18 and 65+ (B01001): ACS 2023 5-year,
  table-based summary-file bulk downloads from www2.census.gov. The Census API now requires a key,
  so the bulk files are used instead. Block groups are kept when their centroid is in the city or at least 50% of their area is.
- Poverty (B17017 E002, households below poverty level) and no internet (B28002 E012 + E013: access without a subscription + no access): same bulk files. Both tables are published at block-group level, so no tract split was needed (the script would fall back to tract value x household share if a block-group value were missing; 0 fallbacks used).
- Stores and sites: OpenStreetMap via Overpass (overpass-api.de, falls back to kumi.systems and private.coffee).
- Neighborhood bboxes: unions of the city's 99 official neighborhoods (UAB CHEERS ArcGIS service).
  Edit `NEIGHBORHOODS` in `build.py` to change the groupings.

Known gaps: OSM store coverage in west Birmingham is thin (check by hand); only a few community centers are tagged.

Closed stores: `CLOSED_STORES` in `build.py` is a hand-kept list (OSM id -> closed_since, note). Those stores are dropped from `stores.json` and written to `former_stores.json` (West End Save-A-Lot, closed 2023-09).
