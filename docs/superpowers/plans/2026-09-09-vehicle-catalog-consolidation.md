# Vehicle catalog consolidation and picker parity

User-approved continuation of PR #11 (2026-09-09). Binding spec: `../specs/2026-09-09-vehicle-picker-parity.md`.

## Global constraints

Keep the final canonical model UUID and repository-owned key. Visible paths follow the marketplace and can have different depths. No universal four-level engine/trim schema, no invented standard trim, no specification/year tables, no runtime provider calls. TSB source identity comparison remains exact normalized full text. Raw sources/prices stay out of git. CI imports the real catalog. Data coverage is partial and must not be called complete.

## Tasks

- [x] Verify representative reference paths and supersede the fixed-depth assumption (Clio/Polo/308/BMW; additional Audi body and Tesla terminal branches).
- [x] Implement optional canonical `selectionPath`, explicit JSONB migration, importer, validator, contracts and active canonical traversal API. Preserve flat `/models` compatibility and model UUIDs.
- [x] Add regression cases for technical consolidation, distinct engine/trim/body/ED paths, unknown source vocabulary, slug collisions and stable baseline identities.
- [x] Add explicit BMW/Mercedes-Benz/Audi aliases. Generate in scratch from the existing August 2026 artifact; replace catalog/mapping/provenance together after inspecting accepted paths and exclusions.
- [x] Verify fixture mapping targets and real Clio/Audi/Tesla picker traversal through added PostgreSQL integration tests (execution gate below).
- [x] Run local lint, typecheck and unit tests; regenerate the full source with the reviewed baseline and compare outputs exactly.
- [x] Complete independent backend/task and whole-change review, fix material findings.
- [x] Run full PostgreSQL CI and build on the updated draft PR head (bc61c7b, CI34361898082 passed).
- [ ] Complete missing brand/nameplate/body/EV/historical curation before marking ready and merging. Current gaps are recorded in the manifest and spec.

## Decisions made during implementation

- The initial four-level backend proposal was replaced by `selectionPath`: indexed Audi/Tesla examples prove different depths. Cost if incorrect: path metadata and traversal contract need revision; leaf UUIDs remain stable.
- Unknown trim/engine/body combinations stay outside the selectable catalog. The current partial seed counts and twelve excluded previously listed brands are recorded in `data/reference/vehicles/source-manifest.json`; intermediate generation counts are not completeness claims. Cost: incomplete picker coverage; PR stays draft.
- The old 6,652 raw-type keys are part of the unmerged B2 proposal. This first consolidation preserves Phase A fixture targets; subsequent runs use the reviewed baseline and reject identity merges/splits/reparenting. No existing listing foreign-key rewrites are performed.

## Validation record

Local Node 24.19.0 / pnpm 11.19.0 differs from the repository's Node 24.20.0 / pnpm 10.34.5 CI baseline. `pnpm lint`, `pnpm typecheck`, API unit suite (107 tests after final review fixes) and web suite (3 tests) passed. There is no local PostgreSQL service; DB changes require the real PostgreSQL 18 workflow. The final 55 curation regressions passed, including positional parenthetical power, Accent Blue/Era exclusion, and shared stable branch keys for new siblings. Full-source regeneration from the reviewed baseline reproduced catalog/mappings byte-for-byte at 18 brands / 50 series / 567 leaves / 790 mappings. Final-head PostgreSQL CI status is recorded on PR #11; CI is authoritative.

Coverage continuation is tracked in [the follow-up plan](2026-09-09-vehicle-catalog-coverage-followup.md); the successful technical checkpoint above is not complete-catalog approval.
