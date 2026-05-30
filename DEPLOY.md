# InnerMirror — Deploy & WebToApp (Global)

Önce canlı site, sonra ödeme (Stripe). Hedef: web + Android (WebToApp).

---

## Faz 1 — Canlıya al (Vercel)

### 1. GitHub’a yükle

```powershell
cd C:\Users\BasakKK\Desktop\InnerMirror\innermirror-project
git init
git add .
git commit -m "InnerMirror v2 — auth, plans, i18n"
```

GitHub’da yeni repo oluştur → push:

```powershell
git remote add origin https://github.com/KULLANICI/innermirror.git
git branch -M main
git push -u origin main
```

### 2. Vercel’e bağla

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub repo’yu seç → **Import**
3. Root directory: `.` (değiştirme)
4. **Environment Variables** ekle (Production + Preview):

| Name | Value |
|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase **anon public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** (gizli) |

5. **Deploy**

Deploy sırasında `npm run build` → `public/config.js` otomatik oluşur.

Canlı adres: `https://innermirror-xxxx.vercel.app`

### 3. Supabase — canlı URL ayarları

**Authentication** → **URL Configuration**:

| Alan | Değer |
|------|--------|
| Site URL | `https://SENIN-SITE.vercel.app` |
| Redirect URLs | `https://SENIN-SITE.vercel.app/**` |

**Authentication** → **Providers** → **Email**:

- Canlıda **Confirm email** → **açık** (önerilir)

### 4. Canlı test

- [ ] Kayıt / giriş
- [ ] 1 fotoğraf analizi (ücretsiz)
- [ ] Günlük kilitli
- [ ] Supabase’de `profiles` → `premium` → 5 foto + günlük

---

## Faz 2 — WebToApp (Android, global)

1. [webtoapp.design](https://webtoapp.design) veya [gonative.io](https://gonative.io)
2. **Website URL:** Vercel adresin (`https://...vercel.app`)
3. İzinler:
   - **Camera** — açık
   - **Storage / localStorage** — açık
   - **Internet** — açık
4. Uygulama adı / ikon
5. APK/AAB oluştur

**Not:** WebToApp, siteni WebView içinde açar. Giriş Supabase + localStorage ile kalır. “Fotoğraf çek” telefonda gerçek kameraya daha yakın çalışır; PC’de klasör açılması normaldir.

**Google Play (ileride):** Dijital abonelik satacaksan Play Billing kurallarına bak; ödeme web’de (Stripe) kalırsa politika açısından dikkatli ol.

---

## Faz 3 — Ödeme (deploy sonrası)

Global hedef → **Stripe** (Checkout + webhook).

Eklenecekler:

- `api/create-checkout.js` — Premium satın al
- `api/stripe-webhook.js` — `profiles.plan` / `premium_until` güncelle
- Arayüz: “Premium’a geç” → Stripe sayfası
- Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`

Fiyat örneği: aylık / yıllık USD veya EUR.

---

## Özel domain (isteğe bağlı)

Vercel → Project → **Domains** → `innermirror.com` ekle → DNS kayıtları.

Supabase Site URL + Redirect URLs’i yeni domain ile güncelle.

---

## Sorun giderme

| Sorun | Çözüm |
|--------|--------|
| Giriş çalışmıyor | Supabase Site URL / Redirect URLs |
| config hatası | Vercel’de `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| Analiz 401 | `SUPABASE_SERVICE_ROLE_KEY` Vercel’de tanımlı mı? |
| WebToApp beyaz ekran | URL `https` olmalı; Vercel deploy başarılı mı? |
