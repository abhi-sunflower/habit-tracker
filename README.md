# Habit Tracker

A simple, single-user habit tracker. Static site (deployable free on GitHub
Pages) backed by **Firebase** (free Spark plan — no credit card, no cost) for
real login and a real database that syncs across all your devices.

## Features

- 🔐 Real login via Firebase Authentication (email/password)
- ➕ Add habits with a name and color
- 📅 Click a habit to open a full month calendar and check off days
- 🔥 Streak tracking per habit
- 📊 Graphs: 30-day consistency per habit (bar chart) + 14-day trend (line chart)
- ☁️ Data stored in Firestore — syncs live across your phone, laptop, any browser
- 📱 iPhone-friendly: safe-area aware, supports "Add to Home Screen" as a full-screen app

## One-time setup: create your free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with any Google account.
2. **Add project** → give it any name (e.g. `my-habit-tracker`) → you can skip Google Analytics → **Create project**.
3. **Enable Authentication:**
   - In the left sidebar: **Build → Authentication → Get started**.
   - Under **Sign-in method**, enable **Email/Password**.
   - Go to the **Users** tab → **Add user** → enter the email + password you (the one user) will log in with.
4. **Enable Firestore:**
   - In the left sidebar: **Build → Firestore Database → Create database**.
   - Choose any region close to you → start in **production mode**.
5. **Set Firestore security rules** so only your signed-in account can read/write your data:
   - Go to **Firestore Database → Rules** tab.
   - Replace the contents with what's in [`firestore.rules`](firestore.rules) in this repo, then **Publish**.
6. **Get your web app config:**
   - Go to **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web) icon → register the app (any nickname, no need for Firebase Hosting).
   - Copy the `firebaseConfig` object it shows you.
7. Paste those values into [`js/firebase-config.js`](js/firebase-config.js), replacing the placeholders.

> Note: This config (`apiKey`, `projectId`, etc.) is **not a secret** — it's
> normal and safe for it to be public in your deployed site / GitHub repo.
> What actually protects your data is the sign-in requirement + the
> Firestore rules from step 5, which only allow your authenticated user to
> touch their own data.

## Run locally

Serve the folder with any static server (must be served over `http://`, not
opened as a `file://` path, for the Firebase SDK's ES modules to work), e.g.:

```bash
npx serve .
```

## Deploy to GitHub Pages (free)

1. Push this repo to GitHub (make sure `js/firebase-config.js` has your real values filled in first).
2. Go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`.
4. Pick the `main` branch and `/ (root)` folder, then Save.
5. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

```bash
git add .
git commit -m "Initial habit tracker"
git push origin main
```

Then enable Pages as described above.

One more Firebase step once you know your Pages URL: go to **Authentication
→ Settings → Authorized domains** in the Firebase console and add your
`<your-username>.github.io` domain, otherwise sign-in will be blocked from
that origin.

## Using it on iPhone

Open the deployed URL in Safari, sign in, then tap **Share → Add to Home
Screen** — it'll behave like a real installed app (full screen, themed,
proper icon), while still just being your free static site.

## Cost

Firebase's free **Spark** plan needs no credit card and its daily limits
(50K reads / 20K writes / 1 GiB storage) are far beyond what a single-user
habit tracker will ever use. This stays $0 unless you deliberately upgrade
to the paid Blaze plan.

## Other free deployment / hosting alternatives

GitHub Pages + Firebase (what's implemented here) is a solid free combo for
a single user who wants cross-device sync. Other free options if you ever
want to move off GitHub Pages for hosting the static files themselves:

| Option | Why you might use it |
|---|---|
| **Cloudflare Pages** | Free static hosting, fast global CDN. |
| **Netlify / Vercel (free tier)** | Free static hosting with easy custom domains and instant deploys from GitHub. |
| **Firebase Hosting (free tier)** | Since you're already using Firebase for auth/data, you could host the static files there too instead of GitHub Pages. |
