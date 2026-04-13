# Firebase Email Verification Setup

This project now includes a custom Firebase email action handler at:

`https://social-cards-b8e6f.web.app/auth-action.html`

Why this exists:

- Some mail providers and security scanners can open Firebase's default one-time verification link before the user does.
- The custom handler avoids consuming the verification code on page load.
- Verification only happens after the user clicks the `Verify email` button on the hosted page.

## One-time Firebase console setup

1. Open Firebase Console for `social-cards-b8e6f`.
2. Go to `Authentication` -> `Templates`.
3. Edit the `Email address verification` template.
4. Enable `Customize action URL`.
5. Set the action URL to:

`https://social-cards-b8e6f.web.app/auth-action.html`

6. Save the template.

## Deploy the handler page

Run:

```powershell
firebase deploy --only hosting
```

## Expected flow

1. The app sends the Firebase verification email.
2. The email opens `auth-action.html` on Firebase Hosting.
3. The hosted page waits for a real user click.
4. Pressing `Verify email` calls `applyActionCode`.
5. The user returns to the app and logs in.
