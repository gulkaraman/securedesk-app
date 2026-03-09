import type Database from 'better-sqlite3'

function startOfWeekMs(baseMs: number): number {
  const d = new Date(baseMs)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const ROLES = [
  'Yazılım Geliştirici',
  'Proje Yöneticisi',
  'UI/UX Tasarımcı',
  'Test Uzmanı',
  'DevOps Mühendisi',
  'İş Analisti',
  'Backend Geliştirici'
] as const

const FIRST_NAMES = [
  'Ahmet', 'Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Zeynep', 'Mustafa',
  'Elif', 'Emre', 'Selin', 'Burak', 'Deniz', 'Can', 'Ece',
  'Kaan', 'Özge', 'Murat', 'Aslı', 'Barış', 'Ceren', 'Volkan', 'Derya',
  'Onur', 'Gamze', 'Serkan', 'Pınar', 'Uğur', 'Merve', 'Kerem', 'İrem',
  'Oğuz', 'Seda', 'Taner', 'Yelda', 'Berk', 'Tuğba', 'Cem', 'Gül',
  'Efe', 'Melis', 'Koray', 'Damla'
]

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Arslan', 'Öztürk',
  'Koç', 'Aydın', 'Yıldız', 'Doğan', 'Özdemir', 'Kılıç', 'Polat',
  'Erdoğan', 'Şahin', 'Çetin', 'Korkmaz', 'Özkan', 'Yalçın', 'Aksoy', 'Güneş',
  'Taş', 'Kurt', 'Özer', 'Arslan', 'Güler', 'Koçak', 'Erdem', 'Tunç',
  'Kara', 'Öztürk', 'Bozkurt', 'Çelik', 'Eren', 'Yavuz', 'Acar', 'Tekin',
  'Keskin', 'Bulut', 'Sönmez', 'Gündüz'
]

/**
 * TUG test için aşırı miktarda örnek veri: 250 kullanıcı, her birine 8-9 görev (~2125 görev, binlerce süre kaydı).
 * Sadece hiç kullanıcı yoksa çalışır.
 */
