# ARCHITECTURE

Bu dosya, YerelSuit projesinin mimarisini staj/bitirme savunmasında anlatabilecek seviyede özetler.

## 1. Proje özeti

YerelSuit, tamamen lokal çalışan bir **güvenli iş ve kaynak yönetim** uygulamasıdır:

- Görev yönetimi (Kanban board, durumlar: `todo`, `in_progress`, `done`).
- Görev bazlı zaman takibi (tek aktif sayaç, idle auto-stop).
- Şifreli veri kasası (AES-256-GCM + PBKDF2 ile şifrelenmiş notlar).
- Haftalık raporlar (SQLite üzerindeki gerçek zaman kayıtlarından grafikler ve tablolar).

Tüm veri SQLite’ta tutulur, ağ erişimi yoktur; bu da offline ve veri mahremiyeti odaklı kullanım sağlar.

## 2. Teknoloji yığını

- **Electron** – cross-platform masaüstü container, main/preload/renderer süreçleri.
- **React + Vite** – modern, hızlı renderer UI.
- **TypeScript (strict)** – hem main hem renderer hem shared katmanda, `noImplicitAny` vb. açık.
- **SQLite (better-sqlite3)** – hızlı, dosya tabanlı veritabanı, sadece main process’te kullanılıyor.
- **Chart.js** – rapor ekranındaki grafikler (bar / doughnut).
- **electron-builder** – üretim paketleri (Windows için portable `.exe`).
- **ESLint + typescript-eslint** – kod kalitesi ve kurallar.
- **GitHub Actions** – CI pipeline (typecheck + lint + build + dist).

## 3. Neden Electron + TypeScript + React + SQLite?

- **Electron**:
  - Windows/macOS/Linux üzerinde tek kod tabanıyla çalışmak için.
  - Node API’leri sayesinde SQLite, dosya sistemi, tray, powerMonitor vb. OS özelliklerine erişmek için.
- **TypeScript**:
  - Main, preload ve renderer arasındaki IPC sözleşmesini tek kaynaktan tiplenmiş tutmak için (shared `ipc.ts` + `models.ts`).
  - Strict mod (`noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes` vb.) ile runtime hatalarını derleme zamanına taşımak.
  - Refactoring ve savunma sırasında “bu API ne alıyor, ne döndürüyor?” sorusunun kod üzerinden net cevaplanması.
- **React**:
  - Kanban board, tablolar, modallar gibi etkileşimli UI’lar için component odaklı, test edilebilir bir yapı.
  - Ecosystem (örn. `@dnd-kit/core`, Chart.js entegrasyonu).
- **SQLite**:
  - Uygulama tamamen lokal olduğu için server-side veritabanına ihtiyaç yok.
  - Tek bir `.sqlite3` dosyası ile backup/restore, taşınabilirlik ve kurulum kolaylığı.

Bu kombinasyon, tamamen offline, güvenli ve taşınabilir bir iş yönetimi aracı sunmak için uygundur; TypeScript sayesinde mimari sınırlar (özellikle main–renderer) kod seviyesinde zorunlu tutulur.

## 4. Main / Preload / Renderer ayrımı

### Main process (`electron/main/*`)

- Uygulamanın “backend” kısmı.
- Sorumlu olduğu işler:
  - `BrowserWindow` oluşturma (`electron/main/window.ts`).
  - Tray ve uygulama yaşam döngüsü (`electron/main/index.ts`).
  - SQLite bağlantısı (`electron/main/db/connection.ts`).
  - Migration ve seed (`electron/main/db/migrate.ts`, `electron/main/db/seed.ts`).
  - Repository ve service katmanları:
    - Tasks, Projects, Attachments, TimeEntries, ActivityLogs, Vault, Settings.
  - Timer servisi (`timerService.ts`) ve idle auto-stop (`idleTimerService.ts`).
  - Rapor servisi (`reportService.ts`) ve PDF export (`reportExportService.ts`).
  - Vault şifreleme ve key yönetimi (`vaultService.ts` + ilgili crypto servisleri).

