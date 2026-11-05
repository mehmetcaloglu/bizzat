# Bizzat — Takip işleri

Bu dosya MVP sonrası açık işleri tek yerde tutar. Issue tracker yerine repo-owned ve kısa bir kayıt tercih edildi; her madde kendi diliminde spec/karar gerektiriyorsa ilgili dokümana bağlanır.

| Öncelik | İş | Neden / kabul yönü |
|---|---|---|
| P2 | Gerçek EİDS provider entegrasyonu | `vehicle_authority` ve `property_authority` için mock dışı, production’da fail-closed provider. |
| P3 | Moderasyon SLA, itiraz ve hesap yaptırımı | Rapor kuyruğu için hedef süre, itiraz akışı ve gerekli hallerde hesap seviyesinde işlem. |
| P3 | Arama/filtre performansı | `q` için ILIKE dışında ölçülmüş ihtiyaç doğarsa PostgreSQL full-text/indeks değerlendirmesi. |
| P3 | Production deploy/Caddy/backup | Uygulama kapsamı dışında kalan sonraki operasyon fazı. |

## Notlar

- İlk MVP’nin üç ilan türü de (satılık daire, kiralık daire, satılık otomobil) çalışır durumdadır.
- Yeni özellik eklerken önce `docs/MVP_SCOPE.md`, `docs/DECISIONS.md` ve ilgili spec/plan dosyaları güncellenir.
- Bu dosya büyüyen bir yol haritası değil, açık işlerin kısa listesidir; tamamlanan madde silinir veya `docs/DECISIONS.md` kaydına dönüşür.
