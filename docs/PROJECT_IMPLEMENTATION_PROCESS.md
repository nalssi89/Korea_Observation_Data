# ASOS 평년 대비 월별 판정 프로젝트 구현 절차

이 문서는 프로젝트를 원점에서 다시 시작해도 같은 기준으로 바로 재현할 수 있도록 정리한 1차 구현 가이드입니다.

## 1. 최종 확정 기준

### 대표지점 기준

- 1973~1989년 남한은 제주를 제외한 본토 56개 대표지점으로 계산한다.
- 1973~1989년 대구-경상북도는 이미지에 실제로 보이는 9개 지점으로 계산한다.
- 이미지에는 대구-경상북도(10), 남부(33)으로 표기되어 있으나, 실제 나열 지점은 9개이고 본토 합계 56개와 일치하므로 9개 기준을 채택한다.
- 안동(136)은 1973~1989년 대구-경상북도에 포함하지 않는다.
- 1990년 이후 남한은 제주를 제외한 본토 62개 대표지점으로 계산한다.
- 제주는 별도 산출 권역으로 유지하고 남한에는 포함하지 않는다.
- 권역 평균은 면적가중이 아니라 대표지점 동일가중 평균이다.

### 평년 및 판정 기준

- 평년값은 30년 창의 월평균으로 계산한다.
- 평년 범위, 즉 비슷 범위는 30년 창의 월값 분포에서 33.33~66.67 퍼센타일로 계산한다.
- 판정 부호는 모든 변수에 대해 퍼센타일 범위를 기준으로 한다.
- `x < p33.33`이면 `-`, `p33.33 <= x <= p66.67`이면 `0`, `x > p66.67`이면 `+`이다.
- 기온 변수는 `- = 낮음`, `0 = 비슷`, `+ = 높음`으로 해석한다.
- 강수량은 `- = 적음`, `0 = 비슷`, `+ = 많음`으로 해석한다.
- 최종 남한 표는 1991~2020 고정 평년을 기준으로 편차와 부호를 함께 제공한다.

### 변수 기준

- `tavg`: 평균기온, 월평균
- `tmin`: 최저기온, 월평균
- `tmax`: 최고기온, 월평균
- `precip`: 강수량, 지점별 월누적 후 권역 동일가중 평균
- 기온 최종 표에는 평년 대비 편차값과 부호를 표시한다.
- 강수량 최종 표에는 월 누적강수량 값과 부호를 표시한다.
- 표와 PNG의 숫자 표기는 소수점 1자리 고정이다.

## 2. 프로젝트 구조

주요 구현 파일은 다음과 같다.

- `src/metadata.js`: 대표지점, 권역, 합성권역 정의
- `src/asos-client.js`: data.go.kr ASOS 일자료 다운로드 클라이언트
- `src/csv.js`: `.md` 확장자를 사용하는 CSV형 파일 입출력
- `src/pipeline.js`: 일자료 월집계, 권역집계, 평년값, 퍼센타일 범위, 판정 산출
- `src/pivot.js`: 연도-월 피벗표 및 `값(부호)` 포맷
- `src/cli.js`: 전체 파이프라인 실행 CLI
- `scripts/export_south_korea_pivots.js`: 남한 최종 연도-월 표 생성
- `scripts/export_south_korea_visual_report.js`: 인라인 SVG Markdown 시각화 생성
- `scripts/export_south_korea_png_charts.ps1`: 2D PNG 그래픽 생성
- `scripts/download_asos_chunk.js`: 대용량 수집을 나누어 수행할 때 사용
- `scripts/merge_data_files.js`: 분할 수집 파일 병합

테스트는 `test/` 폴더에 있으며 `node --test --test-isolation=none`으로 실행한다.

## 3. 사전 준비

### 런타임

- Node.js가 필요하다.
- PNG 생성은 Windows PowerShell과 `System.Drawing`을 사용한다.
- 별도 npm 패키지 설치 없이 동작하도록 구현되어 있다.

### API 키

ASOS 자료를 새로 수집하려면 data.go.kr 기상청 ASOS 일자료 API 키가 필요하다.

