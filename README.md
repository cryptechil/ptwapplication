# PTW — מערכת בקשות היתר עבודה

מערכת דו-כיוונית להגשת בקשות PTW לחברת תבל. קבלני המשנה ממלאים בקשה במערכת,
המערכת ממלאת אוטומטית את הטופס המקוון של תבל ב-monday, ומחזירה למשתמש את מספר
האישור והלינק.

## רכיבים

- `packages/shared` — סכמת השדות הקנונית של טופס תבל (מקור אמת יחיד).
- `apps/api` — Fastify + Prisma + PostgreSQL. אימות, RBAC, CRUD בקשות, שיתופי אורח,
  audit log, schema-guard, ניהול תור.
- `apps/api/src/workers` — BullMQ workers:
  - `submitter` — Playwright שממלא את טופס תבל. CAPTCHA נפתר ידנית על-ידי המנהל
    (man-in-the-loop) דרך VNC/noVNC על ה-VPS.
  - `snapshot` — סורק את טופס תבל מדי יום ומשווה את המבנה. אם יש שינוי, חוסם
    הגשות עד שמנהל מאשר.
- `apps/web` — React + Vite, RTL עברית. Login, Dashboard, טופס דינמי הנבנה
  מהסכמה, עמוד פרטי בקשה, ניהול משתמשים, תצוגת אורח.

## תפקידים

- **admin** — רואה את כל הבקשות, מנהל משתמשים, מאשר schema snapshots.
- **subcontractor** — רואה רק את הבקשות שהוא יצר, יכול ליצור/לערוך/להגיש.
- **guest** — אין לו חשבון בעצמו; ניגש לבקשה ספציפית בלבד דרך לינק שיתוף.

## הרצה מקומית

```bash
cp .env.example .env
# ערוך SESSION_SECRET ל-32+ תווים אקראיים
docker compose up -d                      # postgres + redis
npm install
npx prisma migrate dev --schema apps/api/prisma/schema.prisma
npm run dev                               # api + web + worker במקביל
```

ה-API ב-`http://localhost:4000`, ה-web ב-`http://localhost:5173`.
ה-admin הראשון נוצר אוטומטית מה-env (`SEED_ADMIN_*`).

## פריסה ל-VPS אובונטו (ptw.crtgeeb.co.il)

תלויות במערכת:
```bash
# Node 20, PostgreSQL, Redis, Caddy, Playwright deps + Xvfb לחלון Headful
sudo apt update
sudo apt install -y curl ca-certificates postgresql redis-server caddy xvfb x11vnc novnc websockify
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo adduser --system --group ptw
sudo mkdir -p /var/www/ptw/{app,web} && sudo chown -R ptw:ptw /var/www/ptw

# קוד האפליקציה
sudo -u ptw git clone <repo> /var/www/ptw/app
cd /var/www/ptw/app
sudo -u ptw npm install
sudo -u ptw npx playwright install chromium --with-deps
sudo -u ptw npm run build

# DB
sudo -u postgres psql -c "CREATE USER ptw WITH PASSWORD 'change-me';"
sudo -u postgres psql -c "CREATE DATABASE ptw OWNER ptw;"
sudo -u ptw cp .env.example .env
sudo -u ptw nano .env       # ערוך DATABASE_URL, SESSION_SECRET, SEED_ADMIN_*, PUBLIC_*
sudo -u ptw npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# סטטי של ה-web
sudo cp -r apps/web/dist/* /var/www/ptw/web/

# שירותים
sudo cp deploy/api.service     /etc/systemd/system/ptw-api.service
sudo cp deploy/worker.service  /etc/systemd/system/ptw-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now ptw-api ptw-worker

# Caddy (TLS אוטומטי)
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## פתרון CAPTCHA (Man-in-the-loop)

ה-Playwright פותח Chromium עם `headless: false` תחת Xvfb. כדי שאתה (admin)
תוכל לראות ולפתור את ה-CAPTCHA, התקן noVNC/x11vnc:

```bash
# קישור לחלון הדפדפן של ה-worker
x11vnc -display :99 -rfbport 5900 -forever -nopw &
websockify --web=/usr/share/novnc 7900 localhost:5900 &
# עכשיו ניגש ל-https://ptw.crtgeeb.co.il/vnc/  (ב-Caddy מוסיפים reverse_proxy ל-7900)
```

כשבקשה במצב `awaiting_captcha`, פתח את חלון ה-VNC, פתור את ה-CAPTCHA, לחץ "שלח".
ה-worker יקלוט את עמוד התודה, יחלץ את מספר ה-PTW, ויעדכן את הבקשה ל-`submitted`.

## Schema Guard

cron יומי מריץ snapshot של טופס תבל. אם המבנה השתנה (שדות, סוגים, חובה),
המערכת חוסמת הגשות עד שאתה ניגש ל-`/admin` ומאשר את הסנאפשוט החדש.

ה-hash מחושב מ:
- רשימת ה-`mondayId` של השדות
- ה-`type` של כל שדה
- האם השדה חובה
- ערכי האופציות ב-dropdowns

שינויי label / תיאור לא משנים את ה-hash.

## TODO לפני הרצה ראשונה

- למלא את אופציות ה-dropdowns ב-`packages/shared/src/form-schema.ts`:
  קבלן מבצע, שעות עבודה, סוג עבודה, אתר עבודה, עבודה בסיכון גבוה.
  אפשר להריץ קודם את `runSnapshot` (POST /schema/snapshot) ולהעתיק מהתוצאה.
- להגדיר cron שמריץ את ה-snapshot יומית.
