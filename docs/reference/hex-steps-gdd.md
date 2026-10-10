> **Reference copy.** Uğur's game design document for hex-steps, received 2026-10-10, kept verbatim
> below. Per Uğur: the rules table (1-20) is current; the status line at the top and the 12-level
> table near the end are outdated and should be ignored. New rule since 2026-10-03: maps contain no
> empty cells; former holes became blockers, and because holes and blockers behave the same, no rule
> changes. File references such as `docs/level-format.md` point to the editor's repository. Our
> implementation spec is `docs/rules.md`; history and decisions are in `docs/levels.md`.

# Hex Steps: Game Design

> Durum (2026-09-28): kurallar kesin. Hedef 10 chapter × 6 level = 60 level. Şu an Chapter 1–2
> (12 level) `levels/pack.json`'da, sadece `c01-l01` onaylı. Oyun kodu henüz yok.
> Bu dosya developer için spec. Belirsiz bir yer bulursan kendin karar verme, tasarımcıya sor.

## Özet
Hex grid üzerinde bir karakter var. Oyuncu onu, **adım bütçesi bitmeden**, başlangıç
tile'ından bitiş tile'ına götürmeye çalışır. Her hamle komşu bir tile'a 1 adım harcar. Haritada
adım kazandıran **+1** tile'ları ve karakteri bedava fırlatan **fırlatıcı** tile'lar var.

Oyunun zevki bütçenin sıkı olmasından gelir. Her level'da bütçe, gereken en düşük değere
eşittir. Harita ise bitişin hemen yanında adımın bittiği "neredeyse oluyordu" yollarla doludur.
Oyuncunun işi asıl yolu bulmaktır.

## Kurallar (tek kaynak)

