# Araç kataloğu kapsam takibi — 2026-09-10

Bu çalışma mevcut kısmi kataloğu genişletir. Kaynak satırı sayısı, benzersiz araç veya eksik model sayısı değildir. TSB Ağustos 2026 normalize snapshot'ı repo dışında tutulur; dönem ve checksum `data/reference/vehicles/source-manifest.json` içindedir.

## Yeni doğrulanabilen Renault Megane yolları

2026-09-10 takibinde Sahibinden'in kamuya açık birinci taraf indeks sonuçlarında aşağıdaki dört seçim yolu doğrulandı. Bunlar Megane serisinin tamamı değildir; yalnız kanıtlanan motor/paket çiftleri kabul edilir.

| Seçim yolu | TSB kaynak kodları | Birincil referans |
| --- | --- | --- |
| Renault → Megane → 1.5 dCi → Icon | `122-1160`, `122-1161` | [Megane 1.5 dCi Icon](https://www.sahibinden.com/renault-megane-1.5-dci-icon) |
| Renault → Megane → 1.5 dCi → Joy | `122-1107`, `122-1108` | [Megane 1.5 dCi](https://www.sahibinden.com/renault-megane-1.5-dci) |
| Renault → Megane → 1.5 dCi → GT-Line | `122-1088`, `122-1089` | [Megane 1.5 dCi](https://www.sahibinden.com/renault-megane-1.5-dci) |
| Renault → Megane → 1.6 → Joy | `122-1105`, `122-1106` | [Megane 1.6](https://www.sahibinden.com/renault-megane-1.6) |

Sekiz kaynak kodu yalnız kendi incelenmiş tam kaynak etiketleriyle bu dört yaprağa bağlanır. EDC/CVT, güç ve HB/Sedan gibi TSB ayrıntıları bu increment'te kullanıcıya yeni seçim düğümü üretmez. Yakın ama birebir incelenmemiş yazımlar, farklı güç/teknik ekler veya bilinmeyen paketler `model-review` durumunda kalır; Megane genel `reviewedTechnicalPolicySeries` listesine eklenmez.

Bu oturumda önceki 27.906 satırlık operasyonel normalize snapshot dosyasına yeniden erişilemedi. Bu nedenle mevcut reviewed baseline'ın checksum'u değiştirilmedi ve Megane artışı tam snapshot'ın yeniden üretildiği iddiasıyla değil, sekiz kaynak kodu + dört Sahibinden yolu için açıkça incelenmiş deterministic delta olarak yayımlandı. Tam snapshot erişilebilir olduğunda aynı baseline ile yeniden üretim hâlâ yapılmalıdır.

## Yeni doğrulanabilen Seat yolları

Aşağıdaki üç **tam kategori URL'si ve bunlarla eşleşen kategori başlıkları** kamuya açık arama indeksinden elde edildi. Sayfalar doğrudan açıldığında 403 döndü; canlı sayfa ağacının veya eksiksiz katalog export'unun okunduğu iddia edilmez. TSB kaynak kodları mevcut snapshot ile karşılaştırıldı.

| Seçim yolu | TSB kaynak kodları | İndekslenen birincil referans |
| --- | --- | --- |
| Seat → Ibiza → 1.4 → Reference | `19-1035`, `19-245` | [Ibiza 1.4 Reference](https://www.sahibinden.com/seat-ibiza-1.4-reference) |
| Seat → Ibiza → 1.0 → Style | `19-1097`, `19-1124`, `19-1140` | [Ibiza 1.0 Style](https://www.sahibinden.com/seat-ibiza-1.0-style) |
| Seat → Ibiza → 1.0 EcoTSI → FR | `19-1103`, `19-1153` | [Ibiza 1.0 EcoTSI FR](https://www.sahibinden.com/seat-ibiza-1.0-ecotsi-fr) |

İndeks başlıkları sırasıyla “Seat Ibiza 1.4 Reference”, “Seat Ibiza 1.0 Style” ve “Seat Ibiza 1.0 EcoTSI FR” ifadelerini içeriyordu. Bu kanıt üç motor/paket çiftini destekler; motorlarla paketlerin tüm olası kombinasyonlarını desteklemez.

Kaynak tarafındaki `REFERANCE` yazımı bu kapsamda `Reference` ile eşleştirilir. `1.0 EVO 80` satırlarının `1.0 → Style` yoluna bağlanması, kaynak etiketi ile indekslenen seçim yolunun birlikte değerlendirilmesine dayanır; canlı sayfadan alınmış ayrı bir EVO varyant doğrulaması değildir. EcoTSI ayrı motor grubu olarak korunur. FL, DSG ve S&S ayrıntıları bu incelenmiş yollarda kullanıcıya ek dal üretmez. Ibiza için yalnız yedi incelenmiş normalize etiket kabul edilir; genel teknik ayıklama politikası veya başka serilere yayılan yeni motor sözlüğü açılmaz.

SC, ST, Sport Tourer, Sedan, HB ve doğrulanmamış motor/paket çiftleri bu eklemenin dışındadır. Güç değerinden paket veya motor teknolojisi türetilmez.

## Mevcut referanslarla düzeltilebilen boşluklar

- Accent Blue ve Accent Era, [önceki seçim ağacı incelemesinde](../superpowers/specs/2026-09-09-vehicle-picker-parity.md) doğrulanan ayrı nameplate kimliklerine alınır. Yalnız açık motor + bilinen paket kaydı kabul edilir; teknik detay ayıklama kapsamı genişletilmez. Genel Accent serisinin veya eski model anahtarlarının ebeveyni değiştirilmez.
- Motor teknolojisi yazmayan satırlarda parser'ın motor hacminden sonraki boşluğu tüketmesi düzeltilir. Clio ve Polo'nun mevcut incelenmiş seri politikalarıyla işlenebilen kayıtları böylece eşleşebilir. Bunlar bu oturumda her yaprağı ayrıca indekslenmiş yeni referanslar olarak sunulmaz.
- Kaynakta motor teknolojisi yazmayan Clio `1.2 120` satırları, `1.2 75` ile birleştirilmez veya otomatik TCe yapılmaz; incelemede kalır.

## Doğrulanamadığı için bekleyen kapsam

| Kapsam | Elde edilen kanıtın sınırı |
| --- | --- |
| Megane'ın bu dört yaprak dışındaki motor/paket/gövde yolları | Bu increment yalnız sekiz exact kaynak kodunu kapsar; yakın teknik varyantlar veya başka Megane dalları otomatik kabul edilmedi. |
| Ibiza 1.4 TDI Style ve Sport Tourer | Eşleşen başlık özetleri vardı; sonuç URL'si ana sayfaya düşüyordu veya yalnız motor seviyesindeydi. Tam yaprak/gövde yolu doğrulanmadı. |
| Seat Leon ve SC/ST dalları | Bazı başlıklar ve motor düzeyi izleri vardı; doğrudan motor/paket kategori URL'si elde edilmedi. |
| Ford Focus / Opel Astra | Backlog'daki büyük eksik gruplar; yeni exact yaprak kanıtı ve kaynak eşlemesi ayrıca incelenmeli. |
| Skoda Fabia / Octavia / Superb / Combi | Doğrudan birincil kategori yolları bulunamadı; üçüncü taraf sonuçları taxonomy kanıtı sayılmadı. |
| Kia Ceed / Rio / Picanto / SW / Pro | Bazı başlık özetleri dışında tam birincil kategori yolları doğrulanamadı. |
| BYD Dolphin, Opel Corsa, Peugeot 208 yeni yolları | Boş/ilgisiz sonuçlar, 403 veya ana sayfaya düşen URL'ler yeni yol kabulü için yeterli olmadı. |

Arama sonucunun olmaması, aracın veya kategorinin olmadığı anlamına gelmez. Bu dalları tamamlamak için okunabilen kategori referansı veya izinli taxonomy export'u gerekir. Genel `Standart` paket veya tahmini gövde yolu üretilmez.

## Sonraki veri incelemesi

`data/reference/vehicles/curation-backlog.json`, seri bazında inceleme bekleyen satır sayılarını ve mevcut seçilebilir kayıt sayılarını toplar. Marka/seri çözülemeyen kaynaklar ayrıca sayılır. Liste ham kaynak adı, fiyat veya model yılı taşımaz. 2026-09-10 Megane increment'inden sonra katalog 19 marka / 54 seri / 593 seçilebilir kayıt / 831 source mapping içerir; 6.048 source satırı model incelemesi bekler. Bu rakamlar Türkiye otomobil kapsam yüzdesi veya eksik benzersiz model sayısı değildir.
