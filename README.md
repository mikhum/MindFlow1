# MindFlow1 – Användarmanual

Detta är den fullständiga användarmanualen för MindFlow1, en webbaserad mindmap-editor för att skapa, organisera, redigera och exportera idékartor i webbläsaren.

## 1. Inledning

MindFlow1 är ett verktyg för att:

- skapa mind maps med centrala ämnen och undergrenar
- redigera och strukturera innehåll snabbt
- skapa relationer mellan olika noder
- spara till Google Drive eller exportera filer lokalt
- importera gamla och externa filer
- exportera till JSON, Word eller PDF

Appen körs i webbläsaren och är byggd för snabb planering, brainstorming, analyssessioner och dokumentation.

## 2. Kom igång

### 2.1 Starta appen lokalt

Öppna projektet i VS Code och starta en lokal webbserver från projektets rotmapp:

```bash
python -m http.server 8000
```

Öppna sedan:

```text
http://localhost:8000/
```

### 2.2 Bläddra i användargränssnittet

Huvudfönstret består av:

- menyrad överst
- arbetsyta i mitten
- sidofält för mappar/Google Drive
- kontrollknappar för skapa, redigera och navigera

Det centrala ämnet visas i mitten och kallas ofta för "Central topic". Alla andra noder byggs upp från den.

## 3. Grundläggande användning

### 3.1 Skapa en ny nod

Det finns flera sätt att skapa noder:

- Tryck på Tab för att skapa ett barn till den valda noden
- Tryck på Enter för att skapa en systernod
- Klicka på knappen för att lägga till barn/underpunkt

### 3.2 Redigera nodtext

För att ändra texten i en nod:

- dubbelklicka på noden
- eller markera noden och tryck F2
- eller skriv direkt efter val av nod om textredigering startas automatiskt

När du är i redigeringsläge:

- Enter sparar texten och avslutar redigering
- Esc avbryter redigering
- Tab kan användas för att skapa en undernod direkt efter att texten sparats

### 3.3 Välja, flytta och strukturera noder

- Klicka på en nod för att välja den
- Dra en nod för att flytta den fritt
- Dra en nod över en annan nod för att ändra dess förälder/placering
- Använd hierarkin för att skapa tydliga nivåer och grupper

### 3.4 Dölj och visa delar av kartan

Du kan filtrera kartan så att bara vissa nivåer syns:

- använd nivåväljaren i menyn
- välj nivå 1, 2, 3 eller 4
- eller välj "Alla" för att återställa full visning

Detta är användbart när kartan blir stor och du vill fokusera på en del av strukturen.

## 4. Relationer mellan noder

MindFlow1 stödjer kopplingar mellan separata noder.

### 4.1 Skapa en relation

1. Välj en nod
2. Tryck på knappen för relationer eller använd L
3. Klicka på målnoden som du vill koppla samman med
4. Relationen skapas mellan de två noderna

### 4.2 Ändra relationens utseende

När en relation är vald kan du:

- ändra färg
- lägga till kommentar
- ta bort relationen

### 4.3 Ta bort relation

- välj relationen
- tryck Delete eller Backspace
- eller klicka på raderasymbolen som visas vid vald relation

## 5. Navigering och zoom

### 5.1 Panorera arbetsytan

- dra i tom yta för att flytta runt i arbetsytan
- eller använd scroll/zoom för att zooma in och ut

### 5.2 Zoom

- använd mushjulet för att zooma
- eller använd zoomknapparna i kontrollpanelen

### 5.3 Centrera vy

- välj en nod och använd centreringsfunktion
- eller återställ vy till den centrala noden

## 6. Kortkommandon

Det finns flera genvägar för snabb användning.

| Genväg | Funktion |
| --- | --- |
| Tab | Skapa barnnod |
| Enter | Skapa systernod / spara redigering |
| F2 | Redigera vald nod |
| Delete / Backspace | Ta bort nod eller relation |
| Esc | Avbryt redigering eller avmarkera |
| Pilknappar | Navigera mellan noder |
| Ctrl + Z | Ångra |
| Ctrl + Y | Gör om |
| Ctrl + F | Sök i noder |
| L | Skapa relation |
| H | Öppna hjälp |
| Mellanslag | Centrera vald nod |

## 7. Filformat och sparande

