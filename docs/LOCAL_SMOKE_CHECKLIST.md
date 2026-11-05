# Bizzat — Local smoke checklist

Bu liste local ortamda uçtan uca kontrol için kısa bir rehberdir. Otomatik testlerin kapsamadığı kurulum, migration ve görsel/UX yüzeylerini kontrol eder.

## Hazırlık

- [x] Local PostgreSQL erişilebilir
- [x] `pnpm db:migrate`
- [x] `pnpm reference:import:locations -- data/reference/locations/fixture.locations.json`
- [x] `pnpm reference:import:vehicle-catalog -- data/reference/vehicles/catalog.json`
- [x] `pnpm dev`
- [x] `GET /api/v1/health` → `200 ok`
- [x] `GET /api/v1/ready` → `200 ready`

> Local dev DB migration çalıştırılmadan özellikle daire feed’i `apartment_details` tablosu olmadığı için 500 dönebilir. Bu durumda önce `pnpm db:migrate` çalıştırılmalıdır.

## Public yüzeyler

- [x] `/` ana sayfa açılıyor
- [x] `/otomobil` feed, filtreler ve sıralama açılıyor
- [x] `/daire` feed, satılık/kiralık geçişi ve filtreler açılıyor
- [x] `/otomobil/:id` detay ve telefon gösterme akışı
- [x] `/daire/:id` detay ve telefon gösterme akışı
- [x] Bilinmeyen ilan id’si 404/uygun hata durumunu gösteriyor (integration)
- [x] Header dar ekranda taşmadan sarıyor (CSS wrap)

## Auth ve hesap

- [x] Kayıt, giriş ve çıkış
- [x] `/ilanlarim` oturum yokken giriş CTA’sı gösteriyor
- [x] `/hesabim` hesap durumu ve uyarıları gösteriyor
- [x] Askı/ban sonrası korumalı işlemler `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` dönüyor

## İlan akışları

- [x] Otomobil draft → detay → fotoğraf → yayınla (integration)
- [x] Daire satılık/kiralık draft → detay → fotoğraf → yayınla (integration)
- [x] Kendi ilanlarım: düzenle, yayından kaldır, yeniden yayınla (integration)
- [x] Public detayda telefon yalnız `showPhone=true` ise görünüyor (integration)
- [x] Draft görselleri public değil (integration)

## Moderasyon ve destek

- [x] İlan raporlama (integration)
- [x] Rapor kuyruğu: incele, ilanı kaldır, raporu reddet (integration)
- [x] Reddedilen ilan için sahip itirazı (integration)
- [x] İtiraz kuyruğu: kabul/ret (integration)
- [x] `/destek`: kullanıcı ara, uyar, askıya al, banla, ilan kapat, aktifleştir (integration)
- [x] `/yonetim`: yalnız admin erişimi, özet ve rol değişikliği (integration)
- [x] Moderasyon ve destek yüzeyleri dar ekranda kullanılabilir (CSS wrap)

## Teknik kapanış

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `apps/web/next-env.d.ts` build sonrası değişmediyse commit dışında
