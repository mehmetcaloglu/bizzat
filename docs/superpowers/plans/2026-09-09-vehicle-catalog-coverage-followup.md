# Vehicle catalog coverage follow-up

Continuation authorized by the user's “Devam et” after the status of PR #11. Binding spec: `../specs/2026-09-09-vehicle-picker-parity.md`.

## Global constraints

Retain the reviewed baseline's existing model and branch identities. Variable-depth selection paths and the existing ten series normalization policies remain authoritative. No global technical/body stripping, inferred engines from horsepower, fuzzy mapping, new DB/API layers, raw source/prices in git, or runtime network calls. Partial coverage is not merge readiness. Work in the existing dedicated draft branch and preserve real remote ancestry when publishing changes.

## Task 1: Correct known false negatives and restore separate Accent nameplates

1. Fix the engine-match whitespace bug in `model-label.ts`. The existing optional engine-technology regex consumes trailing spaces even when no technology matches; then the positional power helper sees no leading separator and rejects a valid bare-displacement source. Reproductions: Polo `1.0 75 TRENDLINE` and Clio `JOY 1.2 16V 75` return null, while Polo `1.0 TSI 95 TRENDLINE` works. Put the separator inside the optional technology group so engine-adjacent power handling works as already specified. Test before fixing. Keep unreviewed series fail-closed and prefix/infix/post-trim numbered distinctions intact. Do not infer TCe/TSI or an engine from horsepower. Full-source review found ambiguous Clio bare `1.2 120` rows (`122-1163`, `122-1164`) would join `1.2 75` under Icon; keep these explicit missing-technology cases in review with a paired regression instead of inferring TCe or merging them.
2. Add separate `hyundai:accent-blue` and `hyundai:accent-era` reviewed series aliases for `ACCENT BLUE` / `ACCENT ERA`. Generic `hyundai:accent` retains only `ACCENT`. Test real source cases `177-1014` and `177-406`, plus generic Accent and technical unknowns. Do not reparent retired old generic model keys or add normalization policies for the new series. Display names must be `Accent Blue` and `Accent Era`.
3. Add a narrowly reviewed Seat Ibiza policy using the three exact indexed paths in `docs/reference/VEHICLE_COVERAGE_FOLLOWUP.md`: `1.4 → Reference`, `1.0 → Style`, `1.0 EcoTSI → FR`. Only these complete engine/trim pairs are eligible; do not form their Cartesian product. Seven source rows were cross-checked: `19-1035`, `19-245`; `19-1097`, `19-1124`, `19-1140`; `19-1103`, `19-1153`. Keep SC/ST/Sport Tourer/Sedan/HB and unknown engine/trim combinations outside this increment. No generic engine/power-inference table or new DB/API schema is needed.

Allowed implementation scope remains the existing curation flow and reviewed data artifacts. Do not commit raw input or use new sources without evidence.

## Task 2: Regenerate and review the coverage increment

Generate from the existing 27,906-row August 2026 source with the previous reviewed catalog/mapping baseline. Inspect every added/reassigned mapping and all newly generated paths. Preserve all previous leaf IDs/paths; keep ambiguous rows in review. Publish catalog/mappings/manifest together with accurate counts and source provenance. Add an aggregate per-series backlog so missing coverage is actionable; never claim backlog rows equal missing models. Record current web retrieval limits honestly. Repeat generation with the new baseline and verify exact results.

## Task 3: Verify and publish the draft increment

Run task review, required checks and full PostgreSQL 18 CI on the updated PR head. Update PR #11; it remains draft/unmerged while data coverage is partial.

## Validation record — 2026-09-09 increment

Task review: specification and code quality PASS, no material findings. Focused curation tests 77/77 and full API unit suite 129/129 passed; API lint/typecheck passed. PostgreSQL 18 CI passed on the published draft head.

The full snapshot generated 19 brands / 53 series / 589 models / 823 mappings. Compared with the prior reviewed baseline, all 567 model records and 790 mappings were unchanged; 33 source mappings and 22 leaves were added. The seven Ibiza source codes produced only the three referenced pairs. Clio `122-1163` / `122-1164` remained in review. Regeneration from the new baseline produced catalog/mapping files byte-for-byte identical to the committed candidates. Backlog totals reconciled to 27,906 records and 6,056 model-review rows. This remained partial coverage, not full catalog approval.

## Continuation — 2026-09-10 Renault Megane increment

The next large uncovered group selected was `renault:megane` (187 source rows, initially 0 mapped / 187 model-review / 0 selectable leaves). Sahibinden public first-party index evidence verified only four paths for this bounded increment:

- `1.5 dCi → Icon`
- `1.5 dCi → Joy`
- `1.5 dCi → GT Line`
- `1.6 → Joy`

Eight exact August-source codes were reviewed against those paths: `122-1160`, `122-1161`, `122-1107`, `122-1108`, `122-1088`, `122-1089`, `122-1105`, `122-1106`. Megane was deliberately **not** added to `reviewedTechnicalPolicySeries`; EDC/CVT, horsepower and HB/Sedan source notation do not become picker branches. Near variants remain review-only.

TDD was run in two layers. First, the eight positive exact-selection cases failed while three explicit negative cases remained null; adding the narrow exact map turned the focused tests green. Second, a committed-data regression was added and intentionally failed while `catalog.json` still lacked Megane; the reviewed artifact delta then supplied exactly one new series, four leaves and eight mappings.

The original 27,906-row operational normalized snapshot file was not available in this continuation workspace or Library. Its existing manifest checksum was therefore kept unchanged and no full-snapshot regeneration was claimed. The eight-code Megane increment was applied as an explicit deterministic delta against the reviewed `2026-09-09.3` baseline with invariants that every previous 53 series, 589 models and 823 mappings remained byte-equivalent as JSON objects. Full regeneration remains a follow-up validation when the exact operational snapshot becomes available again.

Post-delta expected state is 19 brands / 54 series / 593 selectable models / 831 mappings, with 6,048 model-review rows. Megane's backlog becomes 8 mapped / 179 model-review / 4 selectable leaves. The PR remains draft and unmerged because overall catalog coverage is still partial.
