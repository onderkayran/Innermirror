# InnerMirror

Fotoğraflardan duygu analizi yapan mobil uyumlu web uygulaması. Kullanıcı hesapları, günlük kota ve Premium / Ücretsiz plan desteği içerir.

## Plan özellikleri

| Özellik | Ücretsiz | Premium |
|--------|----------|---------|
| Giriş (e-posta / şifre) | Evet | Evet |
| Fotoğraf analizi / gün | 1 | 5 |
| Günlük | Kilitli | Tam erişim |
| Analiz sekmesi | Yok | Var |
| AI geçmiş bağlamı | Yok | Var |
| Kayıtların saklanması | Hayır (sadece anlık sonuç) | Supabase’de |

## Proje yapısı

```
innermirror-project/
├── api/proxy.js           # Anthropic proxy + auth + kota
├── public/
│   ├── index.html
│   ├── app-auth.js        # Supabase oturum & veri
│   ├── config.example.js  → config.js olarak kopyala
├── supabase/schema.sql    # Veritabanı şeması
├── vercel.json
└── package.json
```

---

## Kurulum

### 1. Supabase

1. [supabase.com](https://supabase.com) üzerinde proje oluştur.
2. **SQL Editor** → `supabase/schema.sql` dosyasının tamamını çalıştır.
3. **Authentication** → Providers → Email açık olsun (Confirm email isteğe bağlı; geliştirmede kapatabilirsin).
4. **Project Settings → API** değerlerini not al:
   - Project URL
   - `anon` public key
   - `service_role` key (gizli)

### 2. Yerel config

```bash
cp public/config.example.js public/config.js
```

`public/config.js` içine Supabase URL ve anon key yaz.

### 3. Vercel ortam değişkenleri

| Key | Nerede |
|-----|--------|
| `ANTHROPIC_API_KEY` | Vercel + `.env.local` |
| `SUPABASE_URL` | Vercel + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sadece Vercel / sunucu |

```bash
npm install
vercel dev
```

---

## Deploy (canlı site)

Detaylı adımlar: **[DEPLOY.md](./DEPLOY.md)**

Kısa özet:

1. GitHub → Vercel import
2. Vercel env: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Supabase → Authentication → Site URL = Vercel adresin
4. Canlıda test et → sonra WebToApp

Deploy sırasında `npm run build` ile `public/config.js` Vercel ortam değişkenlerinden üretilir.

---

## Yol haritası

| Faz | İçerik | Durum |
|-----|--------|--------|
| 1 | Vercel deploy + Supabase canlı URL | Şimdi |
| 2 | WebToApp (Android) | Deploy sonrası |
| 3 | Stripe ödeme + Premium otomatik | Sonra |

## Premium test (manuel)

Supabase → **Table Editor** → `profiles` → kullanıcı satırında:

- `plan` = `premium`
- `premium_until` = boş (süresiz) veya gelecek bir tarih

Ödeme (Stripe) deploy sonrası eklenecek.

---

## Güvenlik

- API anahtarı yalnızca sunucuda.
- Proxy, JWT olmadan istek kabul etmez.
- Günlük fotoğraf kotası sunucuda sayılır.
- `service_role` anahtarını asla tarayıcıya koyma.

---

## WebToApp (Android)

- URL: deploy adresin
- Camera / Storage izinleri açık
- Kullanıcı oturumu Supabase’de kalır (localStorage)
