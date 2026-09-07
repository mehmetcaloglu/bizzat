# Sahibinden referans envanteri

**Araştırma tarihi:** 7 Eylül 2026  
**Durum:** İlk uygulama referansı  
**Amaç:** Bizzat için yeniden ürün keşfi yapmak yerine, kararlaştırılan Sahibinden referansını ekran, kategori, filtre ve ilan verme akışı düzeyinde kaydetmek.

> Bu belge Sahibinden'in tasarımını veya metinlerini hukuken kopyalama izni anlamına gelmez. Amaç bilgi mimarisi, alanlar, filtre davranışları ve kullanıcı akışını referanslamaktır. Bizzat kendi marka kimliği, metinleri ve görsel bileşenleriyle uygulanacaktır.

## 1. Araştırma yöntemi ve güven düzeyi

Sahibinden'in canlı kategori sayfaları bu araştırmada doğrudan otomatik erişime `403` yanıtı verdi. Bu nedenle üç kaynak türü kullanıldı:

1. **Ticaret Bakanlığı ve EİDS resmî kaynakları:** mevzuat kaynaklı kimlik/yetki doğrulama gereksinimleri için birincil kaynak.
2. **Sahibinden Yardım Merkezi:** ilan verme, EİDS, iletişim, ilan yönetimi ve güncel ürün davranışları için birincil ürün kaynağı.
3. **Arama motorunda indekslenmiş Sahibinden kategori/listeme sayfaları:** kategori ağacı, filtre adları, seçenekler, tablo sütunları ve sıralama seçenekleri için snapshot kaynak. Bu sayfaların önemli bölümü 2025 sonu / 2026 başında taranmış; bazı sonuç sayfaları 2026 yazında yeniden taranmıştır.

Bu nedenle aşağıdaki etiketler kullanılır:

- **RESMÎ / GÜNCEL:** Bakanlık veya Sahibinden Yardım Merkezi üzerinden 7 Eylül 2026'da doğrulandı.
- **SNAPSHOT:** Sahibinden sayfasının arama indeksindeki son görülebilen sürümünden çıkarıldı; uygulama öncesi canlı tarayıcıyla son kez karşılaştırılmalı.
- **AÇIK:** Henüz yeterli kanıtla envantere alınmadı.

## 2. Bizzat'ı doğrudan etkileyen EİDS zorunluluğu

Bu araştırmanın en önemli sonucu budur: kimlik ve ilan verme yetkisi kontrolü sadece Sahibinden'in kendi ürün tercihi değildir.

Ticaret Bakanlığı 22 Ağustos 2026 tarihli açıklamasında EİDS kapsamında kimlik ve yetki doğrulaması zorunluluğunun **Instagram, Facebook ve WhatsApp dahil elektronik ortamda verilen tüm taşınmaz ve taşıt ilanlarını** kapsadığını açıkça belirtmektedir.

### Taşınmaz

**RESMÎ / GÜNCEL**

Bireysel taşınmaz ilanını şu kişiler verebilir:

- taşınmaz sahibi,
- sahibin eşi,
- birinci derece kan hısımları: anne, baba, çocuk,
- ikinci derece kan hısımları: kardeş, büyükanne/büyükbaba, torun,
- taşınmaz sahibince yetkilendirilmiş ve yetki belgeli emlak işletmesi.

Bireysel ilan girişinde **taşınmaz numarası** kullanılır; malik/hısımlık kontrolü Bakanlık sistemi üzerinden yapılır. Sahibinden Yardım Merkezi, ilan yayınlama izni uygulamasının tüm gayrimenkul ilanlarında 15 Şubat 2026 itibarıyla zorunlu olduğunu belirtmektedir.

Bizzat'ın emlakçı ilanlarını kabul etmeme kararı nedeniyle, emlak işletmesi yetkilendirme kolu ürün kapsamı dışında bırakılabilir; ancak bireysel malik/eş/hısım doğrulamasının nasıl entegre edileceği teknik ve operasyonel gereksinimdir.

### Taşıt

**RESMÎ / GÜNCEL**

Ticaret Bakanlığına göre 16 Haziran 2025 itibarıyla EİDS yetki doğrulaması tüm taşıt ilanlarında zorunludur. İlanı şu kişiler/kuruluşlar verebilir:

- taşıt sahibi,
- sahibin eşi,
- birinci ve ikinci derece kan hısımları,
- taşıt sahibince yetkilendirilmiş yetki belgeli oto galeri işletmesi.

