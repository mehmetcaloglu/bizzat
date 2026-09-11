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

When the exact operational snapshot is unavailable, do not substitute a different current/mirror snapshot and claim equivalence. A bounded reviewed delta may be applied only when the exact source codes/labels and marketplace paths are independently evidenced, every previous canonical/mapping identity is asserted unchanged, and the manifest/docs explicitly record that full-snapshot regeneration is still outstanding.

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

The original 27,906-row operational normalized snapshot file was not available in this continuation workspace or Library. Its existing manifest checksum was therefore kept unchanged and no full-snapshot regeneration was claimed at that stage. The eight-code Megane increment was applied as an explicit deterministic delta against the reviewed `2026-09-09.3` baseline with invariants that every previous 53 series, 589 models and 823 mappings remained byte-equivalent as JSON objects.

Post-delta state: 19 brands / 54 series / 593 selectable models / 831 mappings, with 6,048 model-review rows. Megane's backlog became 8 mapped / 179 model-review / 4 selectable leaves. Final clean CI for this increment passed on run `34463680019` with PostgreSQL 18 importing the real 19/54/593 catalog, 142 API unit tests, 31 PostgreSQL integration tests and 3 web tests.

## Continuation — 2026-09-10 Ford Focus increment

The next large uncovered group was `ford:focus` (218 source rows, initially 0 mapped / 218 model-review / 0 selectable leaves). Sahibinden's first-party index for `Ford → Focus → 1.5 TDCi` explicitly exposed four children:

- `ST Line`
- `Style`
- `Titanium`
- `Trend X`

Six exact August 2026 TSB source-code labels were accepted:

- `53-2123` → `1.5 TDCi → Style`
- `53-2126` → `1.5 TDCi → Titanium`
- `53-2120` → `1.5 TDCi → Trend X`
- `53-2196` → `1.5 TDCi → ST Line`
- `53-2251` → `1.5 TDCi → Trend X`
- `53-2254` → `1.5 TDCi → Trend X`

Focus was deliberately **not** added to `reviewedTechnicalPolicySeries`. `III MCA`, 4K/5K, PWS/PowerShift, E6.2 and 8S AT source notation are not picker branches. `FOCUS 1.5 TDCI 120 SW TREND X E6`, near 5K Style/Titanium labels and unknown trims remain review-only instead of being inferred into the accepted paths.

TDD again used two layers. The code-level red run (`34464495566`) failed the six positive mappings and generator expectation while all four negative review-only cases stayed null. After adding only the six-label exact map, the Focus suite passed 11/11 and the full code-level CI (`34464691574`) completed successfully. The committed-data test was then added and the next run (`34464853588`) failed only because `ford:focus` was not yet present in committed artifacts; every Focus code/generator test and prior Megane/data test remained green.

The reviewed artifact delta was applied against `2026-09-10.1` with explicit invariants preserving every prior series/model/mapping object. It added exactly one series, four selectable leaves and six mappings. The original operational normalized snapshot remained unavailable at that stage, so its August checksum was retained and no full-snapshot regeneration was claimed then.

Post-delta artifact state is **19 brands / 55 series / 597 selectable models / 837 mappings**, with **6,042 model-review rows**. Focus's backlog becomes 6 mapped / 212 model-review / 4 selectable leaves. Ford coverage becomes 9 mapped / 389 model-review / 1,164 excluded / 7 selectable leaves across 1,562 source rows. Final clean PostgreSQL 18 CI passed on run `34465460998`: the real 19/55/597 catalog imported successfully, with 154 API unit tests, 31 PostgreSQL integration tests and 3 web tests.

## Continuation — 2026-09-10 Opel Astra increment

The next reviewed uncovered group was `opel:astra` (195 source rows, initially 0 mapped / 195 model-review / 0 selectable leaves). To avoid converting generic TSB `DIZEL` notation into a marketplace engine badge, the increment deliberately targeted only source rows whose own labels explicitly contain `1.3 CDTI` and whose marketplace paths were independently verified:

- `1.3 CDTI → Cosmo`
- `1.3 CDTI → Sport`
- `1.3 CDTI → Enjoy Plus`

