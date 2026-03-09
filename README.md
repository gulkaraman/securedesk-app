# SecureDesk App (YerelSuit)

Electron, React, TypeScript ve SQLite ile geli+þtirilmi+þ, tamamen yerel +ðal¦-+þan g+-venli masa+-st+- uygulamas¦-. G+Ârev y+Ânetimi (Kanban), zaman takibi, +þifreli veri kasas¦- ve haftal¦-k raporlar sunar.

---

## Proje +Âzeti

YerelSuit, a¦þ eri+þimi gerektirmeyen bir **i+þ ve kaynak y+Ânetim** uygulamas¦-d¦-r:

- **G+Ârev y+Ânetimi** ÔÇô Kanban tahtas¦- (`todo` / `in_progress` / `done`), proje bazl¦- g+Ârevler, s+-r+-kle-b¦-rak.
- **Zaman takibi** ÔÇô G+Ârev bazl¦- tek aktif timer, idle s+-re sonunda otomatik durdurma.
- **+Þifreli kasa** ÔÇô AES-256-GCM + PBKDF2 ile +þifrelenmi+þ notlar.
- **Raporlar** ÔÇô Haftal¦-k +Âzet, grafikler ve PDF d¦-+þa aktarma.

T+-m veri yerel SQLite veritaban¦-nda tutulur; uygulama tamamen offline +ðal¦-+þ¦-r.

---

## Kullan¦-lan teknolojiler

| Alan | Teknoloji |
|------|-----------|
| Masa+-st+- | **Electron** (main / preload / renderer) |
| UI | **React 19** + **Vite** (electron-vite) |
| Dil | **TypeScript** (strict mod) |
| Veritaban¦- | **SQLite** (better-sqlite3, sadece main process) |
| Grafikler | **Chart.js** |
| Paketleme | **electron-builder** (Windows portable `.exe`, opsiyonel mac/linux) |
| Kalite | **ESLint**, **typescript-eslint** |
| CI/CD | **GitHub Actions** |

---

## Kurulum ad¦-mlar¦-

**Gereksinimler:** Node.js **20** (LTS), npm.

1. Depoyu klonlay¦-n ve proje k+Âk+-ne gidin:

   ```bash
   git clone <repo-url>
   cd elecjs
   ```

2. Ba¦þ¦-ml¦-l¦-klar¦- y+-kleyin (lockfile ile tutarl¦- kurulum):

   ```bash
   npm ci
   ```

   `postinstall` ile native mod+-ller (better-sqlite3) Electron s+-r+-m+-ne g+Âre derlenir.

3. Geli+þtirme sunucusunu ba+þlat¦-n:

   ```bash
   npm run dev
   ```

   Electron penceresi a+ð¦-l¦-r; main, preload ve renderer hot-reload ile +ðal¦-+þ¦-r.

---

## Geli+þtirme komutlar¦-

| Komut | A+ð¦-klama |
|-------|----------|
| `npm run dev` | Electron + Vite geli+þtirme modu (hot-reload) |
| `npm run typecheck` | TypeScript strict kontrol+- (`tsc --noEmit`) |
| `npm run lint` | ESLint (t+-m proje) |
| `npm run rebuild:native` | Native mod+-lleri Electron i+ðin yeniden derler |

+ûnerilen ak¦-+þ: de¦þi+þiklik sonras¦- `npm run typecheck` ve `npm run lint` ile hatalar¦- yakalay¦-n.

---

## Build komutlar¦-

**Sadece uygulama derlemesi (paketleme yok):**

```bash
npm run build
```

- **+ç¦-kt¦-:** `out/` klas+Âr+-  
  - `out/main/index.js` ÔÇô main process  
  - `out/preload/index.js` ÔÇô preload script  
  - `out/renderer/` ÔÇô React uygulamas¦- (HTML, CSS, JS)

Bu ad¦-m CIÔÇÖda **validate** jobÔÇÖ¦-nda da +ðal¦-+þ¦-r; typecheck ve lint sonras¦- build al¦-n¦-r.

---

## Dist / .exe alma ad¦-mlar¦-

Windows i+ðin tek ta+þ¦-nabilir `.exe` +-retmek:

```bash
npm run dist
```

Bu komut s¦-rayla:

1. `npm run build` ile `out/` +-retir.
2. `electron-builder` ile Windows portable paket olu+þturur.