Bizzat'ın galerici ilanlarını kabul etmeme kararı nedeniyle son kol ürün kapsamı dışında bırakılabilir. Buna rağmen plaka/taşıt ve hısımlık-yetki kontrolü teknik tasarımın parçası olmak zorundadır.

### Repo kararına etkisi

Mevcut ürün belgelerinde "başka bir birey adına yardımcı olarak ilan vermek genel olarak kabul edilebilir" kararı vardır. **Arkadaş, kuzen, amca/dayı/hala/teyze, yeğen gibi EİDS'nin izin verdiği eş + 1./2. derece hısım kümesinin dışındaki kişiler için bu yaklaşım elektronik taşınmaz/taşıt ilanlarında uygulanabilir görünmemektedir.**

Bu bir marka tercihi değil, uygulama öncesi hukuk/entegrasyon gereksinimi olarak ele alınmalıdır. `OPEN_QUESTIONS.md` güncellenmiştir.

## 3. Ortak ekran kabuğu

### 3.1 Üst alan

**SNAPSHOT**

İndekslenmiş güncel Sahibinden sayfalarında ortak üst yapı:

- ana sayfaya dönüş / logo,
- `Kelime, ilan no veya mağaza adı ile ara` arama alanı,
- `Detaylı Arama`,
- `Giriş Yap`,
- `Hesap Aç`,
- `Mesajlar`,
- `Favoriler`,
- `İlan Ver` çağrısı.

Bizzat uyarlaması:

- marka `bizzat`,
- CTA `İlanını oluştur.`,
- arama alanı ve detaylı arama mantığı korunabilir,
- mesaj/favori ilk MVP'ye girmezse üst alanda gösterilmemeli,
- Sahibinden'e özgü `Ekspertiz Raporu Oluştur`, doping ve benzeri servisler kopyalanmamalı.

### 3.2 Arama / liste ekranı iskeleti

**SNAPSHOT**

Temel düzen:

1. breadcrumb / kategori yolu,
2. kategori ve alt kategori seçimi,
3. sol filtre sütunu,
4. seçilmiş filtre etiketleri + `Tümünü Temizle`,
5. sonuç sayısı,
6. `Aramayı Kaydet`,
7. sıralama,
8. sonuç tablosu veya liste,
9. sayfalama,
10. uygun kategorilerde `Harita Görünümü`.

Filtre panelinde iki çalışma biçimi görülüyor:

- kriter seçildikçe sonuçları yenileyen `Seçtikçe sonuç getir`,
- kriterleri seçip `Ara` ile topluca uygulama.

Bizzat ilk sürümünde bunlardan biri seçilebilir; referanstaki davranış için varsayılan öneri seçim sonrası URL/query state'ini güncelleyen ve sonuçları yenileyen modeldir.

## 4. Emlak kategori ağacı

### 4.1 Üst kategoriler

**SNAPSHOT**

Sahibinden `Emlak` altında:

- Konut
- İş Yeri
- Arsa
- Konut Projeleri
- Bina
- Devre Mülk
- Turistik Tesis

Bizzat'ın ilk yayın alt kategorileri henüz kararlaştırılmadığı için bu ağaç **referans ağacıdır, MVP kapsam kararı değildir**.

### 4.2 Konut

**SNAPSHOT**

İşlem türleri:

- Satılık
- Kiralık
- Turistik Günlük Kiralık
- Devren Satılık Konut

Satılık konutta gözlenen alt tipler:

- Daire
- Rezidans
- Müstakil Ev
- Villa
- Çiftlik Evi
- Köşk & Konak
- Yalı
- Yalı Dairesi
- Yazlık
- Kooperatif

`Turistik Günlük Kiralık` için Sahibinden Yardım Merkezi, 100 günden kısa turizm amaçlı kiralamalarda geçerli turizm izin belgesi numarasını zorunlu tutmaktadır. Bizzat bu alt kategoriyi açacaksa ayrıca mevzuat gereksinimi olarak ele alınmalıdır.

### 4.3 İş Yeri

**SNAPSHOT**

İşlem türleri:

- Satılık
- Kiralık
- Devren Satılık
- Devren Kiralık

İş yeri alt tipleri işlem türüne göre değişiyor. İndekslenmiş sayfalarda görülen örnek/başlıca tipler:

