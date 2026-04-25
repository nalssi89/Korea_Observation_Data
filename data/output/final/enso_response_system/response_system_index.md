# ENSO 대응 체계 산출물 안내

- 기본 지표는 ONI입니다.
- RONI는 보조 확인으로만 사용합니다.
- 남한 기온·강수는 기존 1991~2020 평년 및 기존 대표지점 적용값을 그대로 사용합니다.
- 기온·강수 판단에는 기관 공식 전망이나 확률전망을 사용하지 않습니다.
- 티벳 눈덮임은 현재 범위에서 제외했습니다.

| 파일 | 내용 | 사용 시점 |
| --- | --- | --- |
| evidence_registry.md | ONI, RONI, 남한 자료, AO/NAO, 해빙, 유라시아 눈덮임의 적용 규칙 | 자료 기준을 설명할 때 먼저 확인 |
| monthly_effect_table.md | ONI 위상별 1~12월 기온·강수 영향표 | 월별 질문 대응 |
| seasonal_effect_table.md | ONI 위상별 DJF/MAM/JJA/SON 기온·강수 영향표 | 계절 전망 질문 대응 |
| climate_factor_modifier_table.md | AO, NAO, 해빙, 유라시아 눈덮임으로 ONI 결론을 보정 | 유사해 우선순위와 반대근거 확인 |
| analog_year_cards.md | ONI 중심 유사해와 RONI 보조 사례 | 과거 유사해 질문 대응 |
| changma_typhoon_reference.md | 장마·태풍을 ONI 직접효과와 분리하는 해석표 | 장마, 집중호우, 태풍 질문 대응 |
| question_answer_matrix.md | 실제 질문별 짧은 답, 근거, 반대근거, 실무 문구 | 대외·내부 Q&A 초안 |
| 2026_summer_enso_korea_objective_response.md | 2026년 4월 엘니뇨 발달 시나리오에 대한 관측자료 기반 예시 답변 | 실제 문의 대응 예시 |

## 재생성

```bash
npm run build:enso-response
```