PowerShell 예:

```powershell
$env:KMA_SERVICE_KEY="발급받은_서비스키"
```

API 키는 코드에 하드코딩하지 않는다.

## 4. 원자료 수집

회사망에서 파일 확장자 삭제가 발생할 수 있으므로 산출물은 `.md` 확장자를 사용한다. 내부 내용은 CSV 형식이다.

기존 원자료가 없으면 아래처럼 수집한다.

```powershell
$env:KMA_SERVICE_KEY="발급받은_서비스키"
node src/cli.js run --start-year 1973 --end-year 2026 --raw-output data/raw/asos_daily_19730101_20260423.md --output-dir data/output/final
```

이미 원자료가 있으면 다운로드 없이 재처리한다.

```powershell
node src/cli.js run --raw-input data/raw/asos_daily_19730101_20260423.md --output-dir data/output/final
```

현재 1차 작업에서 검증한 원자료 상태는 다음과 같다.

- 수집 지점 수: 기대 66개, 실제 66개
- 누락 지점: 없음
- 수집 기간: 1973-01-01~2026-04-23
- 원자료 행 수: 1,252,416행

## 5. 기본 산출물 생성

파이프라인 실행 후 `data/output/final`에 다음 파일이 생성된다.

- `station_monthly.md`
- `region_monthly.md`
- `region_normals.md`
- `region_normal_ranges.md`
- `region_monthly_classification.md`
- `south_korea_fixed_1991_2020_comparison.md`

의미는 다음과 같다.

- `station_monthly.md`: 지점별 월값
- `region_monthly.md`: 권역별 월값
- `region_normals.md`: 권역별 평년값
- `region_normal_ranges.md`: 권역별 33.33~66.67 퍼센타일 범위
- `region_monthly_classification.md`: 권역별 연도-월-변수 판정
- `south_korea_fixed_1991_2020_comparison.md`: 남한 1991~2020 고정 평년 비교 결과

## 6. 남한 최종 연도-월 표 생성

남한 최종 표는 아래 명령으로 생성한다.

```powershell
node scripts/export_south_korea_pivots.js data/output/final/south_korea_fixed_1991_2020_comparison.md data/output/final/south_korea_tables
```

대표 최종 파일은 다음이다.

- `data/output/final/south_korea_tables/south_korea_final_value_sign_tables.md`

표 컬럼은 `연도`, `1월`, `2월`, ..., `12월`로 표시한다.

기온 셀 예:

```text
2.0(+)
-1.3(-)
0.5(0)
```

강수량 셀 예:

```text
71.7(+)
21.1(-)
158.0(0)
```

## 7. PNG 그래픽 생성