- Akaryakıt İstasyonu
- Apartman Dairesi
- Atölye
- AVM
- Büfe
- Büro & Ofis
- Çiftlik
- Depo & Antrepo
- Düğün Salonu
- Dükkan & Mağaza
- Fabrika & Üretim Tesisi
- Garaj & Park Yeri
- İmalathane
- İş Hanı Katı & Ofisi
- Kafe & Bar
- Kantin
- Kıraathane
- Komple Bina
- Maden Ocağı
- Otopark / Garaj
- Oto Yıkama & Kuaför
- Pastane, Fırın & Tatlıcı
- Pazar Yeri
- Plaza
- Plaza Katı & Ofisi
- Restoran & Lokanta
- Rezidans Katı & Ofisi
- Sağlık Merkezi
- Sinema & Konferans Salonu
- SPA, Hamam & Sauna
- Spor Tesisi
- Villa
- Yurt

Devren ilanlarda kategori ağacı çok daha geniştir; aktar, anaokulu, araç showroom, balıkçı, bar, bijuteri, çamaşırhane, çiçekçi, eczane, elektronik mağazası, gece kulübü, market, matbaa, oto servis, pet shop, veteriner vb. işletme türleri ayrı alt tiplerdir. İlk MVP'de İş Yeri varsa bu ağacın canlı kaynaktan ayrıca tam export'u yapılmalıdır.

### 4.4 Arsa

**SNAPSHOT**

İşlem türleri:

- Kat Karşılığı
- Satılık
- Kiralık

### 4.5 Bina

**SNAPSHOT**

İşlem türleri:

- Satılık
- Kiralık

### 4.6 Devre Mülk

**SNAPSHOT**

İndekslenmiş sayfa hem satılık hem kiralık devre mülk ilanlarını tarif ediyor ve ayrı kiralık sonuçları gösteriyor. İşlem türleri:

- Satılık
- Kiralık

### 4.7 Turistik Tesis

**SNAPSHOT**

İşlem türleri:

- Satılık
- Kiralık

Görülen alt tipler:

- Otel
- Apart Otel
- Butik Otel
- Motel
- Pansiyon
- Kamp Yeri (Mocamp)
- Tatil Köyü
- Plaj (kiralık ağacında gözlendi)

## 5. Emlak filtre envanteri

## 5.1 Konut / Daire — Satılık ve Kiralık ortak çekirdek

**SNAPSHOT**

| Filtre | Tip / görülen seçenekler |
|---|---|
| Adres | İl → İlçe → Semt / Mahalle → Türkiye |
| Fiyat | min/max; TL, USD, EUR, GBP |
| m² (Brüt) | min/max |
| m² (Net) | min/max |
| Oda Sayısı | Stüdyo (1+0), 1+1, 1.5+1, 2+0, 2+1, 2.5+1, 2+2, 3+0, 3+1, 3.5+1, 3+2, 3+3, 4+0, 4+1, 4.5+1, 4.5+2, 4+2, 4+3, 4+4, 5+1, 5.5+1, 5+2, 5+3, 5+4, 6+1, 6+2, 6.5+1, 6+3, 6+4, 7+1, 7+2, 7+3, 8+1, 8+2, 8+3, 8+4, 9+1, 9+2, 9+3, 9+4, 9+5, 9+6, 10+1, 10+2, 10 Üzeri |
| Bina Yaşı | 0 (Oturuma Hazır), 0 (Yapım Aşamasında), 1, 2, 3, 4, 5, 6-10, 11-15, 16-20, 21-25, 26-30, 31 ve üzeri |
| Bulunduğu Kat | Giriş Altı Kot 4/3/2/1, Bodrum, Zemin, Bahçe, Giriş, Yüksek Giriş, Müstakil, Villa Tipi, Çatı Katı, numaralı katlar ve 30+ |
| Kat Sayısı | 1…29, 30 ve üzeri |
| Isıtma | Yok, Soba, Doğalgaz Sobası, Kat Kaloriferi, Merkezi, Merkezi (Pay Ölçer), Kombi (Doğalgaz), Kombi (Elektrik), Yerden Isıtma, Klima, Fancoil Ünitesi, Güneş Enerjisi, Elektrikli Radyatör, Jeotermal, Şömine, VRV, Isı Pompası |
| Banyo Sayısı | Yok, 1, 2, 3, 4, 5, 6, 6 Üzeri |
| Mutfak | Açık (Amerikan), Kapalı |
| Balkon | Var, Yok |
| Asansör | Var, Yok |
| Otopark | Açık Otopark, Kapalı Otopark, Açık & Kapalı Otopark, Yok |
| Eşyalı | Evet, Hayır |
| Kullanım Durumu | Boş, Kiracılı, Mülk Sahibi |
| Site İçerisinde | Evet, Hayır |
| Tapu Durumu | Kat Mülkiyetli, Kat İrtifaklı, Hisseli Tapu, Müstakil Tapulu, Arsa Tapulu, Kooperatif Hisseli Tapu, İntifa Hakkı Tesisli, Yurt Dışı Tapulu, Tapu Kaydı Yok |
| Kimden | Sahibinden, Emlak Ofisinden, İnşaat Firmasından, Bankadan, Turizm İşletmesinden |
| İlan Tarihi | Son 24 saat, 3 gün, 7 gün, 15 gün, 30 gün |
| Fotoğraf / Video | Videolu, Klipli, Sanal Tur, 360 Derece Fotoğraflı |
| Harita | Haritalı ilanlar |
| Kelime | açıklamaları dahil et seçeneğiyle metin filtresi |