| # | Konu | Kural |
|---|---|---|
| 1 | Grid | Pointy-top hex grid. Koordinatlar axial `(q, r)`. Ayrıntı: `docs/level-format.md` |
| 2 | Tile'lar | `floor` (zemin), `start` (1 adet), `finish` (1 adet), `plus1`, `launcher` (yön), `blocker`, `swamp`, `mover` (yön), `portal` (çift), `switch` / `door` (renk), `passage` (kenarlar), `refill` (sayı). Herhangi bir tile `swap` işareti taşıyabilir (kural 16). Tile olmayan hücre **boşluktur**: oraya girilemez |
| 3 | Başlangıç | Karakter `start` tile'ında durur. Kalan adım = level'ın `params.steps` değeri |
| 4 | Hareket | Oyuncu 6 komşudan girilebilen birine geçer ve **1 adım** harcar (bataklık 2, kural 14). Girilemeyenler: boşluk, `blocker`, kapalı `door`, kapalı kenardan `passage`. Kalan adım 0 ise hareket yok |
| 5 | +1 | Karakter `plus1` tile'ına **ilk kez girdiğinde** kalan adım 1 artar. Tile o level boyunca düz zemine döner (tek kullanımlık) |
| 6 | Fırlatıcı | Karakter fırlatıcıya girince önce adımı ödenir, sonra okun yönünde **tam 2 tile** ileri fırlatılır. Fırlatma adım harcamaz |
| 7 | Fırlatma hedefi | Hedef 2 tile ötedeki hücredir; arada boşluk, `blocker` ya da kapalı kapı olsa bile üstünden uçar. 2. hücreye inilemiyorsa (boşluk, `blocker`, kapalı kapı) karakter 1. hücreye iner. Oraya da inilemiyorsa fırlatıcının üstünde kalır ve fırlatıcı tekrar tetiklenmez. Uçuş `passage` kenarlarına takılmaz |
| 8 | Varış | Karakter bir tile'a yürüyerek, inerek, kayarak ya da ışınlanarak **vardığında** o tile çalışır; üstünden geçilenler yok sayılır. `plus1` +1 toplar, `launcher` fırlatır, `mover` kaydırır (zincir), `portal` ışınlar, `switch` basılır, `refill` adımı eşitler, `finish` kazandırır |
| 9 | Zincir güvenliği | Editör fırlatıcı / mover döngüsüne (A→B→A) izin vermez. Kod yine de bir güvenlik sınırı koymalı: 32 zincirleme fırlatma/kaymadan sonra karakter bulunduğu tile'da durur, oyun normal devam eder. Geçerli level'larda bu hiç olmaz |
| 10 | Kazanma | Karakter `finish`'e yürüyerek ya da inişle vardığı anda level kazanılır, kalan adım 0 olsa bile |
| 11 | Kaybetme | Kalan adım 0 ve karakter `finish`'te değil → kaybedildi (1 adımla bataklığa girmek dahil). Kalan adım olsa bile geçerli hamle kalmadıysa da kaybedildi |
| 12 | Geri al / yeniden | Sınırsız **geri al** ve **yeniden başla** her zaman açık, kaybedilmiş durumda da. Geri alma, oyuncunun bir hamlesini bütünüyle geri alır: o hamlenin tetiklediği bütün zincir, toplanan +1'ler, basılan şalterler, değişen çiftlerin durumu ve kalan adım dahil |
| 13 | Blocker | `blocker`'ın üstüne gidilemez (yürüyerek, kayarak ya da inerek). Fırlatma üstünden uçar |
| 14 | Bataklık | `swamp`'a **yürüyerek** girmek 2 adım harcar. 1 adım kalmışken girilirse kalan adım 0 olur ve kaybedilir. Fırlatmayla, kayarak ya da ışınlanarak varmak bedavadır |
| 15 | Mover | `mover`'a girmek normal adımdır. Sonra karakter okun yönünde **bedava** kayar: sadece `floor` (ve `start`, açık `door`, toplanmış `plus1`: kural 5) üstünden geçer. Zemin olmayan ilk tile'da **durur ve o tile çalışır** (kural 8). Sıradaki hücre boşluk, `blocker`, kapalı kapı, o kenardan girilemeyen `passage` ya da harita sonuysa bir önceki hücrede durur |
| 16 | Değişen çift | Aynı `swap` numarasını taşıyan iki tile, oyuncunun **her hamlesinde, yürümeden önce** yer değiştirir. Oyuncu taşınmaz; vardığı hücrede o an ne varsa onu yaşar. Hamlenin geçerliliğine değişimden sonraki haritaya bakılır; geçersizse hiçbir şey olmaz (değişim de). `start` ve `finish` de değişen çiftte olabilir: bitiş yer değiştirir, kazanma o an bitişin bulunduğu hücreye varmaktır; oyuncu her zaman `start`'ın ilk konumunda başlar (Uğur, 2026-09-27) |
| 17 | Portal | Aynı `pair` numaralı iki `portal`. Birine varınca karakter öbürüne ışınlanır; varış portalı onu geri göndermez |
| 18 | Şalter + kapı | Kapalı `door` blocker gibidir. Aynı `color`'daki `switch`'e varınca (yürüyerek, inerek ya da kayarak) o renkteki kapılar **kalıcı** açılır ve zemin gibi davranır |
| 19 | Geçit | `passage`'ın her kenarı ayrı ayarlanır: `noIn` kenarlarından girilemez, `noOut` kenarlarından çıkılamaz. "X kenarından girmek" = X yönündeki komşudan gelmek. Yürüyüş ve kayma kenarlara uyar, fırlatma uymaz |
| 20 | Dolum | `refill`'e varınca kalan adım üzerindeki `value`'ya **eşitlenir**, fazla adım olsa bile. Önce hamlenin adımı düşülür, sonra eşitlenir: bu hamlenin ara hesabı 0'a düşse bile bu hamle kaybettirmez. Sonraki hamlelerde normal kaybetme kuralı (11) geçerlidir |

