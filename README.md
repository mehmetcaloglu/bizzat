# Bizzat

**Bireysel ilanların adresi.**

Bizzat, emlakçı ve galerici ilanlarını dışarıda tutmayı amaçlayan; bireysel satılık ve kiralık emlak ve araç ilanlarına odaklanan bir platform projesidir.

Bu depo ürün kapsamını, marka kimliğini, Sahibinden referans envanterini, ilk MVP sınırlarını, teknik mimariyi ve çalışan foundation kodunu bir araya getirir.

![Bizzat marka panosu: açık mavi yazı logosu, Bireysel ilanların adresi sloganı, renkler ve iletişim örnekleri](assets/brand/bizzat-brand-board.png)

## Temel bilgiler

| Konu | Karar |
|---|---|
| Marka | Bizzat; yazı logosunda `bizzat` |
| Slogan | Bireysel ilanların adresi. |
| Uzun vadeli kategoriler | Emlak ve araç |
| Uzun vadeli işlemler | Her iki ana kategoride satış ve kiralama |
| Hedef | Bireysel ilanlar; emlakçı ve galerici ilanlarına kapalı bir platform |
| İlk MVP kategorileri | Satılık Daire, Kiralık Daire, Satılık Otomobil |
| İlk istemci | Responsive web |
| MVP iletişim | Telefon odaklı; site içi mesajlaşma yok |
| Filtreler | Sahibinden'in ilgili kategori filtreleri referans alınacak; profesyonel satıcı seçenekleri Bizzat kapsamına göre çıkarılacak |
| Ekran ve akış referansı | Ana sayfa, ilan listesi ve ilan detayında Sahibinden esas alınacak; ilan verme adımları benzer olacak |
| EİDS | Production ilan yayını için yetki doğrulaması zorunlu kapı |
| Teknik mimari | Next.js + Fastify + Kysely + PostgreSQL 18; self-hosted modular monolith |
| Çalıştırma | pnpm workspace + Docker Compose; production tarafında tek Linux VM/VDS hedefi |
| Hitap | Sen |
| Görsel yön | Açık mavi, beyaz ve açık tonlar; sade ve profesyonel |
| Düşünülen adres | `bizzat.tr`; satın alma ve uygunluk durumu doğrulanmadı |
| Mevcut aşama | Foundation tamamlandı; auth/reference data sıradaki faz |

İlan veren kişinin her durumda malın kayıtlı sahibi olması markanın genel şartı değildir. Ancak güncel EİDS kuralları nedeniyle taşınmaz ve taşıt ilanlarında elektronik yayın yetkisi malik, eş ve izin verilen birinci/ikinci derece kan hısımlarıyla sınırlı bireysel bir yapıya sahiptir. Bizzat'ın “başkası adına yardımcı olma” yaklaşımı bu yasal/entegrasyon sınırı içinde uygulanmalıdır.

Filtreler ve temel ilan akışları için yeniden ürün keşfi yapılmıyor. Sahibinden referansı Bizzat'ın onaylanan görsel kimliği ve marka diliyle uygulanacak.

## İlk MVP

İlk çalışan sürüm platformun tamamını bir seferde kurmayacak. Uçtan uca ilan döngüsünü şu üç ilan türüyle doğrulayacak:

- Emlak → Konut → Daire → Satılık
- Emlak → Konut → Daire → Kiralık
- Araç → Otomobil → Satılık

İlk MVP'de ana sayfa, liste/filtreleme, ilan detayı, auth, ilan oluşturma, EİDS/yetki kapısı, kendi ilanlarını yönetme, telefonla iletişim, ilan raporlama ve minimum moderasyon bulunur.

Favori, site içi mesajlaşma, ödeme/abonelik, doping, ekspertiz, rezervasyon, native mobil uygulama ve profesyonel mağazalar ilk MVP'nin dışındadır.

Ayrıntı: [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

## Teknik foundation

İlk kod foundation'ı şu sınırları kurar:

- `apps/web`: Next.js responsive web uygulaması,
- `apps/api`: Fastify REST API,
- `packages/contracts`: web ve API'nin paylaştığı transport şemaları,
- PostgreSQL 18 + Kysely bağlantı/migration altyapısı,
- `/api/v1/health` liveness ve `/api/v1/ready` DB-aware readiness,
- local geliştirmede Next.js `/api/*` isteklerini Fastify'a yönlendiren same-origin rewrite,
- explicit migration komutu; API startup migration çalıştırmaz.

Auth, ilan domain tabloları, EİDS provider implementation, medya, moderasyon ve production Caddy/backup konfigürasyonu foundation sonrasındaki fazlardır.

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
pnpm dev
```

Local adresler:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`
- PostgreSQL: `127.0.0.1:5432`

`pnpm dev`, root `.env` dosyası varsa onu yükler ve contracts watcher + API + web süreçlerini birlikte çalıştırır. Local web üzerinden `/api/*` istekleri `.env` içindeki `API_PROXY_TARGET` ile Fastify'a gider.

PR açmadan önce:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` gerçek PostgreSQL integration testlerini de içerir; bu nedenle local PostgreSQL'in ayakta ve `.env` içindeki test bağlantısının erişilebilir olması gerekir.

## Belgeler

| Dosya | İçerik |
|---|---|
| [PROJECT.md](PROJECT.md) | Amaç, hedef kullanıcılar ve uzun vadeli ürün kapsamı |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | İlk implementasyon milestone'u: dahil olan/olmayan kategoriler, akışlar ve kabul kriterleri |
| [docs/superpowers/specs/2026-09-07-technical-architecture-design.md](docs/superpowers/specs/2026-09-07-technical-architecture-design.md) | Onaylanan teknik mimari ve scaling guardrail'leri |
| [docs/superpowers/plans/2026-09-07-foundation-implementation.md](docs/superpowers/plans/2026-09-07-foundation-implementation.md) | Foundation implementasyon planı |
| [DESIGN.md](DESIGN.md) | Onaylanan görsel yön, renkler ve tasarım referansı |
| [docs/reference/SAHIBINDEN_REFERENCE.md](docs/reference/SAHIBINDEN_REFERENCE.md) | Sahibinden ekran/kategori/filtre/ilan verme referansı ve EİDS notları |
| [docs/brand/VOICE.md](docs/brand/VOICE.md) | Marka dili, slogan ve kullanılacak metinler |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Kesinleşmiş kararlar |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | EİDS entegrasyonu, veri kaynakları ve diğer açık konular |
| [AGENTS.md](AGENTS.md) | Projeyi devralan geliştirme araçları için bağlam ve çalışma kuralları |

## Mevcut aşamanın sınırı

Teknik stack ve sistem mimarisi seçildi. Foundation kodu web → REST API → PostgreSQL hattını, explicit migration altyapısını ve temel test/build sınırlarını kuruyor.

Foundation sonrasındaki sıradaki bağımsız plan: Better Auth + kullanıcı rolleri/profil ve MVP'nin konum/araç referans verileri. Ardından listing read ve listing write/EİDS/media vertical slice'ları gelecek.

Bu belgeler 6-8 Eylül 2026 tarihli proje çalışmalarını temel alır.
