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

Araç katalog tarafı MVP için yeterli bir çalışma tabanı sağlıyor ve `AGENTS.md` B2 sonrası `listings` + `car_details` domainine geçilmesini açıkça istiyor.

Mevcut kodda auth/session, canonical araç tabloları, marka/seri endpointleri ve değişken derinlikte `selection` endpointi var; ancak `listings`, `car_details` veya ilan verme web yüzeyi yok. Bu nedenle iş mevcut bir ekrana küçük picker eklemek değil, ilk gerçek ürün vertical slice'ıdır.

## 3. Yaklaşım kararı

### Önerilen ve seçilen: ince vertical slice

`listings` + `car_details` için minimum kalıcı domain, authenticated draft API ve web'de gerçek canonical picker birlikte çıkar.

Bunun yerine değerlendirilen iki yaklaşım reddedildi:

- **Generic listing-schema/form engine'i önce kurmak:** İki gerçek kategori akışı görülmeden abstraction üretir, ilk kullanıcı değerini geciktirir ve YAGNI ihlalidir.
- **Sadece frontend picker demosu:** Canonical model UUID'sinin listing domainine gerçekten bağlandığını kanıtlamaz ve demo olarak kalır.

## 4. Scope

### Dahil

- ilk desteklenen listing type: `car_sale`
- `listing_types`, minimum `listings` ve minimum `car_details`
- authenticated otomobil draft create/read API
- aktif canonical terminal `vehicle_models.id` doğrulaması
- listing + car detail atomik transaction
- `/ilan-ver/otomobil` responsive web akışı
- marka → seri → değişken derinlikte seçim ağacı
- terminal model seçildikten sonra draft oluşturma
- seçili canonical yolun kullanıcıya özetlenmesi
- gerçek PostgreSQL integration testleri
- web picker/flow testleri

### Dahil değil

- EİDS provider veya mock EİDS
- publish endpointi veya state transition API
- model yılı, kilometre, yakıt, vites, kasa, motor, çekiş, renk
- fiyat, konum, fotoğraf/media, açıklama, telefon
- ilan listesi/public ilan detay
- moderasyon
- generic EAV veya generic form engine

İlk slice'ın tek görevi canonical araç seçimini gerçek draft kimliğine güvenli biçimde bağlamaktır.

## 5. Domain modeli

### 5.1 `listing_types`

İlk migration yalnız gerçekten desteklenen type'ı seed eder:

```text
id          uuid primary key default uuidv7()
code        text unique not null  -- car_sale
created_at  timestamptz not null default now()
```

Henüz uygulanmayan `apartment_sale` / `apartment_rent` satırları şimdiden seed edilmez.

### 5.2 `listings`