### Preload process (`electron/preload/index.ts`)

- Renderer’a doğrudan Node API’leri verilmez; bunun nedeni aşağıdaki “Neden nodeIntegration: false ve contextIsolation: true?” bölümünde özetlenir.
- Preload, yalnızca tiplenmiş ve kontrollü bir API’yi `contextBridge.exposeInMainWorld('api', api)` ile `window.api` olarak dışarı açar.
- `src/shared/ipc.ts`’te tanımlanan typed IPC sözleşmesinin client tarafı burada uygulanıyor:
  - `invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>)`.
  - Örneğin:
    - `window.api.tasks.listByProject(projectId)`.
    - `window.api.timer.start(taskId)`.
    - `window.api.vault.unlock(masterKey)`.

### Renderer (`src/renderer/*`, `src/features/*`)

- React bileşenleri (Kanban, Timer, Vault, Reports).
- Sadece `window.api` ile konuşur; Node veya SQLite API’sine doğrudan erişimi yoktur.
- State yönetimi:
  - Yerel component state’leri (Kanban sayfası).
  - Küçük bir global store (`src/lib/timerStore.ts`) – aktif timer state’ini paylaştırır.

## 4.1. Neden `nodeIntegration: false` ve `contextIsolation: true`?

`electron/main/window.ts` içinde `BrowserWindow` bu iki ayar ile oluşturulur:

- **nodeIntegration: false**  
  Renderer (React) içinde `require()`, `process`, `fs`, `child_process` gibi Node API’leri **hiç yoktur**. Böylece:
  - Renderer’daki herhangi bir XSS veya script enjeksiyonu, doğrudan dosya sistemine veya sisteme erişemez.
  - Saldırı yüzeyi yalnızca main process ve preload’un bilinçli olarak expose ettiği yüzeyle sınırlı kalır.

- **contextIsolation: true**  
  Preload script’i ile renderer’ın JavaScript context’i **ayrıdır**. Yani:
  - Renderer’daki `window` objesi, preload’un kendi `window`’undan farklıdır.
  - Preload, sadece `contextBridge.exposeInMainWorld('api', ...)` ile eklediği alanları renderer’a verir; Node veya Electron iç API’leri “sızma” yapmaz.

Sonuç: Renderer tek güvenli giriş kapısı olan `window.api` ile main’e istek atar; doğrudan Node veya SQLite erişimi yoktur. Bu yapı Electron’un resmi güvenlik rehberiyle uyumludur. Ayrıntılar için `docs/SECURITY.md` kullanılabilir.

## 5. Typed IPC sözleşmesi ve akış

### 5.1 Typed IPC sözleşmesi nasıl çalışıyor?

- Ortak tipler: `src/shared/models.ts`.
- IPC kontratları: `src/shared/ipc.ts`:
  - `IpcInvokeMap` – channel → arg/result tipi:
    - Örnek:
      - `'tasks:create': { args: [CreateTaskInput]; result: Result<Task> }`
      - `'timer:getActive': { args: []; result: Result<ActiveTimerSession | null> }`
      - `'vaultSecrets:list': { args: []; result: Result<VaultSecret[]> }`
      - `'reports:getWeekly': { args: [WeeklyReportRequest]; result: Result<WeeklyReportSummary> }`
  - `RendererApi` – preload’un `window.api` altında expose ettiği metodların TypeScript arabirimi.
- Main tarafında (`electron/main/ipc/handlers.ts`):
  - `ipcMain.handle('channel', handler)` çağrıları, `wrap/wrapAsync` fonksiyonları ile `Result<T>` döndürür:
    - Başarılı: `{ ok: true, value: ... }`
    - Hatalı: `{ ok: false, error: AppError }`
- Renderer tarafında:
  - `unwrap` yardımcı fonksiyonları, `Result<T>`’yi açar; hata mesajı UI’da gösterilir.

Typed IPC yaklaşımı sayesinde:

- Yanlış argüman tipleri derleme aşamasında hata verir.
- Main–renderer boundary’si net ve anlaşılırdır.

### 5.2 Typed IPC akışı (adım adım)