**+ç¦-kt¦- konumu:** `dist/`

| +ç¦-kt¦- | A+ð¦-klama |
|-------|----------|
| `dist/YerelSuit-1.0.0.exe` | Tek dosya portable uygulama (kurulumsuz +ðal¦-+þt¦-r¦-labilir) |
| `dist/win-unpacked/` | A+ð¦-lm¦-+þ paket (test / debug i+ðin) |

**Not:** `package.json` i+ðindeki `build` alan¦-nda `appId`, `productName`, `directories.output`, `files` ve `win.target` (portable) tan¦-ml¦-d¦-r. Mac/Linux i+ðin config haz¦-rd¦-r; ilgili OSÔÇÖte veya `electron-builder -m` / `-l` ile paket al¦-nabilir.

---

## GitHub Actions ve build ad¦-mlar¦-

### Workflow dosyalar¦-

- **`.github/workflows/ci.yml`** ÔÇô ¦-ki a+þamal¦- pipeline (validate on Ubuntu, package on Windows).
- **`.github/workflows/build.yml`** ÔÇô Tek jobÔÇÖda typecheck, build ve dist (Windows runner).

### build.yml ad¦-mlar¦-

**Tetikleyiciler:** `push` ve `pull_request` (t+-m branchÔÇÖler).

**Job: Build** (`windows-latest`)

1. **Checkout** ÔÇô Repo kodu al¦-n¦-r.
2. **Setup Node.js** ÔÇô Node 20, npm cache.
3. **Install dependencies** ÔÇô `npm ci`
4. **TypeScript** ÔÇô `npm run typecheck`
5. **Build** ÔÇô `npm run build`
6. **Dist (electron-builder)** ÔÇô `npm run dist` (Windows `.exe` +-retimi).
7. **Upload Windows artifact** ÔÇô `dist/**` ÔåÆ artifact ad¦-: `windows-portable`.

### Yerel build s¦-ras¦-

```bash
npm ci
npm run typecheck
npm run build
npm run dist
```

+ç¦-kt¦-: `dist/YerelSuit-1.0.0.exe` (portable).

### ci.yml (+Âzet)

| Job        | Runner           | Ad¦-mlar |
|-----------|------------------|--------|
| **validate** | `ubuntu-latest`  | `npm ci` ÔåÆ `npm run typecheck` ÔåÆ `npm run lint` ÔåÆ `npm run build` |
| **package**  | `windows-latest` | `npm ci` ÔåÆ `npm run dist` ÔåÆ Upload artifact |

Branch protection ile ÔÇ£Require status checksÔÇØ kullan¦-larak pipeline ye+þil olmadan merge engellenebilir.

---

## Teslimat kontrol listesi

Bu proje a+þa¦þ¦-daki teslimat kriterlerine g+Âre haz¦-rd¦-r:

- GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`, `.github/workflows/build.yml`)
- `push` ve `pull_request` tetikleyicileri (t+-m branchÔÇÖler)
- PipelineÔÇÖda TypeScript kontrol+- (`npm run typecheck`)
- PipelineÔÇÖda build (`npm run build`)
- PipelineÔÇÖda electron-builder ile Windows paketleme (`npm run dist`)
- Windows i+ðin `.exe` +-retimi (`dist/YerelSuit-1.0.0.exe`)
- G+-ncel README (kurulum, komutlar, pipeline, dok+-mantasyon linkleri)
- Teknik savunma dok+-manlar¦-: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/BUILD_AND_RELEASE.md`, `docs/TECHNICAL_CHALLENGE.md`
- Kod kalitesi: strict TypeScript, ESLint, merkezi `unwrap`, kritik yerlerde a+ð¦-klay¦-c¦- yorumlar

---

## Dok+-mantasyon

Detayl¦- teknik dok+-mantasyon `docs/` alt¦-ndad¦-r:

- **`docs/ARCHITECTURE.md`** ÔÇô Mimari, main/preload/renderer, IPC, veritaban¦-
- **`docs/SECURITY.md`** ÔÇô G+-venlik ve +þifreleme
- **`docs/BUILD_AND_RELEASE.md`** ÔÇô Build, paketleme ve CI/CD detaylar¦-
- **`docs/TECHNICAL_CHALLENGE.md`** ÔÇô Teknik zorluklar ve +ð+Âz+-mler

---

## Lisans

ISC (bkz. `package.json`).

