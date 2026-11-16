# HIFIC – Historical Fire Calendar

**Is this month normal for this area?**

HIFIC turns two incompatible satellite records (MODIS and VIIRS active-fire hotspots from NASA FIRMS) into one continuous fire-activity history for the Dominican Republic, from November 2000 to December 2025, and lets you compare any month against the historical record.

Built for the NASA Space Apps Challenge 2026 (Santiago de los Caballeros, Dominican Republic), in response to the challenge on harmonizing MODIS and VIIRS active-fire hotspots into a fire activity calendar.

- **Live demo:** [TODO: add the Netlify URL]
- **Default language:** English. Add `?lang=es` to the URL for Spanish.

## What it does

- **Map of the Dominican Republic.** Click the country to open the calendar.
- **Calendar heatmap** (years × months, 2000–2025) with colour scales that avoid red/green pairs.
- **Count | Anomaly view.** Anomaly mode colours each month by how far it is from the median of the same month in the other years.
- **"Is this month normal?" card.** Value, median of the other years, difference in percent, and the percentile ("higher than X% of the other years").
- **Estimated months are marked.** A dotted border means the value was estimated from MODIS; no border means it was measured by VIIRS. Estimated months also show a probable range.
- **Year range selectors and CSV download** of the selected range.
- **English / Spanish** interface.

## How the data is harmonized

Source data: NASA FIRMS, Dominican Republic only.

- MODIS (Terra and Aqua), from November 2000: 42,263 raw detections.
- VIIRS S-NPP, from January 2012: 106,817 raw detections.

Cleaning rules (applied before any counting):

1. Keep only type-0 detections (presumed vegetation fire).
2. MODIS: confidence of 30 or more. VIIRS: drop low-confidence detections.
3. VIIRS: S-NPP only, so the series uses the same satellite in every year. (NOAA-20 sees almost the same fires as S-NPP: April–December 2018 gave 3,568 vs 3,549 detections after the same filters, so adding both would count each fire twice.)
4. Reject near-real-time (NRT) versions in historical years.

After cleaning: 30,741 MODIS and 91,551 VIIRS detections.

Conversion: each MODIS detection is weighted into "VIIRS-equivalent" detections using its fire radiative power (FRP), the number of detections in that month, and whether it falls in the dry season. Where complete real VIIRS data exist (from February 2012), the real VIIRS count is used unchanged. According to the data lead, the coefficients come from a Poisson regression calibrated on 2012–2025, with separate coefficients for the Terra-only period (2000 to mid-2002).

Result: 302 months (November 2000 – December 2025). 167 are measured by VIIRS (confidence "high"), 115 are MODIS-based (confidence "medium") and 20 are Terra-only (confidence "low"). That means 135 of 302 months are estimates.

## Validation

| Check | Result | Done by |
|---|---|---|
| Leave-one-year-out validation | Annual error ≈ 4.4%, monthly error ≈ 15.7%, bias ≈ 0% | Data lead (declared figures; script: [TODO: link to the calibration/validation script]) |
| Cross-check on the 167 months with both sensors (in-sample) | Bias 0.0%, mean annual error 3.9%, median monthly error 14.8% | Re-run of the team's code with Claude (optimistic: same data used for calibration) |
| Probable range | In 8 of 10 validated months the real value was within 71%–131% of the estimate | Data lead |

## Known limitations

- 45% of the months (135 of 302) are estimates based on MODIS.
- Annual averages differ between eras (about 8,015 in 2001–2011 vs 6,501 in 2013–2025). We do not know whether this is a real trend or a method effect, and the median mixes both eras.
- A hotspot is a thermal detection, not a counted fire (it can include agricultural burning).
- 2000 only has November and December.
- One region only (Dominican Republic). A contrast region has not been tested.
- The base map needs internet access; the calendar does not.
- The calendar is not yet fully keyboard / screen-reader accessible.
- No prediction and no real-time data.
- Suomi NPP stopped delivering new data on 2 November 2026. This prototype ends in December 2025 and is not affected, but extending the series would require NOAA-20 / NOAA-21 and a validation of the continuity.

## Data format

`public/data/focos_mensuales.csv` (column names are in Spanish: they are the data contract between the data pipeline and the web app).

| Column | Meaning |
|---|---|
| `anio` | Year |
| `mes` | Month (1–12) |
| `zona` | Zone code (`RD`) |
| `focos_armonizados` | Harmonized hotspot count (VIIRS-equivalent scale) |
| `focos_modis`, `focos_viirs` | Cleaned counts per sensor (empty when not applicable) |
| `confianza` | Confidence: `alta` (high), `media` (medium), `baja` (low) |
| `fuente` | `VIIRS_real` or `VIIRS_equivalente` (estimated from MODIS) |
| `rango80_bajo`, `rango80_alto` | Probable range for estimated months |

A month with no data has no row (the calendar shows it in grey); a zero means "observed, no hotspots".

## Run it locally

```
npm install
npm run dev        # development server
npm run build      # production build in dist/
npm run datos      # regenerate the CSV from raw FIRMS files
```

`npm run datos` reads `pipeline/entrada/MODIS.csv` and `pipeline/entrada/VIIRS.csv` (raw FIRMS downloads, not included in the repository) and writes `public/data/focos_mensuales.csv` and `pipeline/reporte.json`.

## Project structure

```
index.html
src/            application code (map, calendar, data, export, i18n, intro, styles)
public/data/    harmonized CSV and the Dominican Republic outline (GeoJSON)
pipeline/       harmonization library (data lead) and the script that generates the CSV
docs/           documentation, including the AI-use declaration
```

## Credits and licences

- Data: NASA FIRMS (MODIS and VIIRS active fire). [TODO: add the acknowledgement text recommended by FIRMS]
- Country outline: geoBoundaries (geoboundaries.org), CC BY 4.0; source: Caribbean GeoPortal.
- Base map: © OpenStreetMap contributors.
- Charts: Apache ECharts. Map: Leaflet.

## Use of AI

AI tools were used and are declared in [docs/AI_USE.md](docs/AI_USE.md).

## Team

[TODO: names and roles: data lead, web developer, designer, presenter, researcher/product]

## Licence

[TODO: choose a licence for the code]
