# Proje bağlamı

Bu depo Bizzat'ın ürün, marka, referans ve MVP kapsamını içerir. Uygulama kodu ve seçilmiş teknik altyapı henüz yoktur.

## Önce oku

- `README.md`: Genel özet ve belge haritası.
- `PROJECT.md`: Uzun vadeli ürün kapsamı ve hedef kullanıcılar.
- `docs/MVP_SCOPE.md`: İlk implementasyon milestone'u ve kabul kriterleri.
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
- Teknik altyapı seçimini olmuş gibi varsayma. Sıradaki teknik çalışma stack + sistem/veri mimarisidir.
- Repo belgelerine gerçek TC, plaka, taşınmaz numarası, erişim anahtarı veya başka özel kullanıcı verileri ekleme; örnek gerekiyorsa açıkça sahte örnek olduğunu belirt.

## İlk MVP'nin ana akışları

1. Ana sayfa → kategori → ilan listesi → filtre/sıralama → ilan detayı → telefonla iletişim.
2. Auth → kategori seçimi → EİDS/yetki doğrulaması → dinamik ilan formu → medya → önizleme → moderasyon/yayın.
3. İlan sahibi → kendi ilanları → düzenleme / yayından kaldırma.
4. Ziyaretçi → ilanı raporla; moderatör → incele / yayından kaldır.

## Mevcut doğrulama

Bu aşamada uygulama testi, build veya CI yoktur. Belge değişikliklerinde bağlantıların, kararlar arası tutarlılığın ve `PROJECT.md` / `MVP_SCOPE.md` / `DECISIONS.md` / `OPEN_QUESTIONS.md` uyumunun kontrol edilmesi gerekir.

Teknik stack seçildikten sonra test/build/CI kuralları bu dosyaya ayrıca eklenecektir.
