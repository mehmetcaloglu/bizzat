# Sahibinden araç seçim ağacı

Kullanıcı 2026-09-09 tarihinde “sahibinden nasıl yapıyor ise bizde öyle yapmalıyız ... ona göre devam edelim” talimatını verdi. Bu karar önceki üç görünür seviye sadeleştirmesini değiştirir. Referans, kullanıcıya görünen kategori yollarıdır; Sahibinden'in iç veritabanı veya veri lisansı hakkında çıkarım yapılmaz.

## Davranış

Ağaç her araçta aynı derinlikte değildir. Zorunlu dört seviye veya her motorun altında otomatik “Standart” paketi üretilemez.

| Marka | Seri | Seri altındaki seçim yolu |
| --- | --- | --- |
| Renault | Clio | 1.0 TCe → Evolution |
| Volkswagen | Polo | 1.0 TSI → Comfortline |
| Peugeot | 308 | 1.2 PureTech → GT |
| BMW | 3 Serisi | 320i ED → Sport Line |
| Mercedes-Benz | C Serisi | C 180 → AMG |
| Audi | A3 | A3 Sedan → 35 TFSI → Advanced |
| Tesla | Model 3 | Long Range |

`320i`/`320i ED`, Clio Sport Tourer ve Audi Sedan/Sportback ayrımları korunur. Şanzıman, güç veya kasa sözcükleri için bütün markalara uygulanan kör silme kuralı yoktur: referansta dalı değiştiren ayrım korunur, yeri doğrulanmamış ayrım incelemeye bırakılır. TSB model yılı metadata'sı ilan yılı doğrulaması üretmez.

## Backend

Canonical marka/seri ve son seçilebilir `vehicle_models` UUID'si korunur. Model satırına opsiyonel `selectionPath: Array<{key, name}>` eklenir; PostgreSQL'de nullable `selection_path` JSONB olarak saklanır. Yol seri altından başlar ve son seçilebilir kaydı içerir. Son elemanın key'i modelin değişmeyen `catalog_key` değeridir. Ara düğümler seri kapsamında Bizzat-owned anahtar taşır. Ayrı engine/trim/spec/year tabloları gerekmez.

Bir düğümün adı ve ebeveyn yolu tutarlı olmalıdır. Aynı düğüm hem yaprak hem grup olamaz; döngü, yinelenen yol anahtarı, aynı ebeveyn altında aynı isimli farklı düğüm ve başka seriye taşınmış anahtar reddedilir. Operasyonel katalog her model için açık yol içerir. Eski, yolsuz fixture'lar tek yaprak olarak okunabilir; legacy uyumluluk için motor/paket adları string'den tahmin edilmez.

`GET /api/v1/reference/vehicle/series/:seriesId/selection?parentKey=...` bir sonraki seviyeyi döndürür. `parentKey` verilmezse seri kökünden başlar. Grup `{key, name, kind: 'group'}`, son seçim `{key, name, kind: 'model', id: modelUUID}` biçimindedir. İstemci grup seçildikçe ilerler; yalnız yaprak UUID'sini ilan referansı olarak kullanır. Bilinmeyen, pasif, başka seriye ait veya yaprak olan ebeveyn 404 döner. Yalnız aktif canonical satırlar okunur; kaynak tablosu join'i veya ağ isteği yoktur. Eski `/models` endpointi tam model isimleriyle düz liste sözleşmesini korur.

## Curation ve kapsam

TSB Ağustos 2026 snapshot'ı veri/mapping kaynağıdır. Daha önce edinilmiş 27.906 satırlık normalize artifact yeniden kullanıldı; fiyat ve ham kaynak repoya girmez. Marka/seri alias'ları explicit kalır. Maintenance parser bilinen motor rozetleri, doğrulanmış gövde yolları ve marka kapsamında kabul edilen paket sözlüğünü kullanır. Bilinmeyen paket yazımı, belirsiz kasa veya drivetrain dalı otomatik tahmin edilmez. Candidate çıktısı her kaynak için `mapped`, `model-review` veya `excluded` durumunu gösterir.

Bu sürüm **Sahibinden ağacının tamamı değildir**. 18 marka, 50 seri, 567 seçilebilir kayıt ve 790 kaynak mapping'i içerir. 6.089 seri eşleşmesi model incelemesi bekler. Önceki taslaktaki Alfa Romeo, BYD, Chery, Chevrolet, Cupra, DS Automobiles, Kia, MINI, Mazda, Seat, Skoda ve Subaru bu sıkı sözlükten henüz geçmediği için yayımlanabilir kapsamda değildir. Tesla'da yalnız Model 3'ün açık isimli dalları; Audi'de yalnız açık gövde bilgili A3/A4 kayıtları kabul edilir. Bu kapsam gerilemesi gizlenmez; PR tam katalog olarak merge edilmeye hazır değildir.

İlk, henüz merge edilmemiş 6.652 TSB-tip key'i bu curation'da sadeleştirilir; Phase A fixture hedefleri korunur. Sonraki üretimlerde reviewed `catalog.json` ve `tsb-mappings.json` baseline olarak verilir. Mevcut source mapping'leri yaprak kimliğini, mevcut yol ara düğüm anahtarlarını korur. Aynı kimliğin bölünmesi, iki kimliğin birleşmesi, seriye taşınması veya yol derinliğinin değişmesi explicit review ister. Bir display düzeltmesi yeni listing kimliği üretmez.