Satılık konut snapshot'larında ayrıca `Krediye Uygun` ve `Takaslı` filtreleri görülmektedir. Kiralık daire snapshot'ında bu iki alan çekirdek panelde görülmedi; uygulamada işlem türüne bağlı filtre olarak modellenmelidir.

> **Bizzat farkı — `Kimden`:** `Emlak Ofisinden` Bizzat'ın ürün vaadiyle uyumsuzdur ve aynen taşınmamalıdır. Diğer kurumsal kaynak tiplerinin Bizzat kapsamındaki durumu ayrıca ürün kararı gerektirir. "Filtreler birebir" kararı, platformda bulunması yasaklanan aktörleri yapay olarak filtre seçeneğine eklemek anlamına gelmemelidir.

### Liste sütunları — Daire

**SNAPSHOT**

- İlan Başlığı
- m² (Brüt)
- Oda Sayısı
- Fiyat
- İlan Tarihi
- Semt / Mahalle veya Mahalle

Görülen sıralama seçenekleri:

- Gelişmiş sıralama
- Fiyat: yüksek → düşük
- Fiyat: düşük → yüksek
- Tarih: yeni → eski
- Tarih: eski → yeni
- Adres: A → Z
- Adres: Z → A

## 5.2 Arsa

**SNAPSHOT**

| Filtre | Tip / görülen seçenekler |
|---|---|
| Adres | İl → İlçe → Semt / Mahalle → Türkiye |
| Fiyat | min/max; TL, USD, EUR, GBP |
| İmar Durumu | Ada, A-Lejantlı, Arazi, Bağ & Bahçe, Depo & Antrepo, Eğitim, Enerji Depolama, Konut, Kültürel Tesis, Muhtelif, Özel Kullanım, Sağlık, Sanayi, Sera, Sit Alanı, Spor Alanı, Tarla, Tarla + Bağ, Ticari, Ticari + Konut, Toplu Konut, Turizm, Turizm + Konut, Turizm + Ticari, Villa, Zeytinlik |
| m² | min/max |
| m² Fiyatı | min/max; para birimi |
| Ada No | min/max |
| Parsel No | min/max |
| KAKS (Emsal) | çoklu sabit değerler + Belirtilmemiş |
| Gabari | 3.50, 6.50, 7.50, 8.50, 9.50, 10.50, 11.50, 12.50, 14.50, 15.50, 17.50, 18.50, 21.50, 24.50, 27.50, 30.50, 36.00, Serbest, Belirtilmemiş |
| Krediye Uygunluk | Evet, Hayır, Bilinmiyor |
| Tapu Durumu | Hisseli Tapu, Müstakil Tapulu, Tahsis Tapu, Zilliyet Tapu, Kooperatif Hisseli Tapu, Yurt Dışı Tapulu, Tapu Kaydı Yok |
| Kimden | Sahibinden, Emlak Ofisinden, İnşaat Firmasından, Bankadan |
| Takas | Evet, Hayır |
| İlan Tarihi | 24 saat / 3 / 7 / 15 / 30 gün |
| Medya | Videolu, Sanal Tur, 360 Fotoğraflı |
| Harita | Haritalı |
| Kelime | açıklamaları dahil edebilir |

Arsa liste sütunları:

- İlan Başlığı
- m²
- Fiyat
- m² Fiyatı
- İlan Tarihi
- İl / İlçe

## 5.3 Bina

**SNAPSHOT**

Bina kategorisinde görülen temel filtreler:

- Adres
- Fiyat
- Kat Sayısı
- Bir Kattaki Daire
- Isıtma
- m²
- Bina Yaşı