export function seedDemoData(db: Database.Database): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c
  if (count > 0) return

  const ts = Date.now()
  const weekStart = startOfWeekMs(ts)
  const dayMs = 24 * 60 * 60 * 1000

  const insertUser = db.prepare(
    'INSERT INTO users (first_name, last_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  const users: { id: number; firstName: string; lastName: string; role: string }[] = []
  const numUsers = 250
  for (let i = 0; i < numUsers; i += 1) {
    const baseFirst = FIRST_NAMES[i % FIRST_NAMES.length] ?? 'User'
    const baseLast = LAST_NAMES[i % LAST_NAMES.length] ?? 'Name'
    const batch = Math.floor(i / FIRST_NAMES.length) + 1
    const firstName = batch > 1 ? `${baseFirst} ${String(batch)}` : baseFirst
    const lastName = batch > 1 ? `${baseLast} ${String(batch)}` : baseLast
    const role = ROLES[i % ROLES.length] ?? ROLES[0]
    const info = insertUser.run(firstName, lastName, role, ts, ts)
    users.push({
      id: Number(info.lastInsertRowid),
      firstName,
      lastName,
      role
    })
  }

  const insertProject = db.prepare(
    'INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)'
  )
  const projectRows: [string, string][] = [
    ['Web Uygulaması', 'Ana kurumsal web uygulaması geliştirme ve bakımı'],
    ['Mobil Uygulama', 'iOS ve Android mobil uygulama projesi'],
    ['API ve Entegrasyon', 'REST API ve üçüncü taraf entegrasyonları'],
    ['Altyapı ve DevOps', 'CI/CD, sunucu ve konteyner yönetimi']
  ]
  const projectIds: number[] = []
  for (const [name, desc] of projectRows) {
    const info = insertProject.run(name, desc, ts, ts)
    projectIds.push(Number(info.lastInsertRowid))
  }

  interface TaskRow {
    projectIndex: number
    title: string
    description: string
    status: 'todo' | 'in_progress' | 'done'
    priority: number
  }

  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, title, description, status, priority, assigned_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const tasksByUser: number[][] = []

  const taskTemplates: TaskRow[][] = [
    [
      { projectIndex: 0, title: 'Ana sayfa bileşenlerini refaktör et', description: 'React bileşenlerini modüler hale getir, performans iyileştirmesi yap.', status: 'done', priority: 2 },
      { projectIndex: 0, title: 'Kullanıcı giriş API entegrasyonu', description: 'JWT tabanlı auth endpoint ile frontend entegrasyonu tamamlanacak.', status: 'done', priority: 1 },
      { projectIndex: 0, title: 'Dashboard grafik bileşenleri', description: 'Chart.js ile raporlama grafikleri ekle ve veri bağla.', status: 'in_progress', priority: 3 },
      { projectIndex: 1, title: 'Profil sayfası tasarımı', description: 'Kullanıcı profil sayfası UI ve form validasyonları.', status: 'in_progress', priority: 2 },
      { projectIndex: 0, title: 'Bildirim sistemi (toast)', description: 'Global bildirim bileşeni ve hata/success mesajları.', status: 'todo', priority: 1 },
      { projectIndex: 2, title: 'WebSocket canlı güncelleme', description: 'Gerçek zamanlı veri güncellemeleri için WS bağlantısı.', status: 'todo', priority: 2 },
      { projectIndex: 0, title: 'Erişilebilirlik (a11y) iyileştirmeleri', description: 'ARIA etiketleri, klavye navigasyonu, ekran okuyucu uyumu.', status: 'todo', priority: 2 },
      { projectIndex: 1, title: 'Offline mod ve cache stratejisi', description: 'Service worker ve IndexedDB ile çevrimdışı destek.', status: 'todo', priority: 3 },
      { projectIndex: 2, title: 'API hata yönetimi ve retry', description: 'İstek hatası durumunda retry ve kullanıcı bilgilendirmesi.', status: 'in_progress', priority: 1 }
    ],
    [
      { projectIndex: 0, title: 'Sprint planlama toplantı notları', description: 'Haftalık sprint hedefleri ve görev dağılımı dokümante edilecek.', status: 'done', priority: 1 },
      { projectIndex: 1, title: 'Mobil proje risk analizi', description: 'Mobil tarafta tespit edilen riskler ve azaltma planları.', status: 'done', priority: 2 },
      { projectIndex: 0, title: 'Stakeholder raporu hazırlama', description: 'Aylık ilerleme raporu ve metrik özeti sunumu.', status: 'in_progress', priority: 1 },
      { projectIndex: 2, title: 'Entegrasyon zaman çizelgesi', description: 'Üçüncü taraf API entegrasyonları için zaman planı.', status: 'in_progress', priority: 2 },
      { projectIndex: 0, title: 'Takım kapasite planlaması', description: 'Sonraki çeyrek için görev-kapasite eşleştirmesi.', status: 'todo', priority: 2 },
      { projectIndex: 1, title: 'Mobil release checklist güncelle', description: 'Store yayın öncesi kontrol listesini güncelle.', status: 'todo', priority: 1 },
      { projectIndex: 0, title: 'Retrospective aksiyon takibi', description: 'Son sprint retro aksiyonlarının tamamlanma durumu.', status: 'todo', priority: 2 },
      { projectIndex: 2, title: 'API SLA dokümantasyonu', description: 'Dış API’ler için SLA ve destek süreçleri dokümanı.', status: 'in_progress', priority: 1 }
    ],
    [
      { projectIndex: 0, title: 'Ana sayfa wireframe revizyonu', description: 'Yeni bilgi hiyerarşisine göre wireframe güncellemesi.', status: 'done', priority: 1 },
      { projectIndex: 1, title: 'Mobil navigasyon akışı', description: 'Bottom tab ve deep link yapısı için akış çizimi.', status: 'done', priority: 2 },
      { projectIndex: 0, title: 'Tasarım sistemi renk paleti', description: 'Light/dark tema renkleri ve erişilebilirlik kontrastı.', status: 'in_progress', priority: 2 },
      { projectIndex: 1, title: 'Onboarding ekranları mockup', description: 'İlk kullanım için 3 ekranlık onboarding tasarımı.', status: 'in_progress', priority: 3 },
      { projectIndex: 0, title: 'Form bileşenleri kütüphanesi', description: 'Input, select, checkbox vb. ortak bileşen tasarımları.', status: 'todo', priority: 2 },
      { projectIndex: 2, title: 'API dokümantasyon sayfası UI', description: 'Swagger/OpenAPI görüntüleme arayüzü tasarımı.', status: 'todo', priority: 1 },
      { projectIndex: 0, title: 'Boş durum (empty state) illüstrasyonları', description: 'Liste/arama boş olduğunda gösterilecek görseller.', status: 'todo', priority: 2 },
      { projectIndex: 1, title: 'Profil düzenleme ekranı', description: 'Kullanıcı bilgisi ve avatar düzenleme ekranı tasarımı.', status: 'in_progress', priority: 2 }
    ],
    [
      { projectIndex: 0, title: 'Login akışı E2E testleri', description: 'Giriş, çıkış ve session süresi senaryoları yazılacak.', status: 'done', priority: 1 },
      { projectIndex: 2, title: 'API birim testleri (auth modülü)', description: 'JWT üretimi ve doğrulama testleri.', status: 'done', priority: 2 },
      { projectIndex: 1, title: 'Mobil build smoke test', description: 'Her release öncesi kritik akışların çalıştığından emin ol.', status: 'in_progress', priority: 1 },
      { projectIndex: 0, title: 'Dashboard performans testi', description: 'Büyük veri setinde render süresi ve bellek kullanımı.', status: 'in_progress', priority: 2 },
      { projectIndex: 2, title: 'Yük testi raporu', description: 'API endpoint’leri için yük testi senaryoları ve sonuçları.', status: 'todo', priority: 2 },
      { projectIndex: 0, title: 'Erişilebilirlik test checklist', description: 'WCAG 2.1 AA kriterlerine göre manuel test listesi.', status: 'todo', priority: 1 },
      { projectIndex: 1, title: 'Regresyon test paketi güncelle', description: 'Yeni özellikler eklenerek regresyon suite güncellenecek.', status: 'todo', priority: 2 },
      { projectIndex: 0, title: 'Kullanıcı kabul kriterleri doğrulama', description: 'Sprint US’leri için UAT senaryolarının geçtiğini doğrula.', status: 'in_progress', priority: 1 }
    ],
    [
      { projectIndex: 3, title: 'CI pipeline yaml güncellemesi', description: 'Yeni test adımları ve artifact saklama ayarları.', status: 'done', priority: 1 },
      { projectIndex: 3, title: 'Staging ortamı Docker Compose', description: 'Tek komutla ayağa kalkan staging ortamı tanımı.', status: 'done', priority: 2 },
      { projectIndex: 3, title: 'Production log toplama', description: 'Merkezi log toplama ve retention politikası.', status: 'in_progress', priority: 1 },
      { projectIndex: 2, title: 'API rate limiting konfigürasyonu', description: 'Endpoint bazlı limit ve throttle ayarları.', status: 'in_progress', priority: 2 },
      { projectIndex: 3, title: 'Yedekleme ve restore prosedürü', description: 'DB yedekleme zamanlaması ve restore testi dokümanı.', status: 'todo', priority: 1 },
      { projectIndex: 3, title: 'SSL sertifika yenileme otomasyonu', description: 'Let’s Encrypt yenileme ve uyarı süreci.', status: 'todo', priority: 2 },
      { projectIndex: 3, title: 'Kubernetes resource limitleri', description: 'Pod memory/CPU limit ve request değerlerinin gözden geçirilmesi.', status: 'todo', priority: 2 },
      { projectIndex: 2, title: 'Health check endpoint’leri', description: 'Liveness ve readiness probe’ların eklenmesi.', status: 'in_progress', priority: 1 }
    ],
    [
      { projectIndex: 0, title: 'Kullanıcı ihtiyaç anketi sonuçları', description: 'Ürün kullanım anketi verilerinin analizi ve özeti.', status: 'done', priority: 1 },
      { projectIndex: 2, title: 'API kullanım metrikleri raporu', description: 'Endpoint çağrı sayıları ve ortalama yanıt süreleri.', status: 'done', priority: 2 },
      { projectIndex: 0, title: 'Yeni özellik gereksinim dokümanı', description: 'Raporlama modülü için detaylı gereksinimler.', status: 'in_progress', priority: 2 },
      { projectIndex: 1, title: 'Mobil kullanım istatistikleri', description: 'Ekran geçişleri ve event analizi özeti.', status: 'in_progress', priority: 1 },
      { projectIndex: 0, title: 'Rakip ürün karşılaştırması', description: 'Rakip özellik matrisi ve fırsat alanları.', status: 'todo', priority: 2 },
      { projectIndex: 2, title: 'Entegrasyon iş kuralları', description: 'Harici sistemlerle veri eşleme ve validasyon kuralları.', status: 'todo', priority: 1 },
      { projectIndex: 0, title: 'Kullanıcı hikayesi kabul kriterleri', description: 'Backlog’daki US’ler için AC yazımı.', status: 'todo', priority: 2 },
      { projectIndex: 1, title: 'Release notları taslağı', description: 'Son sürüm için kullanıcı odaklı release notları.', status: 'in_progress', priority: 1 }
    ],
    [
      { projectIndex: 2, title: 'Kullanıcı CRUD API endpoint’leri', description: 'REST: list, get, create, update, delete kullanıcı.', status: 'done', priority: 1 },
      { projectIndex: 2, title: 'Görev filtreleme ve sayfalama', description: 'Query parametreleri ile filtreleme ve limit/offset.', status: 'done', priority: 2 },
      { projectIndex: 2, title: 'Zaman kaydı toplu export API', description: 'Tarih aralığına göre time_entries export endpoint.', status: 'in_progress', priority: 2 },
      { projectIndex: 0, title: 'Raporlama servisi optimizasyonu', description: 'Haftalık rapor sorgusunun indeks ve sorgu iyileştirmesi.', status: 'in_progress', priority: 1 },
      { projectIndex: 2, title: 'Webhook payload doğrulama', description: 'İmza ve payload bütünlüğü kontrolü.', status: 'todo', priority: 2 },
      { projectIndex: 2, title: 'Bulk task status güncelleme', description: 'Çoklu görev durumu güncelleme endpoint’i.', status: 'todo', priority: 1 },
      { projectIndex: 2, title: 'API versiyonlama stratejisi', description: 'v1 prefix ve deprecation politikası dokümanı.', status: 'todo', priority: 2 },
      { projectIndex: 0, title: 'Önbellek invalidation kuralları', description: 'Veri değişiminde cache temizleme akışı.', status: 'in_progress', priority: 1 }
    ]
  ]

  for (let u = 0; u < users.length; u += 1) {
    const user = users[u]
    if (!user) continue
    const tasks = taskTemplates[u % taskTemplates.length]
    if (!tasks) continue
    const userTaskIds: number[] = []
    for (const row of tasks) {
      const projectId = projectIds[row.projectIndex]
      if (projectId == null) continue
      const titleSuffix = users.length > 7 ? ` — ${user.firstName}` : ''
      const info = insertTask.run(
        projectId,
        row.title + titleSuffix,
        row.description,
        row.status,
        row.priority,
        user.id,
        ts,
        ts
      )
      userTaskIds.push(Number(info.lastInsertRowid))
    }
    tasksByUser.push(userTaskIds)
  }

  const insertTimeEntry = db.prepare(
    `INSERT INTO time_entries (task_id, start_time, end_time, duration_seconds, source, created_at)
     VALUES (?, ?, ?, ?, 'manual', ?)`
  )

  const durationPresetsByUser: number[][] = [
    [30, 45, 60, 90, 120, 45, 75, 90, 60],
    [45, 60, 90, 60, 120, 30, 45, 90],
    [60, 90, 45, 120, 75, 90, 60, 45],
    [90, 60, 45, 75, 120, 60, 90, 45],
    [60, 90, 120, 45, 75, 90, 60, 120],
    [45, 90, 60, 75, 90, 45, 60, 90],
    [90, 120, 75, 60, 90, 120, 60, 90]
  ]

  for (let u = 0; u < users.length; u += 1) {
    const userTaskIds = tasksByUser[u]
    const durations = durationPresetsByUser[u % durationPresetsByUser.length]
    if (!userTaskIds || !durations) continue
    for (let t = 0; t < userTaskIds.length; t += 1) {
      const taskId = userTaskIds[t]
      if (taskId == null) continue
      const dayOffset = t % 7
      const startHour = 9 + (u % 2) + (t % 3)
      const startMs = weekStart + dayOffset * dayMs + startHour * 3600 * 1000
      const durationSeconds = (durations[t % durations.length] ?? 60) * 60
      const endMs = startMs + durationSeconds * 1000
      insertTimeEntry.run(taskId, startMs, endMs, durationSeconds, ts)
      if (t % 2 === 0) {
        const startMs2 = weekStart + dayOffset * dayMs + (14 + (t % 2)) * 3600 * 1000
        const dur2 = (20 + (t % 4) * 15) * 60
        insertTimeEntry.run(taskId, startMs2, startMs2 + dur2 * 1000, dur2, ts)
      }
    }
  }
}
