# Proje bağlamı

Bu depo Bizzat'ın ürün, marka, referans, MVP kapsamı, teknik mimari ve uygulama kodunu içerir.

## Önce oku

- `README.md`: Genel özet, teknik quick-start ve belge haritası.
- `PROJECT.md`: Uzun vadeli ürün kapsamı ve hedef kullanıcılar.
- `docs/MVP_SCOPE.md`: İlk implementasyon milestone'u ve kabul kriterleri.
- `docs/superpowers/specs/2026-09-07-technical-architecture-design.md`: Onaylanan teknik mimari ve guardrail'ler.
- `docs/superpowers/plans/2026-09-07-foundation-implementation.md`: Foundation implementasyon sırası.
- `docs/reference/SAHIBINDEN_REFERENCE.md`: Sahibinden kategori/filtre/akış envanteri ve EİDS araştırması.
- `DESIGN.md`: Onaylanan tasarım yönü.
- `docs/DECISIONS.md`: Alınmış kararlar.
- `docs/OPEN_QUESTIONS.md`: Henüz kesinleşmeyen teknik/ürün konuları.
- `docs/brand/VOICE.md`: Marka dili.

## Çalışma ilkeleri

- Kullanıcının yeni açık talimatları bu belgelerden önceliklidir. Karar değişirse ilgili belgeleri birlikte güncelle.
- Türkçe, açık ve anlaşılır yaz. Kullanıcıya ve ürün metinlerinde son kullanıcıya “sen” diye hitap et.
- Onaylanmış kararlarla başlangıç fikirlerini ayrı tut; önerileri geçmişte kesinleşmiş gibi sunma.
- Bizzat bireysel emlak ve araç ilanlarına odaklanır. Uzun vadede her iki ana kategoride satış ve kiralama kapsam içindedir.
- İlk MVP yalnızca `Satılık Daire`, `Kiralık Daire` ve `Satılık Otomobil` ilanlarını kapsar. Yeni bir kullanıcı kararı olmadan ilk milestone'a başka kategori ekleme.
- İlk istemci responsive web'dir. Native mobil uygulama ilk MVP kapsamında değildir.
- Temel amaç emlakçı ve galerici ilanlarını dışarıda tutmaktır. Profesyonel hesap/mağaza akışları oluşturma.
- Başkası adına bireysel ilan yaklaşımını EİDS sınırından bağımsız yorumlama. Production'da malik/eş/izin verilen 1.-2. derece hısım yetkisi doğrulanmadan ilan yayınlama.
- EİDS gerçek entegrasyonu hazır değilse provider/adapter sınırı tasarlanabilir ve local/test'te açıkça işaretli mock kullanılabilir. Production'da mock fallback kullanma.
- TC başına 3–4 ilan fikrini kesin veya uygulanmış bir kural gibi kodlama.
- MVP iletişimi telefon odaklıdır; site içi mesajlaşmayı ilk milestone'a ekleme. Telefon görünürlüğünü kullanıcı tercihi/izni olmadan varsayma.
- İlk MVP'de favori, kaydedilmiş arama, ödeme/abonelik, doping, ekspertiz, rezervasyon, AI önerileri ve profesyonel mağaza özellikleri yoktur.
- Onaylanan açık mavi, sade ve profesyonel görsel yönü esas al. Koyu tema veya yeni bir logo yönünü mevcut kullanıcı tercihi gibi sunma.
- Ana slogan “Bireysel ilanların adresi.”, genel iletişim çağrısı “İlan verenle görüş.” şeklindedir.
- Filtre ve temel akışları yeniden icat etme. `docs/reference/SAHIBINDEN_REFERENCE.md` dosyasındaki Sahibinden referansını kullan; Bizzat'ın yasakladığı `Emlak Ofisinden` / `Galeriden` gibi profesyonel satıcı seçeneklerini körlemesine taşıma.
- Seçilen üç MVP ilan türünün alanlarını implementasyon öncesinde makine-okunur attribute şemasına dönüştür.
- Sahibinden canlı kategori sayfalarının önceki araştırmada 403 verdiğini unutma. Snapshot ile çıkarılan ayrıntıları production davranışı gibi mutlaklaştırma; erişim mümkün olduğunda seçilen MVP kategorilerini son kez doğrula.
- Repo belgelerine gerçek TC, plaka, taşınmaz numarası, erişim anahtarı veya başka özel kullanıcı verileri ekleme; örnek gerekiyorsa açıkça sahte örnek olduğunu belirt.

## Teknik mimari

- Self-hosted TypeScript **modular monolith** kullanılır.
- Frontend: Next.js + TypeScript (`apps/web`).
- Backend: Fastify + TypeScript (`apps/api`).
- DB: PostgreSQL 18; erişim Kysely + `pg` üzerinden.
- Transport: REST `/api/v1`; ortak runtime/type contract'ları `packages/contracts` içinde.
- Monorepo: pnpm workspace.
- Local DB: Docker Compose.
- Migrations explicit komutla çalışır; API startup migration çalıştırmaz.
- PostgreSQL başlangıç source-of-truth'tur. Ölçülmüş gereksinim olmadan Redis, queue, external search, replica veya partitioning ekleme.
- Mikroservis, Kubernetes veya managed backend servisi eklemek için güncel/ölçülmüş gerekçe ve mimari güncelleme gerekir.

## Teknik çalışma komutları

- Node baseline: 24 LTS; `.nvmrc` authoritative.
- Package manager: pnpm 10.34.5; npm/yarn ile değiştirme.
- Local PostgreSQL: `pnpm db:up`; kapatmak için `pnpm db:down`.
- DB migrations: `pnpm db:migrate`; API startup migration çalıştırmamalı.
- Local web + API + contracts watcher: `pnpm dev`.
- Kod değişikliklerini `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` ile doğrula.
- Repository/SQL davranışı gerçek PostgreSQL integration testleri gerektirir; repository mock'u ile ikame etme.
- `pnpm test` için local PostgreSQL'in ayakta ve `.env` içindeki `TEST_DATABASE_URL`'in erişilebilir olması gerekir.
- Redis, queue, external search, microservice, Kubernetes veya managed backend eklemeden önce teknik mimari guardrail'lerindeki üç soruyu cevapla.

## İlk MVP'nin ana akışları

1. Ana sayfa → kategori → ilan listesi → filtre/sıralama → ilan detayı → telefonla iletişim.
2. Auth → kategori seçimi → EİDS/yetki doğrulaması → dinamik ilan formu → medya → önizleme → moderasyon/yayın.
3. İlan sahibi → kendi ilanları → düzenleme / yayından kaldırma.
4. Ziyaretçi → ilanı raporla; moderatör → incele / yayından kaldır.

## Mevcut doğrulama

Foundation aşamasında workspace contract build'i, Fastify API unit testleri, PostgreSQL 18 migration/integration testleri, Next.js smoke testi, lint, typecheck ve build GitHub Actions üzerinde çalıştırılır.

DB kullanan değişiklikler için gerçek PostgreSQL testi olmadan başarı iddiasında bulunma. Production deploy/Caddy/backup henüz bu fazın parçası değildir.