Satılık bina snapshot'ında `Kat Sayısı` 1–8 ve 9+, `Bir Kattaki Daire` 1–4 ve 5+ seçenekleri görülmektedir. Isıtma seçenekleri arasında Yok, Soba, Kalorifer, Doğalgaz (Merkezi), Doğalgaz (Kombi), Doğalgaz Sobası, Yerden Isıtma, Klima, Jeotermal ve Güneş Enerjisi vardır.

Liste sütunları:

- İlan Başlığı
- Kat Sayısı
- Bir Kattaki Daire
- Isıtma tipi
- m²
- Fiyat
- İlan Tarihi
- Semt / Mahalle

## 5.4 İş Yeri — dinamik filtre modeli

**SNAPSHOT**

İş Yeri filtreleri alt tipe göre ciddi biçimde değişmektedir. Veri modeli tek sabit tablo yerine kategoriye bağlı attribute şeması desteklemelidir.

Ortak/tekrarlanan alanlar:

- Adres
- Fiyat
- m²
- Bölüm & Oda Sayısı
- Bulunduğu Kat / Kat Sayısı
- Bina Yaşı
- Isıtma
- Kullanım Durumu
- Kiracılı
- Yapının Durumu
- Krediye Uygunluk
- Tapu Durumu
- Kimden
- Takas
- Zemin Etüdü
- İlan Tarihi
- Medya
- Harita
- Kelime

Alt tipe özel örnekler:

- **Depo & Antrepo:** Giriş Yüksekliği (m)
- **Fabrika & Üretim Tesisi:** Kapalı Alan (m²), Bina Adedi, Bölüm & Oda Sayısı, Kat Sayısı, Giriş Yüksekliği
- **Atölye:** Giriş Yüksekliği, Bölüm & Oda Sayısı
- **Plaza / ofis tipleri:** Bulunduğu Kat, fan-coil/VAV/VRV gibi iklimlendirme seçenekleri

Bu bulgu teknik tasarım için kritiktir: ilan özellikleri kategori bazlı şemadan üretilmelidir.

## 6. Vasıta kategori ağacı

**SNAPSHOT**

Sahibinden `Vasıta` altında görülen üst kategoriler:

- Otomobil
- Arazi, SUV & Pickup
- Elektrikli Araçlar
- Motosiklet
- Minivan & Panelvan
- Ticari Araçlar
- Kiralık Araçlar
- Deniz Araçları
- Hasarlı Araçlar
- Karavan
- Klasik Araçlar
- Hava Araçları
- ATV
- UTV
- Engelli Plakalı Araçlar

Bu liste Bizzat'ın otomatik MVP kapsamı değildir. `Araç` kapsamının ilk sürümde hangi sınıfları içerdiği ayrıca dondurulmalıdır.

## 7. Vasıta filtre envanteri

### 7.1 Vasıta üst seviye ortak kabuk

**SNAPSHOT**

- Adres: İl / İlçe / Türkiye
- Fiyat: TL, USD, EUR, GBP + min/max
- Takaslı
- İlan Tarihi: 24 saat / 3 / 7 / 15 / 30 gün
- Fotoğraf / Video: Videolu, Klipli
- Kelime ile filtrele + ilan açıklamalarını dahil et

### 7.2 Otomobil

**SNAPSHOT**

| Filtre | Görülen seçenek / tip |
|---|---|
| Marka → Seri → Model | kategori ağacı |
| Adres | İl → İlçe → Türkiye |
| Fiyat | min/max; TL/USD/EUR/GBP |
| Yıl | min/max |
| Yakıt Tipi | Benzinli, Benzin & LPG, Dizel, Hibrit, Elektrikli |
| Vites | Manuel, Otomatik |
| Araç Durumu | İkinci El, Yurtdışından İthal Sıfır, Sıfır |
| KM | min/max |
| Kasa Tipi | Cabrio, Coupe, Coupe 4 kapı, Hatchback 3 kapı, Hatchback 5 kapı, Sedan, Station Wagon, MPV, Roadster |
| Motor Gücü | 50 hp'ye kadar; 51–75; 76–100; ardından 25 hp bantları; 601 hp ve üzeri |
| Motor Hacmi | ≤1300; 1301–1600; 1601–1800; 1801–2000; 2001–2500; 2501–3000; 3001–3500; 3501–4000; 4001–4500; 4501–5000; 5001–5500; 5501–6000; 6001+ cm³ |
| Çekiş | Önden Çekiş, Arkadan İtiş, 4WD (Sürekli), AWD (Elektronik) |
| Renk | Bej, Beyaz, Bordo, Füme, Gri, Gümüş Gri, Kahverengi, Kırmızı, Lacivert, Mavi, Mor, Pembe, Sarı, Siyah, Şampanya, Turkuaz, Turuncu, Yeşil |
| Garanti | Evet, Hayır |
| Ağır Hasar Kayıtlı | Evet, Hayır |
| Plaka / Uyruk | Türkiye (TR) Plakalı, Mavi (MA) Plakalı |
| Kimden | Sahibinden, Galeriden, Yetkili Bayiden |
| Takaslı | Evet, Hayır |
| İlan Tarihi | 24 saat / 3 / 7 / 15 / 30 gün |
| Fotoğraf / Video | Videolu, Klipli |
| Boya, Değişen Parça | Boyasız, Değişensiz |
| Kelime | açıklamaları dahil et seçeneği |

