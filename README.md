# Smule Downloader API Server

Smule'dan video ve müzik indirmek için REST API servisi. Coolify/Docker ile deploy edilebilir.

## Özellikler

- Smule URL'lerinden video ve audio indirme linkleri çıkarma
- Şifreli URL'leri otomatik deşifre etme
- Video ve Audio seçeneklerini ayrı ayrı döndürme
- Direkt indirme linkleri (mümkünse)
- Proxy indirme desteği (gerekirse)
- Otomatik dosya temizleme (1 saat)
- Docker & Coolify desteği

---

## API Dokümantasyonu

### Base URL
```
Production: https://your-domain.com
Local: http://localhost:3000
```

---

### 1. URL İşleme (Ana Endpoint)

Smule URL'sinden video/audio bilgilerini ve indirme linklerini alır.

```
POST /api/process
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://www.smule.com/recording/bruno-mars-uptown-funk/1234567890"
}
```

**Response (Video + Audio mevcut):**
```json
{
  "title": "Uptown Funk - Acoustic",
  "artist": "Bruno Mars",
  "coverUrl": "https://c-cdnet.cdn.smule.com/.../cover.jpg",
  "duration": 216,
  "owner": {
    "accountId": 289710417,
    "handle": "username",
    "pictureUrl": "https://..."
  },
  "video": {
    "available": true,
    "type": "direct",
    "url": "https://c-cdnet.cdn.smule.com/.../video.mp4"
  },
  "audio": {
    "available": true,
    "type": "direct",
    "url": "https://c-cdnet.cdn.smule.com/.../audio.m4a"
  }
}
```

**Response (Sadece Audio mevcut):**
```json
{
  "title": "Leylim Ley",
  "artist": "Ömer Zülfü Livaneli",
  "coverUrl": "https://...",
  "duration": 245,
  "video": {
    "available": false,
    "type": null,
    "url": null
  },
  "audio": {
    "available": true,
    "type": "direct",
    "url": "https://..."
  }
}
```

**Response Alanları:**

| Alan | Tip | Açıklama |
|------|-----|----------|
| `title` | string | Şarkı adı |
| `artist` | string | Sanatçı adı |
| `coverUrl` | string | Kapak görseli URL'i (thumbnail) |
| `duration` | number | Süre (saniye) |
| `owner.handle` | string | Yükleyen kullanıcı adı |
| `owner.pictureUrl` | string | Kullanıcı profil resmi |
| `video.available` | boolean | Video mevcut mu? |
| `video.type` | string | `"direct"` veya `"proxy"` |
| `video.url` | string | Video indirme URL'i |
| `audio.available` | boolean | Audio mevcut mu? |
| `audio.type` | string | `"direct"` veya `"proxy"` |
| `audio.url` | string | Audio indirme URL'i |

**Hata Response:**
```json
{
  "error": "No media found for this performance"
}
```

---

### 2. Proxy İndirme (Opsiyonel)

Direkt erişilemeyen dosyalar için server üzerinden indirme.
> Not: Sadece `type: "proxy"` olduğunda kullanılır.

```
POST /api/proxy-download
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://...",
  "type": "video",
  "title": "Song Name"
}
```

**Response:**
```json
{
  "success": true,
  "downloadUrl": "https://your-server.com/api/download/uuid",
  "downloadId": "uuid"
}
```

---

### 3. Dosya İndirme

Proxy ile indirilen dosyaları serve eder.

```
GET /api/download/:id
```

**Response:** Dosya binary stream

---

### 4. Health Check

Server durumunu kontrol eder.

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-19T12:00:00.000Z",
  "uptime": 3600
}
```

---

### 5. İstatistikler

Aktif indirmeleri listeler.

```
GET /api/stats
```

**Response:**
```json
{
  "activeDownloads": 2,
  "downloads": [...]
}
```

---

## App Entegrasyon Örnekleri

### JavaScript / React Native

```javascript
const API_URL = 'https://your-server.com';

// 1. URL İşle
async function processSmuleUrl(smuleUrl) {
  const response = await fetch(`${API_URL}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: smuleUrl })
  });
  return response.json();
}

// 2. Kullanım
const result = await processSmuleUrl('https://smule.com/p/123456');

// Bilgileri göster
console.log(result.title);      // "Uptown Funk"
console.log(result.artist);     // "Bruno Mars"
console.log(result.coverUrl);   // Thumbnail URL
console.log(result.duration);   // 216 (saniye)

// Butonları kontrol et
if (result.video.available) {
  // Video İndir butonu göster
  // Tıklanınca: downloadFile(result.video.url, 'video.mp4')
}

if (result.audio.available) {
  // Müzik İndir butonu göster
  // Tıklanınca: downloadFile(result.audio.url, 'audio.m4a')
}

// 3. İndirme fonksiyonu
async function downloadFile(url, filename) {
  // Direkt indirme
  if (url.startsWith('https://c-cdnet.cdn.smule.com')) {
    window.open(url); // veya native download
    return;
  }

  // Proxy gerekirse
  const proxyResponse = await fetch(`${API_URL}/api/proxy-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, type: 'video', title: filename })
  });
  const { downloadUrl } = await proxyResponse.json();
  window.open(downloadUrl);
}
```

### Flutter / Dart

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const String API_URL = 'https://your-server.com';

class SmuleDownloader {
  // URL İşle
  Future<Map<String, dynamic>> processUrl(String smuleUrl) async {
    final response = await http.post(
      Uri.parse('$API_URL/api/process'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'url': smuleUrl}),
    );
    return jsonDecode(response.body);
  }
}

// Kullanım
final downloader = SmuleDownloader();
final result = await downloader.processUrl('https://smule.com/p/123456');

// UI'da göster
Text(result['title']);                    // Başlık
Image.network(result['coverUrl']);        // Thumbnail
Text('${result['duration']} saniye');     // Süre

// Butonlar
if (result['video']['available']) {
  ElevatedButton(
    onPressed: () => launchUrl(Uri.parse(result['video']['url'])),
    child: Text('Video İndir'),
  );
}

if (result['audio']['available']) {
  ElevatedButton(
    onPressed: () => launchUrl(Uri.parse(result['audio']['url'])),
    child: Text('Müzik İndir'),
  );
}
```