Tek bir istek (örneğin “proje listesi”) şu yolu izler:

1. **Renderer** (örn. `ProjectsPage.tsx`):  
   `window.api.projects.list()` çağrılır. Bu, preload’un expose ettiği ve `src/shared/ipc.ts` ile tiplenmiş bir metodtur.

2. **Preload** (`electron/preload/index.ts`):  
   `projects.list`, dahili olarak `ipcRenderer.invoke('projects:list')` ile main’e kanal adı ve argümanları (bu örnekte argüman yok) gönderir. Preload’daki `invoke<C>(channel, ...args)` fonksiyonu, `IpcInvokeMap` sayesinde yalnızca tanımlı kanalları ve doğru argüman tiplerini kabul eder.

3. **Main** (`electron/main/ipc/handlers.ts`):  
   `ipcMain.handle('projects:list', handler)` ile kayıtlı handler çalışır. Handler, ilgili service’i (örn. `ProjectService.list()`) çağırır; service repository üzerinden SQLite’a gider. Dönüş değeri `wrap()` veya `wrapAsync()` ile `Result<Project[]>` formatına çevrilir.

4. **Preload → Renderer**:  
   Promise olarak dönen `Result<Project[]>` renderer’a iletilir. Renderer’da genelde `unwrap(res)` ile `res.ok ? res.value : throw` yapılır ve UI güncellenir.

Bu akışta veritabanına yalnızca main process dokunur; renderer hiçbir zaman SQLite veya Node API’si görmez. Build ve paketleme süreci için `docs/BUILD_AND_RELEASE.md` içindeki “electron-builder build mantığı” ve “GitHub Actions pipeline” bölümlerine bakılabilir.

## 6. SQLite neden sadece main process’te?

- Electron güvenlik rehberine göre Node API’leri ve native modüller sadece main (veya controlled background) süreçlerde kullanılmalıdır.
- `better-sqlite3` bir Node native modülüdür; renderer’da çalıştırmak hem güvenlik hem de bellek açısından risklidir.
- Ayrıca:
  - SQLite dosyasına eşzamanlı erişim (özellikle `better-sqlite3` ile) tek process modelinde daha öngörülebilirdir.
  - Tüm DB işlemleri main process’te toplandığında, logging, transaction yönetimi, encryption vb. cross-cutting mantıklar tek yerde yönetilebilir.

Bu yüzden tüm repository’ler (`electron/main/repositories/*`) ve DB bağlantısı sadece main’de bulunur; renderer sadece typed IPC ile istek yapar.

## 7. Kanban modülü veri akışı

İlgili dosyalar:

- `src/features/tasks/TasksPage.tsx`
- `electron/main/repositories/projectRepository.ts`
- `electron/main/repositories/taskRepository.ts`
- `electron/main/services/projectService.ts`
- `electron/main/services/taskService.ts`
- `src/shared/ipc.ts` (`tasks:*` kanalları)

Akış:

1. Renderer’da `TasksPage` açıldığında:
   - `window.api.projects.list()` ile projeler,
   - Seçilen proje için `window.api.tasks.listByProject(projectId)` ile görevler çekilir.
2. Yeni görev oluşturma:
   - Form → `CreateTaskInput` → `window.api.tasks.create(input)` çağrısı.
   - Main:
     - `TaskService.create` → `TaskRepository.create` → SQLite `tasks` tablosu.
   - Dönen `Task`, React state’ine eklenir.
3. Drag & Drop (dnd-kit):
   - Kartlar `TaskCard` bileşeni ile sürüklenebilir.
   - Sürükleme sonu (`handleDragEnd`):
     - Optimistic olarak local state’te `status` güncellenir.
     - Ardından `window.api.tasks.update({ id, status })` çağrılır.
     - Başarılı olursa `activityLogs.create({ type: 'task.status_changed', ... })` ile event kaydedilir.

Bu sayede Kanban, SQLite verisi üzerinde çalışan, typed ve IPC tabanlı bir modül haline gelir.

## 8. Dosya ekleri AppData’ya nasıl taşınıyor?

