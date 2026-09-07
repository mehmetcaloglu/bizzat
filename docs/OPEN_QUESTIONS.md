# Açık konular

Bu dosyada karar gerektiren konular ve konuşulmuş başlangıç fikirleri bulunur. Uygulanmış özellik veya tamamlanmış entegrasyon olarak okunmamalıdır. 7 Eylül 2026'da yapılan ilk Sahibinden/EİDS referans araştırmasının sonuçları ilgili başlıklara işlenmiştir.

## 1. Alan adı ve isim

- Kullanıcı `bizzat.com` adresinin dolu olduğunu belirtti ve `bizzat.tr` adresini düşündüğünü söyledi.
- `bizzat.tr` adresinin müsaitliği, satın alınıp alınmadığı ve Bizzat adının marka uygunluğu bu çalışmada doğrulanmadı.

## 2. İlan ve kişi kontrolleri

### EİDS — artık açık bir ürün tercihi değil, entegrasyon gereksinimi

7 Eylül 2026 araştırmasında Ticaret Bakanlığının güncel EİDS açıklamaları incelendi. Kimlik ve ilan verme yetkisi doğrulaması elektronik ortamda verilen taşınmaz ve taşıt ilanlarını kapsıyor.

Bireysel ilan tarafında ilan verme yetkisi genel olarak şu kümeyle sınırlı:

- mal/taşıt sahibi,
- sahibin eşi,
- birinci derece kan hısımları,
- ikinci derece kan hısımları.

Yetki belgeli emlak işletmeleri ve oto galeriler için de ayrı yetkilendirme yolu vardır; ancak Bizzat'ın ürün kararı profesyonel emlakçı ve galerici ilanlarını dışarıda tutmaktır.

Bu nedenle önceki genel ürün yaklaşımındaki “başka bir birey adına yardımcı olarak ilan vermek kabul edilebilir” ifadesi teknik olarak sınırsız uygulanamaz. Arkadaş, kuzen, amca/dayı/hala/teyze, yeğen gibi EİDS kapsamındaki eş + 1./2. derece hısımlık kümesinin dışındaki kişiler için taşınmaz/taşıt ilanı yayınlanması mümkün görünmemektedir.

Ayrıntılı araştırma ve kaynaklar: [reference/SAHIBINDEN_REFERENCE.md](reference/SAHIBINDEN_REFERENCE.md).

### Araçta plaka ve sahiplik

Kullanıcı, araç ilanlarında plaka kontrolü ve ilan veren kişi ile kayıtlı araç sahibinin eşleşmesi yönünde bir yaklaşım belirtti.

Güncel EİDS kuralı nedeniyle yalnızca birebir malik eşleşmesi doğru ürün modeli değildir: eş ile birinci/ikinci derece kan hısımları da bireysel ilan verebilir. Teknik tasarımın plaka/araç doğrulamasını ve Bakanlık tarafındaki ilan verme yetkisini birlikte ele alması gerekir.

Henüz kesinleşmeyenler:

- Bizzat'ın EİDS'ye hangi teknik/kurumsal yöntemle bağlanabileceği.
- Doğrulama için gereken sözleşme, izin, veri ve operasyon gereksinimleri.
- Kullanıcıya gösterilecek doğrulama durumları ve hata/itiraz akışı.
- EİDS'nin izin verdiği hısımlık durumunun Bizzat arayüzünde nasıl anlatılacağı.

### Emlakta taşınmaz ve hısımlık doğrulaması

Güncel referansa göre bireysel gayrimenkul ilanında taşınmaz numarası üzerinden malik veya izin verilen hısımlık/yetki kontrolü yapılır. Sahibinden Yardım Merkezi, tüm gayrimenkul ilanlarında ilan yayınlama izni uygulamasının 15 Şubat 2026 itibarıyla zorunlu olduğunu belirtmektedir.

Henüz kesinleşmeyenler:

- Bizzat'ın taşınmaz numarası doğrulamasını nasıl entegre edeceği.
- EİDS sonucu dışında ek sahte/ticari ilan kontrollerinin neler olacağı.
- Hısımlık ve malik verilerinden hangilerinin Bizzat tarafından saklanmasının gerçekten gerekli olduğu.

### Emlakta ilan sınırı