> **Bizzat farkı — `Galeriden`:** bu seçenek Bizzat'ta bulunmamalıdır. `Yetkili Bayiden` seçeneğinin ürün kapsamındaki yeri ayrıca netleştirilmelidir.

Otomobil liste sütunları:

- Marka
- Seri
- Model
- İlan Başlığı
- Yıl
- KM
- Fiyat
- İlan Tarihi
- İl / İlçe

Görülen sıralamalar:

- Gelişmiş sıralama
- Fiyat yüksek/düşük
- İlan tarihi yeni/eski
- KM düşük/yüksek
- Yıl eski/yeni
- Adres A-Z / Z-A

### 7.3 Arazi, SUV & Pickup

**SNAPSHOT**

Otomobil şemasına çok benzerdir. Farklı/gözlenen alanlar:

- Kasa Tipi: Crossover, Pickup, SUV
- Çekiş: 4x2 (Arkadan İtişli), 4x2 (Önden Çekişli), 4x4
- Kapı: 2, 3, 4, 5
- Motor Hacmi: ≤1300, 1301–1600, 1601–1800, 1801–2000, 2001–2500, 2501–3000, 3001–3500, 3501–4000, 4001–5000, 5001–6000, 6001+
- Motor Gücü: 50 hp'ye kadar → 601 hp ve üzeri, 25 hp bantları
- Yakıt, vites, durum, KM, renk, ilan tarihi, medya ve boya/değişen filtreleri otomobil ile aynı yapıya yakın.

### 7.4 Diğer vasıta sınıfları

**AÇIK / SONRAKİ TAMAMLAMA**

Motosiklet, Minivan & Panelvan, Ticari Araçlar, Elektrikli Araçlar, Kiralık Araçlar, Deniz Araçları, Karavan, ATV/UTV ve diğer üst sınıfların kategoriye özgü bütün attribute seçenekleri bu ilk snapshot'ta tam normalize edilmedi.

Sebep kapsam eksikliği değil: Bizzat'ın ilk yayın `Araç` alt kategorileri henüz seçilmedi. MVP kapsamı dondurulduğunda seçilen sınıfların filtreleri canlı kaynaktan son kez doğrulanıp bu belgeye/makine okunur şemaya aktarılmalıdır.

## 8. İlan detay ekranı

Sahibinden yardım içeriği ve indekslenmiş liste yapısından çıkarılan **referans bloklar**:

1. breadcrumb / kategori yolu,
2. ilan başlığı,
3. fotoğraf/video galerisi,
4. fiyat,
5. konum,
6. kategoriye özgü temel ilan kriterleri,
7. açıklama,
8. ilan veren / iletişim alanı,
9. favori / paylaşım / rapor gibi yardımcı işlemler,
10. ilan sahibi için sağ tarafta `İlan İşlemleri`,
11. uygun kategoride harita / konum,
12. benzer ilanlar veya ilgili içerik.

**RESMÎ / GÜNCEL:** Sahibinden Yardım Merkezi, ilan sahibinin ilan detayındaki `İlan İşlemleri` menüsünden ilanı düzenleyip yayından kaldırabildiğini; görünen ad, kayıtlı telefonlar ve mesaj kabul durumunu düzenleyebildiğini doğruluyor.

Bizzat için ilk detay ekranında gerekli minimum:

- başlık,
- medya,
- fiyat,
- konum,
- yapılandırılmış özellikler,
- açıklama,
- ilan veren bilgisi,
- kararlaştırılacak iletişim CTA'sı,
- ilanı raporla.

Favori, paylaşım ve benzer ilanlar MVP kapsam kararına bağlı olabilir.

## 9. İlan verme akışı