hex-steps sadece hex grid kullanır. Harita alanı `(0,0)` merkezli bir altıgendir (`grid.size`, bkz.
`docs/level-format.md`). Editörde grid tipi oyuna (ruleset'e) bağlıdır, level başına
seçilmez (2026-09-27). Kural motoru kare grid'de de çalışır (4 komşu, N/E/S/W); `fx-15` bunu
test eder, ileride kare grid'li bir oyun aynı motoru kullanabilir.

## Tile'lar

| Tile | JSON `type` | Görsel ipucu (editördeki) |
|---|---|---|
| Zemin | `floor` | Açık bej |
| Başlangıç | `start` | Mavi, halka |
| Bitiş | `finish` | Yeşil, hedef |
| +1 Adım | `plus1` | Turuncu, "+1" |
| Fırlatıcı | `launcher` + `dir` | Mor, ok yönü gösterir |
| Blocker | `blocker` | Gri, çarpı |
| Bataklık | `swamp` | Yeşilimsi, "≈" |
| Mover | `mover` + `dir` | Zemin üstünde mor çift ok |
| Portal | `portal` + `pair` (1, 2, …) | Mavi halka, çift numarası |
| Şalter | `switch` + `color` (1–3) | Koyu daire, harf A/B/C |
| Kapı | `door` + `color` (1–3) | Gri, kapı çerçevesi + harf; açılınca kesik çizgi |
| Geçit | `passage` + `noIn` / `noOut` (yön listeleri) | Kapalı kenar = kalın çizgi; tek yön = izin verilen yönü gösteren ok |
| Dolum | `refill` + `value` (1–99) | Yeşil halka içinde sayı |
| Değişen çift | herhangi bir tile + `swap` (1, 2, …) | Noktalı mavi halka, numara rozeti |

Editördeki renkler tasarım kararı değil, sadece okunurluk için. Oyunun görsel yönü ayrı konuşulacak.

## Kontroller
- **Fare/dokunmatik:** karakterin komşusu olan bir tile'a tıklayınca/dokununca o yöne hareket
  eder. Gidilebilir komşular vurgulanır.
- **Klavye (masaüstü):** hex yönleri `W`=↖ `E`=↗ `A`=← `D`=→ `Z`=↙ `X`=↘. `Backspace`=geri al,
  `R`=yeniden başla. Editördeki oyna modu da bu tuşları kullanıyor.

## Ekranda olması gerekenler
- Kalan adım sayısı, her zaman görünür ve büyük: ekranın sağ üst köşesinde, sadece sayı (geri sayım
  gibi; editör de aynı yerde gösterir)
- Geri al ve yeniden başla butonları
- Level numarası
- Kazanınca "sonraki level"; kaybedince geri al / yeniden başla önerisi
- Fırlatmada karakterin uçtuğu ve +1'in toplandığı görülebilmeli (kısa bir hareket yeterli)

## İlerleme kaydı
Sadece bitirilen level id'leri tutulur (`localStorage`, bkz. `docs/tech-conventions.md`). Bir level
bitince sıradaki açılır. Skor ya da yıldız yok.

## Level seti
Hedef yapı: 10 chapter × 6 level (bkz. `docs/workflow.md` "Oyun yapısı"). Chapter planı (Uğur,
2026-09-27): 9 mekanik + karma son chapter.

| Chapter | Level'lar | Mekanik |
|---|---|---|
| 1 | 1–6 | +1 ve Blocker |
| 2 | 7–12 | Fırlatıcı |
| 3 | 13–18 | Bataklık |
| 4 | 19–24 | Mover |
| 5 | 25–30 | Değişen çift |
| 6 | 31–36 | Portal |
| 7 | 37–42 | Şalter + Kapı |
| 8 | 43–48 | Geçit |
| 9 | 49–54 | Dolum |
| 10 | 55–60 | Hepsi bir arada |

Her chapter'ın 1. level'ı mekaniği tanıtır, 1→6 zorluk artar.

`levels/pack.json` chapter sırasıyla level'ları içerir; oyun bu sırayı kullanmalı. Şu an Chapter 1
ve 2 hazır (12 level, 2026-09-27). Id düzeni: `cNN-lMM` (chapter, chapter içindeki sıra).

**Durum (Uğur, 2026-09-27):** sadece `c01-l01` onaylandı → `levels/onayli/c01-l01.json` (son sürümde
kullanılacak, `meta.approved`). Diğer 11 level beğenilmedi, yeniden yapılacak; şimdilik çalışma
setinde duruyor.

| # | id | İsim | Bütçe | Mekanik (çıkarılınca) |
|---|---|---|---|---|
| 1 | c01-l01 ✓ onaylı | İlk engel | 5 | +1 yoksa en az 6; blocker yoksa 4 yeter |
| 2 | c01-l02 | Çift blocker | 6 | +1 yoksa 7; blocker yoksa 4 |
| 3 | c01-l03 | Sapmalar | 7 | +1 yoksa 9; blocker yoksa 6 |
| 4 | c01-l04 | Dar geçit | 9 | +1 yoksa 10; blocker yoksa 8 |
| 5 | c01-l05 | Üç engel | 9 | +1 yoksa 11; blocker yoksa 6 |
| 6 | c01-l06 | Uzun devriye | 10 | +1 yoksa 13; blocker yoksa 9 |
| 7 | c02-l01 | Fırlat | 5 | fırlatıcı yoksa 6 |
| 8 | c02-l02 | Fırlatıcı ve engel | 6 | fırlatıcı yoksa 8; blocker yoksa 5 |
| 9 | c02-l03 | Fırlatıcı ve +1 | 6 | fırlatıcı yoksa 7; +1 yoksa 7 |
| 10 | c02-l04 | Çift fırlatıcı | 8 | fırlatıcı yoksa hiç çözülemez; +1 yoksa 9 |
| 11 | c02-l05 | Üçlü sınav | 9 | fırlatıcı yoksa 10; +1 yoksa 11 |
| 12 | c02-l06 | Hepsi bir arada | 11 | fırlatıcı yoksa 12; +1 yoksa 13 |

**Tasarım kuralı (Uğur, 2026-09-27):** değişen çift, oyuncunun o an durduğu hücreye kenarı kapalı bir
`passage` getirmemeli. Motor buna izin veriyor (kural 16'ya göre doğru), ama oyuncu önceden göremediği
bir yasakla karşılaşır. Level tasarımında bundan kaçınılır.

Hepsi editörün çözücüsüyle üretildi ve doğrulandı: tek çözüm, bütçe = gereken en az adım, chapter'ın
mekaniği zorunlu. Tasarımcı bu level'ları editörde açıp değiştirebilir ya da yerine yenilerini koyabilir.
İlk taslak 10 level (sadece +1 ve fırlatıcı, chapter planından önce) `levels/taslak/` altında duruyor;
oyun onları kullanmaz.

Her level'da `meta.solution` alanı var:
- `minBudget`: gereken en düşük adım
- `solutions`: bu bütçeyle kazanan farklı hamle dizisi sayısı
- `shortest`: en kısa çözümün yön listesi

`shortest` bir kabul testi olarak da kullanılabilir: yeniden oynatıldığında level kazanılmalı.

## Kabul kriterleri (developer)
1. `levels/fixtures/*.json` dosyalarının hepsi geçiyor. Her fixture'daki `expect.moves` oynatılınca
   `expect.result`, `expect.stepsLeft` ve (varsa) `expect.at` birebir çıkıyor.
2. `levels/pack.json`'daki her level için `meta.solution.shortest` oynatılınca level kazanılıyor.
3. Oyun level'ları `levels/pack.json`'dan okuyor. Level verisi koda gömülü değil.
4. Geri al / yeniden başla her durumda çalışıyor, kazanılmış ya da kaybedilmiş durumda da.
5. Masaüstü tarayıcıda fare + klavye, mobil tarayıcıda dokunmatik ile oynanabiliyor.
