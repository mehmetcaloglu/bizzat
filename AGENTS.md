# Proje bağlamı

Bu depo Bizzat'ın ürün, marka, referans, MVP kapsamı, teknik mimari ve uygulama kodunu içerir.

## Önce oku

- `README.md`: Genel özet, teknik quick-start ve belge haritası.
- `PROJECT.md`: Uzun vadeli ürün kapsamı ve hedef kullanıcılar.
- `docs/MVP_SCOPE.md`: İlk implementasyon milestone'u ve kabul kriterleri.
- `docs/superpowers/specs/2026-09-07-technical-architecture-design.md`: Onaylanan teknik mimari ve guardrail'ler.
- `docs/superpowers/specs/2026-09-08-location-reference-data-design.md`: Konum reference-data tasarımı.
- `docs/superpowers/specs/2026-09-08-vehicle-catalog-design.md`: Canonical araç katalog tasarımı ve source/mapping sınırı.
- `docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md`: TSB source ingestion/mapping Phase B tasarımı.
- `docs/superpowers/plans/2026-09-07-foundation-implementation.md`: Foundation implementasyon sırası.
- `docs/superpowers/plans/2026-09-08-identity-implementation.md`: Auth/profile/role implementasyon sınırı.
- `docs/superpowers/plans/2026-09-08-location-reference-data-implementation.md`: Konum reference-data implementasyon sırası.
- `docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-a-implementation.md`: Canonical araç katalog Phase A implementasyon sırası.
- `docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-b1-implementation.md`: TSB source ingestion/mapping B1 implementasyon sırası.
- `docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-b2-implementation.md`: Türkiye otomobil katalog curation B2 implementasyon sırası.
- `docs/reference/SAHIBINDEN_REFERENCE.md`: Sahibinden kategori/filtre/akış envanteri ve EİDS araştırması.
- `DESIGN.md`: Onaylanan tasarım yönü.
- `docs/DECISIONS.md`: Alınmış kararlar.
- `docs/OPEN_QUESTIONS.md`: Henüz kesinleşmeyen teknik/ürün konuları.
- `docs/brand/VOICE.md`: Marka dili.

## Çalışma ilkeleri

- Kullanıcının yeni açık talimatları bu belgelerden önceliklidir. Karar değişirse ilgili belgeleri birlikte güncelle.
- Türkçe, açık ve anlaşılır yaz; ürün metinlerinde son kullanıcıya “sen” diye hitap et.
- İlk MVP yalnızca `Satılık Daire`, `Kiralık Daire` ve `Satılık Otomobil` ilanlarını kapsar.
- İlk istemci responsive web'dir; native mobil uygulama MVP kapsamında değildir.
- Profesyonel emlakçı/galerici hesap ve mağaza akışları oluşturma.
- Production'da EİDS yetkisi doğrulanmadan ilan yayınlama; mock fallback production'da yasaktır.
- TC başına 3–4 ilan fikrini kesin ürün kuralı gibi kodlama.
- MVP iletişimi telefon odaklıdır; site içi mesajlaşma ekleme.
- Favori, ödeme/abonelik, doping, ekspertiz, rezervasyon ve AI önerileri ilk MVP kapsamında değildir.
- Onaylanan açık mavi, sade ve profesyonel görsel yönü esas al.
- Filtre ve temel akışları yeniden icat etme; Sahibinden referans dokümanını kullan, profesyonel satıcı seçeneklerini taşımama kuralını koru.
- Repo belgelerine gerçek TC, plaka, taşınmaz numarası, erişim anahtarı veya özel kullanıcı verisi ekleme.

## Teknik mimari

- Self-hosted TypeScript **modular monolith**.
- Frontend: Next.js + TypeScript (`apps/web`).
- Backend: Fastify + TypeScript (`apps/api`).
- DB: PostgreSQL 18; Kysely + `pg`.
- REST uygulama API'si `/api/v1`; auth HTTP yüzeyi `/api/auth/*`.
- Monorepo: pnpm workspace; local DB: Docker Compose.
- Migration'lar explicit komutla çalışır; API startup migration çalıştırmaz.
- Ölçülmüş gereksinim olmadan Redis, queue, external search, replica, partitioning, microservice veya Kubernetes ekleme.

## Identity kuralları

- Better Auth self-hosted olarak Fastify API içinde çalışır; managed auth servisi ekleme.
- Better Auth tabloları PostgreSQL `auth` schema'sındadır ve user ID tipi UUID'dir.
- Browser auth için Better Auth session API/cookie mekanizmasını kullan; custom JWT veya cookie parser yazma.
- Bizzat authorization rolünün kaynağı `public.profiles.role` alanıdır: `user | moderator | admin`.
- Public sign-up payload'ından **role kabul etme**; yeni kullanıcı her zaman `user` olur.
- Role/state değiştirme ileride yalnız server-owned moderator/admin akışından yapılır.
- `/api/v1/me` session user'ını ve Bizzat profil rolünü birleştirir.
- Auth migration sırası `auth schema bootstrap → Better Auth tabloları → Bizzat domain tabloları` şeklindedir.
- Better Auth veya domain migration'larını API startup'a taşıma.
- Social login, email verification ve password reset şu an uygulanmış değildir; ayrı ürün/provider kararı olmadan ekleme.
- Production secret'larını repoya yazma; `.env.example` sadece local/CI örneğidir.