### 9.1 Sahibinden genel akışı

**RESMÎ / GÜNCEL — Yardım Merkezi**

Sahibinden genel akışı:

1. giriş yap,
2. `İlan Ver`,
3. üst kategori seç,
4. alt kategori seç,
5. başlık ve açıklama,
6. fiyat ve kategoriye özgü ürün/ilan detayları,
7. fotoğraf/video,
8. Sahibinden'e özgü teknik hizmet / doping seçenekleri,
9. ödeme tercihi,
10. kontrol / moderasyon ve yayın.

Bizzat bu akışın **kategori → detaylar → medya → önizleme/yayın** mantığını referans almalı; doping, Sahibinden ücret paketi ve Sahibinden'e özgü hizmetleri kopyalamamalıdır.

### 9.2 Bizzat için EİDS'nin yerleşeceği nokta

Önerilen mantıksal sıra:

1. kategori ve işlem türü seçimi,
2. EİDS için gerekli temel kimlik/varlık bilgisi,
   - emlak: taşınmaz numarası,
   - taşıt: plaka ve ilgili araç bilgileri,
3. Bakanlık/EİDS yetki sonucu,
4. yalnızca yetki olumluysa kategoriye özgü ilan detayları,
5. fiyat,
6. fotoğraflar,
7. açıklama,
8. iletişim tercihi,
9. önizleme,
10. gönder / moderasyon / yayın.

Bu sıra teknik tasarım kararı olarak kesinleşmiş değildir; ancak yetkisiz kullanıcının uzun ilan formunu doldurduktan sonra reddedilmesini önlemek için doğrulamanın erken yapılması tercih edilmelidir.

## 10. Birebir alınacaklar ve uyarlanacaklar

### Birebir referanslanacak

- kategoriye göre dinamik filtre mantığı,
- kategori ağacının hiyerarşik yapısı,
- filtrelerin URL/query state ile listelere uygulanması,
- liste sayfası bilgi yoğunluğu,
- kategoriye göre değişen tablo sütunları,
- detay sayfasında yapılandırılmış özellikler,
- ilan verme sırasında kategoriye göre dinamik alanlar,
- ana sayfa → liste → detay → ilan oluşturma temel zihinsel modeli.

### Bizzat'a uyarlanacak / kopyalanmayacak

- Sahibinden sarı renk sistemi ve marka öğeleri,
- Sahibinden metinleri/logo/görsel varlıkları,
- `Emlak Ofisinden` ve `Galeriden` gibi Bizzat'ın vaadiyle çelişen kaynak seçenekleri,
- doping/öne çıkarma ürünleri (gelir modeli kararlaştırılana kadar),
- Sahibinden'e özgü ekspertiz ve mağaza ürünleri,
- profesyonel emlakçı/galerici profil ve mağaza akışları,
- Bizzat MVP'sinde henüz kararlaştırılmamış mesaj/favori gibi yan ürünler.

## 11. Teknik tasarım için çıkarımlar

Bu envanter henüz stack seçimi değildir, fakat veri modeline açık gereksinimler verir:

- `category` ağacı çok seviyeli olmalı.
- `transaction_type` kategoriye göre değişebilmeli (`sale`, `rent`, `daily_rent`, `transfer_sale`, `transfer_rent`, `land_share` vb.).
- Filtre/ilan alanları **kategoriye bağlı dinamik attribute şeması** olmalı.
- Aynı attribute farklı kategoride farklı seçenek kümesine sahip olabilmeli.
- Sayısal alanlar range sorgusunu desteklemeli.
- Enum alanları çoklu seçim desteklemeli.
- Konum `il → ilçe → semt/mahalle` hiyerarşisini desteklemeli.
- Araç `marka → seri → model` ağacı ayrı referans verisi olarak düşünülmeli.
- EİDS doğrulama sonucu ve doğrulamanın hangi varlık/kimlik üzerinde yapıldığı güvenli biçimde modellenmeli; TC/plaka gibi hassas veriler dokümana veya loglara gelişigüzel yazılmamalı.
- Arama listeleri kategoriye göre farklı kolon projeksiyonları kullanabilmeli.

Bu nedenle tüm özellikleri tek bir `listings` tablosunda yüzlerce nullable kolon olarak modellemek yerine, sorgulanabilir kategori attribute altyapısı tasarlanması beklenir. Kesin DB kararı teknik tasarım aşamasında verilecektir.

## 12. Kalan doğrulama işleri