```text
id                uuid primary key default uuidv7()
owner_user_id     uuid not null references auth."user"(id)
listing_type_id   uuid not null references listing_types(id)
status            text not null default 'draft'
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

`status` için DB `CHECK` şu stabil vocabulary'yi kabul eder:

```text
draft
pending_verification
pending_review
published
rejected
inactive
```

Bu slice yalnız `draft` oluşturur ve hiçbir transition endpointi sunmaz.

Kurallar:

- Client `owner_user_id` veya `status` gönderemez.
- Owner Better Auth session user UUID'sinden gelir.
- Future title/description/price/location/contact kolonları ihtiyaç duyulan slice'ta eklenir; şimdiden nullable kolon yığını açılmaz.
- Auth user silme davranışı bu slice'ta yeni account-deletion policy üretmez; FK varsayılan restrict/no-action davranışıyla referential integrity'yi korur.

### 5.3 `car_details`

```text
listing_id         uuid primary key references listings(id) on delete cascade
vehicle_model_id   uuid not null references vehicle_models(id)
```

Authoritative araç kimliği yalnız terminal `vehicle_models.id`'dir.

- `make_id` ve `series_id` tekrar saklanmaz.
- Marka/seri gerektiğinde `vehicle_models -> vehicle_series -> vehicle_brands` üzerinden türetilir.
- Bu güncel karar, eski teknik mimari taslağındaki redundant `make_id/series_id/model_id` üçlüsünün yerini alır.
- `model_year` taxonomy değildir ve bu slice'ta eklenmez; sonraki otomobil alanları slice'ında `car_details.model_year` olur.

## 6. API tasarımı

### 6.1 Mevcut reference API değişmez

Picker şunları kullanır:

```text
GET /api/v1/reference/vehicle/brands
GET /api/v1/reference/vehicle/brands/:brandId/series
GET /api/v1/reference/vehicle/series/:seriesId/selection?parentKey=...
```

Web TSB/source tablolarına erişmez ve `catalog.json`ı bundle içine almaz.

### 6.2 Draft oluşturma

```text
POST /api/v1/listings/car-sale/drafts
```

Request:

```json
{ "vehicleModelId": "uuid" }
```

Response `201` özet şekli:

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

Category-specific route bilinçlidir: yalnız `car_sale` varken generic discriminated-union `POST /listings` kontratı tasarlamak gereksiz abstraction olur. İkinci gerçek listing type geldiğinde ortak create contract tekrar değerlendirilebilir.

### 6.3 Kendi draft'ını okuma

```text
GET /api/v1/listings/:listingId
```

Bu slice'ta yalnız owner kendi draft'ını okuyabilir. Başkasının draft'ı için bilgi sızdırmayan `404 LISTING_NOT_FOUND` kullanılır. Public published listing read sonraki listing-detail slice'ına aittir.

## 7. Backend sınırları

Yeni modül:

```text
apps/api/src/modules/listings/
  listing.routes.ts
  listing.service.ts
  listing.repository.ts
```

- **Route:** session auth + TypeBox validation + service call; SQL yok.
- **Service:** `car_sale` type resolve, active canonical model doğrulama, owner authorization ve transaction boundary.
- **Repository:** listing type lookup ve listing/car detail persistence/read SQL; ürün policy'si yok.

Vehicle doğrulaması canonical `vehicle_models` üzerinden yapılır. Listing modülü `vehicle_source_*` tablolarına veya TSB mapping katmanına erişmez.

Vehicle catalog modülüne minimum public servis metodu eklenebilir: aktif model UUID'sini doğrulayıp brand/series/selection-path özetini döndürür. Bu, listing modülünün vehicle repository'sine doğrudan uzanmasını önler.

## 8. Transaction ve bütünlük

Draft create atomiktir:

```text
active canonical vehicle model doğrula
BEGIN
  car_sale listing type resolve et
  listings row insert et
  car_details row insert et
