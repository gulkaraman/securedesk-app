# TECHNICAL CHALLENGE AND Q&A

Bu dosya, projede karşılaşılan en büyük teknik engeli, diğer önemli zorlukları ve savunmada kullanılabilecek örnek soru–cevapları özetler.

## 1. En büyük teknik engel: Güvenli mimari ile typed IPC

Projede en zorlayıcı kısım, **Electron’un güvenli mimarisini (nodeIntegration: false, contextIsolation: true) strict TypeScript ve tek tip sözleşme ile tutarlı biçimde yönetmek**ti.

**Neden zordu?**

- Renderer’a Node/SQLite vermeden tüm işleri main’de yapmak gerekiyordu; arayüz ise sadece “bir API” ile konuşmalıydı.
- Bu API’nin kanal adları, argüman tipleri ve dönüş tipleri main ile renderer arasında uyuşmazlığa düşmeden korunmalıydı.
- Serbest string kanallar (`ipcRenderer.send('herhangi-bir-sey')`) hem güvenlik hem de bakım açısından istenmiyordu.

**Nasıl aşıldı?**

- **Tek tip kaynağı:** `src/shared/ipc.ts` içinde `IpcInvokeMap` ile her kanal için `args` ve `result` tipleri tanımlandı. Böylece “bu kanal ne alıyor, ne döndürüyor?” sorusu tek dosyadan okunabilir hale geldi.
- **Preload’da typed invoke:** Preload’da `invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>)` yazıldı; yanlış kanal adı veya argüman tipi derleme hatası veriyor.
- **Main’de Result<T>:** Tüm handler’lar `wrap` / `wrapAsync` ile `Result<T>` döndürüyor; renderer tarafında `unwrap(res)` ile tek tip hata işleme yapılıyor.
- **Renderer sadece window.api:** React bileşenleri yalnızca `window.api.tasks.listByProject(projectId)` gibi, `ipc.ts` ile tiplenmiş metodları kullanıyor; doğrudan `ipcRenderer` yok.

**Sonuç:** Main–renderer sınırı hem güvenli hem de tip güvenli; savunmada “IPC’yi nasıl güvende ve sürdürülebilir tuttunuz?” sorusuna bu yapı üzerinden net cevap verilebilir.

## 2. Diğer önemli teknik engeller

### 2.1 Timer + idle + suspend/lock-screen ile tutarlı süre takibi

**Sorun:**

- Tek aktif sayaç kuralıyla:
  - Kullanıcı UI’da Başlat/Durdur yaparken,
  - Sistem idle/suspend/lock-screen olduğunda,
  - Uygulama kapanıp tekrar açıldığında
zaman kayıtlarının çakışmaması ve sürelerin doğru hesaplanması gerekiyordu.

**Çözüm:**

- **Tek kaynaklı gerçek:** `active_timer` tablosu:
  - Sadece `task_id`, `start_time` ve `created_at` tutar.
- `TimerService`:
  - `start`:
    - Elde mevcut bir active row varsa ve farklı görevse `ConflictError`.
    - Yoksa `active_timer`’a yazar.
  - `stop`:
    - `time_entries` tablosuna tek satır yazar (`start_time`, `end_time`, `duration_seconds`, `source`).
    - Ardından `active_timer`’ı siler.
- **IdleTimerService**:
  - `powerMonitor.getSystemIdleTime()` ile periyodik idle kontrolü.
  - 10 dakika inaktiflikte, aktif timer varsa:
    - `TimerService.stop(..., 'auto_stop')`.
    - `activity_log`:
      - `idle_detected`
      - `timer_auto_stopped`.
- **Recovery stratejisi**:
  - Uygulama açılırken `TimerService.recoverOnStartup(Date.now())`:
    - Eğer `active_timer` doluysa:
      - `auto_stop` ile time entry oluştur.
      - `timer_stopped` event’i reason=`recovery` ile logla.

**Kazanç:**

- Tek bir kaynaktan (DB) bakarak:
  - O anda aktif timer var mı?
  - Bugünkü ve toplam süreler nedir?
  - Idle auto-stop ne zaman devreye girdi?
