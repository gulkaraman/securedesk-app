# BUILD AND RELEASE

Bu dosya, projenin nasıl derlendiğini, paketlendiğini ve CI/CD boru hattının nasıl çalıştığını açıklar.

## 1. Geliştirme komutları

- **Kurulum**:

  ```bash
  npm ci
  ```

- **Geliştirme (hot-reload)**:

  ```bash
  npm run dev
  ```

  Bu komut:

  - electron-vite dev server’ını başlatır.
  - React renderer hot-reload ile çalışır.
  - Main ve preload tarafında kod değişiklikleri de hızlıca yeniden derlenir.

## 2. TypeScript ve lint kontrolleri

- **Typecheck**:

  ```bash
  npm run typecheck
  ```

  - `tsconfig.json` strict ayarlarla (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` vs).
  - Main, preload ve renderer kodu aynı TS projesi içinde derlenir.

- **Lint**:

  ```bash
  npm run lint
  ```

  - Flat config (`eslint.config.js`) ile TS + React kuralları.
  - Hatalar CI’da pipeline’ı kırar.

## 3. Prod build (electron-vite)

- **Komut**:

  ```bash
  npm run build
  ```

  Bu komut `electron-vite build` çalıştırır ve üç hedefi derler:

  - `out/main/index.js` – Electron main process bundle’ı.
  - `out/preload/index.js` – preload bundle’ı.
  - `out/renderer/**` – React/Vite üretim çıktıları (`index.html`, `assets/*.js` / `*.css`).

`package.json` içindeki `"main": "out/main/index.js"` alanı, prod ortamda Electron’un bu entry file’ı kullanmasını sağlar.

## 4. Paketleme (electron-builder)

- **Komut**:

  ```bash
  npm run dist
  ```

  Bu komut önce `npm run build`, ardından `electron-builder` çalıştırır.

### 4.1 electron-builder build mantığı

Adımlar özetle şöyledir:

1. **Girdi hazırlığı**  
   `npm run build` zaten çalıştırıldığı için `out/main/index.js`, `out/preload/index.js` ve `out/renderer/**` mevcuttur. `package.json` içindeki `"main": "out/main/index.js"` alanı, paketlenmiş uygulamanın giriş noktası olarak kullanılır.

2. **Packaging listesi**  
   `package.json` → `build.files` ile hangi dosyaların pakete dahil edileceği belirlenir: `out/**`, `node_modules/**`, `package.json`. Kaynak kod (örn. `src/`, `electron/main/*.ts`) dahil edilmez; sadece derlenmiş çıktı ve bağımlılıklar girer.

3. **Native modül yeniden derleme**  
   electron-builder, hedef platform (örn. Windows x64) için `better-sqlite3` gibi native modülleri Electron’un Node sürümüyle uyumlu olacak şekilde yeniden derler (`@electron/rebuild`). Böylece paketlenmiş uygulama içinde doğru `.node` binary’si kullanılır.

4. **ASAR arşivi**  
   Dahil edilen dosyalar (main, preload, renderer, node_modules) tek bir `app.asar` dosyasına arşivlenir. `build.asarUnpack: ["**/*.node"]` sayesinde native modüller asar dışında bırakılır (`app.asar.unpacked`) ve çalışma zamanında yüklenebilir.

5. **Windows çıktısı**  
   - Önce `dist/win-unpacked/` üretilir: Electron runtime, `resources/app.asar`, `app.asar.unpacked`, locale dosyaları vb.
   - `win.target: ["portable"]` ile bu klasör tek bir taşınabilir `.exe` dosyasına sarılır.
   - `win.artifactName: "${productName}-${version}.${ext}"` ile dosya adı `YerelSuit-1.0.0.exe` olur.

Sonuç: Kullanıcı `dist/YerelSuit-1.0.0.exe` dosyasını kurulum yapmadan çalıştırabilir; veri `%APPDATA%` (userData) altında tutulur.

### 4.2 Config özeti (`package.json` → `build`)

- `appId`: `com.local.suite`
- `productName`: `YerelSuit`
- `directories.output`: `dist`
- `files`: `out/**`, `node_modules/**`, `package.json`
- `asar: true`, `asarUnpack`: `["**/*.node"]`
- `win.target`: `["portable"]`, `artifactName`: `"${productName}-${version}.${ext}"`

**Çıktı**: `dist/YerelSuit-1.0.0.exe` (portable), `dist/win-unpacked/` (açılmış paket).

## 5. CI/CD – GitHub Actions

Workflow dosyası: `.github/workflows/ci.yml`

### 5.1 Tetikleyiciler

- **push** – tüm branch’ler
- **pull_request** – tüm branch’ler

### 5.2 GitHub Actions pipeline akışı

```
push / pull_request
        │
        ▼
┌───────────────────────────────────────┐
│  Job: validate (ubuntu-latest)         │
│  • Checkout                            │
│  • Node 20 + npm cache                 │
│  • npm ci                              │
│  • npm run typecheck                   │
│  • npm run lint                        │
│  • npm run build                       │
└───────────────────────────────────────┘
        │
        │ başarılı ise
        ▼
┌───────────────────────────────────────┐
│  Job: package (windows-latest)         │
│  • Checkout                            │
│  • Node 20 + npm cache                 │
│  • npm ci                              │
│  • npm run dist  (build + electron-    │
│                   builder)             │
│  • Upload artifact: dist/**            │
│    name: windows-portable              │
└───────────────────────────────────────┘
```

- **validate** job’ı typecheck, lint ve electron-vite build’ini yapar; biri bile hata verirse pipeline kırmızı olur.
- **package** job’ı yalnızca `validate` başarılıysa çalışır; Windows üzerinde `npm run dist` ile gerçek `.exe` üretimini doğrular ve `dist/**` çıktısını `windows-portable` adlı artifact olarak yükler.
- Branch protection ile “Require status checks” açılıp bu job’lar zorunlu kılınarak, pipeline yeşil olmadan merge engellenebilir.

### 5.3 validate job (Ubuntu)

- **Runs on:** `ubuntu-latest`
- **Steps:** Checkout → Setup Node.js 20 (cache: npm) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm run build`

Bu job, her push/PR’da tip hatalarının, lint hatalarının olmamasını ve electron-vite prod build’inin başarıyla tamamlanmasını garanti eder.

### 5.4 package job (Windows)

- **Runs on:** `windows-latest`
- **Needs:** `validate`
- **Steps:** Checkout → Setup Node.js 20 (cache: npm) → `npm ci` → `npm run dist` → Upload artifact `dist/**` (name: `windows-portable`)

Bu job, Windows ortamında native modüllerin (better-sqlite3) doğru derlendiğini ve `YerelSuit-1.0.0.exe` üretiminin hatasız tamamlandığını doğrular.

### 5.5 Pipeline başarısızlıkları

Olası failure noktaları:

- **Typecheck hataları**: TS tip sorunları, strict moddaki eksik alanlar.
- **Lint hataları**: Güvenlik/pattern kurallarına aykırı kullanımlar (ör. `any`, unsafe template literal vs).
- **Build hataları**: electron-vite veya electron-builder asset/path sorunları.

Scriptler bu hataları net göstermesi için sade tutulmuştur; karmaşık `&&` zincirleri yerine ayrı adımlar kullanılmıştır.

## 6. Lokal dist doğrulama

Lokal olarak CI’ya benzer bir süreç çalıştırmak için:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run dist
```

Bu adımların tamamı başarıyla geçtiğinde:

- Electron main/preload/renderer kodu tip ve lint açısından temizdir.
- Prod build hattı (electron-vite) sorun çıkarmaz.
- Paketleme hattı (electron-builder) Windows portable `.exe` (`YerelSuit-1.0.0.exe`) üretir.

## 7. Savunmada vurgulanabilecek build noktaları

- “CI’da hem electron-vite build’i hem de electron-builder dist’i çalıştırıyoruz; sadece test değil, gerçek paketleme senaryosunu da doğruluyoruz.”
- “Strict TypeScript ve ESLint kuralları pipeline’da zorunlu; console’da sarı uyarılar değil, kırmızı hatalar olarak değerlendirilir.”
- “Windows runner üzerinde çalıştırılan dist job’u, native modüllerin gerçekten Windows ortamına uygun build edildiğini garantiliyor.”

