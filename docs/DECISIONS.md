# Karar kaydı

Bu kayıt, Bizzat için kesinleşen ürün kararlarını özetler. Henüz sonuçlanmamış fikirler [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) dosyasındadır. İlk implementasyon kapsamı [MVP_SCOPE.md](MVP_SCOPE.md) dosyasında ayrıntılıdır.

| No | Konu | Karar | Gerekçe |
|---|---|---|---|
| 01 | Marka adı | Bizzat | Kullanıcının seçtiği isim; günlük dilde doğal bir anlam taşıyor. |
| 02 | İlan kategorileri | Emlak ve araç | Genel ikinci el eşya pazarı yerine bu iki kategoriye odaklanılıyor. |
| 03 | Uzun vadeli işlem türleri | Her iki ana kategoride satış ve kiralama | Platform vizyonunda satış ve kiralama korunuyor; ilk MVP bunun tamamını tek seferde uygulamayacak. |
| 04 | Katılımın esası | Bireysel ilanlar; emlakçı ve galerici ilanlarını dışarıda tutma hedefi | Platformun esas farklılığı bu ayrım. |
| 05 | Başkası adına ilan | Marka yaklaşımında kabul edilebilir; uygulama EİDS'nin malik/eş/1.-2. derece hısım sınırına uyar | Ürün niyeti ticari aracılığı değil bireysel yardımı dışlamamak; elektronik ilan yayın yetkisi ise güncel EİDS kurallarıyla sınırlı. |
| 06 | Başlangıç yaklaşımı | Makul kontroller ve istisnalara tolerans | İlk aşamada bütün fraud/ticari kullanım istisnalarının kusursuz biçimde çözülmesi istenmiyor. |
| 07 | İlan yapısı | Ayrıntılı filtreler, tanımlı araç marka ve modelleri, düzenli bilgiler | Kullanıcı Sahibinden benzeri yapılandırılmış bir ilan deneyimi tarif etti. |
| 08 | Hitap | Sen | Kullanıcı bunu daha doğal buluyor. |
| 09 | Marka görünümü | Sade, az detaylı ve profesyonel | Gösterişli veya yapay görünen bir kimlik istenmiyor. |
| 10 | Renk yönü | Açık mavi, beyaz ve açık tonlar; koyu gri metin | Kullanıcı açık renkleri tercih etti ve hazırlanan görsel yönü beğendi. |
| 11 | Logo yönü | Küçük harfli, açık mavi `bizzat` yazı logosu | Hazırlanan görseldeki biçim ve ağırlık onaylandı. |
| 12 | Ana slogan | Bireysel ilanların adresi. | Her ilanın ilan veren kişinin kendi malı olduğu şeklinde mutlak bir vaat verilmemesi. |
| 13 | İletişim metni | İlan verenle görüş. | Doğrudan mal sahibiyle görüşüldüğüne ilişkin mutlak bir izlenim verilmemesi. |
| 14 | Teknik çalışma | Marka/referans kapsamından sonra | Önce ürün ve marka bağlamı netleştirildi; teknik aşamaya MVP scope sonrası geçiliyor. |
| 15 | Filtrelerin kapsamı | Sahibinden'in ilgili emlak ve araç kategorilerindeki filtreleri referans al | Filtreler yeniden ürün keşfiyle icat edilmeyecek; Bizzat'ın yasakladığı profesyonel satıcı seçenekleri aynen taşınmayacak. |
| 16 | Temel ekranlar | Ana sayfa, ilan listesi ve ilan detayında Sahibinden esas alınacak | Kullanıcı başlangıçta bu ekranlarda mevcut referansı kullanmak istiyor. |
| 17 | İlan verme | Sahibinden'e benzer adımlar | Yeni bir ilan verme akışı tasarlamak için ayrı keşif yapılması istenmiyor. |
| 18 | İlk MVP emlak kapsamı | Konut → Daire → Satılık ve Kiralık | Emlakın iki temel işlem türünü aynı attribute altyapısında doğrulamak için yeterli ve kontrollü ilk kapsam. |
| 19 | İlk MVP araç kapsamı | Otomobil → Satılık | Marka/seri/model ve yoğun araç filtrelerini doğrularken kiralama ve diğer vasıta sınıflarını ilk milestone'dan çıkarır. |
| 20 | İlk platform yüzeyi | Responsive web | İlk ürünün hızlı ve tek istemciyle uçtan uca doğrulanması; native mobil uygulama sonraya bırakılır. |
| 21 | MVP iletişim kanalı | Telefon odaklı; site içi mesajlaşma yok | İlan verenle doğrudan iletişim ihtiyacını en küçük ürün yüzeyiyle karşılar. Telefon görünürlüğü kullanıcı tercihi/izniyle yönetilir. |
| 22 | EİDS yayın kapısı | Production'da gerekli yetki doğrulaması olmadan ilan yayınlanmaz | EİDS bir yan özellik değil, elektronik taşınmaz/taşıt ilanı için ürünün production önkoşuludur. Local/test ortamında açıkça işaretli mock kullanılabilir. |
| 23 | MVP dışı özellikler | Favori, site içi mesaj, ödeme/abonelik, doping, ekspertiz, rezervasyon, native mobil ve profesyonel mağazalar sonraya bırakıldı | İlk milestone ana ilan döngüsünü ayağa kaldırmaya odaklanır; kapsam şişmesi engellenir. |
| 24 | Minimum moderasyon | İlan raporlama + moderatörün inceleyip yayından kaldırabilmesi | Bireysel ilan vaadi için ilk günden temel operasyon yolu gerekir; karmaşık ML/fraud sistemi ilk MVP şartı değildir. |

## Önceki önerilerin durumu

- “Siz” hitabı, kullanıcının tercihiyle “sen” olarak değiştirildi.
- Koyu yeşil renk yönü ilk öneriydi; açık mavi görsel yön kabul edildi.
- “Sahibiyle, bizzat.” ilk slogan önerisiydi; güncel ana slogan değildir.
- Her ilanı yalnızca malın kayıtlı sahibinin verebilmesi marka kuralı değildir; ancak EİDS'nin izin verdiği bireysel kişi kümesi dışına çıkılamaz.
- `bizzat.tr` düşünülen adrestir; kayıt, sahiplik veya tescil kontrolü tamamlandı şeklinde bir karar yoktur.
- Filtrelerin ve temel ekran akışlarının baştan tasarlanması önerisi, kullanıcının Sahibinden'i esas alma kararıyla değiştirildi. Bizzat'ın onaylanan görsel kimliği geçerliliğini korur.
- Araç kiralama uzun vadeli platform kapsamından çıkarılmadı; yalnızca ilk MVP milestone'undan ertelendi.

## Kararların güncellenmesi

Sonraki açık kullanıcı kararları bu belgelerden önceliklidir. Yeni kararlar alındığında ilgili belge ile bu kayıt birlikte güncellenir. Bir öneri, kullanıcı kararı olmadan geçmişte kabul edilmiş gibi yazılmaz.