cevaplanabiliyor.

### 2.2 Vault şifreleme: AES-256-GCM + PBKDF2’yi doğru bağlamak

**Sorun:**

- Kullanıcı notlarını veritabanında **plaintext** tutmamak.
- “Master key”’in veritabanında açık halde saklanmaması.
- Yanlış master key ile açılmaya çalışılan kasanın deterministik bir şekilde hataya düşmesi.

**Çözüm:**

- PBKDF2 ile key türetildi:
  - `salt`, `iterations`, `derivedKey`.
  - `derivedKey`’in hash’i `keyVerifier` olarak saklandı.
- `app_settings` tablosunda sadece şu metadata tutuldu:
  - `vault_salt` (base64)
  - `vault_iterations`
  - `vault_key_verifier` (sha256(derivedKey) hex)
- AES-256-GCM:
  - `iv` ve `authTag` her not için ayrı üretildi.
  - Şifreli gövde JSON olarak `enc_payload_json` içinde saklandı (`iv/authTag/ciphertext`), gövde kolonu yok.
- Unlock:
  - Kullanıcının girdiği master key ile PBKDF2 tekrar çalıştırıldı.
  - `keyVerifier` karşılaştırması ile doğru/yanlış karar verildi.

**Kazanç:**

- DB sızsa bile master key olmadıkça notlar çözülemiyor.
- Master key sadece RAM’de; disk üzerinde hiçbir zaman plaintext tutulmuyor.

## 3. Savunmada sorulabilecek örnek teknik sorular ve kısa cevaplar

### Soru 1: Neden `nodeIntegration`’ı kapattınız?

**Cevap (kısa):**

- Güvenlik sebebiyle.
- `nodeIntegration: true` olsaydı, renderer’daki her XSS güvenlik açığı otomatik olarak `fs`, `child_process` gibi modüllere erişebilirdi.
- Bunun yerine:
  - `nodeIntegration: false`, `contextIsolation: true` kullandım.
  - Preload’ta sadece `window.api` altında typed ve sınırlı bir IPC yüzeyi expose ediyorum.

### Soru 2: Vault notları veritabanına nasıl kaydediliyor? Plaintext var mı?

**Cevap (kısa):**

- Hayır, plaintext yok.
- Not gövdesini (string) AES-256-GCM ile şifreliyorum.
- `vault_secrets` tablosunda sadece:
  - `title`, `enc_payload_json`, `created_at`, `updated_at` kolonları var.
- `enc_payload_json` alanı:
  - `iv`, `ciphertext`, `authTag` içeriyor.
- KDF metadata’sı:
  - `vault_salt`, `vault_iterations`, `vault_key_verifier` olarak `app_settings` tablosunda tutuluyor.
- Gövde (`body`) için ayrı bir kolon yok; sadece ciphertext var.

### Soru 3: Master key’i nerede tutuyorsunuz?

**Cevap (kısa):**

- Sadece main process’in RAM’inde.
- İlk kullanımda PBKDF2 ile derived key hesaplanıyor; veritabanında sadece:
  - `salt`, `iterations`, `keyVerifier` (hash) tutuluyor.
- Master key’in kendisini veya derived key’i asla diske yazmıyorum.
- Uygulama kapanınca RAM’deki key de kayboluyor; sonraki açılışta kullanıcı tekrar master key girmek zorunda.

### Soru 4: Tek aktif timer kuralını nasıl garanti ediyorsunuz?

**Cevap (kısa):**

- `active_timer` diye ayrı bir tablo var; sadece tek satır.
- `TimerService.start`:
  - Bu tablodan okuyor; halihazırda satır varsa ve başka `task_id` ise `ConflictError` fırlatıyor.
- Bu sayede hem UI’de hem DB tarafında aynı anda sadece tek aktif sayaç olabiliyor.

### Soru 5: Idle auto-stop hangi durumda tetikleniyor?

**Cevap (kısa):**

- `IdleTimerService` `powerMonitor.getSystemIdleTime()` ile sistem idle süresini izliyor.
- 10 dakikadan fazla inaktiflik varsa ve aktif timer varsa:
  - Timer `auto_stop` source ile durduruluyor.
  - `idle_detected` ve `timer_auto_stopped` event’leri loglanıyor.
  - Kullanıcıya native notification ile bilgi veriliyor.