## Konum reference-data kuralları

- Runtime konum okumaları yalnız PostgreSQL'den gelir; normal API/page request'lerinde dış konum servisi çağırma.
- Konum importu explicit bakım işlemidir; API startup, deploy veya migration içine remote fetch/import ekleme.
- Provider kimliği ile import version/checksum provenance'ını ayrı tut.
- İl/ilçe/mahalle kayıtlarını display name ile eşleme; `(provider_id, source_key)` kimliğini koru.
- Yeni snapshot'ta kaybolan idari kayıtları silme; `active = false` yap ki eski ilan referansları bozulmasın.
- Public reference API provider/source/checksum metadata'sını döndürmez.
- Repo'daki küçük location fixture yalnız test/development içindir. Operasyonel source manifest `onurusluca/turkey-geo-api` v1.3 commit `5a16cef20f2335e3fe643c9618f931866bb8134c` kaynağına pinlidir ve resmi NVI mirror'ı değildir.

## Araç katalog kuralları

- `vehicle_brands`, `vehicle_series`, `vehicle_models` Bizzat'ın canonical araç kimliğidir; listing'ler ileride bu UUID'leri referanslar.
- `catalog_key` repository-owned ve sabit kimliktir. Display name düzeltmesinde yeni row/key üretme; mevcut kaydı güncelle.
- Canonical listing kimliği `vehicle_models` UUID'sidir. Kullanıcının 2026-09-09 kararı gereği görünür seçim ağacı Sahibinden referansındaki değişken derinliği izler; `selection_path` seri altındaki düğümleri ve yaprağı saklar. Her araca zorla engine/trim seviyeleri ekleme. Güncel tasarım: `docs/superpowers/specs/2026-09-09-vehicle-picker-parity.md`. Ayrı generation/engine/trim/spec/VIN tabloları ekleme.
- Model yılı canonical taxonomy'nin parçası değildir; `car_details.model_year` bağımsız ilan alanı olarak kalır. `vehicle_model_years` tablosu ekleme.
- TSB veya başka provider ID/source string'ini listing domain ID'si yapma.
- Runtime araç reference endpointleri yalnız canonical PostgreSQL tablolarından okur; TSB/OtoAPI/başka araç API'sine normal request sırasında çağrı yapma.
- Canonical catalog import explicit bakım işlemidir; API startup/deploy içine implicit import ekleme.
- Canonical kaynaktan kaybolan marka/seri/model kayıtlarını hard-delete etme; `active = false` yap.
- `data/reference/vehicles/fixture.catalog.json` yalnız küçük test/development fixture'ıdır; gerçek Türkiye araç kataloğu gibi sunma.
- Operasyonel canonical katalog `data/reference/vehicles/catalog.json` dosyasıdır; değişiklikleri review etmeden DB'ye import etme.

### TSB source/mapping Phase B1 guardrail'leri

- `vehicle_source_*` tabloları coverage/curation altyapısıdır; canonical listing kimliği değildir.
- TSB `source_key` değeri yalnız trimlenmiş **Araç Kodu**dur. Model yılını source key'e ekleme.
- `available_model_years` yalnız source metadata'sıdır; ilan model yılı geçerliliği üretme.
- Ham TSB XLS/XLSX/CSV/export dosyalarını public repoya commit etme.
- Kasko değer/fiyat alanlarını mevcut ürün ihtiyacı yokken DB'ye taşıma.
- TSB source importu explicit bakım işlemidir; runtime/API startup/deploy/migration içinde remote fetch veya implicit import ekleme.
- Source importer canonical `vehicle_brands/series/models` tablolarını oluşturamaz, yeniden adlandıramaz veya otomatik map edemez.
- Source importer `mapping_needs_review=true` durumunu kendiliğinden temizleyemez; yalnız explicit mapping apply/confirm temizler.
- Anlamlı mapped source brand/type değişimi `mapping_needs_review=true` yapar; case/whitespace-only değişiklik bunu tetiklemez.
- Mapping apply yalnız aktif `vehicle_models.catalog_key` hedeflerine yapılır; inactive hedef reddedilir.
- Mapping dosyası patch/apply artifact'ıdır; dosyada olmayan mevcut mapping'leri silme.
- Canonical hedef sonradan inactive olursa source identity review flag'ini değiştirme; report bunu `invalid-mapping` olarak türetsin.
- Public araç dropdown/API response'larını oluşturmak için source tablolarını join etme; public runtime canonical tabloları kullanır.
- B1 fixture source/mapping dosyaları uydurulmuş deterministic test verisidir; gerçek TSB dataset'i gibi sunma.

### Türkiye katalog curation Phase B2 guardrail'leri