Kullanıcı, özellikle emlak için TC başına en fazla yaklaşık 3–4 ilanı başlangıç fikri olarak önerdi.

Henüz kesinleşmeyenler:

- Sınırın 3 mü 4 mü olacağı.
- Aktif ilan sayısı mı, belli bir dönem içindeki toplam mı sayılacağı.
- Limitin hangi kategorilere uygulanacağı.
- İstisna ve itirazların nasıl ele alınacağı.
- EİDS doğrulaması varken ek ilan limitinin gerçekten gerekli olup olmadığı.

İlan sayısı sınırı tek başına emlakçı veya galerici tespiti değildir. Başlangıç hedefi, pratik kontrollerle ticari ilanları azaltmak ve bireysel ilan odağını korumaktır; sıfır istisna koşulu yoktur.

### Uygulama, hukuk ve operasyon

Doğrulamanın erişim koşulları, gerekli hukuki değerlendirmeler, KVKK kapsamındaki veri işleme yöntemi, saklama süreleri ve operasyon süreci uygulama aşamasında araştırılmalıdır. Bu görüşmede bir EİDS entegrasyon yöntemi veya sağlayıcı seçilmedi.

## 3. Referansın aktarılması ve açık ürün ayrıntıları

Filtrelerin Sahibinden ile birebir aynı olması kararlaştırıldı. Ana sayfa, ilan listesi ve ilan detayı da Sahibinden'i esas alacak; ilan verme adımları benzer olacak. Bu yönler artık açık tasarım kararı değildir.

7 Eylül 2026'da ilk referans envanteri çıkarıldı: [reference/SAHIBINDEN_REFERENCE.md](reference/SAHIBINDEN_REFERENCE.md).

Bu ilk envanter şunları içeriyor:

- ortak ekran kabuğu ve liste davranışı,
- Emlak ve Vasıta kategori ağacının yüksek seviyeli snapshot'ı,
- satılık/kiralık daire filtrelerinin çekirdeği,
- arsa, bina ve iş yeri filtre örüntüleri,
- otomobil ve Arazi/SUV/Pickup filtreleri,
- sonuç tablosu sütunları ve sıralamalar,
- ilan detay ekranının temel blokları,
- ilan verme akışı,
- Bizzat'a aynen taşınmaması gereken profesyonel satıcı/mağaza parçaları,
- EİDS gereksinimleri.

Sahibinden canlı kategori sayfaları otomatik erişimde 403 verdiği için bazı filtre/kategori ayrıntıları arama indeksindeki Sahibinden snapshot'larından çıkarıldı. MVP kapsamı belli olduğunda seçilen kategoriler canlı tarayıcıyla son kez karşılaştırılmalıdır.

Açık kalan ürün ayrıntıları:

- İlk yayına alınacak emlak ve araç alt kategorileri.
- Seçilen alt kategorilerin eksiksiz makine-okunur filtre/attribute şeması.
- Araç marka/model verisinin kaynağı.
- İlan verenle iletişimin kanalı.
- Şüpheli ticari ilanların incelenmesi ve kullanıcı itirazları.
- İlk yayın kapsamı ve lansman bölgesi.
- İlan ücretleri, gelir modeli veya abonelik olup olmayacağı.

## 4. Tasarım üretimi

- Kesin yazı karakteri ve kullanım lisansı.
- Düzenlenebilir vektör logo ve farklı boyutlarda kullanım dosyaları.
- Favicon ve benzeri küçük uygulamalar.
- Gerçek ekranlarda renk ve metin okunabilirliği.

Görsel yön zaten onaylandı; bu başlıklar yeni bir estetik arayışı değil, onaylanan görünümün üretime aktarılmasıyla ilgilidir.

## 5. Teknik altyapı

Frontend, backend, veritabanı, kimlik doğrulama, barındırma ve mobil uygulama yaklaşımı seçilmedi.

Referans araştırması stack seçimini yapmadı fakat veri modeli için önemli bir gereksinimi netleştirdi: Sahibinden'deki alanlar kategoriye göre ciddi biçimde değiştiğinden Bizzat'ın ilan özellikleri kategoriye bağlı dinamik attribute şeması desteklemelidir. Kesin mimari sonraki teknik aşamada kararlaştırılacaktır.
