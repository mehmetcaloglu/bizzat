# Bizzat

**Bireysel ilanların adresi.**

Bizzat, emlakçı ve galerici ilanlarını dışarıda tutmayı amaçlayan; bireysel satılık ve kiralık emlak ve araç ilanlarına odaklanan bir platform projesidir.

Bu depo ürün kapsamını, marka kimliğini, Sahibinden referans envanterini, ilk MVP sınırlarını ve açık teknik konuları bir araya getirir. Uygulama kodu ve seçilmiş teknik altyapı henüz yoktur.

![Bizzat marka panosu: açık mavi yazı logosu, Bireysel ilanların adresi sloganı, renkler ve iletişim örnekleri](assets/brand/bizzat-brand-board.png)

## Temel bilgiler

| Konu | Karar |
|---|---|
| Marka | Bizzat; yazı logosunda `bizzat` |
| Slogan | Bireysel ilanların adresi. |
| Uzun vadeli kategoriler | Emlak ve araç |
| Uzun vadeli işlemler | Her iki ana kategoride satış ve kiralama |
| Hedef | Bireysel ilanlar; emlakçı ve galerici ilanlarına kapalı bir platform |
| İlk MVP kategorileri | Satılık Daire, Kiralık Daire, Satılık Otomobil |
| İlk istemci | Responsive web |
| MVP iletişim | Telefon odaklı; site içi mesajlaşma yok |
| Filtreler | Sahibinden'in ilgili kategori filtreleri referans alınacak; profesyonel satıcı seçenekleri Bizzat kapsamına göre çıkarılacak |
| Ekran ve akış referansı | Ana sayfa, ilan listesi ve ilan detayında Sahibinden esas alınacak; ilan verme adımları benzer olacak |
| EİDS | Production ilan yayını için yetki doğrulaması zorunlu kapı |
| Hitap | Sen |
| Görsel yön | Açık mavi, beyaz ve açık tonlar; sade ve profesyonel |
| Düşünülen adres | `bizzat.tr`; satın alma ve uygunluk durumu doğrulanmadı |
| Mevcut aşama | MVP scope tamamlandı; teknik mimari sırada |

İlan veren kişinin her durumda malın kayıtlı sahibi olması markanın genel şartı değildir. Ancak güncel EİDS kuralları nedeniyle taşınmaz ve taşıt ilanlarında elektronik yayın yetkisi malik, eş ve izin verilen birinci/ikinci derece kan hısımlarıyla sınırlı bireysel bir yapıya sahiptir. Bizzat'ın “başkası adına yardımcı olma” yaklaşımı bu yasal/entegrasyon sınırı içinde uygulanmalıdır.

Filtreler ve temel ilan akışları için yeniden ürün keşfi yapılmıyor. Sahibinden referansı Bizzat'ın onaylanan görsel kimliği ve marka diliyle uygulanacak.

## İlk MVP

İlk çalışan sürüm platformun tamamını bir seferde kurmayacak. Uçtan uca ilan döngüsünü şu üç ilan türüyle doğrulayacak:

- Emlak → Konut → Daire → Satılık
- Emlak → Konut → Daire → Kiralık
- Araç → Otomobil → Satılık

İlk MVP'de ana sayfa, liste/filtreleme, ilan detayı, auth, ilan oluşturma, EİDS/yetki kapısı, kendi ilanlarını yönetme, telefonla iletişim, ilan raporlama ve minimum moderasyon bulunur.

Favori, site içi mesajlaşma, ödeme/abonelik, doping, ekspertiz, rezervasyon, native mobil uygulama ve profesyonel mağazalar ilk MVP'nin dışındadır.

Ayrıntı: [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md).

## Belgeler

| Dosya | İçerik |
|---|---|
| [PROJECT.md](PROJECT.md) | Amaç, hedef kullanıcılar ve uzun vadeli ürün kapsamı |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | İlk implementasyon milestone'u: dahil olan/olmayan kategoriler, akışlar ve kabul kriterleri |
| [DESIGN.md](DESIGN.md) | Onaylanan görsel yön, renkler ve tasarım referansı |
| [docs/reference/SAHIBINDEN_REFERENCE.md](docs/reference/SAHIBINDEN_REFERENCE.md) | Sahibinden ekran/kategori/filtre/ilan verme referansı ve EİDS notları |
| [docs/brand/VOICE.md](docs/brand/VOICE.md) | Marka dili, slogan ve kullanılacak metinler |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Kesinleşmiş kararlar |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | EİDS entegrasyonu, veri kaynakları, teknik stack ve diğer açık konular |
| [assets/brand/README.md](assets/brand/README.md) | Görselin durumu ve kullanım notları |
| [docs/design/HOMEPAGE.md](docs/design/HOMEPAGE.md) | İlk ana sayfa görsel taslağı ve kapsamı |
| [AGENTS.md](AGENTS.md) | Projeyi devralan geliştirme araçları için bağlam |

## Mevcut aşamanın sınırı

MVP ürün kapsamı donduruldu. Frontend/backend yaklaşımı, veritabanı, auth, storage, arama, deploy ve gerçek EİDS entegrasyon yöntemi henüz seçilmedi.

Sıradaki çalışma teknik stack + sistem/veri mimarisidir. Bu aşamada seçilen üç ilan türünün attribute şeması makine-okunur hale getirilecek ve ardından gerçek uygulama iskeleti oluşturulacaktır.

Bu belgeler 6-7 Eylül 2026 tarihli proje çalışmalarını temel alır.
