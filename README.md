# Bizzat

**Bireysel ilanların adresi.**

Bizzat, emlakçı ve galerici ilanlarını dışarıda tutmayı amaçlayan; bireysel satılık ve kiralık emlak ve araç ilanlarına odaklanan bir platform projesidir.

Bu depo ürün kapsamını, marka kimliğini, Sahibinden referans envanterini, ilk MVP sınırlarını, teknik mimariyi ve çalışan uygulama foundation'ını içerir.

![Bizzat marka panosu: açık mavi yazı logosu, Bireysel ilanların adresi sloganı, renkler ve iletişim örnekleri](assets/brand/bizzat-brand-board.png)

## Temel bilgiler

| Konu | Karar |
|---|---|
| Marka | Bizzat; yazı logosunda `bizzat` |
| Slogan | Bireysel ilanların adresi. |
| Uzun vadeli kategoriler | Emlak ve araç |
| İlk MVP kategorileri | Satılık Daire, Kiralık Daire, Satılık Otomobil |
| İlk istemci | Responsive web |
| MVP iletişim | Telefon odaklı; site içi mesajlaşma yok |
| EİDS | Production ilan yayını için yetki doğrulaması zorunlu kapı |
| Teknik mimari | Next.js + Fastify + Kysely + PostgreSQL 18; self-hosted modular monolith |
| Auth | Self-hosted Better Auth; email/password + cookie session |
| Roller | `public.profiles`: `user`, `moderator`, `admin` |
| Konum referansı | PostgreSQL içinde il → ilçe → mahalle; explicit snapshot import |
| Araç kataloğu | Bizzat-owned Marka → Seri → Model UUID kimliği; PostgreSQL runtime |
| Çalıştırma | pnpm workspace + Docker Compose; production tarafında tek Linux VM/VDS hedefi |
| Görsel yön | Açık mavi, beyaz ve açık tonlar; sade ve profesyonel |
| Mevcut aşama | Identity + konum + canonical araç katalog + TSB source/mapping B1 tamamlandı; gerçek Türkiye katalog curation B2 sırada |

İlan veren kişinin her durumda malın kayıtlı sahibi olması markanın genel şartı değildir. Ancak güncel EİDS kuralları nedeniyle taşınmaz ve taşıt ilanlarında elektronik yayın yetkisi malik, eş ve izin verilen birinci/ikinci derece kan hısımlarıyla sınırlı bireysel bir yapıya sahiptir. Bizzat'ın “başkası adına yardımcı olma” yaklaşımı bu yasal/entegrasyon sınırı içinde uygulanmalıdır.

## İlk MVP

İlk çalışan sürüm uçtan uca ilan döngüsünü şu üç ilan türüyle doğrulayacak:

- Emlak → Konut → Daire → Satılık
- Emlak → Konut → Daire → Kiralık
- Araç → Otomobil → Satılık

Ana sayfa, liste/filtreleme, ilan detayı, auth, ilan oluşturma, EİDS/yetki kapısı, kendi ilanlarını yönetme, telefonla iletişim, ilan raporlama ve minimum moderasyon MVP kapsamındadır. Favori, site içi mesajlaşma, ödeme/abonelik, doping, ekspertiz, rezervasyon, native mobil uygulama ve profesyonel mağazalar kapsam dışıdır.

