# Vehicle catalog reproducibility record — 2026-09-11

This record closes the source-reproducibility validation gate for PR #11. It does **not** claim that the Turkish automobile catalog is complete; coverage review remains partial.

## Exact TSB source reproduction

The historical acquisition/normalization script was recovered from repository history at commit `b9ae77a6afa57dd3c64b36de6324af13561d7df5` (`scripts/maintenance/acquire-tsb-source.py`). The script was run again against the official Türkiye Sigorta Birliği archive for August 2026.

Fresh reacquisition produced:

- source period: `2026-08`
- normalized records: `27,906`
- SHA-256: `768140c3952ced1eb614eb0dfb57c519e6b127109591b862d629adf84d34b550`

The record count and checksum match `data/reference/vehicles/source-manifest.json` exactly. The normalized snapshot remains outside git and contains source identity/model-year metadata only; kasko price/value fields are not emitted.

## Full regeneration finding and fixes

The first full regeneration from the reproduced snapshot and the latest reviewed baseline intentionally compared generated artifacts with committed artifacts. It exposed two reproducibility bugs:

1. Exact reviewed selection labels for Seat Ibiza, Renault Megane, Ford Focus and Opel Astra were not also constrained by their explicitly reviewed source codes. A repeated normalized label under another source code could therefore inherit the reviewed mapping. In the real August snapshot this surfaced as four unintended Megane mappings (`123-2052`, `123-2054`, `123-2106`, `123-2107`).
2. Existing reviewed series display names could be overwritten by the pinned bootstrap dataset during a later full regeneration, even though their stable series identities were unchanged.

Regression tests were added before the fixes. The red run kept the previous 164 API/unit tests green while the five new regressions failed as expected. The fixes then:

- enforce explicit source-code scope for the narrowly reviewed Ibiza/Megane/Focus/Astra selections; unreviewed codes remain `model-review` even when their normalized label is identical;
- preserve an existing reviewed baseline series display name during regeneration.

The normal CI after these fixes passed with 169 API/unit tests plus the existing PostgreSQL integration and web suites.

## Final exact regeneration

A final one-shot, read-only verification reacquired the official August 2026 source, verified the exact checksum, fetched the pinned `global-car-models` bootstrap at commit `44da5c9e5e0f3162d65579033f7a641473308b11`, and ran the current generator with `data/reference/vehicles` as the reviewed baseline.

Final generation summary:

- source records: `27,906`
- exact candidates: `841`
- mapped source codes: `841`
- canonical brands: `19`
- canonical series: `56`
- canonical selectable models: `600`
- ambiguous-series excluded: `21`
- unknown-brand excluded: `13,955`
- no-series excluded: `7,051`
- model-review required: `6,038`

No brand, series, model or mapping was added, removed, reordered or changed relative to the committed reviewed artifacts. The final byte-level checks were:

```text
catalogByteEqual: true
mappingsByteEqual: true
```

Verification run: `34589816322`.

The temporary network-enabled verification workflow was removed immediately after this proof. Permanent CI remains offline/read-only and does not fetch TSB or the bootstrap source.

## Result

The August 2026 TSB provenance and the current reviewed `catalog.json` / `tsb-mappings.json` pipeline are reproducible from the recorded source and pinned inputs. Source reproducibility is therefore **PASS** for this reviewed baseline.

Catalog completeness is a separate product/curation gate. PR #11 remains draft and unmerged while missing brands/series and remaining review rows are evaluated.


## 2026-09-13 archive drift and Skoda batch

A fresh reacquisition of the official August 2026 TSB archive on 2026-09-13 still produced `27,906` normalized records, but the normalized SHA-256 changed from the 2026-09-11 value to `d810927023cc1fe50b457c83dec3b3dd485cee0f110f2a6b6d476c25d33c2b11`. The earlier checksum remains a historical reproducibility result; the upstream archive is therefore treated as having drifted in place.

Before accepting any new curation from the drifted snapshot, the full generator was run against the reviewed baseline and required to preserve every existing mapping target and every existing canonical model object. That invariant held.

The reviewed Skoda batch then added only marketplace-evidenced, source-code-scoped rows for Octavia, Superb, Fabia and Rapid:

- mappings: `841` → `871` (`+30`)
- selectable models: `600` → `621` (`+21`)
- canonical brands: `19` → `20`
- canonical series: `56` → `60`
- model-review rows: `6,038` → `6,008`

Rows carrying unresolved `Combi`, `Spaceback`, `4x4`, `CR`, `GreenTec`, `ACT`, `MHEV` or `e-TEC` semantics, plus cleaned paths lacking marketplace evidence, remain review-only. The permanent CI remains offline; network access was used only in one-shot verification/commit workflows and removed afterward.
