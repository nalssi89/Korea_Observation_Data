#!/usr/bin/env python3
"""Build Korean ENSO response manuals as Markdown and PDF."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
MANUAL_MD_DIR = ROOT / "data/output/final/enso_manuals"
MANUAL_PDF_DIR = ROOT / "output/pdf/enso_manuals"
TODAY = date.today().isoformat()

SEASON_PATH = ROOT / "data/output/final/enso_analysis/enso_season_phase_summary.md"
MONTH_PATH = ROOT / "data/output/final/enso_analysis/enso_month_phase_summary.md"
LIFECYCLE_PATH = ROOT / "data/output/final/enso_analysis/enso_season_lifecycle_summary.md"
ANALOG_PATH = ROOT / "data/output/final/elnino_summer_2026/analog_year_metrics.csv"
MANIFEST_PATH = ROOT / "data/output/final/elnino_summer_2026/analog_year_metrics_manifest.md"
PUBLIC_GUIDE_PATH = ROOT / "data/output/final/enso_response_system/enso_public_communication_guide.md"
ONI_SCRIPT_PATH = ROOT / "scripts/export_enso_association_analysis.js"


@dataclass
class Section:
    title: str
    blocks: list[dict]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def numeric(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def signed(value: str | float | None, digits: int = 1, suffix: str = "") -> str:
    number = numeric(str(value)) if not isinstance(value, float) else value
    if number is None:
        return ""
    rounded = round(number, digits)
    if rounded == 0:
        return f"{0:.{digits}f}{suffix}"
    return f"{'+' if rounded > 0 else ''}{rounded:.{digits}f}{suffix}"


def fixed(value: str | float | None, digits: int = 0, suffix: str = "") -> str:
    number = numeric(str(value)) if not isinstance(value, float) else value
    if number is None:
        return ""
    return f"{number:.{digits}f}{suffix}"


def phase_label(phase: str) -> str:
    return {"El Nino": "엘니뇨", "La Nina": "라니냐", "Neutral": "중립"}.get(phase, phase)


def lifecycle_label(stage: str) -> str:
    return {"Development": "발달기", "Decay": "소멸기"}.get(stage, stage)


def temp_signal(departure: str | None, high_pct: str | None, low_pct: str | None) -> str:
    dep = numeric(departure)
    high = numeric(high_pct) or 0
    low = numeric(low_pct) or 0
    if dep is None:
        return "자료 부족"
    if dep >= 0.3 or high - low >= 15:
        return "고온 쪽"
    if dep <= -0.3 or low - high >= 15:
        return "저온 쪽"
    return "뚜렷하지 않음"


def precip_signal(ratio: str | None, wet_pct: str | None, dry_pct: str | None) -> str:
    value = numeric(ratio)
    wet = numeric(wet_pct) or 0
    dry = numeric(dry_pct) or 0
    if value is None:
        return "자료 부족"
    if value >= 110 or wet - dry >= 15:
        return "다우 쪽"
    if value <= 90 or dry - wet >= 15:
        return "소우 쪽"
    return "뚜렷하지 않음"


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def make_table(headers: list[str], rows: list[list[str]], wide: bool = False) -> dict:
    return {"type": "table", "headers": headers, "rows": rows, "wide": wide}


def make_paragraph(text: str) -> dict:
    return {"type": "paragraph", "text": text}


def make_bullets(items: list[str]) -> dict:
    return {"type": "bullets", "items": items}


def make_callout(text: str) -> dict:
    return {"type": "callout", "text": text}


def make_code(lines: list[str]) -> dict:
    return {"type": "code", "lines": lines}


def phase_season_rows(phase: str) -> list[list[str]]:
    rows = []
    for row in read_csv(SEASON_PATH):
        if row["phase"] != phase:
            continue
        rows.append(
            [
                row["season"],
                row["n"],
                signed(row["tavg_departure_mean"], 1, "도"),
                fixed(row["tavg_high_pct"], 0, "%"),
                fixed(row["precip_ratio_pct"], 0, "%"),
                temp_signal(row["tavg_departure_mean"], row["tavg_high_pct"], row["tavg_low_pct"]),
                precip_signal(row["precip_ratio_pct"], row["precip_wet_pct"], row["precip_dry_pct"]),
            ]
        )
    return rows


def phase_month_rows(phase: str) -> list[list[str]]:
    rows = []
    for row in read_csv(MONTH_PATH):
        if row["phase"] != phase:
            continue
        rows.append(
            [
                f"{row['month']}월",
                row["n"],
                signed(row["tavg_departure_mean"], 1, "도"),
                fixed(row["precip_ratio_pct"], 0, "%"),
                temp_signal(row["tavg_departure_mean"], row["tavg_high_pct"], row["tavg_low_pct"]),
                precip_signal(row["precip_ratio_pct"], row["precip_wet_pct"], row["precip_dry_pct"]),
            ]
        )
    return rows


def lifecycle_rows(phase: str) -> list[list[str]]:
    rows = []
    season_order = {"DJF": 0, "MAM": 1, "JJA": 2, "SON": 3}
    stage_order = {"Development": 0, "Decay": 1}
    for row in sorted(
        read_csv(LIFECYCLE_PATH),
        key=lambda item: (
            stage_order.get(item["lifecycle_stage"], 9),
            season_order.get(item["season"], 9),
        ),
    ):
        if row["phase"] != phase:
            continue
        rows.append(
            [
                lifecycle_label(row["lifecycle_stage"]),
                row["season"],
                row["n"],
                signed(row["tavg_departure_mean"], 1, "도"),
                fixed(row["precip_ratio_pct"], 0, "%"),
                temp_signal(row["tavg_departure_mean"], row["tavg_high_pct"], row["tavg_low_pct"]),
                precip_signal(row["precip_ratio_pct"], row["precip_wet_pct"], row["precip_dry_pct"]),
            ]
        )
    return rows


def el_nino_analog_rows() -> list[list[str]]:
    rows = []
    for row in read_csv(ANALOG_PATH):
        if row["oni_development_full"] != "Y":
            continue
        rows.append(
            [
                row["year"],
                row["oni_episode_start"],
                signed(row["jja_tavg_dep"], 1, "도"),
                row["jja_tavg_month_signs"],
                fixed(row["jja_precip_ratio"], 0, "%"),
                row["jja_precip_month_signs"],
                row.get("typhoon_near_korea_count", ""),
            ]
        )
    return rows


def season_name(month: int) -> str:
    return {
        1: "DJF",
        2: "JFM",
        3: "FMA",
        4: "MAM",
        5: "AMJ",
        6: "MJJ",
        7: "JJA",
        8: "JAS",
        9: "ASO",
        10: "SON",
        11: "OND",
        12: "NDJ",
    }[month]


def parse_oni_rows() -> list[dict]:
    text = ONI_SCRIPT_PATH.read_text(encoding="utf-8")
    match = re.search(r"const ONI_TEXT = `\n(?P<table>.*?)\n`;", text, re.S)
    if not match:
        return []
    rows = []
    for line in match.group("table").strip().splitlines():
        parts = line.split()
        year = int(parts[0])
        for index, value in enumerate(parts[1:], start=1):
            oni = float(value)
            if oni >= 0.5:
                raw_phase = "El Nino"
            elif oni <= -0.5:
                raw_phase = "La Nina"
            else:
                raw_phase = "Neutral"
            rows.append({"year": year, "month": index, "oni": oni, "raw_phase": raw_phase})
    return rows


def oni_episodes(target_phase: str, min_start_year: int = 1973) -> list[list[str]]:
    rows = parse_oni_rows()
    runs = []
    current = []
    for row in rows:
        if row["raw_phase"] == target_phase:
            current.append(row)
            continue
        if len(current) >= 5:
            runs.append(current)
        current = []
    if len(current) >= 5:
        runs.append(current)

    output = []
    for run in runs:
        start = run[0]
        if start["year"] < min_start_year:
            continue
        end = run[-1]
        values = [item["oni"] for item in run]
        output.append(
            [
                str(start["year"]),
                f"{season_name(start['month'])} {start['year']}",
                f"{season_name(end['month'])} {end['year']}",
                fixed(max(values) if target_phase == "El Nino" else min(values), 1, "도"),
                str(len(run)),
            ]
        )
    return sorted(output, key=lambda row: int(row[0]), reverse=True)


def source_rows() -> list[list[str]]:
    return [
        ["ONI", "NOAA/CPC ONI v5", "기본 ENSO 판정"],
        ["RONI", "NOAA/CPC RONI", "온난화 배경 민감도 보조 확인"],
        ["남한 기온·강수", "62개 지점 남한 평균자료 체계", "1991-2020 고정 평년 비교"],
        ["AO/NAO", "NOAA/CPC 월지수", "고위도 순환 보정"],
        ["해빙", "NSIDC Sea Ice Index", "북극·바렌츠·카라 해빙 보조"],
        ["유라시아 눈덮임", "Rutgers Global Snow Lab", "대륙 가열·제트 보조"],
        ["태풍", "IBTrACS/KMA 태풍자료", "경로·수증기 유입 별도 판단"],
    ]


def process_rows(mode: str) -> list[list[str]]:
    return [
        ["1", "자료 갱신", "ONI/RONI, 남한 월별 기온·강수, AO/NAO, 해빙, 유라시아 눈덮임, 태풍 자료를 최신화"],
        ["2", "상태 진단", f"공식 ONI {mode} episode 충족 여부와 조기 발달 신호를 분리"],
        ["3", "질문 분류", "상태 질문, 여름 기온, 강수, 장마, 태풍, 가을·겨울 영향으로 분류"],
        ["4", "기본 근거 선택", f"ONI {mode} phase 월별·계절연도 합성표를 먼저 확인"],
        ["5", "유사해 확인", "ONI episode 시작 시점, 최근 연도순, RONI 보조 여부, 보조 기후인자를 확인"],
        ["6", "지역 영향 판단", "기온·강수·태풍을 한 문장으로 묶지 않고 각각 판단"],
        ["7", "반대근거 기록", "평균과 반대되는 사례, 월별 방향 차이, 태풍·장마 예외를 명시"],
        ["8", "대외 문구 작성", "공식 판정, 감시 단계, 한반도 영향 판단을 분리해서 표현"],
        ["9", "검증·보관", "빌드, 테스트, PDF 렌더링 확인 후 git에 커밋"],
    ]


def el_nino_manual() -> tuple[str, list[Section]]:
    title = "엘니뇨 대응 매뉴얼"
    sections = [
        Section(
            "목적과 적용 범위",
            [
                make_paragraph(
                    "이 매뉴얼은 언론, 대국민 설명, 내부 보고에서 반복되는 '엘니뇨인가', '여름에 비가 많이 오는가', '폭염 또는 태풍 영향이 커지는가' 질문에 일관되게 대응하기 위한 운영 절차서입니다."
                ),
                make_bullets(
                    [
                        "기본 ENSO 지표는 ONI입니다. RONI는 보조 민감도 확인에만 사용합니다.",
                        "한반도 기온·강수 판단은 남한 평균 관측자료와 관측 기반 유사해를 우선합니다.",
                        "KMA 등 기관의 공식 기온·강수 전망 확률은 이 매뉴얼의 영향 판단 근거에서 제외합니다.",
                        "장마와 태풍은 ONI 직접효과가 아니라 별도 보정 레이어로 다룹니다.",
                    ]
                ),
            ],
        ),
        Section(
            "자료와 산출물",
            [
                make_table(["자료", "출처", "역할"], source_rows()),
                make_paragraph(
                    "canonical 산출물은 data/output/final/enso_response_system/ 아래에 두고, PDF 매뉴얼은 output/pdf/enso_manuals/ 아래에 보관합니다."
                ),
            ],
        ),
        Section(
            "전체 대응 프로세스",
            [
                make_table(["단계", "작업", "세부 내용"], process_rows("El Nino"), wide=True),
            ],
        ),
        Section(
            "공식 판정과 조기 소통",
            [
                make_callout("공식 선언은 늦고, 감시는 빠르게 한다."),
                make_paragraph(
                    "엘니뇨는 한 달 해수온이 높다고 바로 선언하지 않습니다. Niño3.4 해역의 3개월 이동평균이 +0.5°C 이상이고 이 상태가 여러 계절 지속되는지 확인해야 합니다. 따라서 공식 ONI 판정은 원래 사후 확인 성격이 있습니다."
                ),
                make_table(
                    ["상황", "권장 표현", "피해야 할 표현"],
                    [
                        ["한 달 또는 주별 SST가 +0.5°C 부근", "엘니뇨 쪽으로 기울고 있다", "엘니뇨 발생"],
                        ["3개월 평균이 +0.5°C 이상이나 지속성 미확인", "엘니뇨 발달 가능성이 커졌다", "엘니뇨 확정"],
                        ["ONI episode 충족", "공식 기준상 엘니뇨 상태", "단순 고수온"],
                    ],
                ),
            ],
        ),
        Section(
            "관측자료 기반 영향 판단",
            [
                make_paragraph(
                    "계절 표본은 완전한 계절연도 기준입니다. JJA는 한 해의 6-8월을 합산·평균한 1개 여름입니다."
                ),
                make_table(
                    ["계절", "표본", "기온편차", "고온비율", "강수평년비", "기온 신호", "강수 신호"],
                    phase_season_rows("El Nino"),
                    wide=True,
                ),
                make_table(
                    ["월", "표본", "기온편차", "강수평년비", "기온 신호", "강수 신호"],
                    phase_month_rows("El Nino"),
                    wide=True,
                ),
            ],
        ),
        Section(
            "ONI 발달해와 유사해 절차",
            [
                make_paragraph(
                    "ONI 발달해 전체는 1979년 이후 ONI warm episode 시작이 AMJ-SON인 해입니다. MJJ-ASO 여름 전환형은 여름 중 전환 질문에만 쓰는 부분집합입니다. RONI는 보조 표기로만 남깁니다."
                ),
                make_table(
                    ["연도", "ONI 시작", "JJA 기온편차", "기온 부호", "JJA 강수비", "강수 부호", "태풍 근접"],
                    el_nino_analog_rows(),
                    wide=True,
                ),
            ],
        ),
        Section(
            "발달기·소멸기별 영향",
            [
                make_paragraph(
                    "발달기와 소멸기는 공식 ONI episode 안에서만 구분합니다. 엘니뇨는 episode 시작부터 첫 번째 ONI 최댓값까지를 발달기, 이후 episode 종료까지를 소멸기로 둡니다. 정점 계절은 발달기에 포함합니다."
                ),
                make_table(
                    ["단계", "계절", "표본", "기온편차", "강수평년비", "기온 신호", "강수 신호"],
                    lifecycle_rows("El Nino"),
                    wide=True,
                ),
                make_bullets(
                    [
                        "발달기는 여름 전환·가을 지속 질문에 우선 참고하지만, 한반도 여름 폭염·다우·태풍 증가는 별도 순환 조건이 필요합니다.",
                        "소멸기는 다음 봄·여름 질문에서 잔류 영향 가능성을 설명할 때 쓰되, 월별 표본과 장마·태풍 보정 레이어를 반드시 함께 봅니다.",
                        "표에 없는 단계·계절 조합은 완전한 계절연도 표본이 없어 제시하지 않습니다.",
                        "표본이 작으므로 발달기·소멸기 표는 기본 월별·계절별 ONI 표를 대체하지 않습니다.",
                    ]
                ),
            ],
        ),
        Section(
            "장마·태풍 대응",
            [
                make_bullets(
                    [
                        "장마 시작·종료는 ONI로 직접 판정하지 않습니다. 정체전선 위치, 북태평양고기압 가장자리, 상층 제트, 저기압 통과를 함께 봅니다.",
                        "계절 누적 강수와 단기 집중호우 위험을 분리합니다.",
                        "태풍은 발생 수보다 경로, 북태평양고기압 가장자리, 중위도 기압골, 전선 위치, 접근 시점의 수증기 공급을 중심으로 설명합니다.",
                        "IBTrACS 500km 접근값은 참고자료이며 KMA 공식 영향태풍 판정을 대체하지 않습니다.",
                    ]
                ),
            ],
        ),
        Section(
            "답변 템플릿",
            [
                make_callout(
                    "공식 기준으로는 아직 확정 전입니다. 하지만 엘니뇨 쪽으로 발달하는 신호는 감시 중입니다. 현재 단계의 정확한 표현은 '엘니뇨 발생'이 아니라 '엘니뇨 발달 가능성'입니다. 한반도 영향은 실제 해수온 변화, 대기 반응, 장마전선, 북태평양고기압, 태풍 경로를 함께 보겠습니다."
                ),
                make_table(
                    ["질문", "답변 방향"],
                    [
                        ["엘니뇨가 발달하면 여름에 비가 많이 오나?", "ONI만으로는 단정하지 않고 월별 강수와 장마·태풍 보정 레이어를 함께 제시"],
                        ["엘니뇨가 발달하면 폭염이 오나?", "ONI 단독보다 북태평양고기압, 고온다습 남서류, 해양열용량 결합 여부를 강조"],
                        ["태풍은 늘어나나?", "개수보다 경로와 수증기 유입 시점이 핵심이라고 설명"],
                    ],
                ),
            ],
        ),
        Section(
            "갱신과 검증",
            [
                make_code(["npm run build:enso-response", ".venv-pdf/bin/python scripts/build_enso_manuals.py", "npm test"]),
                make_paragraph(
                    "매뉴얼 갱신 후에는 PDF 첫 페이지와 표가 많은 페이지를 PNG로 렌더링하여 한글 깨짐, 표 잘림, 페이지 번호를 확인합니다."
                ),
            ],
        ),
    ]
    return title, sections


def la_nina_manual() -> tuple[str, list[Section]]:
    title = "라니냐 대응 매뉴얼"
    sections = [
        Section(
            "목적과 적용 범위",
            [
                make_paragraph(
                    "이 매뉴얼은 '라니냐인가', '겨울 한파·건조가 강해지는가', '여름·가을 강수와 태풍은 어떻게 봐야 하는가' 질문에 대응하기 위한 별도 운영 절차서입니다."
                ),
                make_bullets(
                    [
                        "기본 ENSO 지표는 ONI입니다. RONI는 보조 민감도 확인에만 사용합니다.",
                        "라니냐도 한 달 해수온만으로 선언하지 않고 3개월 이동평균과 지속성을 확인합니다.",
                        "한반도 영향은 La Nina phase 합성표와 월별·계절별 관측자료를 우선합니다.",
                        "한파, 건조, 폭설, 태풍은 AO, 시베리아고기압, 동아시아 겨울몬순, 북태평양고기압, 경로 보정을 함께 적용합니다.",
                    ]
                ),
            ],
        ),
        Section(
            "자료와 산출물",
            [
                make_table(["자료", "출처", "역할"], source_rows()),
                make_paragraph(
                    "라니냐 매뉴얼은 현재 ONI phase 합성표를 기본 근거로 사용합니다. 별도 라니냐 유사해 거리표가 필요한 경우 동일한 manifest 구조로 cold episode analog metrics를 확장합니다."
                ),
            ],
        ),
        Section(
            "전체 대응 프로세스",
            [
                make_table(["단계", "작업", "세부 내용"], process_rows("La Nina"), wide=True),
            ],
        ),
        Section(
            "공식 판정과 조기 소통",
            [
                make_callout("공식 선언은 늦고, 감시는 빠르게 한다."),
                make_paragraph(
                    "라니냐는 Niño3.4 해역의 3개월 이동평균이 -0.5°C 이하이고 이 상태가 여러 계절 지속되는지를 확인해야 합니다. 따라서 '라니냐 확정'과 '라니냐 쪽으로 기울고 있음'을 분리해 말합니다."
                ),
                make_table(
                    ["상황", "권장 표현", "피해야 할 표현"],
                    [
                        ["한 달 또는 주별 SST가 -0.5°C 부근", "라니냐 쪽으로 기울고 있다", "라니냐 발생"],
                        ["3개월 평균이 -0.5°C 이하이나 지속성 미확인", "라니냐 발달 가능성이 커졌다", "라니냐 확정"],
                        ["ONI cold episode 충족", "공식 기준상 라니냐 상태", "단순 저수온"],
                    ],
                ),
            ],
        ),
        Section(
            "관측자료 기반 영향 판단",
            [
                make_paragraph(
                    "라니냐 영향도 계절 평균만으로 단정하지 않습니다. 월별 방향, AO, 시베리아고기압, 동아시아 겨울몬순, 장마·태풍 경로를 함께 봅니다."
                ),
                make_table(
                    ["계절", "표본", "기온편차", "고온비율", "강수평년비", "기온 신호", "강수 신호"],
                    phase_season_rows("La Nina"),
                    wide=True,
                ),
                make_table(
                    ["월", "표본", "기온편차", "강수평년비", "기온 신호", "강수 신호"],
                    phase_month_rows("La Nina"),
                    wide=True,
                ),
            ],
        ),
        Section(
            "ONI cold episode와 유사해 절차",
            [
                make_paragraph(
                    "라니냐 유사해는 ONI cold episode 시작 시점, 강도, 지속 기간, 최근 기후 배경을 기준으로 구성합니다. RONI는 보조 민감도 확인이며 기본 표본을 대체하지 않습니다."
                ),
                make_table(
                    ["시작연도", "시작", "종료", "최저 ONI", "지속 계절수"],
                    oni_episodes("La Nina"),
                    wide=True,
                ),
            ],
        ),
        Section(
            "발달기·소멸기별 영향",
            [
                make_paragraph(
                    "발달기와 소멸기는 공식 ONI episode 안에서만 구분합니다. 라니냐는 episode 시작부터 첫 번째 ONI 최솟값까지를 발달기, 이후 episode 종료까지를 소멸기로 둡니다. 저점 계절은 발달기에 포함합니다."
                ),
                make_table(
                    ["단계", "계절", "표본", "기온편차", "강수평년비", "기온 신호", "강수 신호"],
                    lifecycle_rows("La Nina"),
                    wide=True,
                ),
                make_bullets(
                    [
                        "발달기는 가을·겨울 한파와 건조 질문에서 보조 확인하지만, AO와 동아시아 겨울몬순을 함께 봐야 합니다.",
                        "소멸기는 봄철 저온·강수 및 여름 장마·태풍 질문에서 별도 확인하되, 위상 자체보다 계절 순환을 우선합니다.",
                        "표에 없는 단계·계절 조합은 완전한 계절연도 표본이 없어 제시하지 않습니다.",
                        "표본이 작으므로 발달기·소멸기 표는 기본 월별·계절별 ONI 표를 대체하지 않습니다.",
                    ]
                ),
            ],
        ),
        Section(
            "겨울·강수·태풍 대응",
            [
                make_bullets(
                    [
                        "겨울 한파는 라니냐 단독보다 AO, 시베리아고기압, 동아시아 겨울몬순 강화 여부를 함께 봅니다.",
                        "강수와 적설은 계절 누적보다 저기압 경로, 찬 공기 남하 시점, 해기차, 서해안 효과를 분리해 설명합니다.",
                        "여름·가을 태풍은 라니냐 여부보다 북태평양고기압 위치와 중위도 기압골, 열대 대류 위치가 중요합니다.",
                        "라니냐라서 곧바로 한파·건조·폭설이 확정된다는 표현은 피합니다.",
                    ]
                ),
            ],
        ),
        Section(
            "답변 템플릿",
            [
                make_callout(
                    "공식 기준으로는 아직 확정 전입니다. 하지만 라니냐 쪽으로 발달하는 신호는 감시 중입니다. 현재 단계의 정확한 표현은 '라니냐 발생'이 아니라 '라니냐 발달 가능성'입니다. 한반도 영향은 실제 해수온 변화, 대기 반응, AO, 시베리아고기압, 동아시아 겨울몬순, 저기압 경로를 함께 보겠습니다."
                ),
                make_table(
                    ["질문", "답변 방향"],
                    [
                        ["라니냐면 겨울이 무조건 춥나?", "La Nina phase 통계와 AO/EAWM 보정을 함께 제시"],
                        ["라니냐면 비가 적나?", "월별·계절별 강수 신호와 저기압 경로 예외를 함께 설명"],
                        ["라니냐면 태풍 영향이 커지나?", "개수보다 북태평양고기압 위치와 경로를 중심으로 설명"],
                    ],
                ),
            ],
        ),
        Section(
            "갱신과 검증",
            [
                make_code(["npm run build:enso-response", ".venv-pdf/bin/python scripts/build_enso_manuals.py", "npm test"]),
                make_paragraph(
                    "라니냐 유사해 거리표를 추가할 경우, 엘니뇨 analog_year_metrics와 같은 manifest, 기준 플래그, 실제 자료 기반 회귀 테스트를 함께 추가합니다."
                ),
            ],
        ),
    ]
    return title, sections


def render_markdown(title: str, sections: list[Section], path: Path) -> None:
    lines = [
        f"# {title}",
        "",
        f"- 작성일: {TODAY}",
        "- 기준: ONI 기본, RONI 보조, 남한 평균 관측자료 기반",
        "- 산출물 성격: 언론·대국민·내부 보고 대응 매뉴얼",
        "",
    ]
    for section in sections:
        lines.extend([f"## {section.title}", ""])
        for block in section.blocks:
            if block["type"] == "paragraph":
                lines.extend([block["text"], ""])
            elif block["type"] == "callout":
                lines.extend([f"> {block['text']}", ""])
            elif block["type"] == "bullets":
                lines.extend([f"- {item}" for item in block["items"]])
                lines.append("")
            elif block["type"] == "code":
                lines.extend(["```bash", *block["lines"], "```", ""])
            elif block["type"] == "table":
                lines.extend([markdown_table(block["headers"], block["rows"]), ""])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def register_font() -> str:
    candidates = [
        Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf"),
        Path("/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            pdfmetrics.registerFont(TTFont("Korean", str(candidate)))
            return "Korean"
    return "Helvetica"


def styles(font_name: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ManualTitle",
            parent=base["Title"],
            fontName=font_name,
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#12324A"),
            spaceAfter=12,
            wordWrap="CJK",
        ),
        "meta": ParagraphStyle(
            "ManualMeta",
            parent=base["Normal"],
            fontName=font_name,
            fontSize=9,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=14,
            wordWrap="CJK",
        ),
        "h1": ParagraphStyle(
            "ManualHeading1",
            parent=base["Heading1"],
            fontName=font_name,
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#12324A"),
            spaceBefore=10,
            spaceAfter=7,
            keepWithNext=True,
            wordWrap="CJK",
        ),
        "body": ParagraphStyle(
            "ManualBody",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=9.5,
            leading=15,
            alignment=TA_LEFT,
            spaceAfter=7,
            wordWrap="CJK",
        ),
        "callout": ParagraphStyle(
            "ManualCallout",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=10,
            leading=15,
            leftIndent=6,
            rightIndent=6,
            textColor=colors.HexColor("#0F5132"),
            backColor=colors.HexColor("#EAF6EE"),
            borderColor=colors.HexColor("#9BC7A7"),
            borderWidth=0.6,
            borderPadding=6,
            spaceAfter=8,
            wordWrap="CJK",
        ),
        "code": ParagraphStyle(
            "ManualCode",
            parent=base["Code"],
            fontName=font_name,
            fontSize=8.5,
            leading=12,
            leftIndent=6,
            backColor=colors.HexColor("#F3F4F6"),
            borderPadding=5,
            spaceAfter=8,
            wordWrap="CJK",
        ),
        "table": ParagraphStyle(
            "ManualTable",
            parent=base["BodyText"],
            fontName=font_name,
            fontSize=7.2,
            leading=9,
            wordWrap="CJK",
        ),
    }


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    escaped = (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )
    return Paragraph(escaped, style)


def pdf_table(headers: list[str], rows: list[list[str]], style_map: dict[str, ParagraphStyle]) -> Table:
    data = [[paragraph(cell, style_map["table"]) for cell in headers]]
    data.extend([[paragraph(cell, style_map["table"]) for cell in row] for row in rows])
    table = Table(data, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCEAF5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#12324A")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B8C3CC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def footer(canvas, doc, title: str, font_name: str) -> None:
    canvas.saveState()
    canvas.setFont(font_name, 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(18 * mm, 11 * mm, title)
    canvas.drawRightString(192 * mm, 11 * mm, f"{doc.page}")
    canvas.restoreState()


def render_pdf(title: str, sections: list[Section], path: Path) -> None:
    font_name = register_font()
    style_map = styles(font_name)
    story = [
        Paragraph(title, style_map["title"]),
        Paragraph(
            f"작성일: {TODAY}<br/>ONI 기본, RONI 보조, 남한 평균 관측자료 기반 대응 프로세스",
            style_map["meta"],
        ),
        Spacer(1, 4),
    ]

    for section_index, section in enumerate(sections):
        if section_index == 1:
            story.append(PageBreak())
        story.append(Paragraph(section.title, style_map["h1"]))
        for block in section.blocks:
            if block["type"] == "paragraph":
                story.append(paragraph(block["text"], style_map["body"]))
            elif block["type"] == "callout":
                story.append(paragraph(block["text"], style_map["callout"]))
            elif block["type"] == "bullets":
                items = [
                    ListItem(paragraph(item, style_map["body"]), leftIndent=8)
                    for item in block["items"]
                ]
                story.append(ListFlowable(items, bulletType="bullet", leftIndent=12))
                story.append(Spacer(1, 4))
            elif block["type"] == "code":
                story.append(paragraph("\n".join(block["lines"]), style_map["code"]))
            elif block["type"] == "table":
                story.append(pdf_table(block["headers"], block["rows"], style_map))
                story.append(Spacer(1, 8))

    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="Korea Observation Data ENSO response system",
    )
    doc.build(
        story,
        onFirstPage=lambda canvas, doc_obj: footer(canvas, doc_obj, title, font_name),
        onLaterPages=lambda canvas, doc_obj: footer(canvas, doc_obj, title, font_name),
    )


def build_manual(title: str, sections: list[Section], stem: str) -> None:
    render_markdown(title, sections, MANUAL_MD_DIR / f"{stem}.md")
    render_pdf(title, sections, MANUAL_PDF_DIR / f"{stem}.pdf")


def main() -> None:
    MANUAL_MD_DIR.mkdir(parents=True, exist_ok=True)
    MANUAL_PDF_DIR.mkdir(parents=True, exist_ok=True)
    title, sections = el_nino_manual()
    build_manual(title, sections, "el_nino_response_manual")
    title, sections = la_nina_manual()
    build_manual(title, sections, "la_nina_response_manual")
    print(f"Manual Markdown written to {MANUAL_MD_DIR}")
    print(f"Manual PDFs written to {MANUAL_PDF_DIR}")


if __name__ == "__main__":
    main()
