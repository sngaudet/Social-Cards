# Mark Existing Test Users Verified

This one-off script updates existing Firebase Auth users to:

`emailVerified: true`

It can look users up by email or UID and also reports whether matching
Firestore docs exist in `users/{uid}` and `publicProfiles/{uid}`.

## Usage

From `backend/`:

```powershell
npm run mark-email-verified -- --email test@uwm.edu
```

Multiple users:

```powershell
npm run mark-email-verified -- --email test1@uwm.edu --email test2@uwm.edu
```

By UID:

```powershell
npm run mark-email-verified -- --uid YOUR_UID_HERE
```

Dry run:

```powershell
npm run mark-email-verified -- --email test@uwm.edu --dry-run
```

## Notes

- This requires Firebase Admin credentials.
- If the script reports missing Firestore docs, the user may still need their
  profile data repaired even after being marked verified.