## Doğrulama ve merge kapısı

Offline testler curation, bilinmeyenlerin reddi, teknik tiplerin birleşmesi, yol ayrımları, identity baseline ve mapping hedeflerini doğrular. PostgreSQL testleri explicit migration/import, değişmeyen UUID, değişken derinlikte traversal, pasif kayıtlar, seri sınırı ve 404 davranışını doğrular. CI gerçek committed katalog ile B1 fixture mapping'lerini birlikte import eder. Tam CI ve bağımsız kod incelemesi teknik kapıdır; eksik marka/seri yollarının curation incelemesi ayrı ürün kapısıdır. İkisi tamamlanmadan PR #11 draft kalır.

## İncelenen referanslar — 2026-09-09

- [Clio 1.0 TCe Techno Esprit Alpine](https://www.sahibinden.com/renault-clio-1.0-tce-techno-esprit-alpine)
- [Clio 1.0 TCe Touch](https://www.sahibinden.com/renault-clio-1.0-tce-touch)
- [Polo 1.0 TSI Comfortline](https://www.sahibinden.com/volkswagen-polo-1.0-tsi-comfortline)
- [308 1.2 PureTech GT](https://www.sahibinden.com/peugeot-308-1.2-puretech-gt)
- [BMW 320i ED](https://www.sahibinden.com/bmw-3-serisi-320i-ed)
- [BMW 320i Executive M Sport](https://www.sahibinden.com/bmw-3-serisi-320i-executive-m-sport)
- [Mercedes C 180 AMG](https://www.sahibinden.com/en/mercedes-benz-c-series-c-180-amg)
- [Mercedes C 180 Komp. BlueEfficiency AMG](https://www.sahibinden.com/mercedes-benz-c-serisi-c-180-komp-blueefficiency-amg)
- [Audi A3 Sedan 35 TFSI Advanced](https://www.sahibinden.com/audi-a3-a3-sedan-35-tfsi-advanced)
- [Audi A3 Sportback 35 TFSI Advanced](https://www.sahibinden.com/audi-a3-a3-sportback-35-tfsi-advanced)
- [Audi A4 Avant](https://www.sahibinden.com/audi-a4-a4-avant)
- [Tesla Model 3 Long Range](https://www.sahibinden.com/tesla-model-3-long-range)
- [Tesla Model 3 Standart Plus ve kardeş dalları](https://www.sahibinden.com/tesla-model-3-standart-plus)
- [Egea Cross'un ayrı SUV kategorisi](https://www.sahibinden.com/arazi-suv-pickup-fiat-egea-cross-1.4-fire-urban)

Başarılı arama indeksi özetleri kategori yollarını ve bazı kardeş dalları gösterir. Bunlar seçili örneklerdir; eksiksiz veya lisanslanmış güncel kategori export'u elde edildiği anlamına gelmez. GİB arşiv dosyaları bu değişiklikte okunmadı; JATO entegrasyonu yapılmadı.

## İnceleme sonrası korumalar

Teknik ayıklama yalnız `source-manifest.json` içindeki on `reviewedTechnicalPolicySeries` için uygulanır. Diğer serilerde gövde/şanzıman/güç sözcükleri korunarak incelemeye bırakılır; sayı içeren paket adları güç gibi silinmez. Kaynakta zaten açık motor + bilinen paket bulunan temiz satırlar bu ayıklamaya ihtiyaç duymadan aday olabilir. Marka kapsamındaki paket sözlüğü, tek başına tüm serilerde teknik ayrım silme izni vermez.

Import, mevcut aktif veya pasif modelin serisini ve mevcut serinin markasını değiştirmeyi transaction içinde reddeder. Conflict update parent ID'lerini yazmaz; dönen parent kontrolü eşzamanlı uyuşmazlıkta rollback sağlar. Her ara düğüm `<seriesKey>:` ad alanına ait olmalıdır.

İlk MVP yalnız Otomobil olduğundan bilinen SUV/pickup/ticari nameplate alias'ları bu seed'den çıkarıldı. Fiat 500/500L de doğru `500 Ailesi` ara yapısı ayrıca incelenene kadar dışarıda. [Peugeot 408](https://www.sahibinden.com/arazi-suv-pickup-peugeot-408), [Citroën C4 Cactus](https://www.sahibinden.com/arazi-suv-pickup-citroen-c4-cactus) ve [Fiat 500L](https://www.sahibinden.com/fiat-500-ailesi-500l-1.3-mjet) referansları bu ayrımın neden önemli olduğunu gösterir. `coverageByKnownBrand` kabul/inceleme sayılarıyla kalan işi görünür tutar; kaynak toplamı otomobil kapsam yüzdesi değildir.

Accent Blue/Era kaynakları ortak Hyundai Accent dalına katılmaz; ayrı nameplate kimlikleri incelenene kadar seçilebilir seed dışında tutulur. İnceleme referansları: [Accent Blue](https://www.sahibinden.com/hyundai-accent-blue), [Accent Era](https://www.sahibinden.com/hyundai-accent-era). Motor/rozet/hacim ile doğrudan ilişkili olmayan parantezli sayılar da otomatik güç değeri sayılmaz.

Baseline üzerinden korunan bir grubun anahtarı, aynı güncel ancestor-path altına eklenen yeni kardeş yapraklar tarafından paylaşılır. Aynı yola birden fazla eski grup kimliği veya aynı kimliğe farklı yollar düşerse explicit review gerekir.