COMMIT
```

İkinci insert başarısızsa orphan listing kalmaz.

Aktiflik kontrolü ile insert arasında maintenance kaynaklı eşzamanlı deactivation teorik olarak mümkün olsa da catalog import explicit bakım işlemidir; bu slice bunun için lock/complex concurrency protokolü eklemez. FK kimlik bütünlüğünü, service ise create anındaki active-policy'yi korur.

## 9. Web akışı

Yeni route:

```text
/ilan-ver/otomobil
```

Sayfanın tek işi doğru otomobili seçip draft oluşturmaktır.

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

Picker davranışı:

- Marka değişirse seri + tüm alt seçimler sıfırlanır.
- Seri değişirse tüm selection-path seçimleri sıfırlanır.
- `group` seçilince `parentKey` ile bir sonraki seviye yüklenir.
- `model` seçilince child request yapılmaz; dönen UUID terminal seçimdir.
- Üst seçim değişirse stale terminal UUID temizlenir.
- Loading/error/empty state görünürdür.
- Selection endpointi 404 dönerse stale seviye temizlenip kullanıcıdan yeniden seçim istenir.
- Terminal model seçilmeden create CTA aktif değildir.
- Create request pending iken CTA tekrar gönderimi engellemek için disable edilir.
- Başarılı create sonrası listing ID ve seçili araç özeti gösterilir; henüz sahte future form alanları render edilmez.

Görsel yön:

- açık mavi/beyaz, koyu gri metin yönü korunur,
- Sahibinden'in adım mantığı referans alınır ama görsel kopya yapılmaz,
- ana vurgu seçim ilerlemesidir; dashboard-kart kalabalığı veya dekoratif gradient yok,
- desktop'ta seçim yolu/aktif seviye okunaklı, mobilde ardışık tek kolon,
- kullanıcıya `catalog_key` gösterilmez.

## 10. Auth davranışı

- Draft create/read authenticated endpointtir.
- Session mevcut `getAuthSession()` ile okunur.
- Session yoksa `401 UNAUTHENTICATED`.
- `owner_user_id` request body'sinden kabul edilmez.
- Yeni JWT/cookie parser/auth mekanizması yazılmaz.
- Web unauthenticated durumda login CTA/yönlendirmesi gösterir ve ilan verme route'una dönüş hedefini mümkün olduğunca korur.

## 11. Contracts

`packages/contracts` içine yalnız bu slice'ın gerçek alanları eklenir:

- request `vehicleModelId`
- listing `id`
- `status: 'draft'`
- `type: 'car_sale'`
- canonical vehicle brand/series/selectionPath özeti

Future field'lar optional placeholder olarak kontrata eklenmez.

## 12. Test stratejisi

Implementasyon TDD ile yapılır.

### RED önce

Önce başarısız testler:

1. Migration `listing_types`, `listings`, `car_details` ve FK/check invariant'larını oluşturur.
2. Unauthenticated create `401` döner.
3. Aktif terminal model ile create `201` döner.
4. Inactive/bilinmeyen model fail-closed olur.
5. Owner session user'dır; client owner/status belirleyemez.
6. `listings` ve `car_details` atomik oluşur.
7. Başka kullanıcının draft read'i `404` döner.
8. Response canonical brand/series/selectionPath döndürür.
9. Web picker brand → series → variable group → model ilerler.
10. Parent değişiminde descendant seçimleri temizlenir.
11. Terminal seçilmeden CTA aktif olmaz ve pending durumda double-submit engellenir.
12. Create başarılı olduğunda dönen listing ID/araç özeti görünür.

### GREEN

Yalnız bu testleri geçirmek için gereken minimum production kodu eklenir.

### Final doğrulama

- `pnpm lint`
- `pnpm typecheck`
- gerçek PostgreSQL integration tests
- web tests
- `pnpm test`
- `pnpm build`
- normal repo CI

DB migration/transaction davranışı mock DB ile ikame edilmez.

## 13. Backward compatibility

- Yeni migration existing auth/location/vehicle tablolarını değiştirmez.
- `vehicle_models` UUID'leri yeniden üretilmez.
- Catalog import davranışı değişmez.
- Listing FK mevcut canonical model UUID'sine bağlanır.
- Catalog row daha sonra inactive olsa bile geçmiş listing kimliği silinmez; draft üzerinde yeniden seçim gerekip gerekmediği ayrı ürün kuralıdır.

## 14. Sonraki küçük slice'lar

Bu slice green olduktan sonra önerilen sıra:

1. `car_details`: model yılı + km + temel otomobil özellikleri
2. erken EİDS/vehicle-authority boundary ve local/test mock provider
3. fiyat + konum
4. fotoğraf/media
5. açıklama + telefon tercihi
6. önizleme + verification/review/publish state transitions
7. kendi ilanlarım
8. public listing list/detail

Her slice ölçülebilir kullanıcı davranışı ekler; listing domain tek seferde büyük generic framework'e dönüştürülmez.

## 15. Kabul invariant'ı

> Kullanıcının araç seçim ağacında seçtiği tek authoritative araç kimliği terminal canonical `vehicle_models.id`'dir ve oluşturulan Satılık Otomobil draft'ı bu UUID'yi atomik olarak `car_details` içinde saklar.

TSB/provider kimliği, raw label veya ara selection node key'i listing domain kimliği olamaz.
