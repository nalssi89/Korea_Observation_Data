# Korea Observation Data

KMA ASOS daily observations are downloaded and aggregated into monthly station,
regional, normal-period, and South Korea summary outputs. The final deliverables
use `.md` extensions so they survive document-extension cleanup rules in the
user environment.

## Usage

Run from an existing raw ASOS file:

```bash
node src/cli.js run --raw-input data/raw/asos_daily.md --output-dir data/output/final
```

Download directly from data.go.kr:

```bash
$env:KMA_SERVICE_KEY="..."
node src/cli.js run --start-year 1973 --end-year 2026 --raw-output data/raw/asos_daily.md --output-dir data/output/final
```

Core outputs:

- `data/output/final/station_monthly.md`
- `data/output/final/region_monthly.md`
- `data/output/final/region_normals.md`
- `data/output/final/region_normal_ranges.md`
- `data/output/final/region_monthly_classification.md`
- `data/output/final/south_korea_fixed_1991_2020_comparison.md`

South Korea final tables:

```bash
node scripts/export_south_korea_pivots.js data/output/final/south_korea_fixed_1991_2020_comparison.md data/output/final/south_korea_tables
```

The combined human-readable report is:

- `data/output/final/south_korea_tables/south_korea_final_value_sign_tables.md`

## ENSO response system

Generate the ONI-centered response package:

```bash
npm run build:enso-response
```

Use this single file first:

- `data/output/final/enso_response_system/ENSO_RESPONSE_SYSTEM.md`

It includes a worked 2026 April example covering summer temperature,
summer precipitation, typhoon influence, autumn, and winter.
Temperature and precipitation judgments intentionally exclude official forecast
probabilities from KMA or other agencies; they use observed data and observed
analog outcomes only.

The detailed source tables are also written to:

- `data/output/final/enso_response_system/ENSO_RESPONSE_SYSTEM.md`
- `data/output/final/enso_response_system/2026_summer_enso_korea_objective_response.md`
- `data/output/final/enso_response_system/response_system_index.md`
- `data/output/final/enso_response_system/evidence_registry.md`
- `data/output/final/enso_response_system/monthly_effect_table.md`
- `data/output/final/enso_response_system/seasonal_effect_table.md`
- `data/output/final/enso_response_system/active_season_year_table.md`
- `data/output/final/enso_response_system/lifecycle_effect_table.md`
- `data/output/final/enso_response_system/climate_factor_modifier_table.md`
- `data/output/final/enso_response_system/analog_year_cards.md`
- `data/output/final/enso_response_system/changma_typhoon_reference.md`
- `data/output/final/enso_response_system/question_answer_matrix.md`
- `data/output/final/enso_response_system/enso_public_communication_guide.md`
- `data/output/final/elnino_summer_2026/analog_year_metrics_manifest.md`

Generate the PDF manuals:

```bash
.venv-pdf/bin/python scripts/build_enso_manuals.py
```

Manual outputs:

- `data/output/final/enso_manuals/el_nino_response_manual.md`
- `data/output/final/enso_manuals/la_nina_response_manual.md`
- `output/pdf/enso_manuals/el_nino_response_manual.pdf`
- `output/pdf/enso_manuals/la_nina_response_manual.pdf`

`build:enso-response` regenerates the ONI association summaries, the analog
metrics table, the manifest, the detailed response-system tables, and the
canonical single-file response inside this repository. Older files one level
above this repository are treated only as convenience copies, not canonical
outputs.

The system uses ONI as the primary ENSO index, keeps RONI as an auxiliary
sensitivity check, excludes Tibetan snow cover, and preserves the existing
South Korea station and 1991-2020 normal-period policy.