Ayrıntı: [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

## Teknik foundation

- `apps/web`: Next.js responsive web uygulaması.
- `apps/api`: Fastify REST API.
- `packages/contracts`: web ve API'nin paylaştığı transport şemaları.
- PostgreSQL 18 + Kysely bağlantı/migration altyapısı.
- `/api/v1/health` liveness ve `/api/v1/ready` DB-aware readiness.
- Local geliştirmede Next.js `/api/*` isteklerini Fastify'a yönlendiren same-origin rewrite.
- Migration'lar explicit komutla çalışır; API startup migration çalıştırmaz.

## Identity

Identity katmanı self-hosted Better Auth kullanır:

- email/password kayıt ve giriş,
- PostgreSQL `auth` schema'sında Better Auth `user`, `session`, `account`, `verification` tabloları,
- UUID user ID,
- browser session'ı Better Auth cookie'leriyle,
- Bizzat'a ait rol bilgisi `public.profiles` tablosunda,
- public kayıt her zaman `user` rolüyle başlar,
- `GET /api/v1/me` authenticated user + Bizzat role döndürür,
- web'de `/login` ve `/register` temel ekranları vardır.

Auth HTTP yüzeyi `/api/auth/*` altındadır. Sosyal login, email verification ve password-reset mail akışı henüz etkin değildir. Bunlar ihtiyaç ve mail/provider kararıyla ayrı fazda eklenir.

## Konum reference data

Konum hiyerarşisi uygulama runtime'ında dış servisten okunmaz. İller, ilçeler ve mahalleler PostgreSQL'de tutulur ve public read-only API üzerinden sunulur:

- `GET /api/v1/reference/provinces`
- `GET /api/v1/reference/provinces/:provinceId/districts`
- `GET /api/v1/reference/districts/:districtId/neighborhoods`

Import yalnız explicit bakım komutudur. API startup veya deploy sırasında otomatik import yapılmaz. Kaybolan/yeniden adlandırılan idari kayıtlar hard-delete edilmez; eski ilan referanslarının korunması için pasifleştirilir.

Repo'daki `data/reference/locations/fixture.locations.json` yalnız development/CI fixture'ıdır. Operasyonel kaynak manifesti `onurusluca/turkey-geo-api` v1.3 commit `5a16cef20f2335e3fe643c9618f931866bb8134c` sürümüne pinlidir; bu kaynak resmi NVI mirror'ı olarak sunulmaz.

## Araç katalog reference data

Otomobil seçimi için canonical kimlik Bizzat'a aittir:

```text
Marka → Seri → Model
```

PostgreSQL tabloları `vehicle_brands`, `vehicle_series` ve `vehicle_models`dır. Her kaydın dış sağlayıcılardan bağımsız UUID'si ve repository-owned sabit `catalog_key` değeri vardır. Display name düzeltmeleri kimliği değiştirmez; katalogdan kaldırılan kayıtlar hard-delete edilmek yerine pasifleştirilir.

Public read-only API:

- `GET /api/v1/reference/vehicle/brands`
- `GET /api/v1/reference/vehicle/brands/:brandId/series`
- `GET /api/v1/reference/vehicle/series/:seriesId/models`

Runtime hiçbir araç katalog servisine veya TSB'ye HTTP isteği yapmaz; yalnız PostgreSQL canonical tablolarını okur. Canonical katalog explicit bakım komutuyla import edilir:

```bash
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
```

`data/reference/vehicles/fixture.catalog.json` yalnız development/CI fixture'ıdır ve **Türkiye araç kataloğunun tamamı değildir**.

### TSB source ingestion ve mapping — Phase B1

TSB, canonical taxonomy'nin sahibi değil; Türkiye pazar coverage ve mapping kaynağıdır. B1 source katmanı şu dört tabloyu kullanır:

- `vehicle_source_providers`
- `vehicle_source_imports`
- `vehicle_source_records`
- `vehicle_source_mappings`

TSB için `source_key` yalnız **Araç Kodu**dur. Model yılları aynı source kaydında `available_model_years` metadata'sı olarak tutulur; source identity'nin veya ilan geçerliliğinin parçası değildir.

Ham TSB spreadsheet/export dosyaları public repoya commit edilmez ve kasko fiyatları DB'de saklanmaz. B1, operatörün TSB kaynağından dışarıda hazırladığı normalize JSON sınırından başlar. API startup, deploy, migration ve normal kullanıcı request'leri TSB'ye bağlanmaz.

Bakım komutları:

```bash
pnpm reference:import:vehicle-source -- tsb <normalized-json>
pnpm reference:apply:vehicle-mappings -- tsb <mapping-json>
pnpm reference:report:vehicle-source -- tsb
```

Mapping dosyaları DB UUID değil `TSB Araç Kodu → Bizzat vehicle_models.catalog_key` tutar. Mapping dosyasındaki eksik bir kayıt mevcut başka mapping'i silmez; dosyalar patch/apply artifact'ıdır. Kaynak marka/tip kimliği anlamlı biçimde değişirse mapped source `mapping_needs_review=true` olur ve explicit mapping apply/confirm edilene kadar trusted sayılmaz. Canonical hedef sonradan inactive olursa report bunu ayrı `invalid-mapping` durumu olarak gösterir.

Repo'daki `fixture.tsb-source.json` ve `fixture.tsb-mappings.json` yalnız **uydurulmuş deterministic test/CI verisidir**; gerçek TSB datasetinin yeniden dağıtımı değildir.

B2'de brand/series alias'ları, deterministic candidate generation, reviewed gerçek Türkiye `catalog.json` ve daha geniş source mapping curation yapılacaktır.

Model yılı canonical katalog hiyerarşisinin parçası değildir. İlan tarafında bağımsız `car_details.model_year` alanı olarak kalır; böylece TSB'nin sınırlı yıl coverage'ı eski araç ilanlarını engellemez.

## Development

Gereksinimler:

- Node.js 24 LTS (`.nvmrc`)
- pnpm 10.34.5 via Corepack
- Docker Desktop / Docker Engine with Compose

Kurulum ve başlatma:

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm reference:import:locations -- data/reference/locations/fixture.locations.json
pnpm reference:import:vehicle-catalog -- data/reference/vehicles/fixture.catalog.json
pnpm reference:import:vehicle-source -- tsb data/reference/vehicles/fixture.tsb-source.json
pnpm reference:apply:vehicle-mappings -- tsb data/reference/vehicles/fixture.tsb-mappings.json
pnpm reference:report:vehicle-source -- tsb
pnpm dev
```

Local adresler:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- Auth endpoints: `http://localhost:3000/api/auth/*` (Next same-origin proxy üzerinden)
- Authenticated profile: `http://localhost:3000/api/v1/me`
- Location reference: `http://localhost:3000/api/v1/reference/provinces`
- Vehicle reference: `http://localhost:3000/api/v1/reference/vehicle/brands`
- PostgreSQL: `127.0.0.1:5432`

`.env.example` local-only Better Auth secret içerir. Production'da ayrı, güçlü `BETTER_AUTH_SECRET` ve gerçek public `BETTER_AUTH_URL` verilmelidir.

PR açmadan önce:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` gerçek PostgreSQL integration testlerini de içerir; local PostgreSQL'in ayakta ve `.env` içindeki test bağlantısının erişilebilir olması gerekir.

## Belgeler

| Dosya | İçerik |
|---|---|
| [PROJECT.md](PROJECT.md) | Amaç, hedef kullanıcılar ve uzun vadeli ürün kapsamı |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | İlk implementasyon milestone'u |
| [docs/superpowers/specs/2026-09-07-technical-architecture-design.md](docs/superpowers/specs/2026-09-07-technical-architecture-design.md) | Onaylanan teknik mimari ve scaling guardrail'leri |
| [docs/superpowers/specs/2026-09-08-location-reference-data-design.md](docs/superpowers/specs/2026-09-08-location-reference-data-design.md) | Konum reference-data tasarımı |
| [docs/superpowers/specs/2026-09-08-vehicle-catalog-design.md](docs/superpowers/specs/2026-09-08-vehicle-catalog-design.md) | Canonical araç katalog tasarımı |
| [docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md](docs/superpowers/specs/2026-09-08-vehicle-catalog-phase-b-design.md) | TSB source/mapping Phase B tasarımı ve B1/B2 ayrımı |
| [docs/superpowers/plans/2026-09-07-foundation-implementation.md](docs/superpowers/plans/2026-09-07-foundation-implementation.md) | Foundation implementasyon planı |
| [docs/superpowers/plans/2026-09-08-identity-implementation.md](docs/superpowers/plans/2026-09-08-identity-implementation.md) | Identity implementasyon planı |
| [docs/superpowers/plans/2026-09-08-location-reference-data-implementation.md](docs/superpowers/plans/2026-09-08-location-reference-data-implementation.md) | Konum reference-data implementasyon planı |
| [docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-a-implementation.md](docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-a-implementation.md) | Canonical araç katalog Phase A implementasyon planı |
| [docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-b1-implementation.md](docs/superpowers/plans/2026-09-08-vehicle-catalog-phase-b1-implementation.md) | TSB source ingestion/mapping B1 implementasyon planı |
| [docs/reference/SAHIBINDEN_REFERENCE.md](docs/reference/SAHIBINDEN_REFERENCE.md) | Sahibinden ekran/kategori/filtre/ilan verme referansı ve EİDS notları |
| [DESIGN.md](DESIGN.md) | Onaylanan görsel yön |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Kesinleşmiş kararlar |
