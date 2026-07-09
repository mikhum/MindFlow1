# Production Environment Documentation — MindFlow1

**Repository:** `mikhum/MindFlow1`  
**Owner:** `mikhum`  
**Last Updated:** July 9, 2026  
**Environment Type:** Personal production (GitHub Pages + Google Drive)

## 1) Purpose

This document describes the production setup for `MindFlow1`, including:

- Hosting and deployment
- Data storage model
- Operational checks
- Incident recovery steps

The goal is long-term maintainability and easy troubleshooting.

---

## 2) Production Overview

`MindFlow1` is a static web application for creating and editing mind maps.

### Runtime architecture

1. User opens the production URL (GitHub Pages)
2. Browser downloads static assets (HTML/CSS/JS)
3. App runs client-side
4. User mind map files are loaded/saved to Google Drive

### Key characteristics

- Static hosting only (no dedicated server runtime)
- No managed DB service
- Code in GitHub
- User files in Google Drive

---

## 3) Production Services

## 3.1 Hosting

- **Provider:** GitHub Pages
- **Repository:** `mikhum/MindFlow1`
- **Production URL:** `https://mikhum.github.io/MindFlow1/` *(confirm if changed)*
- **Pages config:** Repository **Settings → Pages**
  - Source branch/folder: *(fill actual values, e.g. `main` `/root` or `/docs`)*

## 3.2 Data Storage

- **Provider:** Google Drive
- **Storage owner:** `mikhum` personal Google account
- **Data type:** Mind map documents and related user files

## 3.3 Source Control

- **Provider:** GitHub
- **Default branch:** *(fill actual value, likely `main`)*
- **Deploy trigger:** push to configured Pages source branch

---

## 4) Deployment Process

## 4.1 Standard deployment

1. Implement and test changes locally
2. Commit with descriptive message
3. Push to Pages source branch
4. Wait for Pages build/deploy
5. Validate production behavior

## 4.2 Post-deploy smoke test

- [ ] App loads from production URL
- [ ] Mind map canvas/editor works
- [ ] Create/edit map works
- [ ] Save to Drive works
- [ ] Load from Drive works
- [ ] No critical browser console errors

---

## 5) Data and File Management

## 5.1 Data location

All production user content lives in Google Drive, not in repository source.

## 5.2 Recommended Drive structure

- `/Apps/MindFlow1/active/`
- `/Apps/MindFlow1/archive/`
- `/Apps/backups/MindFlow1/`

## 5.3 Backup policy (recommended)

- Weekly: duplicate key files to backup location
- Monthly: offline export/sync copy
- Keep at least two historical restore points

---

## 6) Access and Security

## 6.1 GitHub

- Account: `mikhum`
- 2FA enabled (recommended)
- Recovery methods stored securely

## 6.2 Google Account

- 2FA enabled
- Recovery options current
- Connected app permissions reviewed periodically

## 6.3 Secrets and credentials

- Do not commit secrets to the repo
- Only public client configuration should be in frontend code
- Rotate credentials immediately if exposure is suspected

---

## 7) Operations and Monitoring

A lightweight operational routine is enough for personal production.

## 7.1 Weekly checks

- Open production URL
- Validate save/load cycle with Drive
- Check Pages deployment status
- Inspect console for regressions/errors

## 7.2 Warning signs

- 404 or white screen
- Save or load failures
- OAuth loops / repeated permission prompts
- New permission/CORS/auth errors

---

## 8) Incident Runbook

## 8.1 Site unavailable

1. Check repo Settings → Pages
2. Validate source branch/folder
3. Check latest deployment/build status
4. Revert to known good commit if needed
5. Re-deploy and verify smoke tests

## 8.2 Drive integration broken

1. Verify Google account login
2. Re-authorize app permissions
3. Confirm Drive access scopes
4. Test read/write using a new temporary file
5. Verify folder ownership/permissions

## 8.3 Rollback process

1. Find last known good commit
2. Revert problematic changes
3. Push revert
4. Re-run smoke tests

---

## 9) Recovery Checklist

If restoring on a new machine or after account recovery:

1. Recover GitHub access
2. Recover Google account access
3. Clone `mikhum/MindFlow1`
4. Restore local dev prerequisites
5. Confirm Pages settings/deploy access
6. Confirm Drive data access
7. Validate production URL behavior

---

## 10) Change Log Notes (Recommended)

Track meaningful production changes in `CHANGELOG.md`:

- Date
- Commit hash
- Summary of change
- Risk
- Rollback reference

---

## 11) Repo-Specific Fill-In (Complete This)

- **Pages Source Branch:** `<fill>`
- **Pages Source Folder:** `<fill>`
- **Build Command (if any):** `<fill>`
- **Last Known Good Commit:** `<fill>`
- **Primary Drive Folder ID/Path:** `<fill>`
- **Special Operational Notes:** `<fill>`
