# Guide: Driftsättning av MindFlow på Google Cloud Run

Denna guide beskriver hur du driftsätter MindFlow till **Google Cloud Run** och vilka inställningar som måste göras i **Google Cloud Console**, särskilt för att appen och Google Drive-integrationen ska fungera felfritt.

---

## 1. Vad som har förberetts i projektet

Projektet har förberetts för containerbaserad drift:
1. **[Dockerfile](file:///c:/Users/mikae/OneDrive/Utveckling/MindFlow1/tests/MindFlow1/Dockerfile)**:
   - Baserad på officiell och fjäderlätt `nginx:alpine` (~20 MB).
   - Startar på under 1 sekund vid cold start.
   - Tar emot miljövariabeln `$PORT` automatiskt från Cloud Run (standard 8080).
   - Innehåller automatisk healthcheck på `/healthz`.
2. **[nginx/default.conf.template](file:///c:/Users/mikae/OneDrive/Utveckling/MindFlow1/tests/MindFlow1/nginx/default.conf.template)**:
   - Gzip-komprimering för blixtsnabb laddtid.
   - Säkerhetsheadrar (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
   - Caching-strategi: statiska tillgångar (JS/CSS) cachas effektivt medan `index.html` alltid valideras så att användare direkt får nya uppdateringar.
   - SPA-fallback (`try_files $uri $uri/ /index.html;`).
3. **[.dockerignore](file:///c:/Users/mikae/OneDrive/Utveckling/MindFlow1/tests/MindFlow1/.dockerignore)**:
   - Exkluderar `.git`, `node_modules` och tester från containern.
4. **[cloudbuild.yaml](file:///c:/Users/mikae/OneDrive/Utveckling/MindFlow1/tests/MindFlow1/cloudbuild.yaml)**:
   - Konfiguration för automatisk byggning och deploy via Google Cloud Build.

---

## 2. Driftsättning till Google Cloud Run

Eftersom koden ligger i Git/GitHub kan du deploya på två smidiga sätt:

### Alternativ A: Direkt via Cloud Console GUI (Rekommenderat)
1. Öppna [Google Cloud Console](https://console.cloud.google.com/).
2. Välj ditt projekt (där Google Client ID ligger).
3. Sök efter **Cloud Run** i sökrutan högst upp och öppna tjänsten.
4. Klicka på **Create Service** (Skapa tjänst).
5. Välj **Continuously deploy from a repository** (Kontinuerlig driftsättning från ett arkiv) och klicka på **Set up with Cloud Build**:
   - Välj leverantör: **GitHub**.
   - Välj ditt repository för `MindFlow`.
   - Branch: `^main$`.
   - Build Type: **Dockerfile** (sökväg `/Dockerfile`).
6. Fyll i tjänstens grundinställningar:
   - **Service name**: `mindflow`
   - **Region**: `europe-north1` (Finland – låg latens och förnybar energi) eller `europe-west1` (Belgien).
   - **Authentication**: Välj **Allow unauthenticated invocations** *(Kritiskt: detta gör att vem som helst kan öppna webbappen i sin webbläsare)*.
7. Öppna fliken **Container, Volumes, Networking, Security**:
   - **Container port**: `8080` (standard).
   - **Memory**: `256 MiB` eller `512 MiB` (mer än tillräckligt för en Nginx-server).
   - **CPU**: `1`.
   - **Minimum instances**: `0` (skalar ner till 0 när ingen använder appen = helt gratis inom Google Cloud Free Tier).
8. Klicka på **Create** (Skapa).
9. Efter 1–2 minuter är tjänsten klar och du får en URL, t.ex:
   `https://mindflow-xxxxxx-lz.a.run.app`

---

### Alternativ B: Via Google Cloud Shell (i webbläsaren)
Om du föredrar terminalen behöver du inte installera något lokalt; använd Cloud Shell i webbläsaren:
1. Klicka på ikonen **Activate Cloud Shell** `>_` uppe till höger i Cloud Console.
2. Klona eller dra in dina filer:
   ```bash
   git clone <ditt-github-repo-url>
   cd MindFlow1
   ```
3. Kör en direktdeploy:
   ```bash
   gcloud run deploy mindflow \
     --source . \
     --region europe-north1 \
     --allow-unauthenticated \
     --port 8080
   ```
4. Svara `Y` på eventuella frågor om att aktivera API:er (Artifact Registry, Cloud Build).

---

## 3. Ändringar i Google Cloud Console (Viktigt!)

När Cloud Run-tjänsten är skapad och du har fått din app-URL måste du göra följande inställningar i Google Cloud Console:

### 1) Uppdatera OAuth 2.0 Client ID (Auktoriserade ursprung)
MindFlow integrerar mot Google Drive och Google Identity Services. Om din nya Cloud Run-URL inte är registrerad kommer Google att neka inloggning med felmeddelandet `origin_mismatch`.

1. Gå till **APIs & Services** (API:er och tjänster) -> **Credentials** (Autentiseringsuppgifter).
2. Leta upp ditt OAuth 2.0-klient-ID:
   - Samma ID som används i [index.html](file:///c:/Users/mikae/OneDrive/Utveckling/MindFlow1/tests/MindFlow1/index.html) (`150867957379-...`).
   - Klicka på pennan / namnet för att redigera klienten.
3. Skrolla ner till sektionen **Authorized JavaScript origins** (Auktoriserade JavaScript-ursprung).
4. Klicka på **+ ADD URI** (Lägg till URI).
5. Klistra in din nya Cloud Run URL **utan snedstreck på slutet**, exempelvis:
   ```
   https://mindflow-xxxxxx-lz.a.run.app
   ```
   *(Om du även kopplar en egen domän, t.ex. `https://mindmap.mindflow.se`, lägger du till den här också).*
6. Klicka på **Save** (Spara).
> *Obs! Det kan ta mellan 2 till 10 minuter för Googles OAuth-servrar att slå igenom ändringen globalt.*

---

### 2) Kontrollera att Google Drive API är aktiverat
1. Gå till **APIs & Services** -> **Enabled APIs & services**.
2. Kontrollera att **Google Drive API** finns i listan.
3. Om den inte finns:
   - Klicka på **+ ENABLE APIS AND SERVICES** högst upp.
   - Sök efter `Google Drive API` och klicka på **Enable** (Aktivera).

---

### 3) OAuth consent screen (Skärm för samtycke)
Om detta redan är konfigurerat för din app behöver du inte ändra något, men verifiera följande:
1. Gå till **APIs & Services** -> **OAuth consent screen**.
2. **Publishing status**:
   - Om den är satt till *Testing* (Testläge), kontrollera att din e-postadress är tillagd under **Test users**.
   - Om du vill att alla ska kunna logga in kan du klicka på *Publish App* (eller använda Google Workspace inom organisationen).
3. **Scopes**:
   - Kontrollera att scopet `https://www.googleapis.com/auth/drive.appdata` och e-postprofil ingår.

---

### 4) (Valfritt) Koppla egen anpassad domän
Om du inte vill använda `.a.run.app`-adressen:
1. I **Cloud Run**, gå till fliken **Custom Domains** (Anpassade domäner) eller klicka på **Manage Custom Domains**.
2. Klicka på **Add Mapping**.
3. Välj tjänsten `mindflow` och ange din domän/subdomän (t.ex. `karta.dindoman.se`).
4. Google tillhandahåller DNS-poster (A/AAAA eller CNAME) som du lägger in hos din DNS-leverantör. Google hanterar automatiskt kostnadsfritt SSL-certifikat.
5. **Kom ihåg**: Om du lägger till en egen domän, glöm inte att också lägga till den under *Authorized JavaScript origins* i OAuth-inställningarna enligt steg 1 ovan.

---

## 4. Sammanfattning av checklista
- [x] `Dockerfile` och `nginx/default.conf.template` tillagda i repot.
- [x] `.dockerignore` skapad.
- [ ] Pusha koden till ditt GitHub-repo.
- [ ] Skapa Cloud Run-tjänst med **Allow unauthenticated** och port **8080**.
- [ ] Kopiera Cloud Run-adressen och klistra in i **OAuth 2.0 Credentials -> Authorized JavaScript origins**.
- [ ] Öppna Cloud Run-adressen i webbläsaren och testa att spara/öppna via Google Drive!
