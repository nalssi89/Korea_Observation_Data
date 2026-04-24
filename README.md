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