İlgili dosyalar:

- `electron/main/paths.ts` – `attachmentsDir` (`userData/attachments`).
- `electron/main/repositories/taskAttachmentRepository.ts`
- `electron/main/services/attachmentFileService.ts`
- `electron/main/ipc/handlers.ts` (`taskAttachments:*` kanalları)
- `src/features/tasks/components/TaskDetailsPanel.tsx`

Akış:

1. Kullanıcı görev detayında “Dosya ekle” butonuna basar.
2. Renderer:
   - `window.api.taskAttachments.pickAndAttach(task.id)` çağırır.
3. Preload:
   - `ipcRenderer.invoke('taskAttachments:pickAndAttach', taskId)`.
4. Main (`AttachmentFileService.pickAndAttach`):
   - `dialog.showOpenDialog` ile OS dosya seçim penceresi açılır.
   - Kullanıcının seçtiği dosya **orijinal yerinde bırakılır**; `fs.copyFileSync` ile:
     - `attachments/{projectId}/{taskId}/{uuid}.ext` altına kopyalanır.
   - MIME type basit bir uzantı tablosu ile belirlenir.
   - `TaskAttachmentRepository.create` ile SQLite tablosuna metadata yazılır:
     - `original_name`, `stored_name`, `stored_path` (relative), `mime_type`, `size`.
   - Path traversal’dan kaçınmak için tüm path’ler `attachmentsDir` altında kalacak şekilde `assertWithinRoot` ile doğrulanır.
5. Renderer tarafına dönen `TaskAttachment`, görev detayındaki ek listesine eklenir.
6. “Dosyayı aç” / “Klasörde göster” / “Sil”:
   - Sırasıyla:
     - `shell.openPath(absPath)`
     - `shell.showItemInFolder(absPath)`
     - `fs.unlinkSync(absPath)` + `DELETE FROM task_attachments` kombinasyonu ile gerçekleştirilir.
   - Her silme için `activity_log`’a `attachment_removed` event’i kaydedilir.

## 9. Timer ve idle auto-stop mantığı

İlgili dosyalar:

- `electron/main/db/migrate.ts` (`active_timer` tablosu)
- `electron/main/repositories/activeTimerRepository.ts`
- `electron/main/repositories/timeEntryRepository.ts`
- `electron/main/services/timerService.ts`
- `electron/main/services/idleTimerService.ts`
- `src/lib/timerStore.ts`
- `src/features/tasks/components/TaskDetailsPanel.tsx`
- `src/features/timer/TimerPage.tsx`

Ana fikir:

- **Tek aktif sayaç**: `active_timer` tablosu (id=1) sadece bir aktif oturum tutar.
- `TimerService.start(taskId, startTime)`:
  - Eğer başka görev aktifse `ConflictError` fırlatır.
  - Değilse `active_timer`’a yazar.
- `TimerService.stop(endTime, source)`:
  - `active_timer`’ı okur, süreyi hesaplar (`durationSeconds`) ve `time_entries` tablosuna yazar.
  - Sonra `active_timer`’ı temizler.
- `IdleTimerService`:
  - `powerMonitor.getSystemIdleTime()` ile periyodik olarak sistem idle süresini ölçer.
  - 10 dakikayı aştığında ve aktif timer varsa:
    - `TimerService.stop(now, 'auto_stop')`
    - `activity_log`:
      - `idle_detected`
      - `timer_auto_stopped`
    - Native notification ile kullanıcı bilgilendirilir.
- Renderer tarafında:
  - `timerStore` global store’u:
    - `timer:getActive` ile initial state’i çeker.
    - `setInterval` ile `nowMs` güncelleyerek UI’da saniye saniye artan süre gösterir.
  - Görev detayında ve sidebar’da “Başlat / Durdur” butonları `window.api.timer.start / stop` üzerinden çalışır.

## 10. Tray davranışı

İlgili dosyalar:

- `electron/main/index.ts`
- `electron/main/window.ts`

Beklenen davranış:

- Pencere **kapatıldığında** uygulama tamamen çıkmasın, tray’e gizlensin.
- “Çıkış” işleminden sonra gerçekten kapansın.

Gerçekleşen mimari:

- `window.ts`:
  - `allowClose` flag’i ve `markAllowClose()` fonksiyonu.
  - `BrowserWindow`’un `close` event’inde:
    - Eğer `allowClose === false` ise:
      - `event.preventDefault()`
      - Windows: `win.hide()`
      - macOS: `app.hide()`
- `index.ts`:
  - `createAppTray()` içinde:
    - Tray menüsü:
      - “Uygulamayı Göster”
      - “Gizle”
      - “Çıkış” → `markAllowClose()` + `app.quit()`
  - `window-all-closed` → `app.quit()` yapmıyor; böylece arka planda çalışmaya devam ediyor.
  - `before-quit`’te DB bağlantısı kapanıyor ve tray yok ediliyor.

Bu sayede timer ve idle detection arka planda çalışmaya devam edebiliyor.

## 11. Vault şifreleme akışı (yüksek seviye)

Ayrıntılı güvenlik detayları `docs/SECURITY.md` içinde; burada mimari seviyesi:

- **Amaç**: Kullanıcı notlarını asla plaintext olarak DB’de saklamadan, AES-256-GCM ile şifrelenmiş halde tutmak.
- Master key:
  - İlk kullanımda kullanıcıdan alınır ve PBKDF2 ile **256-bit** anahtar türetilir (`electron/main/services/vaultKeyService.ts`).
  - DB’de sadece metadata tutulur (`app_settings` tablosu):
    - `vault_salt` (base64)
    - `vault_iterations` (string sayı)
    - `vault_key_verifier` (sha256(derivedKey) hex)
  - Master key ve derived key **diske yazılmaz**; derived key sadece main process RAM’inde tutulur.
- Not şifreleme:
  - Not gövdesi (string) AES-256-GCM ile şifrelenir (`electron/main/services/vaultCryptoService.ts`).
  - `vault_secrets.enc_payload_json` sadece şunları içerir:
    - `iv`, `ciphertext`, `authTag` (base64)
  - KDF salt/iterations her notta tekrar yazılmaz; kasa seviyesinde `app_settings`’te tutulur.
- Vault servis katmanı:
  - `electron/main/services/vaultService.ts` encrypt/decrypt işini main’de yapar.
  - Renderer sadece typed IPC ile:
    - `window.api.vault.getStatus / unlock / lock`
    - `window.api.vaultSecrets.create/get/update/delete`
    çağrılarını yapar.

## 12. Rapor ve PDF export mantığı

İlgili dosyalar:

- `electron/main/services/reportService.ts`
- `electron/main/ipc/handlers.ts` (`reports:*`)
- `src/features/reports/ReportsPage.tsx`
- `src/features/reports/components/*.tsx`

Akış:

- Haftalık rapor:
  - `reports:getWeekly` handler’ı, `ReportService.getWeeklyReport` üzerinden:
    - Zaman kayıtlarından (`time_entries`) haftalık metrikleri hesaplar.
  - Renderer bu veriyi Chart.js grafikleri ve tablo ile gösterir.
- PDF export:
  - Kullanıcı “PDF İndir” butonuna basar (`ReportsPage`).
  - Renderer → `window.api.reports.exportWeeklyPdf(request)`.
  - Preload → `ipcRenderer.invoke('reports:exportWeeklyPdf', request)`.
  - Main (`electron/main/ipc/handlers.ts`):
    - `dialog.showSaveDialog` ile path seçtirir.
    - Aynı `webContents.printToPDF({ printBackground: true, pageSize: 'A4' })` ile PDF üretir.
    - `fs.writeFileSync` ile dosyayı seçilen path’e yazar.
  - Print CSS (`@media print`) ile titlebar, sidebar vb. gizlenerek sadece rapor içeriği PDF’e girer.

---

Bu mimari dosyası ile, savunmada “sistem mimarisi” slaydını ve kod turunu rahatça anlatabilecek net bir referans döküman hazırlanmış olur.
