# Bizzat — Satılık Otomobil İlan Taslağı + Canonical Araç Seçici Tasarımı

**Tarih:** 2026-09-15  
**Durum:** Kullanıcı incelemesi bekliyor  
**Branch:** `feat/car-listing-draft-picker`  
**Base:** `279ed07141c5c00d762ee560abfddf881046ee7f` (`#20` merge sonucu)

## 1. Amaç

Araç katalog/curation fazını büyütmeyi bırakıp katalog verisini ilk kez gerçek ürün akışında kullanmak.

Bu slice sonunda giriş yapmış bir kullanıcı:

1. Satılık Otomobil ilan akışına girer.
2. Canonical katalogdan marka seçer.
3. Marka altında seri seçer.
4. Serinin `selection_path` ağacını değişken derinlikte ilerler.
5. Terminal `vehicle_models.id` seçer.
6. Bu terminal model kimliğiyle bir `draft` ilan oluşturur.
7. Oluşturduğu taslağın seçili araç yolunu tekrar görebilir.

Bu slice **yayınlama akışı değildir**. EİDS, fiyat, konum, fotoğraf, açıklama, telefon tercihi ve moderasyon sonraki küçük slice'larda eklenir.

## 2. Neden şimdi bu iş

Araç katalog tarafı artık MVP için yeterli bir çalışma tabanı sağlıyor ve `AGENTS.md` açıkça B2 sonrası `listings` + `car_details` domainine geçilmesini istiyor.

Mevcut kodda:

- auth/session var,
- canonical araç tabloları var,
- marka/seri endpointleri var,
- değişken derinlikte `selection` endpointi var,
- ancak `listings`, `car_details` veya ilan verme web yüzeyi henüz yok.

Bu nedenle iş mevcut bir ekrana küçük picker eklemek değil; ilk gerçek ürün vertical slice'ıdır.

## 3. Değerlendirilen yaklaşımlar

### A. Önerilen: ince vertical slice

`listings` + `car_details` için minimum kalıcı domain, authenticated draft API ve web'de gerçek canonical picker birlikte çıkar.

**Artıları**

- Kullanıcı açısından gerçek ürün değeri üretir.
- Katalog tasarımını uçtan uca doğrular.
- Backend/frontend aynı PR'da gerçek kontrat üzerinden bağlanır.
- Sonraki yıl/km/fiyat/EİDS/media adımları küçük migration ve feature PR'ları olarak eklenebilir.

**Eksisi**

- İlk listing domain migration'ı ve API sınırı şimdi tanımlanır.

### B. Generic listing-schema/form engine'i önce kurmak

İlk günden `packages/listing-schema`, tüm otomobil alanları ve daire alanları için dinamik form motoru kurmak.

**Reddedildi:** İlk kullanıcı değerini geciktirir, henüz gerçek iki kategori formu üzerinden doğrulanmamış abstraction üretir ve YAGNI ihlali olur.

### C. Sadece frontend picker demosu

Araç ağacını web'de gezdirip server-side ilan kaydı oluşturmamak.

**Reddedildi:** Canonical model kimliğinin listing domainine gerçekten bağlandığını kanıtlamaz; demo olarak kalır.

## 4. Scope

### Dahil

- `listing_types` için ilk desteklenen publishable type: `car_sale`
- `listings` minimum core tablosu
- `car_details` minimum one-to-one tablosu
- authenticated otomobil draft oluşturma API'si
- kullanıcının kendi draft'ını okuma API'si
- aktif canonical `vehicle_models.id` doğrulaması
- listing + car detail atomik transaction
- `/ilan-ver/otomobil` responsive web akışı
- marka → seri → değişken derinlikte seçim ağacı
- terminal model seçildikten sonra draft oluşturma
- seçili yolun kullanıcıya özetlenmesi
- gerçek PostgreSQL integration testleri
- web component/flow testleri

### Dahil değil