### 7.1 Standardformat för nya filer

Nya filer sparas med filändelsen:

- .mmh

Exempel:

- min-karta.mmh
- brainstorm-2026.mmh

### 7.2 Bakåtkompatibilitet

Appen kan fortfarande öppna och importera äldre filer med ändelsen:

- .mindflow

Det innebär att äldre mappar fortfarande kan användas utan konvertering.

### 7.3 Spara lokalt

Appen kan spara filer i ett format som följer det nya .mmh-formatet. Det är lämpligt att använda .mmh för framtida sparade filer.

### 7.4 Google Drive

Appen kan också spara kartor i Google Drive.

Funktioner:

- spara till Google Drive app-katalog
- lista tidigare sparade kartor
- återöppna sparade kartor från Drive
- ladda ner och hantera filer i skrivbordsliknande kontext

För att använda Google Drive krävs att en Google Client ID är konfigurerad. Om du inte är inloggad kommer appen att be dig logga in först.

## 8. Import och export

### 8.1 Importera filer

Appen kan öppna och importera:

- .mmh
- .mindflow
- .json
- Freemind-filer i format .mm och .xml

Detta gör att filerna från tidigare versioner fortfarande kan användas tillsammans med nya .mmh-filer.

### 8.2 Exportera filer

Appen kan exportera till:

- JSON
- Word-dokument
- PDF

Det finns exportfunktioner i Arkiv-menyn.

### 8.3 Exportera som JSON

JSON-export används för att spara den fulla mindmap-strukturen i ett maskinläsbart format. Det är lämpligt om du vill:

- lagra projektdata
- återimportera kartan senare
- arbeta med extern databehandling

## 9. Hjälp och felsökning

### 9.1 Hjälptext

Tryck H för att öppna hjälpmodulen som visar kortkommandon och grundläggande kontroller.

### 9.2 Vanliga problem

#### Appen öppnas inte korrekt

- kontrollera att du öppnar appen via en lokal webbserver
- använd om möjligt http://localhost:8000

#### Google Drive fungerar inte

- kontrollera att Google Client ID är konfigurerat
- kontrollera att webbadressen matchar den ursprungliga appens giltiga origin
- logga ut och in igen om sessionen har gått ut

#### En äldre .mindflow-fil öppnas inte

- kontrollera att filen inte är skadad
- testa att importera den igen med filväljaren
- kontrollera att filen faktiskt innehåller en giltig root-node

#### Filens namn ser fel ut

- appen normaliserar ogiltiga tecken till bindestreck
- tryck på filnamnet i export/namnflödet för att se den slutgiltiga namngivningen

## 10. Bästa praxis

- använd .mmh för alla nya sparade filer
- behåll .mindflow som stöd för äldre projekt
- använd nivåfiltrering för stora kartor
- använd relationer för att koppla ihop delar av kartan som inte är direkt hierarkiska
- spara regelbundet i Google Drive om du arbetar med viktiga kartor

## 11. Exempel på arbetsflöde

### Ny kartstart

1. Skapa ett centralt ämne
2. Lägg till huvudgrenar med Tab
3. Fortsätt med undergrenar
4. Använd relationer för att knyta ihop idéer
5. Spara kartan som .mmh
6. Exportera till PDF eller Word när det behövs

### Brainstorming-session

1. Skriv huvudfrågan i central nod
2. Lägg till idéer som undernoder
3. Organisera idéer genom flytt och nivåfilter
4. Koppla relaterade idéer med relationer
5. Spara till Google Drive

## 12. Sammanfattning

MindFlow1 är ett flexibelt och snabbt verktyg för att skapa idékartor i webbläsaren. Det stödjer moderna arbetsflöden med .mmh-filer, bakåtkompatibilitet för .mindflow och integration med Google Drive.

Genom att förstå grunderna i nodredigering, relationer, import/export och kortkommandon kan du snabbt komma igång och arbeta effektivt i appen.

## 13. Snabbstart

Om du bara vill börja direkt:

1. öppna appen i webbläsaren
2. skapa ett centralt ämne
3. tryck Tab för att skapa barnnoder
4. använd dubbelklick eller F2 för att redigera
5. spara kartan som .mmh
6. exportera till PDF eller Word vid behov

Det är allt du behöver för att komma igång med ditt första mind map i MindFlow1.