Four exact source codes were accepted:

- `111-717` / `1.3 CDTI 95 COSMO` → `1.3 CDTI → Cosmo`
- `111-716` / `1.3 CDTI 95 SPORT` → `1.3 CDTI → Sport`
- `111-715` / `1.3 CDTI 95 ENJOY PLUS` → `1.3 CDTI → Enjoy Plus`
- `111-1011` / `1.3 CDTI 95 ENJOY PLUS` → `1.3 CDTI → Enjoy Plus`

Astra was deliberately **not** added to `reviewedTechnicalPolicySeries`. `SEDAN SPORT 1.3 CDTI 95` remains review-only because the body path is not resolved in this increment; `DIZEL ENJOY ACTIVE 1.3 95` and `DIZEL S&S SPORT 1.3 95` remain review-only because generic `DIZEL` is not silently interpreted as `CDTI`; `1.3 CDTI 95 ENJOY` remains review-only because that marketplace leaf was not independently accepted here.

TDD again used code and committed-data gates. The initial Astra red run (`34465902425`) failed the four positive exact mappings plus the generator expectation while all explicit negative cases stayed null. After adding the narrow exact map, run `34466131009` passed the code-level suite. A committed-data regression was then added; run `34466303908` failed only because the reviewed Astra records had not yet been published. The deterministic artifact delta then added exactly one series, three selectable leaves and four mappings while preserving every prior series/model/mapping object.

The original 27,906-row operational normalized snapshot remained unavailable at publication time. The manifest therefore retained the exact August checksum and the Astra publication was explicitly a bounded reviewed delta. Post-delta artifact state is **19 brands / 56 series / 600 selectable models / 841 mappings**, with **6,038 model-review rows**. Astra's backlog is 4 mapped / 191 model-review / 3 selectable leaves. The publication workflow verified PostgreSQL import of the real 19/56/600 catalog plus **164 API unit + 31 PostgreSQL integration + 3 web = 198 tests**, lint, typecheck, build and Next standalone output. The temporary write-enabled publication workflow was removed before normal-CI verification.

## Validation — 2026-09-11 exact source reproducibility

The historical acquisition/normalization script was recovered from repository history at commit `b9ae77a6afa57dd3c64b36de6324af13561d7df5` and run again against the official TSB archive. Fresh acquisition reproduced the exact recorded August source: **27,906 normalized records** and SHA-256 `768140c3952ced1eb614eb0dfb57c519e6b127109591b862d629adf84d34b550`.

The first full regeneration correctly exposed two real deterministic-boundary bugs rather than being waved through: narrowly reviewed exact labels were not also constrained by source code, which produced four unintended Megane mappings (`123-2052`, `123-2054`, `123-2106`, `123-2107`), and reviewed series display names could drift back to pinned bootstrap spelling. Five regression tests were added first; the RED CI left the previous 164 API/unit tests green while all five new regressions failed for those exact causes.

The fixes enforce explicit source-code scope for the narrowly reviewed Seat Ibiza, Renault Megane, Ford Focus and Opel Astra selections, and preserve existing reviewed baseline series display names during regeneration. Normal CI then passed with **169 API/unit tests** plus the existing integration/web suites.

The exact source was reacquired again and full regeneration rerun with the pinned `global-car-models` commit `44da5c9e5e0f3162d65579033f7a641473308b11` and the current reviewed baseline. Run `34589816322` produced exactly **19 brands / 56 series / 600 models / 841 mappings / 6,038 model-review rows**. Brand, series, model and mapping diff sets were empty, and both `catalog.json` and `tsb-mappings.json` were **byte-for-byte identical** to regenerated artifacts (`catalogByteEqual=true`, `mappingsByteEqual=true`).

The one-shot network verification workflow was deleted immediately afterward; permanent CI remains offline/read-only. Source reproducibility is now **PASS**. This closes the provenance/regeneration merge gate but does not change the separate product fact that catalog coverage is still partial. Detailed evidence is recorded in `docs/reference/VEHICLE_REPRODUCIBILITY.md`. PR #11 remains draft and unmerged pending the next scope/review decision.