- EİDS provider veya mock EİDS akışı
- publish endpointi
- durum geçişleri (`pending_verification`, `published` vb.)
- model yılı
- kilometre
- yakıt/vites/kasa/motor/çekiş/renk vb. otomobil alanları
- fiyat
- konum
- fotoğraf/media
- açıklama
- iletişim telefonu
- ilan listesi veya ilan detay sayfası
- moderasyon
- generic EAV veya generic form engine

Bu alanların eksikliği geçici ve bilinçlidir; ilk slice'ın tek görevi canonical araç seçimini gerçek draft kimliğine bağlamaktır.

## 5. Domain modeli

### 5.1 `listing_types`

İlk migration yalnız desteklenen type'ı tanımlar:

```text
id          uuid primary key default uuidv7()
code        text unique not null  -- car_sale
created_at  timestamptz not null
```

Bu tablo gelecekte `apartment_sale` ve `apartment_rent` eklenirken aynı listing core'u kullanmayı sağlar. Henüz uygulanmayan type'lar seed edilmez; DB'de var görünerek yanlışlıkla desteklenmiş izlenimi oluşturmaz.

### 5.2 `listings`

İlk slice yalnız gerçekten gereken core alanlarını oluşturur:

```text
id                uuid primary key default uuidv7()
owner_user_id     uuid not null
listing_type_id   uuid not null references listing_types(id)
status            text not null default 'draft'
created_at        timestamptz not null
updated_at        timestamptz not null
```

Kurallar:

- Bu slice yalnız `draft` oluşturur.
- Client `owner_user_id` veya `status` gönderemez.
- `owner_user_id` Better Auth session user UUID'sinden gelir.
- Gelecekteki title/description/price/location/contact alanları ihtiyaç duyulan slice'ta migration ile eklenir; şimdiden nullable kolon yığını açılmaz.
- Minimum status vocabulary uzun vadede `draft`, `pending_verification`, `pending_review`, `published`, `rejected`, `inactive` olarak korunur; ancak bu slice transition API'si oluşturmaz.

### 5.3 `car_details`

```text
listing_id         uuid primary key references listings(id) on delete cascade
vehicle_model_id   uuid not null references vehicle_models(id)
```

Önemli karar:

- `make_id` ve `series_id` ayrıca saklanmaz.
- Canonical listing araç kimliği yalnız terminal `vehicle_models.id`'dir.
- Marka ve seri `vehicle_models -> vehicle_series -> vehicle_brands` ilişkisiyle türetilir.
- Bu karar 2026-09-09 sonrası güncel vehicle catalog guardrail'lerini, eski teknik mimari taslağındaki redundant `make_id/series_id/model_id` üçlüsüne tercih eder.
- `model_year` bu slice'ta eklenmez; sonraki otomobil alanları slice'ında `car_details.model_year` olarak eklenir ve taxonomy'nin parçası yapılmaz.

## 6. API tasarımı

### 6.1 Mevcut reference endpointleri değişmez

Picker mevcut endpointleri kullanır:

```text
GET /api/v1/reference/vehicle/brands
GET /api/v1/reference/vehicle/brands/:brandId/series
GET /api/v1/reference/vehicle/series/:seriesId/selection?parentKey=...
```

Web kaynak/TSB tablosuna erişmez ve katalog JSON dosyasını bundle içine almaz.

### 6.2 Draft oluşturma

```text
POST /api/v1/listings/car-sale/drafts
```

Request:

```json
{
  "vehicleModelId": "uuid"
}
```

Response `201`:

```json
{
  "listing": {
    "id": "uuid",
    "status": "draft",
    "type": "car_sale",
    "vehicle": {
      "modelId": "uuid",
      "brand": { "id": "uuid", "name": "Renault" },
      "series": { "id": "uuid", "name": "Clio" },
      "selectionPath": [
        { "key": "renault:clio:1-0-tce", "name": "1.0 TCe" },
        { "key": "renault:clio:1-0-tce-evolution", "name": "Evolution" }
      ]
    }
  }
}
```