- `brand-aliases.json`, `series-aliases.json`, `catalog.json`, `tsb-mappings.json` ve `source-manifest.json` repository-owned review artifact'larıdır.
- Brand mapping yalnız explicit reviewed alias ile yapılır. TSB raw brand textinden otomatik/fuzzy tahmin üretme.
- Seri mapping yalnız aynı marka içindeki reviewed token-boundary alias'larla yapılır; en uzun eşleşme kazanır. Aynı specificity'de farklı seri adayları varsa fail-closed bırak.
- Fuzzy matching veya runtime/maintenance LLM ile sessiz taxonomy değişikliği yapma.
- Candidate/generator çıktıları doğrudan canonical DB'yi değiştiremez; önce `/tmp` gibi review alanına üret, sonra review edilen artifact'ı repo/DB akışına al.
- Generator maintenance-only'dir. API startup, runtime request, deploy veya migration sırasında TSB/global bootstrap fetch etme.
- Raw TSB workbook/CSV, kasko fiyatları ve operasyonel normalize TSB snapshot'ını repoya commit etme. Repo yalnız curation sonuçlarını ve provenance manifestini tutar.
- `source-manifest.json` gerçek kullanılan TSB dönemini ve bootstrap source/commit/license bilgisini güncel tutar. İlk reviewed curation TSB `2026-08` dönemidir.
- `tsb-mappings.json` yalnız source code → canonical `catalog_key` mapping'idir; source raw text, model-year metadata veya fiyat taşımaz.
- Aynı generated model key'e materially farklı label'lar çakışırsa otomatik seçim yapma; collision grubunu mapping dışında bırak.
- `catalog_key` curation yeniden çalıştığında listing kimliği olarak stabil kalmalıdır. Sonraki generator çalıştırmalarında reviewed katalog/mapping baseline'ını ver; display label düzeltmesinde key üretme, kimlik birleşmesi/bölünmesi/reparenting için explicit review yap.
- Permanent CI dış TSB endpointlerine bağlanmaz; committed alias/catalog/mapping/manifest verisini offline doğrular ve gerçek `catalog.json`ı PostgreSQL'e import ederek API/integration testlerini çalıştırır.
- Katalog altyapısını daha fazla büyütmek yerine B2 sonrası MVP listing domainine (`listings` + `car_details`) geç; ölçülmüş gerçek katalog açığı olmadıkça generation/engine/trim/spec katmanı ekleme.

## Teknik çalışma komutları

- Node baseline: 24 LTS; `.nvmrc` authoritative.
- Package manager: pnpm 10.34.5.
- Local PostgreSQL: `pnpm db:up`; kapatmak için `pnpm db:down`.
- DB + auth migrations: `pnpm db:migrate`.
- Test/development konum fixture importu: `pnpm reference:import:locations -- data/reference/locations/fixture.locations.json`.
- Operasyonel araç katalog importu: `pnpm reference:import:vehicle-catalog -- data/reference/vehicles/catalog.json`.
- Küçük test/development araç katalog fixture importu: `pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json`.
- Test/development TSB source fixture importu: `pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json`.
- Test/development TSB mapping apply: `pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json`.
- TSB source coverage report: `pnpm reference:report:vehicle-source -- tsb`.
- Offline/review curation generator: `pnpm reference:generate:vehicle-catalog -- <normalized-tsb.json> data/reference/vehicles/brand-aliases.json data/reference/vehicles/series-aliases.json <bootstrap-models.json> <output-dir> [version] [reviewed-baseline-dir]`.
- Local web + API + contracts watcher: `pnpm dev`.
- Kod değişikliklerini `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` ile doğrula.
- DB/auth/reference-data davranışı gerçek PostgreSQL integration testleri gerektirir; mock ile ikame etme.
- `pnpm test` için local PostgreSQL ayakta ve `.env` test bağlantısı erişilebilir olmalı.

## İlk MVP'nin ana akışları

1. Ana sayfa → kategori → ilan listesi → filtre/sıralama → ilan detayı → telefonla iletişim.
2. Auth → kategori seçimi → EİDS/yetki doğrulaması → dinamik ilan formu → medya → önizleme → moderasyon/yayın.
3. İlan sahibi → kendi ilanları → düzenleme / yayından kaldırma.
4. Ziyaretçi → ilanı raporla; moderatör → incele / yayından kaldır.

## Mevcut doğrulama

CI PostgreSQL 18 üzerinde frozen lockfile, explicit migrations, Better Auth auth integration testleri, location migration/import/API testleri, gerçek curated `data/reference/vehicles/catalog.json` import/API testleri, deterministic vehicle curation generator fixture'ı, committed curation data/provenance testleri, TSB normalized source import/mapping/report fixture testleri, web smoke testleri, lint, typecheck ve build çalıştırır. Permanent CI dış TSB endpointlerine bağlanmaz.

DB/auth/reference-data kullanan değişikliklerde gerçek integration testi olmadan başarı iddiasında bulunma. Production deploy/Caddy/backup hâlâ sonraki fazdadır.
