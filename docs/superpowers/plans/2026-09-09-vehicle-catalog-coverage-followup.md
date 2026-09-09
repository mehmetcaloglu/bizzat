# Vehicle catalog coverage follow-up

Continuation authorized by the user's “Devam et” after the status of PR #11. Binding spec: `../specs/2026-09-09-vehicle-picker-parity.md`.

## Global constraints

Retain the reviewed baseline's existing model and branch identities. Variable-depth selection paths and the existing ten series normalization policies remain authoritative. No global technical/body stripping, inferred engines from horsepower, fuzzy mapping, new DB/API layers, raw source/prices in git, or runtime network calls. Partial coverage is not merge readiness. Work in the existing dedicated draft-branch checkout; preserve remote ancestry through Git Data API.

## Task 1: Correct known false negatives and restore separate Accent nameplates

Two bounded corrections to existing curation behavior:

1. Fix the engine-match whitespace bug in `model-label.ts`. The existing optional engine-technology regex consumes trailing spaces even when no technology matches; then the positional power helper sees no leading separator and rejects a valid bare-displacement source. Reproductions: Polo `1.0 75 TRENDLINE` and Clio `JOY 1.2 16V 75` return null, while Polo `1.0 TSI 95 TRENDLINE` works. Put the separator inside the optional technology group so engine-adjacent power handling works as already specified. Test before fixing. Keep unreviewed series fail-closed and prefix/infix/post-trim numbered distinctions intact. Do not infer TCe/TSI or an engine from horsepower. Full-source review found ambiguous Clio bare `1.2 120` rows (122-1163,122-1164) would join `1.2 75` under Icon; keep these explicit missing-technology cases in review with a paired regression instead of inferring TCe or merging them.
2. Add separate `hyundai:accent-blue` and `hyundai:accent-era` reviewed series aliases for `ACCENT BLUE` / `ACCENT ERA`. Generic `hyundai:accent` retains only `ACCENT`. The earlier whole-change review and spec verified these distinct marketplace nameplates. Replace the old regression expecting these rows to stay unselectable with a regression proving they resolve to distinct new series/paths and never generic Accent. Test real source cases `177-1014` (`ACCENT BLUE 1.6 CRDI MODE PLUS`) and `177-406` (`ACCENT ERA 1.5 CRDI MODE`), plus generic Accent and technical unknowns. Do not reparent retired old generic model keys or add normalization policies for the new series. Display names must be `Accent Blue` and `Accent Era`.


3. Add a narrowly reviewed Seat Ibiza policy using the three exact indexed paths in `docs/reference/VEHICLE_COVERAGE_FOLLOWUP.md`: `1.4 → Reference`, `1.0 → Style`, `1.0 EcoTSI → FR`. Only these complete engine/trim pairs are eligible; do not form their Cartesian product. Seven source rows were cross-checked: 19-1035,19-245;19-1097,19-1124,19-1140;19-1103,19-1153 respectively. Support scoped `REFERANCE` spelling and `1.0 EVO 80` source detail, EcoTSI spelling, and reviewed FL/DSG/S&S technical tokens. Keep SC/ST/Sport Tourer/Sedan/HB and unknown engine/trim combinations outside this increment. Do not add EcoTSI acceptance or typo normalization for other series as a side effect. Use meaningful paired acceptance/rejection tests; all old-series policies and behavior must be unchanged except the already specified separator fix. No generic engine/power-inference table or new DB/API schema is needed.

Allowed implementation files: model-label.ts, existing vehicle-curation.test.ts, series-aliases.json. Parent supplies display-name bootstrap labels, generated artifacts, manifest and documentation. Run focused test red/green, API lint/typecheck. Do not commit raw input or use new sources without evidence. Do not spawn subagents or change remote refs. Report changes, exact checks, concerns and any source expansion risks.

## Task 2: Regenerate and review the coverage increment

Generate from the existing 27,906-row August 2026 source with the previous reviewed catalog/mapping baseline. Inspect every added/reassigned mapping and all newly generated paths. Preserve all previous leaf IDs/paths; keep ambiguous rows in review. Publish catalog/mappings/manifest together with accurate counts and source provenance. Add an aggregate per-series backlog (counts and identifiers only) so missing coverage is actionable; never include raw source or claim backlog rows equal missing models. Record current web retrieval limits honestly. Repeat generation with the new baseline and verify exact results.

## Task 3: Verify and publish the draft increment

Task review (spec compliance and code quality), then final increment review. Fix material findings in bounded scopes. Run local required checks and full PostgreSQL 18 CI on the updated PR head. Update PR #11; it remains draft/unmerged while data coverage is partial. The previous baseline's CI already passed at bc61c7b (run34361898082).

## Validation record before publication

Task 1 independent review: specification and code quality PASS, no findings. Focused curation tests77/77 and full API unit suite129/129 passed; API lint/typecheck passed. Local Node24.19/pnpm11 differs from CI Node24.20/pnpm10.34.5; PostgreSQL18 CI remains the final publication gate, tracked on PR #11.

The full snapshot generated19brands/53series/589models/823mappings. Compared with the prior reviewed baseline, all567model records and790mappings are unchanged;33source mappings and22leaves are added. The seven Ibiza source codes produce only the three referenced pairs. Clio122-1163/1164 remain in review. Regeneration from the new baseline produced catalog/mapping files byte-for-byte identical to the committed candidates. Backlog totals across203source series plus unassigned-source buckets reconcile to27,906records and6,056model-review rows. This remains partial coverage, not fullcatalog approval.

Final whole-increment review: PASS, no material findings. The review independently reconciled all33mapping additions, retained baseline identities, selection-path validity and backlog/manifest totals. Final-head CI evidence is tracked on PR #11.
