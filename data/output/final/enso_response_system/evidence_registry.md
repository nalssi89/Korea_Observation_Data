# ENSO 대응 체계 근거 등록부

| 항목 | 역할 | 출처 | 적용 규칙 |
| --- | --- | --- | --- |
| ONI | 기본 ENSO 판정 | NOAA/CPC ONI v5 | +0.5°C 이상 또는 -0.5°C 이하가 5개 이상 연속된 episode를 phase로 사용 |
| ONI 발달해 전체 | 유사해 기본 표본 | data/output/final/elnino_summer_2026/analog_year_metrics.csv | 1979년 이후 ONI warm episode 시작이 AMJ~SON인 해. 판단표는 최근 연도순으로 제시. |
| MJJ-ASO 여름 전환형 | 여름 중 전환 질문의 부분집합 | data/output/final/elnino_summer_2026/analog_year_metrics.csv | ONI warm episode 시작이 MJJ~ASO인 해. ONI 발달해 전체를 대체하지 않고 하위 표본으로만 사용. |
| ONI 발달기·소멸기 | episode 생애주기별 영향 보조 판단 | data/output/final/enso_analysis/enso_season_lifecycle_summary.md | El Nino는 첫 ONI 최댓값까지, La Nina는 첫 ONI 최솟값까지를 발달기로 두고 이후를 소멸기로 구분. 정점/저점은 발달기에 포함. |
| ONI 영향 계절연도 | 여름·겨울 계절 영향 기본 표본 | data/output/final/enso_analysis/enso_active_season_years.md | episode 시작연도가 아니라 해당 DJF/JJA 계절 자체가 ONI El Nino 또는 La Nina phase였는지를 기준으로 포함. |
| RONI | 보조 확인 | NOAA/CPC RONI | ONI 결론의 온난화 배경 민감도 확인용. 기본 phase나 유사도 점수에는 넣지 않음 |
| 남한 기온·강수 | 국내 영향 산출 | data/output/final/south_korea_fixed_1991_2020_comparison.md | 기존 적용값 유지. 1973~1989년은 제주 제외 본토 56개 대표지점, 1990년 이후는 제주 제외 본토 62개 대표지점, 평년은 1991~2020 고정 평년. |
| 기관 공식 기온·강수 전망 | 제외 | KMA 등 국내외 기관 전망 | 기온·강수 영향 판단에는 사용하지 않음. 관측자료 기반 사후 비교가 필요할 때만 별도 참고. |
| AO | 고위도 순환 보정 | NOAA/CPC AO monthly index | 1~3월 평균, 월별 값, 겨울-봄 전환폭을 보조지표로 사용 |
| NAO | 고위도 순환 보정 | NOAA/CPC NAO monthly index | AO와 함께 대서양-유라시아 순환 배경을 판단 |
| 해빙 | 고위도 열적 배경 보정 | NSIDC Sea Ice Index | 북극 전체, 바렌츠해, 카라해를 분리해서 사용 |
| 유라시아 눈덮임 | 대륙 가열·제트 보조인자 | Rutgers Global Snow Lab Eurasia SCE | 1~3월 월별값과 봄철 주별값을 보조로 사용 |
| 티벳 눈덮임 | 제외 | 없음 | 이번 프로젝트 범위에서는 제외 |
| 장마·태풍 | 별도 보정 레이어 | KMA 장마 통계, IBTrACS/KMA 태풍자료 | ONI 직접효과로 단정하지 않고 정체전선, 북태평양고기압, 저기압, 경로를 함께 해석 |
