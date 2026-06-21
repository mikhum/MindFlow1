# MindFlow - Systemdokumentation

## Dokumentinformation
1. System: MindFlow
2. Dokumenttyp: Teknisk systemdokumentation
3. Version: 1.0
4. Datum: 2026-06-20
5. Syfte: Beskriva arkitektur, funktioner, beteenden och forvaltningsrekommendationer.

## 1. Sammanfattning
MindFlow ar en klientbaserad mindmap-editor byggd med HTML, CSS och JavaScript (ES Modules).
Applikationen kor i webblasaren och erbjuder skapande av noder, relationer, import/export,
localStorage-sparning och interaktiv redigering av karta i realtid.

## 2. Malbild
Refaktoreringen och buggrattningarna har haft foljande huvudmal:
1. Stabilisera den modulare arkitekturen.
2. Aterstalla korrekt beteende for nodskapande, redigering och relationer.
3. Forbattra drag-and-drop och branch-flytt.
4. Forbattra centrering, visuell tydlighet och redigeringsflode.
5. Minska storande popup-dialoger i viktiga arbetsfloden.

## 3. Arkitektur och modulansvar
Systemet ar uppdelat i separata moduler med tydligt ansvar:

1. src/app.js: Initialisering, autosave-load, uppstart av listeners och initial render.
2. src/state.js: Global state for noder, relationer, viewport, editing, drag och historik.
3. src/dom.js: Centraliserade DOM-referenser.
4. src/events.js: Tangentbord, pekare, kontroller och huvudflode for UI-interaktion.
5. src/rendering.js: Render av noder, connectors, relationer och edit-UI.
6. src/nodes.js: Node-CRUD, val, redigering, reparenting, collapse-hjalpfunktioner.
7. src/relationships.js: Skapa/valja/ta bort relationer mellan noder.
8. src/navigation.js: Centrering och geometrisk nodnavigation.
9. src/viewport.js: Zoom, pan och canvas-transform.
10. src/fileIO.js: Save/load/import/export och browser storage.
11. src/history.js: Undo/redo snapshots.
12. src/layout.js: Layoutlogik for importerade kartor + Freemind parsing.

## 4. Datamodell
State innehaller i huvudsak:
1. nodes: Objekt per nod (id, text, parent, x, y, color, comment, collapsed).
2. relationships: Fria lankar mellan noder.
3. selection/editing: selectedNodeId, selectedRelationshipId, editingNodeId, editingBuffer.
4. viewport: x, y, scale.
5. drag/linking: dragStart, dragDelta, hoveredParentId, linkingSourceId, linkingMousePos.
6. history: undoStack, redoStack.
7. file/map: currentMapName, saveFileHandle.

## 5. Nyckelfunktioner
### 5.1 Nodskapande och redigering
1. Ny topic kan skapas via Tab, Enter och + beroende pa kontext.
2. Nya topics skapas med texten "New Topic" och gar direkt in i edit-lage.
3. Enter i edit-lage sparar nodtext.
4. Tab i edit-lage kan anvandas for direkt fortsatt skapande enligt aktuellt arbetsflode.
5. F2 aktiverar redigering for vald nod.

### 5.2 Kollaps/expand av brancher
1. Noder med children far en +/- kontroll.
2. Kollaps dolder hela undertradet.
3. Expand visar undertradet igen.

### 5.3 Relationer
1. Relationer kan skapas mellan valfria noder.
2. Relationer kan valjas, fargsattas, kommenteras och tas bort.
3. Relationer renderas separat fran parent-child-connectors.

### 5.4 Drag-and-drop och branch-flytt
1. Noder kan flyttas fritt inom gren.
2. Slapp ovanpa annan nod ska reparenta noden till den branchen.
3. Drop-detektering ar forstarkt med hitbox och fallback via element under pekaren.
4. Reparenting placerar noden som riktig child pa branchens sida och undviker overlap med siblings.

### 5.5 Centrering och viewport
1. Root (Central Topic) centreras i canvas vid init, ny karta, load och import.
2. Centrering bygger pa canvas-koordinater sa beteendet ar oberoende av fonsterstorlek.

### 5.6 Import/export och lagring
1. Save till browser storage + filsave nar API finns.
2. Import av JSON/MindFlow-filer.
3. Import av Freemind (.mm/.xml).
4. Export till JSON och Word.

## 6. Design- och UX-regler
1. Central Topic har standardfarg RGB 14,165,233 (#0ea5e9).
2. Nya topics placeras med utokat avstand for battre lasbarhet.
3. Onodiga popup-fonster har tagits bort i ny/import/save-floden.

## 7. Test och validering
1. Projektet har en smoke-testsvit: tests/smoke.mjs.
2. Tester kor centrala floden: skapa, editera, relationer, save.
3. Tester har kor ts efter varje storre andring for regressionskontroll.

## 8. Kanda kvarvarande risker
1. Drag/drop mellan komplexa brancher kan fortfarande ha edge cases vid mycket tat nodplacering.
2. Hjalptext i UI kan halka efter nar shortcuts andras.
3. Fler E2E-testfall for branch-flytt rekommenderas.

## 9. Forvaltningsrekommendationer
1. Behall modulansvar tydliga och undvik att flytta tillbaka logik till monolit.
2. Lagg till regressionstest vid varje fix i edit/drag/drop-floden.
3. Hall dokumentation och UI-shortcut-lista synkade.
4. Prioritera tydlig visuell feedback pa drop-targets och edit-lage.

## 10. Andringslogg (sammandrag)
1. Refaktorering till modulstruktur stabiliserad.
2. Parent-child-connectorer korrigerade.
3. Save/load/import-floden forbattrade och popup-flode forenklat.
4. Editfloden for nya och befintliga noder forbattrat.
5. Collapse/expand-funktion tillagd.
6. Branch-flytt via drag/drop forstarkt.
7. Central Topic defaultfarg standardiserad till #0ea5e9.

## 11. Driftmanual
### 11.1 Lokal start
1. Oppna projektmappen i VS Code.
2. Starta en lokal webbserver i projektroten.
3. Oppna indexsidan i webblasaren och verifiera att MindFlow laddas.

### 11.2 Rekommenderade kommandon
1. Installera beroenden: npm install
2. Kor smoke-test: npm run smoke
3. Kontrollera git-status fore commit: git status

### 11.3 Daglig verifiering efter andring
1. Skapa en child och en sibling.
2. Redigera nodtext med F2, Enter och dubbelklick.
3. Testa drag/drop mellan brancher.
4. Testa collapse/expand.
5. Testa save/load och import/export.

### 11.4 Publicering (Git)
1. Kontrollera att onskade filer ar stageade.
2. Skapa commit med tydlig andringsbeskrivning.
3. Pusha till avsedd branch.
4. Skapa Pull Request vid behov.

### 11.5 Felsokning snabbguide
1. Om UI beter sig ovantat: hard-reload i webblasaren.
2. Om tester faller: kor npm run smoke och lasa forsta felet i output.
3. Om drag/drop missar mal: verifiera att noden slapps ovanpa malnoden.
4. Om import misslyckas: kontrollera filformat och att root-node finns.