Neden category-specific route:

- İlk slice yalnız `car_sale` destekliyor.
- Generic `POST /listings` discriminated-union contract'ını henüz daire akışı olmadan tasarlamak gereksiz abstraction olur.
- Daha sonra iki gerçek listing type akışı oluştuğunda ortak create contract gerekirse bilinçli olarak çıkarılabilir.

### 6.3 Kendi draft'ını okuma

```text
GET /api/v1/listings/:listingId
```

Bu slice'ta yalnız owner kendi draft'ını okuyabilir. Başkasının draft'ı için bilgi sızdırmayan `404 LISTING_NOT_FOUND` davranışı tercih edilir.

Public published listing read davranışı sonraki listing detail slice'ına aittir.

## 7. Backend bileşenleri

Yeni modül:

```text
apps/api/src/modules/listings/
  listing.routes.ts
  listing.service.ts
  listing.repository.ts
```

Sorumluluklar:

### Route

- session authentication
- TypeBox request/response contract
- service çağrısı
- SQL içermez

### Service

- `car_sale` listing type'ını resolve eder
- `vehicleModelId`'nin aktif canonical terminal model olduğunu vehicle catalog public service üzerinden doğrular
- transaction boundary'yi yönetir
- owner authorization yapar

### Repository

- listing type lookup
- listing + car_details insert/read SQL
- product policy kararı vermez

Vehicle model doğrulaması source/TSB tablolarından değil canonical `vehicle_models` üzerinden yapılır. Listing modülü vehicle source repository'sine erişmez.

## 8. Transaction ve bütünlük

Draft create atomik olmalıdır:

```text
BEGIN
  active canonical vehicle model doğrula
  car_sale listing type resolve et
  listings row insert et
  car_details row insert et
COMMIT
```

İkinci insert başarısız olursa orphan `listings` row kalmaz.

DB foreign key ayrıca inactive olmayan yanlış UUID problemini çözmez; bu nedenle service active model kontrolü yapar. FK ise silinmiş/geçersiz kimlik bütünlüğünü ikinci katman olarak korur.

## 9. Web akışı

Yeni route:

```text
/ilan-ver/otomobil
```

Sayfanın tek işi doğru otomobili seçip draft oluşturmaktır.

Akış:

```text
Satılık Otomobil

Marka
  ↓
Seri
  ↓
Seri altı değişken seçim ağacı
  ↓
Terminal model
  ↓
[İlan taslağını oluştur]
```

### Picker davranışı

- Marka değişirse seri + tüm alt seçimler sıfırlanır.
- Seri değişirse tüm selection-path seçimleri sıfırlanır.
- `group` seçilince aynı endpoint `parentKey` ile bir sonraki seviyeyi yükler.
- `model` seçilince artık yeni child request yapılmaz; UUID terminal seçimdir.
- Geri dönülüp üst seviye değiştirilirse eski terminal UUID temizlenir.
- Loading/error/empty state açıkça gösterilir.
- API 404 dönerse stale seçim temizlenip ilgili seviyeden yeniden seçim istenir.
- Kullanıcı terminal model seçmeden draft create CTA aktif olmaz.
- Draft create başarılı olduğunda listing ID gösterilir ve sonraki alanların gelecek adım olduğu belirtilir; henüz sahte fiyat/yıl/form alanları gösterilmez.

### Görsel yön

- Mevcut Bizzat açık mavi/beyaz, koyu gri metin yönü korunur.
- Sahibinden'in adım mantığı referans alınır; birebir görsel kopya yapılmaz.
- Birincil vurgu seçim ilerlemesidir; dashboard kart kalabalığı veya dekoratif gradient kullanılmaz.
- Masaüstünde seçim yolu ve aktif kolon okunaklı; mobilde tek kolon/ardışık ilerleme kullanılır.
- Kullanıcıya teknik `catalog_key` gösterilmez.

