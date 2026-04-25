# ENSO analog metrics manifest

- version: 2026-04-25
- purpose: Reproducible manifest for ONI-primary ENSO analog metrics used by the response system.

## Local Inputs

- South Korea monthly observations: `data/output/final/south_korea_fixed_1991_2020_comparison.md`
- ENSO onset candidates: `data/output/final/elnino_summer_2026/enso_onset_candidates.csv`
- Auxiliary manifest: `data/input/enso_analog_manifest_2026.json`

## Criteria

- ONI development-year full: ONI warm episode starts in AMJ, MJJ, JJA, JAS, ASO, or SON, with year >= 1979 for high-latitude comparability.
- MJJ-ASO summer-transition subset: ONI warm episode starts in MJJ, JJA, JAS, or ASO. Pre-1979 rows are retained as South Korea observation supplements but not as full high-latitude analogs.
- RONI auxiliary: RONI onsets are retained only as auxiliary sensitivity labels and never replace ONI-primary classification.
- RONI-only sensitivity: RONI summer auxiliary onset exists but the year is not selected by ONI development-year or ONI summer-transition criteria.

## Generated Counts

- ONI development-year full: 12
- MJJ-ASO summer-transition subset: 10
- RONI auxiliary noted: 13
- RONI-only sensitivity: 0

## External References

- oni: NOAA/CPC ONI v5 and ASCII table
- roni: NOAA/CPC RONI table
- ao: NOAA/CPC monthly AO index
- nao: NOAA/CPC monthly NAO index
- sea_ice: NSIDC Sea Ice Index v4
- snow_cover: Rutgers Global Snow Lab Eurasia snow-cover extent
- typhoon: NOAA/NCEI IBTrACS v04r01 Western Pacific best track

## Notes

- JJA temperature metrics are arithmetic means of June, July, and August South Korea monthly values.
- JJA precipitation metrics use June-August accumulated observed and normal precipitation before computing the percentage ratio.
- RONI labels are retained for sensitivity checks but do not promote a year into the ONI-primary set.

