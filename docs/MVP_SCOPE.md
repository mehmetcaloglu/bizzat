# Bizzat — İlk MVP kapsamı

**Tarih:** 7 Eylül 2026  
**Durum:** İlk implementasyon kapsamı donduruldu  
**Amaç:** Platformun uzun vadeli ürün kapsamını küçültmeden, ilk çalışan sürümde hangi akışların ve kategorilerin geliştirileceğini kesinleştirmek.

## 1. Kapsam ilkesi

Bizzat'ın uzun vadeli ürün kapsamı değişmedi: emlak ve araç ilanları; her iki ana kategoride satış ve kiralama; profesyonel emlakçı ve galerici ilanlarını dışarıda tutan bireysel ilan odağı.

İlk MVP bunun tamamını tek seferde uygulamayacak. İlk hedef, kategoriye bağlı dinamik ilan/filtre altyapısını iki temsilci kategori üzerinde doğru kurup uçtan uca çalışan bir web ürünü çıkarmaktır.

## 2. İlk MVP'deki kategoriler

### Emlak

**Dahil:**

- Emlak → Konut → Daire → Satılık
- Emlak → Konut → Daire → Kiralık

Bu iki akışta `docs/reference/SAHIBINDEN_REFERENCE.md` içinde çıkarılan daire filtreleri ve ilan alanları referans alınır. Satılık ve kiralık arasındaki filtre farkları kategori/işlem türüne bağlı şema olarak modellenir.

**İlk MVP dışında:**

- Rezidans
- Müstakil Ev
- Villa
- Arsa
- İş Yeri
- Bina
- Devre Mülk
- Turistik Tesis
- Günlük kiralık
- Devren satış/kiralama
- Diğer emlak alt kategorileri

Bunlar nihai ürün kapsamından çıkarılmış değildir; ilk altyapı doğrulandıktan sonra aynı kategori/attribute sistemi üzerinden eklenir.

### Araç

**Dahil:**

- Araç → Otomobil → Satılık

Otomobilde marka → seri → model hiyerarşisi ve referans dokümandaki otomobil filtreleri uygulanır.

**İlk MVP dışında:**

- Kiralık otomobil
- Arazi, SUV & Pickup
- Motosiklet
- Minivan & Panelvan
- Ticari Araçlar
- Elektrikli Araçlar için ayrı üst kategori akışı
- Deniz Araçları
- Karavan
- ATV / UTV
- Klasik / hasarlı / engelli plakalı ve diğer vasıta sınıfları

Araç kiralama platformun uzun vadeli kapsamındadır; yalnızca ilk implementasyon milestone'unda ertelenmiştir.

## 3. Platform yüzeyi

İlk MVP **responsive web** olarak geliştirilecektir.

Native iOS/Android uygulaması ilk MVP kapsamında değildir. Web mimarisi daha sonra mobil istemcilerin kullanabileceği backend/API sınırlarını engellemeyecek şekilde kurulmalıdır; ancak sırf olası mobil uygulama için ilk sürüm gereksiz biçimde mikroservislere veya ayrı backend katmanlarına bölünmemelidir.

## 4. Kullanıcı tipleri

### Ziyaretçi

Giriş yapmadan:

- ana sayfayı görür,
- kategoriye gider,
- ilanları listeler,
- filtreler ve sıralar,
- ilan detayını görür.

### Bireysel ilan veren

Giriş yaptıktan sonra:

- ilan oluşturur,
- gerekli EİDS/yetki kontrolünden geçer,
- kendi ilanlarını görüntüler,
- düzenler,
- yayından kaldırır,
- uygun durumdaysa yeniden yayına alır.

Profesyonel emlak ofisi, galerici, mağaza veya kurumsal satıcı hesabı ilk MVP'de yoktur.

### Moderatör / yönetici

İlk MVP'de son kullanıcıya yönelik kapsam kadar büyük bir yönetim paneli gerekmiyor. Ancak operasyon için minimum olarak:

- ilanı görüntüleme,
- raporlanan ilanı inceleme,
- ilanı yayından kaldırma / reddetme,
- temel moderasyon notu tutma

yeteneği bulunmalıdır.

## 5. Ana kullanıcı akışları

### 5.1 İlan arama

1. Ana sayfa
2. Emlak veya Otomobil kategorisine geçiş
3. İlan listesi
4. Kategoriye özel filtreleme ve sıralama
5. İlan detayı
6. İlan verenle iletişim

### 5.2 İlan oluşturma

1. Giriş / hesap oluşturma
2. Kategori ve işlem türü seçimi
3. EİDS/yetki doğrulaması için gerekli varlık bilgisinin alınması
   - emlak: taşınmaz numarası ve gerekli doğrulama girdileri
   - otomobil: plaka/taşıt ve gerekli doğrulama girdileri
4. Yetki olumluysa ilan formuna devam
5. Kategoriye özel alanlar
6. Fiyat
7. Konum
8. Fotoğraflar
9. Açıklama
10. İletişim tercihi
11. Önizleme
12. Gönderme / moderasyon / yayın

Kullanıcıya uzun formu doldurttuktan sonra yetkisiz olduğunu söylememek için EİDS kontrolü mümkün olduğunca erken yapılmalıdır.

### 5.3 Kendi ilanlarını yönetme

- Taslakları görme
- Yayındaki ilanları görme
- Düzenleme
- Yayından kaldırma
- Reddedilmiş / doğrulama bekleyen ilan durumunu görme

## 6. İlan durumları

İlk teknik tasarım en az şu durumları desteklemelidir:

- `draft`
- `pending_verification`
- `pending_review`
- `published`
- `rejected`
- `inactive`

Durum adları uygulama kodunda değişebilir; burada önemli olan doğrulama, moderasyon ve yayın durumlarının birbirinden ayrılmasıdır.

## 7. EİDS production yayın kapısı

EİDS ilk MVP'de "sonra bakarız" denebilecek bir yan özellik değildir.

- Production ortamında gerekli EİDS/yetki doğrulaması olumlu değilse emlak veya taşıt ilanı yayınlanmamalıdır.
- Gerçek entegrasyon geliştirme başında hazır değilse doğrulama sağlayıcısı bir arayüz/adapter arkasına alınabilir.
- Local/test ortamında açıkça işaretlenmiş mock doğrulama kullanılabilir.
- Mock doğrulama production'da sessizce fallback olarak çalışamaz.
- TC, plaka, taşınmaz numarası ve doğrulama sonuçları için KVKK, loglama ve saklama gereksinimleri ayrıca teknik/hukuki tasarımda ele alınmalıdır.

## 8. Arama ve filtreleme

İlk MVP'de seçilen kategoriler için Sahibinden referansındaki filtre kapsamı ürün yönü olarak korunur.

### Daire

Satılık/kiralık daire için referans dokümanda çıkarılmış:

- konum,
- fiyat,
- brüt/net m²,
- oda sayısı,
- bina yaşı,
- kat,
- kat sayısı,
- ısıtma,
- banyo,
- mutfak,
- balkon,
- asansör,
- otopark,
- eşyalı,
- kullanım durumu,
- site,
- tapu ve işlem türüne özel diğer alanlar

şemaya alınacaktır.

Bizzat'ta bulunması yasaklanan profesyonel satıcı tipleri (`Emlak Ofisinden` gibi) körlemesine kopyalanmaz.

### Otomobil

Referans dokümandaki:

- marka / seri / model,
- fiyat,
- yıl,
- yakıt,
- vites,
- araç durumu,
- kilometre,
- kasa tipi,
- motor gücü,
- motor hacmi,
- çekiş,
- renk,
- garanti,
- ağır hasar kaydı,
- plaka/uyruk,
- takas,
- boya/değişen ve diğer ilgili alanlar

uygulanacaktır.

`Galeriden` gibi profesyonel satıcı seçenekleri Bizzat'ta yoktur.

## 9. İlan detay ekranı

İlk MVP ilan detayında en az:

- kategori yolu,
- başlık,
- fotoğraf galerisi,
- fiyat,
- konum,
- yapılandırılmış kategori özellikleri,
- açıklama,
- ilan veren bilgisi,
- iletişim CTA'sı,
- ilanı raporla

bulunmalıdır.

Sahibinden ekran yapısı referans alınır; Bizzat'ın açık mavi görsel kimliği, kendi metinleri ve bileşenleri kullanılır.

## 10. İletişim

İlk MVP'de iletişim **telefon odaklıdır**.

- İlan veren, ilan için iletişim telefonunu kullanır.
- Telefonun ilan üzerinde gösterimi açık kullanıcı tercihi/izniyle yapılır.
- Site içi mesajlaşma ilk MVP'de yoktur.
- WhatsApp entegrasyonu ilk MVP gereksinimi değildir.

Bu karar, ileride site içi mesajlaşma eklenmesine engel değildir.

## 11. İlk MVP'de özellikle olmayanlar

- Site içi mesajlaşma
- Favoriler
- Kaydedilmiş aramalar ve bildirimler
- Ödeme / abonelik
- Ücretli öne çıkarma / doping
- Ekspertiz entegrasyonu
- Rezervasyon
- Teklif verme sistemi
- AI önerileri
- Gelişmiş kişiselleştirme
- Native mobil uygulama
- Profesyonel emlakçı/galerici hesapları
- Mağaza sayfaları
- Sosyal özellikler
- Geniş analitik/dashboard ürünü

Bu liste YAGNI sınırıdır: ilk ana ilan döngüsünü çalıştırmayan bir özellik varsayılan olarak sonraya bırakılır.

## 12. Moderasyon ve bireysel ilan odağı

İlk sürümde "emlakçı/galerici tespiti" için karmaşık ML veya kusursuz fraud sistemi kurulmayacaktır.

Minimum yaklaşım:

- EİDS yetki doğrulaması,
- profesyonel hesap türlerinin hiç sunulmaması,
- kullanıcıların ilan raporlayabilmesi,
- moderatörün ilanı kaldırabilmesi,
- aynı kullanıcının olağandışı ilan davranışının ileride ek kontrollere uygun veri bırakması.

TC başına 3–4 emlak ilanı fikri bu aşamada kesin ürün kuralı değildir.

## 13. İlk MVP'nin tamamlanmış sayılması

İlk milestone şu uçtan uca akışlar gerçek veritabanıyla çalıştığında tamamlanmış kabul edilir:

1. Ziyaretçi ana sayfadan satılık/kiralık daire veya satılık otomobil listesine ulaşabiliyor.
2. İlgili kategori filtrelerini kullanıp URL/state üzerinden sonucu daraltabiliyor.
3. İlan detayını açabiliyor.
4. Kullanıcı hesap oluşturup giriş yapabiliyor.
5. Yetkili kullanıcı seçilen üç ilan türünden birinde ilan oluşturabiliyor.
6. Fotoğraf ekleyip ilanı önizleyebiliyor.
7. Doğrulama/moderasyon durumuna göre ilan yayınlanabiliyor.
8. İlan sahibi kendi ilanını düzenleyip yayından kaldırabiliyor.
9. Ziyaretçi ilanı raporlayabiliyor.
10. Moderatör raporlanan ilanı inceleyip yayından kaldırabiliyor.
11. Responsive web arayüzü masaüstü ve mobil tarayıcıda temel akışları kullanılabilir halde sunuyor.

Gerçek EİDS entegrasyonu production yayını için zorunludur; yalnızca mock ile çalışan geliştirme build'i production-ready sayılmaz.

## 14. Sonraki adım

MVP ürün kapsamı artık implementasyon için yeterince daraltılmıştır.

Sıradaki iş:

1. teknik stack'i seçmek,
2. sistem/veri mimarisini tasarlamak,
3. seçilen Daire ve Otomobil alanlarını makine-okunur attribute şemasına dönüştürmek,
4. ardından uygulama iskeletini oluşturmak.