## 10. Auth davranışı

- Draft create ve draft read authenticated endpointtir.
- Session mevcut `getAuthSession()` helper'ı ile okunur.
- Session yoksa `401 UNAUTHENTICATED`.
- `owner_user_id` request body'sinden kabul edilmez.
- Public sign-up role veya başka authorization parametreleri bu akışa taşınmaz.

Web sayfası unauthenticated durumda login yönlendirmesi/CTA'sı gösterir ve mümkün olduğunda ilan verme route'una geri dönüş hedefini korur. Yeni custom JWT veya auth mekanizması yazılmaz.

## 11. Contracts

`packages/contracts` içine listing draft contract'ları eklenir.

İlk contract yalnız bu slice'ın gerçekten kullandığı alanları taşır:

- `vehicleModelId`
- listing `id`
- `status: 'draft'`
- `type: 'car_sale'`
- kullanıcıya gösterilecek canonical vehicle brand/series/selectionPath özeti

Future field'lar şimdiden optional olarak eklenmez.

## 12. Test stratejisi

Implementasyon TDD ile yapılır.

### RED önce

Önce başarısız testler:

1. Migration sonrası `listing_types`, `listings`, `car_details` ilişkileri oluşur.
2. Unauthenticated draft create `401` döner.
3. Aktif terminal model ile draft create `201` döner.
4. İnactive/bilinmeyen model ile create fail-closed olur.
5. Oluşturulan listing owner session user'dır; client owner belirleyemez.
6. `listings` ve `car_details` atomik oluşur.
7. Başka kullanıcının draft read'i `404` döner.
8. Response canonical brand/series/selectionPath bilgisini döndürür.
9. Web picker brand → series → variable group → model akışını gerçek contract shape ile ilerletir.
10. Parent değişiminde descendant seçimleri temizlenir.
11. Terminal seçilmeden CTA aktif olmaz.
12. Create başarılı olduğunda dönen listing ID ekranda görünür.

### GREEN

Yalnız testleri geçirmek için gereken minimum production kodu eklenir.

### Final verification

- `pnpm lint`
- `pnpm typecheck`
- gerçek PostgreSQL integration tests
- web tests
- `pnpm test`
- `pnpm build`
- normal repo CI

Mock DB ile migration/transaction doğrulaması yapılmaz.

## 13. Migration/backward compatibility

- Yeni migration existing vehicle/location/auth tablolarını değiştirmez.
- `vehicle_models` UUID'leri yeniden üretilmez.
- Catalog import davranışı değişmez.
- Listing FK'si mevcut canonical model ID'lerine bağlanır.
- Catalog row ileride inactive olsa bile geçmiş listing kimliği korunur; draft üzerinde yeniden seçim gerekip gerekmediği ayrı ürün kuralıdır ve bu slice'ta otomatik silme yapılmaz.

## 14. Sonraki küçük slice'lar

Bu PR green olduktan sonra sıra:

1. `car_details` alanları: model yılı + km + temel otomobil özellikleri
2. erken EİDS/vehicle authority boundary ve local/test mock provider
3. fiyat + konum
4. fotoğraf/media
5. açıklama + telefon tercihi
6. önizleme + verification/review/publish state transitions
7. kendi ilanlarım
8. public listing list/detail

Her slice ölçülebilir ürün davranışı ekler; listing domain tek seferde büyük generic framework'e dönüştürülmez.

## 15. Kabul kriteri

Bu tasarım tamamlandığında sistem şu invariant'ı gerçek uçtan uca akışta kanıtlamalıdır:

> Kullanıcının araç seçim ağacında seçtiği tek authoritative araç kimliği terminal canonical `vehicle_models.id`'dir ve oluşturulan Satılık Otomobil draft'ı bu UUID'yi atomik olarak `car_details` içinde saklar.

TSB/provider kimliği, raw label veya ara selection node key'i listing domain kimliği olamaz.
