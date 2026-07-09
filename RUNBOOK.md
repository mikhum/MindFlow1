# Runbook — MindFlow1

**Repository:** `mikhum/MindFlow1`  
**Last Updated:** July 9, 2026

## 1) Purpose

This runbook provides fast operational steps for support, incidents, and recovery in `MindFlow1` production.

---

## 2) Quick Facts

- **Production URL:** `https://mikhum.github.io/MindFlow1/` *(confirm if updated)*
- **Hosting:** GitHub Pages
- **Data storage:** Google Drive
- **Owner/operator:** `mikhum`

---

## 3) Routine Operations

## 3.1 Weekly health check

- [ ] Open production URL
- [ ] Create/edit a sample mind map
- [ ] Save to Drive
- [ ] Load from Drive
- [ ] Verify no new critical console errors
- [ ] Check latest Pages deployment state

## 3.2 Monthly maintenance

- [ ] Validate account recovery options (GitHub + Google)
- [ ] Review Drive/OAuth app permissions
- [ ] Confirm backup snapshots exist and are readable
- [ ] Update `PRODUCTION.md` if environment changed

---

## 4) Incident Severity

- **SEV-1 (Critical):** App unavailable
- **SEV-2 (Major):** App available but Drive operations broken
- **SEV-3 (Minor):** Non-blocking functional/UI defects

---

## 5) Incident Procedures

## 5.1 Site unavailable (SEV-1)

1. Confirm correct production URL.
2. Check **Settings → Pages** in repo.
3. Verify source branch/folder is correct.
4. Inspect latest deployment status/log.
5. Roll back to known good commit if needed.
6. Re-deploy and validate.

**Exit criteria:** app loads and core editing works.

---

## 5.2 Drive save/load failure (SEV-2)

1. Verify Google sign-in and auth status.
2. Re-authorize permissions.
3. Confirm required Drive scopes and access.
4. Test with new temporary test file.
5. Validate folder permissions/ownership.
6. Re-run save/load checks.

**Exit criteria:** successful write/read roundtrip in production.

---

## 5.3 Rollback bad release

1. Locate commit introducing issue.
2. Identify last known good commit.
3. Revert problematic commit(s).
4. Push revert to Pages branch.
5. Smoke test:
   - App load
   - Map edit
   - Drive save
   - Drive load

**Exit criteria:** production stable and usable.

---

## 6) Troubleshooting Matrix

| Symptom | Likely cause | First action |
|---|---|---|
| 404 or site missing | Pages config/deploy issue | Check Pages settings + deploy logs |
| UI partially broken | Frontend JS error | Inspect browser console |
| Save denied/fails | Auth scope/permission issue | Re-auth and check scopes |
| Load cannot find file | Folder/file permission mismatch | Verify Drive location/access |
| Works on one browser only | Cache/session issue | Hard refresh / retest |

---

## 7) Recovery Procedure (New Device / Account Recovery)

1. Recover GitHub account
2. Recover Google account
3. Clone `mikhum/MindFlow1`
4. Restore local environment
5. Confirm deployment access and settings
6. Confirm Drive file access
7. Validate production end-to-end

---

## 8) Operational Notes

Fill and maintain:

- **Pages source branch:** `<fill>`
- **Pages source folder:** `<fill>`
- **Last known good commit:** `<fill>`
- **Drive root folder path/id:** `<fill>`
- **Special caveats:** `<fill>`