### Soru 6: Raporlardaki grafikler dummy mi yoksa gerçek veri mi?

**Cevap (kısa):**

- Gerçek veri.
- `ReportService.getWeeklyReport` fonksiyonu:
  - `time_entries` tablosundan haftalık toplam süreleri, gün/görev bazlı dağılımı ve tamamlanan task sayısını SQL üzerinden hesaplıyor.
- React tarafında sadece bu JSON verileri ***Chart.js*** ile görselleştiriliyor.

### Soru 7: CI/CD’de neleri kontrol ediyorsunuz?

**Cevap (kısa):**

- GitHub Actions:
  - Her push/PR’da:
    - `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`.
  - Windows runner’da:
    - `npm run build`, `npm run dist` (electron-builder).
- Yani sadece unit test değil; tip hataları, lint sorunları ve üretim build/paketleme adımları da kontrol ediliyor.

### Soru 8: electron-builder paketleme sürecinde ne oluyor?
**Cevap (kısa):** Önce `npm run build` ile `out/main`, `out/preload`, `out/renderer` üretiliyor. electron-builder, `package.json` içindeki `main` ve `files` alanına göre bu çıktıyı ve `node_modules`’ü alıp tek bir `app.asar` arşivine koyuyor. Native modüller (better-sqlite3) `asarUnpack` ile arşiv dışında bırakılıyor ki çalışabilsin. Windows’ta `win.target: portable` ile tek bir taşınabilir `.exe` (YerelSuit-1.0.0.exe) üretiliyor. Detay için `docs/BUILD_AND_RELEASE.md` “electron-builder build mantığı” bölümüne bakılabilir.

### Soru 9: Neden SQLite yerine başka bir veritabanı seçmediniz?

**Cevap (kısa):**

- Proje tamamen lokal ve offline odaklı.
- Kullanıcıdan ek bir “server” kurmasını istemeden, tek bir `.sqlite3` dosyası ile veri saklamak istiyorum.
- SQLite:
  - Kullanıcı için kurulum maliyeti yok.
  - Yedekleme ve taşıma basit (tek dosya).
  - Electron ekosisteminde `better-sqlite3` ile performanslı ve stabil.

### Soru 10: Preload script’in tam rolü nedir?
**Cevap (kısa):** Preload, güvenlik nedeniyle renderer’a Node API’si vermediğimiz için araya giren ince katmandır. Renderer’ın JavaScript context’i ile main process’in context’i ayrı (contextIsolation: true). Preload, `contextBridge.exposeInMainWorld('api', api)` ile sadece bizim tanımladığımız, tiplenmiş `window.api` objesini renderer’a verir. Yani renderer `ipcRenderer`’ı hiç görmez; sadece `window.api.tasks.listByProject(projectId)` gibi metodları çağırır. Preload bu çağrıları alıp `ipcRenderer.invoke(channel, ...args)` ile main’e iletir. Böylece hem güvenlik hem de tek tip sözleşme (typed IPC) korunur.

### Soru 11: Uygulamayı savunurken hangi dosyalara bakarak mimariyi anlatırsınız?

**Cevap (kısa referans listesi):**

- Main lifecycle: `electron/main/index.ts`
- Pencere + tray: `electron/main/window.ts`
- IPC ve service wiring: `electron/main/ipc/handlers.ts`
- Ortak tipler: `src/shared/models.ts`
- IPC sözleşmesi: `src/shared/ipc.ts`
- Görev/kanban UI: `src/features/tasks/*`
- Timer ve idle: `electron/main/services/timerService.ts`, `idleTimerService.ts`, `src/lib/timerStore.ts`
- Vault: `electron/main/services/vaultService.ts` ve ilgili crypto servisleri
- Raporlar: `electron/main/services/reportService.ts`, `src/features/reports/*`

Bu sorular ve cevaplar savunma sırasında hızlıca referans alabileceğiniz bir “cheat sheet” görevi görür.
