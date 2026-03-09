# SECURITY

Bu dosya, YerelSuit projesinin güvenlik tasarımını ve alınan önlemleri açıklar. Main / preload / renderer ayrımı ve typed IPC’nin mimari tarafı `docs/ARCHITECTURE.md` içinde; savunmada sorulabilecek güvenlik soruları ve kısa cevaplar `docs/TECHNICAL_CHALLENGE.md` “Savunmada sorulabilecek örnek teknik sorular” bölümünde yer alır.

## 1. Saldırı yüzeyini sınırlama

### 1.1 nodeIntegration=false, contextIsolation=true

`electron/main/window.ts` içinde `BrowserWindow` şu şekilde yapılandırılır:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`

Bu ayarlar ile:

- Renderer (React) tarafı **doğrudan Node API’lerine** erişemez (ör. `fs`, `child_process`, `require` vs).
- Preload süreci, `contextBridge.exposeInMainWorld` ile çok kısıtlı ve tiplenmiş bir `window.api` alanı açar.
- Kötü niyetli bir script (ör. XSS) uygulamaya sızsa bile, sadece expose edilen bu güvenli API’leri görür; dosya sistemi veya veritabanına doğrudan ulaşamaz.

### 1.2 Typed IPC ile kısıtlı yüzey

- Tüm IPC kanalları `src/shared/ipc.ts` içinde tiplenmiş olarak tanımlıdır.
- Renderer, sadece burada tanımlı kanalları kullanabilir:
  - Örn. `tasks:listByProject`, `timer:start`, `vault:getStatus`, `vaultSecrets:list`, `reports:getWeekly`.
- Main tarafındaki handler’lar (`electron/main/ipc/handlers.ts`) sadece beklenen giriş tiplerini kabul eder ve `Result<T>` döndürür.

Bu yaklaşım, “her yere giden serbest string kanal isimleri” yerine, statik olarak analiz edilebilir ve test edilebilir bir IPC yüzeyi sağlar.

## 2. Veri saklama ve SQLite güvenliği

### 2.1 SQLite sadece main process’te

- `better-sqlite3` sadece main process’te kullanılır (`electron/main/db/connection.ts`).
- Renderer, veritabanına asla doğrudan bağlanmaz; tüm DB işlemleri main’deki servisler üzerinden yapılır.

Avantajları:

- Veritabanı erişimi tek bir süreçte toplanır; saldırı yüzeyi küçülür.
- Transaction / migration / logging gibi cross-cutting konular tek yerde tutulur.

### 2.2 AppData klasör yapısı

`electron/main/paths.ts`:

- `root = app.getPath('userData')`
- `databaseDir = root/database`
- `attachmentsDir = root/attachments`
- `exportsDir = root/exports`
- `logsDir = root/logs`

Tüm kalıcı veri bu klasör altında tutulur (Windows’ta `%APPDATA%` altı); göreli path’lerle çalışılır.

## 3. Şifreli veri kasası (Vault)

### 3.1 Tehdit modeli

Amaç:

- SQLite dosyasını ele geçiren bir saldırganın, kullanıcı notlarını **plaintext** olarak okuyamaması.

Saldırganın elinde:

- `app.sqlite3` dosyası,
- Uygulama binary’si,
- Possibly `app_settings` içeriği (salt, iterations vs).

Saldırganın elinde **olmayan** şey:

- Kullanıcı Master Key’i (sadece hafızada tutulur).

### 3.2 AES-256-GCM + PBKDF2

Vault notları şu mantıkla saklanır:

1. Kullanıcı ilk defa kasayı açarken bir **master key** belirler.
2. Main process’te PBKDF2 ile türetilir:
   - `salt`: kriptografik olarak rastgele 16 byte.
   - `iterations`: `310_000`.
   - `keyLength`: 32 byte (AES-256).
   - `digest`: `sha256`.
3. Türetilen key ile bir `keyVerifier` hesaplanır (`sha256(derivedKey)` → hex) ve `app_settings` içinde **ayrı key’ler** olarak tutulur:

   - `vault_salt` (base64)
   - `vault_iterations` (string sayı)
   - `vault_key_verifier` (hex)

4. Master key’in kendisi asla diske yazılmaz; sadece RAM’de tutulur.

### 3.3 Not şifreleme

- Uygulama not gövdesi (`body: string`) AES-256-GCM ile şifrelenir.
- AES-256-GCM ile şifrelenir:
  - `iv`: 12 byte rastgele nonce.
  - `ciphertext`: `cipher.update(plaintext) + cipher.final()`.
  - `authTag`: `cipher.getAuthTag()` (GCM’in bütünlük kontrolü).
- Sonuç olarak DB’ye yazılan `enc_payload_json` alanı sadece şunları içerir:

  ```json
  {
    "iv": "<base64>",
    "ciphertext": "<base64>",
    "authTag": "<base64>"
  }
  ```

> **Önemli:** KDF salt/iterations her notta tekrar saklanmaz; kasa seviyesinde `app_settings`’te tutulur. Plaintext `body` için ayrı kolon yoktur.

### 3.4 Unlock / Lock akışı

- **İlk kullanım (setup)**:
  - Kullanıcı master key girer.
  - Yukarıdaki PBKDF2 + metadata işlemi yapılır ve key RAM’de tutulur.
- **Sonraki açılışlarda**:
  - Kullanıcıdan master key istenir.
  - PBKDF2 ile derived key hesaplanır; `keyVerifier` ile karşılaştırılır.
  - Doğruysa vault **unlocked** duruma geçer; yanlışsa hata verilir.
- **Lock**:
  - RAM’de tutulan derived key ve durum silinir; vault API’leri tekrar unlock edilmeden kullanılmaz.

### 3.5 Plaintext loglamama


- Vault notları okunurken plaintext sadece main process RAM’inde kısa süreli tutulur.
- Loglama ve hata mesajları, plaintext içeriği içermez:
  - Örneğin: “Failed to decrypt vault item” gibi genel hata mesajları.
- Renderer tarafına sadece şifre çözülmüş gövde (`title`, `body`, `createdAt`, `updatedAt`) taşınır; loglarda yine belirtilmez.

## 4. Dosya ekleri ve path güvenliği

### 4.1 Path traversal koruması

`AttachmentFileService` içinde her dosya path’i şu şekilde doğrulanır:

- Gerçek path `path.resolve` ile normalize edilir.
- App’in `attachmentsDir` kökü de normalize edilir.
- Kandidat path’in kök path ile başladığı (`startsWith`) kontrol edilir.
- Değilse `ValidationError('Unsafe path rejected')` fırlatılır.

Bu sayede `"../../../../Windows/System32"` gibi zararlı path girişimleri diske yansıtılmaz.

### 4.2 Dosya boyutu limiti

- Eklenen dosyalar için bir üst limit konur (örn. 250 MB).
- `fs.statSync` ile dosya boyutu okunur; limit üstündeyse `ValidationError('File is too large')` döner.

Bu limit DoS benzeri “devasa dosya eklerim, disk şişiririm” saldırılarına karşı basit bir savunmadır.

## 5. Timer, idle ve güç olayları

- `IdleTimerService`:
  - `powerMonitor.getSystemIdleTime()` ile kullanıcı inaktifliğini izler.
  - 10 dakikadan fazla inaktiflikte aktif timer varsa `TimerService.stop(..., 'auto_stop')` çağrılır.
  - `idle_detected` ve `timer_auto_stopped` event’leri `activity_logs` tablosuna yazılır.
- `powerMonitor.on('suspend')` ve `on('lock-screen')` event’leri de timer’ı güvenli şekilde durdurur.

Bu sayede:

- Kullanıcı terminali kilitlediğinde veya makine suspend olduğunda timer boşa akmaz.

## 6. Electron güvenlik rehberine uyum

Özetle:

- `nodeIntegration: false` – Renderer’da Node API yok.
- `contextIsolation: true` – Preload ve Renderer context’leri ayrılmış.
- `sandbox: true` – WebContents sandbox modunda.
- Tüm kritik işler (DB, dosya erişimi, crypto) sadece main process’te.
- Renderer sadece typed IPC ile konuşur.

Bu yapıyla Electron’un resmi güvenlik rehberinde önerilen ana maddelere uyulmuş olur.

## 7. Savunmada vurgulanabilecek güvenlik noktaları

- **Vault:** DB çalınsa bile notlar AES-256-GCM ile şifreli; master key olmadan içerik açılamaz. Master key ve türetilmiş anahtar yalnızca RAM’de, diske yazılmıyor.
- **Electron ayarları:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` ile renderer’da Node/OS erişimi yok; en yaygın Electron hatalarından (nodeIntegration: true, remote) kaçınıldı.
- **IPC:** Typed IPC (`src/shared/ipc.ts`) ile sınırlı ve tiplenmiş kanal listesi; serbest `ipcRenderer.send`/`ipcMain.on` kullanımı yok.
- **SQLite:** Sadece main process’te; renderer hiçbir zaman veritabanına doğrudan erişmiyor.
- **Dosya ekleri:** Sadece AppData altına kopyalanıyor; path traversal kontrolü ve dosya boyutu limiti var.
- **Timer / idle:** Suspend ve lock-screen’de timer güvenli şekilde durduruluyor; boşa süre yazılmıyor.

Detaylı soru–cevap örnekleri için `docs/TECHNICAL_CHALLENGE.md` “Savunmada sorulabilecek örnek teknik sorular ve kısa cevaplar” bölümüne bakılabilir.