İlk referans envanteri uygulamaya başlamak için yeterli iskeleti çıkarıyor; ancak aşağıdakiler MVP kapsamı belli olduğunda tamamlanmalıdır:

- seçilecek tüm `Araç` alt kategorilerinin tam filtre seçenekleri,
- İş Yeri devren ağacının tam makine-okunur listesi,
- Konutun Daire dışındaki her alt tipi için fark filtreleri,
- Turistik Tesis / Devre Mülk ayrıntılı filtreleri,
- canlı Sahibinden'e tarayıcıyla erişilebildiğinde 2026-09 snapshot ile son karşılaştırma,
- filtre isimleri/seçenekleri için makine-okunur JSON/YAML şema,
- ilan detayının piksel/komponent seviyesi ekran envanteri.

## 13. Kaynaklar

### Ticaret Bakanlığı / EİDS

- https://eids.ticaret.gov.tr/
- https://ticaret.gov.tr/haberler/ticaret-bakanligi-tasinmaz-ve-tasit-ticaretinde-uygulanmakta-olan-elektronik-ilan-dogrulama-sistemi-eids-kapsaminda-kimlik-ve-yetki-dogrulamasi-zorunlulugunu-instagram-facebook-ve-whatsapp-da-dahil-olmak-uzere-elektronik-ortamda-verilen-tum-tasinmaz-ve-tasi
- https://ticaret.gov.tr/haberler/ticaret-bakanligindan-yeni-ve-zorunlu-uygulama-tum-tasit-ilanlarinda-eids-yetki-dogrulama-uygulamasi-basladi
- https://ticaret.gov.tr/kurumsal-haberler/elektronik-ilan-dogrulama-sistemi-eids-yetki-dogrulama-uygulamasi-hayata-gecirildi
- https://afyon.ticaret.gov.tr/haberler/elektronik-ilan-dogrulama-sistemi-eids-nedir-nasil-kullanilir

### Sahibinden Yardım Merkezi

- https://yardim.sahibinden.com/hc/tr/articles/115004690274-Nas%C4%B1l-%C4%B0lan-Verebilirim
- https://yardim.sahibinden.com/hc/tr/articles/20827132453404-Kendime-ait-gayrimenkul-i%C3%A7in-ilan-vermek-istiyorum
- https://yardim.sahibinden.com/hc/tr/articles/20830849867292-Ba%C5%9Fkas%C4%B1na-ait-gayrimenkul-i%C3%A7in-ilan-vermek-istiyorum
- https://yardim.sahibinden.com/hc/tr/articles/20827031631900-Vas%C4%B1ta-ilan%C4%B1-vermek-istiyorum
- https://yardim.sahibinden.com/hc/tr/articles/24432491805340-%C4%B0lan-Yay%C4%B1nlama-ile-%C4%B0lgili-S%C4%B1k%C3%A7a-Sorulan-Sorular
- https://yardim.sahibinden.com/hc/tr/articles/115004690294-%C4%B0lan%C4%B1m%C4%B1n-%C4%B0%C3%A7eri%C4%9Fini-Nas%C4%B1l-D%C3%BCzenleyebilirim
- https://yardim.sahibinden.com/hc/tr/articles/115004672573-%C4%B0lan%C4%B1mdaki-%C4%B0leti%C5%9Fim-Bilgilerimi-Nas%C4%B1l-De%C4%9Fi%C5%9Ftirebilirim

### Sahibinden kategori/listeme snapshot örnekleri

- https://www.sahibinden.com/kiralik-daire
- https://www.sahibinden.com/satilik-daire
- https://www.sahibinden.com/satilik-arsa
- https://www.sahibinden.com/satilik-bina
- https://www.sahibinden.com/otomobil
- https://www.sahibinden.com/arazi-suv-pickup
- https://www.sahibinden.com/kategori/devre-mulk
- https://www.sahibinden.com/satilik-otel

## 14. Sonuç

Artık "Sahibinden'i referans al" kararı soyut bir not olmaktan çıktı. Uygulamanın ilk teknik tasarımında kullanılabilecek:

- ekran iskeleti,
- kategori ağacı,
- yüksek öncelikli emlak/otomobil filtreleri,
- sonuç sütunları ve sıralamalar,
- ilan verme akışı,
- kategoriye bağlı dinamik attribute gereksinimi,
- EİDS zorunluluğu

repo içinde kayıt altındadır.

Sonraki ürün adımı, **ilk MVP'de açılacak emlak ve araç alt kategorilerini dondurmak**; sonraki teknik adım ise stack ve veri modelini seçmektir.