### Swift / iOS

```swift
import Foundation

struct SmuleResponse: Codable {
    let title: String
    let artist: String
    let coverUrl: String
    let duration: Int
    let video: MediaOption
    let audio: MediaOption
}

struct MediaOption: Codable {
    let available: Bool
    let type: String?
    let url: String?
}

class SmuleDownloader {
    let apiUrl = "https://your-server.com"

    func processUrl(_ smuleUrl: String) async throws -> SmuleResponse {
        let url = URL(string: "\(apiUrl)/api/process")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["url": smuleUrl])

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(SmuleResponse.self, from: data)
    }
}

// Kullanım
let downloader = SmuleDownloader()
let result = try await downloader.processUrl("https://smule.com/p/123456")

// UI'da göster
titleLabel.text = result.title
thumbnailImageView.load(url: result.coverUrl)

// Butonlar
videoButton.isHidden = !result.video.available
audioButton.isHidden = !result.audio.available
```

### Kotlin / Android

```kotlin
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject

class SmuleDownloader {
    private val client = OkHttpClient()
    private val apiUrl = "https://your-server.com"

    suspend fun processUrl(smuleUrl: String): JSONObject = withContext(Dispatchers.IO) {
        val body = """{"url": "$smuleUrl"}""".toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$apiUrl/api/process")
            .post(body)
            .build()

        val response = client.newCall(request).execute()
        JSONObject(response.body?.string() ?: "{}")
    }
}

// Kullanım
lifecycleScope.launch {
    val result = SmuleDownloader().processUrl("https://smule.com/p/123456")

    // UI güncelle
    titleText.text = result.getString("title")
    Glide.with(this).load(result.getString("coverUrl")).into(thumbnailImage)

    // Butonlar
    val video = result.getJSONObject("video")
    val audio = result.getJSONObject("audio")

    videoButton.visibility = if (video.getBoolean("available")) View.VISIBLE else View.GONE
    audioButton.visibility = if (audio.getBoolean("available")) View.VISIBLE else View.GONE

    videoButton.setOnClickListener {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(video.getString("url"))))
    }
}
```

---

## Kurulum

### Yerel Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# Sunucuyu başlat
npm start

# Geliştirme modu (auto-reload)
npm run dev
```

### Docker

```bash
# Image oluştur
docker build -t smule-downloader .

# Container başlat
docker run -p 3000:3000 smule-downloader
```

### Coolify Deployment

1. Git repository oluştur ve kodu push et
2. Coolify'da yeni servis ekle → Docker seç
3. Repository'yi bağla
4. Port: `3000`
5. Environment Variables:
   - `PORT=3000`
   - `NODE_ENV=production`
6. Deploy!

---

## Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Ortam |

---

## Dosya Yapısı

```
smule-downloader-server/
├── src/
│   ├── index.js           # Express server & API endpoints
│   ├── smuleClient.js     # Smule API client
│   ├── urlDecryptor.js    # URL şifre çözücü
│   └── downloadManager.js # İndirme yöneticisi
├── downloads/             # Geçici dosya deposu
├── Dockerfile             # Docker yapılandırması
├── package.json           # Bağımlılıklar
└── README.md              # Bu dosya
```

---

## Desteklenen URL Formatları

Server aşağıdaki tüm Smule URL formatlarını otomatik olarak algılar:

```
# Format 1: Kısa format
https://www.smule.com/p/1234567890_1234567890

# Format 2: Şarkı adıyla tam format
https://www.smule.com/recording/bruno-mars-uptown-funk/1234567890_1234567890

# Format 3: Kayıt formatı
https://www.smule.com/recording/p/1234567890_1234567890

# Format 4: Sing recording formatı
https://www.smule.com/sing-recording/1234567890_1234567890

# Format 5: Sing/recording formatı
https://www.smule.com/sing/recording/1234567890_1234567890

# Format 6: Performance formatı
https://www.smule.com/performance/1234567890_1234567890

# Tüm formatlar http veya https, www olsun olmasın desteklenir
```

**Bonus:** Eğer URL redirect ediliyorsa (örn. `/sing-recording/` linki otomatik olarak `/recording/` linkine yönleniyorsa), server redirect'i otomatik takip eder ve doğru kaydı bulur.

---

## Hata Kodları

| Kod | Mesaj | Açıklama |
|-----|-------|----------|
| 400 | Missing required parameter: url | URL parametresi eksik |
| 404 | No media found for this performance | Medya bulunamadı |
| 500 | Failed to process URL | İşleme hatası |

---

## Notlar

- Video dosyaları `.mp4` formatındadır
- Audio dosyaları `.m4a` formatındadır
- Proxy ile indirilen dosyalar 1 saat sonra otomatik silinir
- Tüm URL'ler HTTPS üzerinden serve edilir

---

## Lisans

MIT