2D PNG 그래픽은 아래 명령으로 생성한다.

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/export_south_korea_png_charts.ps1 -InputPath data/output/final/south_korea_fixed_1991_2020_comparison.md -OutputDir data/output/final/png_charts
```

생성되는 2D PNG는 변수별로 4종이다.

- `*_sign_calendar.png`: 연도-월 전체 부호 달력
- `*_annual_ribbon.png`: 연도별 편차 리본
- `*_monthly_distribution.png`: 월별 부호 분포
- `*_recent_10yr_matrix.png`: 최근 10년 상세 매트릭스

주요 2D sign calendar 파일은 다음이다.

- `tavg_sign_calendar.png`
- `tmin_sign_calendar.png`
- `tmax_sign_calendar.png`
- `precip_sign_calendar.png`

2D sign calendar 기준은 다음과 같다.

- 왼쪽 축에 모든 연도 표시
- 위쪽과 아래쪽 축에 `1월~12월` 표시
- 모든 값은 소수점 1자리 고정
- 기온은 월별 편차값 표시
- 강수량은 월 누적강수량 표시
- 기온 색상은 연한 파랑, 중립, 연한 빨강 계열
- 강수량 색상은 갈색, 중립, 초록 계열
- PNG 그래픽에서는 2026년 4~12월을 미싱으로 처리한다.

## 8. 인라인 SVG Markdown 시각화

이미지 파일 삭제 환경을 대비해 Markdown 안에 SVG를 직접 넣은 보고서도 생성할 수 있다.

```powershell
node scripts/export_south_korea_visual_report.js data/output/final/south_korea_fixed_1991_2020_comparison.md data/output/final/south_korea_visual_report.md
```

출력:

- `data/output/final/south_korea_visual_report.md`

## 9. 내부망 강수량 교차검증

내부망의 1973~1990 남한 월강수량 표와 교차검증한 결과는 다음과 같다.

- 1990년 62개 기준은 12개월 모두 일치한다.
- 1973~1989년은 현재 56개 기준에서 204개월 중 203개월이 일치한다.
- `안동(136)`을 1973~1989년에 포함하면 204개월 중 143개월이 불일치하므로 내부망 전체 기준이 아니다.
- 따라서 1973~1989년 대구-경북은 9개 지점, 남한은 56개 지점으로 확정한다.
- 남은 차이는 1973년 1월 강수량뿐이다.

1973년 1월 남한 강수량:

- 정확 계산값: 71.7357mm
- 소수점 1자리 표시: 71.7mm
- 내부망 표시: 71.8mm
- 결론: 원자료 기준으로는 71.7mm가 맞으므로 71.7mm를 채택한다.

검증 리포트:

- `data/output/final/internal_network_precip_validation.md`

## 10. 검증 절차

전체 작업 후 반드시 테스트를 실행한다.

```powershell
node --test --test-isolation=none
```

현재 기준 통과 상태:

- 테스트 수: 21개
- 실패: 0개

핵심 검증 항목:

- 1973~1989년 남한 지점 수가 56개인지 확인
- 1990년 이후 남한 지점 수가 62개인지 확인
- 제주가 남한 합성권역에 포함되지 않는지 확인
- 33.33~66.67 퍼센타일 범위 안의 값이 `0`으로 분류되는지 확인
- `p33.33`과 `p66.67` 경계값이 모두 `0` 또는 비슷으로 처리되는지 확인
- 최종 남한 표의 부호가 편차의 음양이 아니라 퍼센타일 범위 기준인지 확인
- `.05` 경계값이 소수점 1자리에서 안정적으로 반올림되는지 확인

## 11. 주의사항

- `.md` 파일 중 상당수는 Markdown 표가 아니라 CSV 형식 데이터를 `.md` 확장자로 저장한 것이다.
- 회사망에서 `.csv`, `.data`, `.png` 등이 삭제될 수 있으므로 최종 수치 결과는 `.md`를 우선 보존한다.
- PNG는 보고용 이미지이므로 삭제 가능성에 대비해 언제든 스크립트로 재생성할 수 있어야 한다.
- 3D terrain calendar 스크립트는 실험적으로 만들었으나 1차 최종 산출 기준에서는 제외한다.
- 2026년 자료는 원자료 수집일에 따라 달라질 수 있다. 현재 2D PNG에서는 2026년 4~12월을 미싱으로 처리한다.
- 새로 수집하면 최신 가용일이 달라질 수 있으므로 원자료 기간과 2026년 처리 정책을 다시 확인한다.

## 12. 원점 재작업 순서 요약

1. `src/metadata.js`에서 대표지점 기준이 56/62개 및 제주 별도인지 확인한다.
2. ASOS 일자료를 수집하거나 기존 raw `.md`를 준비한다.
3. `node src/cli.js run --raw-input ... --output-dir data/output/final`을 실행한다.
4. `node scripts/export_south_korea_pivots.js ...`를 실행해 최종 연도-월 표를 만든다.
5. `powershell.exe -ExecutionPolicy Bypass -File scripts/export_south_korea_png_charts.ps1 ...`를 실행해 PNG를 만든다.
6. 필요 시 `node scripts/export_south_korea_visual_report.js ...`로 SVG Markdown 보고서를 만든다.
7. `node --test --test-isolation=none`으로 검증한다.
8. `south_korea_final_value_sign_tables.md`, `png_charts`, `internal_network_precip_validation.md`를 확인한다.
