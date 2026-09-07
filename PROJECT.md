# Proje bilgisi

## Amaç

Bizzat'ın temel amacı, emlakçı ve galerici ilanlarının olmadığı, bireysel kullanıcıların ilan verebildiği bir emlak ve araç platformu oluşturmaktır.

Kategori bilgilerinin belirgin olduğu, araç marka ve modellerinin tanımlı olduğu ve ayrıntılı filtrelerin kullanılabildiği düzenli bir ilan deneyimi hedeflenir. Filtreler Sahibinden'in ilgili emlak ve araç kategorileri referans alınarak uygulanır; ana sayfa, ilan listesi ve ilan detayı için Sahibinden esas alınır; ilan verme adımları da benzer tutulur. Bizzat'ın onaylanan marka ve görsel kimliği kullanılır.

Ayrıntılı referans: [docs/reference/SAHIBINDEN_REFERENCE.md](docs/reference/SAHIBINDEN_REFERENCE.md).

## Hedef kullanıcılar

- Evini veya başka bir emlak varlığını satmak ya da kiraya vermek isteyen bireyler.
- Aracını satmak veya kiraya vermek isteyen bireyler.
- EİDS'nin izin verdiği malik/eş/1.-2. derece hısım sınırı içinde bir yakınının ilanına yardımcı olan kişiler.
- Satılık veya kiralık emlak ve araç arayan kişiler.

## Uzun vadeli kapsam

| Kategori | Satış | Kiralama |
|---|---|---|
| Emlak | Kapsamda | Kapsamda |
| Araç | Kapsamda | Kapsamda |

Bu tablo platform vizyonunu gösterir; ilk implementasyon milestone'u daha dardır.

## İlk MVP kapsamı

7 Eylül 2026'da ilk implementasyon kapsamı donduruldu:

- Emlak → Konut → Daire → Satılık
- Emlak → Konut → Daire → Kiralık
- Araç → Otomobil → Satılık

İlk istemci responsive web'dir.

İlk MVP'de:

- ana sayfa,
- ilan listesi,
- kategoriye özel filtreler ve sıralama,
- ilan detayı,
- hesap oluşturma/giriş,
- EİDS/yetki doğrulama kapısı,
- ilan oluşturma,
- kendi ilanlarını yönetme,
- telefon odaklı doğrudan iletişim,
- ilan raporlama,
- minimum moderasyon

bulunur.

Favoriler, site içi mesajlaşma, ödeme/abonelik, ücretli öne çıkarma, ekspertiz, rezervasyon, native mobil uygulama ve profesyonel mağaza hesapları ilk MVP kapsamında değildir.

Ayrıntı ve kabul kriterleri: [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

## Katılım yaklaşımı

Temel ayrım bireysel kullanıcılarla emlakçı ve galericiler arasındadır.

Marka yaklaşımı, bir bireyin izin verilen yakınlık ilişkisi içinde başka bir bireyin malına yardımcı olabilmesini dışlamaz. Ancak güncel EİDS gereksinimleri elektronik taşınmaz ve taşıt ilanlarında yayın yetkisini sınırlar. Bizzat production akışı bu doğrulamayı bypass edemez.

Başlangıçta anlaşılır kurallar ve makul kontroller tercih edilir. Her fraud/ticari kullanım istisnasını ilk günden tamamen ortadan kaldırmaya çalışmak istenmez. İstisnalara tolerans, emlakçı ve galerici ilanlarını kabul etme yönünde bir karar değildir.

## Beklenen ilan deneyimi

- Sahibinden'in ilgili kategorilerindeki filtreleri referans alan ayrıntılı arama.
- Belirgin emlak ve araç kategorileri.
- Araçlarda tanımlı marka, seri ve model seçimi.
- Satılık ve kiralık ilanların anlaşılır biçimde sunulması.
- İlan veren kişiyle doğrudan görüşme olanağı.
- Sade, profesyonel ve rahat okunabilen bir görünüm.

## Ekran ve akış referansları

| Alan | Karar |
|---|---|
| Emlak ve araç filtreleri | İlgili Sahibinden kategori filtrelerini referans al; profesyonel satıcı seçeneklerini Bizzat kapsamına göre çıkar |
| Ana sayfa | Sahibinden'i esas al; Bizzat'ın görsel kimliğini uygula |
| İlan listesi | Sahibinden'i esas al; Bizzat'ın görsel kimliğini uygula |
| İlan detayı | Sahibinden'i esas al; Bizzat'ın görsel kimliğini uygula |
| İlan verme adımları | Sahibinden'e benzer akış; EİDS doğrulamasını erken aşamada uygula |

İlk ana sayfa görsel taslağı [HOMEPAGE.md](docs/design/HOMEPAGE.md) dosyasında bulunur. İlk referans envanteri çıkarılmış olsa da Sahibinden'in canlı kategori sayfalarının otomatik erişimde 403 vermesi nedeniyle seçilen kategori alanları implementasyon sırasında son kez canlı tarayıcıyla karşılaştırılmalıdır.

## İletişim

İlk MVP iletişim kanalı telefon odaklıdır. Site içi mesajlaşma ilk milestone'da yoktur. Telefon görünürlüğü kullanıcı tercihi/izniyle yönetilmelidir.

## Başarı beklentisi

Aranan fayda, bireysel ilan arayan kişinin emlakçı ve galerici ilanları arasında ayıklama yapmak zorunda kalmadan düzenli bir ilan deneyimi yaşayabilmesidir.

İlk MVP teknik başarı ölçütü, Satılık/Kiralık Daire ve Satılık Otomobil için ana sayfa → liste/filtre → detay ile auth → EİDS → ilan oluşturma → yayın/yönetim döngülerinin gerçek veritabanıyla uçtan uca çalışmasıdır.

Sayısal iş/KPI hedefleri henüz belirlenmedi.

## Henüz kararlaştırılmayanlar

EİDS entegrasyon yöntemi, araç marka/model veri kaynağı, konum veri kaynağı, teknik stack, gelir modeli, lansman bölgesi, detaylı moderasyon operasyonu ve production altyapısı açık konulardır.

Ayrıntılar [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) dosyasında tutulur.
