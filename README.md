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
| Çalıştırma | pnpm workspace + Docker Compose; production tarafında tek Linux VM/VDS hedefi |
| Görsel yön | Açık mavi, beyaz ve açık tonlar; sade ve profesyonel |
| Mevcut aşama | Identity tamamlandı; reference data sıradaki faz |

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
- Auth endpoints: `http://localhost:3000/api/auth/*` (Next same-origin proxy üzerinden)
- Authenticated profile: `http://localhost:3000/api/v1/me`
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
| [docs/superpowers/plans/2026-09-07-foundation-implementation.md](docs/superpowers/plans/2026-09-07-foundation-implementation.md) | Foundation implementasyon planı |
| [docs/superpowers/plans/2026-09-08-identity-implementation.md](docs/superpowers/plans/2026-09-08-identity-implementation.md) | Identity implementasyon planı |
| [docs/reference/SAHIBINDEN_REFERENCE.md](docs/reference/SAHIBINDEN_REFERENCE.md) | Sahibinden ekran/kategori/filtre/ilan verme referansı ve EİDS notları |
| [DESIGN.md](DESIGN.md) | Onaylanan görsel yön |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Kesinleşmiş kararlar |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | EİDS entegrasyonu, veri kaynakları ve diğer açık konular |
| [AGENTS.md](AGENTS.md) | Geliştirme bağlamı ve çalışma kuralları |

## Mevcut aşamanın sınırı

Foundation ve identity katmanı hazırdır. Sıradaki bağımsız iş MVP için **reference data**: Türkiye il/ilçe/mahalle verisinin ve otomobil marka/seri/model kataloğunun kaynak/seed yapısının kurulmasıdır. Ardından listing read ve listing write/EİDS/media vertical slice'ları gelir.

Bu belgeler 6-8 Eylül 2026 tarihli proje çalışmalarını temel alır.
