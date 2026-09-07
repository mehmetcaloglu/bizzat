# Açık konular

Bu dosyada karar gerektiren konular ve konuşulmuş başlangıç fikirleri bulunur. Uygulanmış özellik veya tamamlanmış entegrasyon olarak okunmamalıdır. İlk MVP kapsamı artık [MVP_SCOPE.md](MVP_SCOPE.md) dosyasında dondurulmuştur.

## 1. Alan adı ve isim

- `bizzat.tr` düşünülen adrestir.
- Alan adının müsaitliği/satın alma durumu ve marka tescil uygunluğu doğrulanmadı.

## 2. EİDS, kimlik ve ilan verme yetkisi

### EİDS entegrasyon yöntemi

EİDS artık açık bir ürün tercihi değil, production yayın önkoşuludur. Açık kalan konu **nasıl entegre edileceğidir**.

Henüz netleşmeyenler:

- Bizzat'ın EİDS'ye hangi teknik/kurumsal yöntemle bağlanabileceği.
- Sözleşme, başvuru, yetki ve erişim gereksinimleri.
- Test/sandbox imkânı olup olmadığı.
- Taşınmaz ve taşıt doğrulaması için gereken exact request/response akışları.
- Kullanıcıya gösterilecek doğrulama hata ve itiraz durumları.
- Entegrasyon kesintisinde production davranışının ne olacağı.

Karar: production'da doğrulama başarısızsa veya yapılamıyorsa ilan sessizce yayınlanamaz.

### KVKK ve hassas veri

Henüz netleşmeyenler:

- TC kimlik numarası gibi verilerin Bizzat tarafından tutulmasına gerçekten ihtiyaç olup olmadığı.
- Plaka ve taşınmaz numarası için saklama süreleri.
- EİDS doğrulama cevabından hangi minimum verinin kalıcı tutulacağı.
- Log/redaction politikası.
- Kullanıcı aydınlatma ve açık rıza gereksinimleri.

Amaç mümkün olduğunca az hassas veri saklamaktır.

### Emlakta ilan sınırı

TC başına yaklaşık 3–4 ilan fikri hâlâ kesin ürün kuralı değildir.

Açık kalanlar:

- EİDS + moderasyon varken ek limite gerçekten ihtiyaç olup olmadığı.
- Gerekirse limitin aktif ilan mı, dönemsel ilan mı sayacağı.
- İstisna ve itiraz modeli.

İlk MVP bu limiti zorunlu kabul ederek kodlanmamalıdır.

## 3. İlk MVP için veri kaynakları

### Araç marka / seri / model

İlk MVP'de Otomobil bulunduğu için bu konu artık implementasyon öncesi çözülmesi gereken açık teknik üründür.

Açık kalanlar:

- veri kaynağı,
- lisans/kullanım koşulları,
- model yılına göre seri/model ilişkisi gerekip gerekmediği,
- düzenli güncelleme yöntemi.

### Türkiye konum verisi

Daire ve otomobil filtrelerinde il/ilçe, emlakta ayrıca semt/mahalle hiyerarşisi gerekir.

Açık kalanlar:

- il/ilçe/mahalle veri kaynağı,
- güncelleme yöntemi,
- koordinat/geocoding'in ilk MVP'de ne kadar gerekli olduğu.

Harita-odaklı ürün ilk MVP şartı değildir.

### Makine-okunur attribute şeması

Referans envanteri metin olarak çıkarıldı. İlk implementasyon için şu üç ilan türü JSON/YAML veya seed-data biçiminde normalize edilmelidir:

- Satılık Daire
- Kiralık Daire
- Satılık Otomobil

Bu şemada alan tipi, seçenekler, zorunluluk, filtrelenebilirlik, sıralanabilirlik ve işlem türü/kategori ilişkisi açık olmalıdır.

## 4. Teknik altyapı

Henüz seçilmedi:

- frontend framework,
- backend yaklaşımı,
- veritabanı,
- auth servisi/yöntemi,
- dosya/fotoğraf storage,
- arama altyapısı,
- hosting/deploy,
- gözlemlenebilirlik,
- CI/CD.

MVP kararı bazı gereksinimleri sabitledi:

- ilk istemci responsive web,
- kategoriye bağlı dinamik attribute şeması,
- gerçek relational veri tabanı,
- fotoğraf yükleme,
- filtrelenebilir/sıralanabilir ilan listeleri,
- EİDS provider/adapter sınırı,
- moderasyon durumları,
- production'da mock EİDS fallback olmaması.

Sıradaki teknik iş stack + sistem/veri mimarisi kararıdır.

## 5. İletişim ayrıntıları

İlk MVP'de kanal kararı verildi: **telefon odaklı**, site içi mesajlaşma yok.

Açık kalan küçük uygulama ayrıntıları:

- telefonun varsayılan olarak gizli/açık olması,
- telefon gösteriminde rate limit / abuse önlemleri,
- numara doğrulama yönteminin auth ile aynı olup olmayacağı.

## 6. Moderasyon operasyonu

İlk MVP'de ilan raporlama ve moderatör kaldırma yeteneği var.

Henüz netleşmeyenler:

- rapor nedenleri,
- moderasyon SLA'sı,
- tekrar eden kötüye kullanım davranışı,
- kullanıcı itirazı,
- hesap seviyesinde yaptırım,
- ileride emlakçı/galerici davranışını tespit etmek için ek sinyaller.

Bunların tamamının ilk kod tesliminden önce kusursuz çözülmesi şart değildir.

## 7. Gelir modeli ve ticari kapsam

Açık:

- ilan ücretli mi ücretsiz mi,
- ücretsiz ilan limiti,
- abonelik,
- öne çıkarma/doping,
- gelir modeli,
- ilk ticari lansman bölgesi.

İlk MVP'de ödeme/abonelik/doping yoktur; bu karar gelir modelini kalıcı olarak reddetmez.

## 8. Tasarım üretimi

Açık:

- kesin font ailesi ve lisansı,
- SVG/vector logo,
- favicon/app icon seti,
- gerçek ekranlarda erişilebilirlik/kontrast doğrulaması,
- responsive breakpoint ve component-level tasarım detayları.

Görsel yön değişmiyor: açık mavi, beyaz/açık tonlar, sade ve profesyonel.

## 9. Sonraki kategori genişlemesi

İlk MVP kategorileri artık açık konu değildir:

- Satılık Daire
- Kiralık Daire
- Satılık Otomobil

Sonraki hangi kategorinin ekleneceği MVP ana döngüsü çalıştıktan sonra kararlaştırılacaktır. Araç kiralama ve diğer emlak/vasıta sınıfları uzun vadeli ürün kapsamındadır.
