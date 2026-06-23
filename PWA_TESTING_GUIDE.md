# 🧪 Testing PWA Install on Desktop & Mobile

## 🖥️ **Desktop Testing (Chrome/Edge/Brave)**

### Requirements for PWA Install to Show:

1. ✅ **HTTPS or localhost** - App must be served securely
2. ✅ **Valid manifest.json** - Already configured
3. ✅ **Service worker registered** - Handled by vite-plugin-pwa
4. ✅ **User engagement** - Browser requires user to interact with page first

### How to Test on Desktop:

#### Method 1: Check Browser Install Icon

1. **Open your app** in Chrome/Edge/Brave
2. **Look in the address bar** (right side) for an install icon:
   - ⊕ Plus icon in a circle, OR
   - 💾 Install icon
3. **Click it** to install

#### Method 2: Check Chrome Menu

1. Open your app
2. Click **menu (⋮)** in top-right
3. Look for **"Install Track My Day..."** or **"Install app"**
4. Click to install

#### Method 3: Use Install Button in App

1. **Open the app**
2. **Wait 2-3 seconds** for page to fully load
3. Look for the **Download icon** in the app header (top-right)
4. If you see it, click to install
5. If you **don't see it**, it means browser criteria aren't met yet

### Why Install Option Might Not Show:

❌ **Not served over HTTPS** - Production deployment needed
  - Localhost works for testing
  - HTTP URLs won't work (except localhost)

❌ **Service worker not registered yet**
  - Open DevTools (F12)
  - Go to **Application** tab → **Service Workers**
  - Should see service worker registered
  - If not, refresh page and wait

❌ **Already installed**
  - App might already be installed
  - Check your apps list (Windows Start Menu, Mac Launchpad)
  - Uninstall first, then try again

❌ **Browser criteria not met**
  - Chrome requires user to visit twice over 2 separate days
  - OR user must engage with page (click, scroll, etc.)
  - **Solution**: Just interact with the page, wait a few seconds

❌ **Incognito/Private mode**
  - PWA install doesn't work in private browsing
  - Use a regular browser window

### Force Install Prompt to Show (Testing):

```javascript
// Open browser console (F12) and run:
localStorage.removeItem('pwa-hide-install')
location.reload()
```

---

## 📱 **Mobile Testing**

### Android (Chrome/Edge/Samsung Internet)

#### Via Browser Menu:
1. Open your app in Chrome/Edge/Samsung Internet
2. Tap **menu (⋮)** in browser
3. Tap **"Add to Home screen"** or **"Install app"**
4. Confirm installation
5. App icon appears on home screen

#### Via In-App Banner:
1. Open the app
2. Look for the **"Install Track My Day"** banner (purple card)
3. Tap **"Install Now"** button
4. Confirm in browser prompt

### iPhone/iPad (Safari)

**Note:** iOS Safari doesn't support the install prompt API, so the "Install Now" button won't work.

#### Manual Installation:
1. Open app in **Safari** (not Chrome!)
2. Tap **Share button** (⬆️ box with arrow)
3. Scroll down, tap **"Add to Home Screen"**
4. Edit name if desired
5. Tap **"Add"**
6. App icon appears on home screen

---

## 🔍 **Debugging Install Issues**

### Step 1: Check DevTools (Desktop)

Press **F12** to open DevTools, then:

#### Application Tab:
1. Click **"Application"** tab (top)
2. Check **"Manifest"**:
   - Should show "Track My Day"
   - Icon should be visible
   - If errors, manifest isn't loading

3. Check **"Service Workers"**:
   - Should show a service worker for your domain
   - Status should be "activated"
   - If none, refresh and wait

#### Console Tab:
1. Click **"Console"** tab
2. Look for errors (red text)
3. Common issues:
   - `Manifest: Line: 1, column: 1, Syntax error` - Manifest invalid
   - `Service worker registration failed` - SW not loading

#### Lighthouse Tab:
1. Click **"Lighthouse"** tab
2. Select **"Progressive Web App"**
3. Click **"Analyze page load"**
4. Shows PWA checklist with pass/fail

### Step 2: Check Network Tab

1. Open **Network** tab in DevTools
2. Refresh page (Ctrl+R)
3. Filter by "manifest"
4. Should see: `manifest.json` with status **200 OK**
5. Click it to see the content
6. If **404**, manifest isn't being served

### Step 3: Verify HTTPS/Localhost

In address bar:
- ✅ `https://your-domain.com` - Good!
- ✅ `http://localhost:5173` - Good for testing!
- ❌ `http://your-domain.com` - Won't work (needs HTTPS)

### Step 4: Check Install Criteria

Run this in browser console:

```javascript
// Check if beforeinstallprompt event fires
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('✅ App is installable!', e);
});

// Check if already in standalone mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('✅ Already running as installed app');
} else {
  console.log('ℹ️ Running in browser (not installed yet)');
}
```

---

## ✅ **Successful Install Indicators**

### Desktop:
- App opens in **standalone window** (no address bar)
- App appears in **Start Menu** (Windows) or **Applications** (Mac)
- Can **pin to taskbar/dock**
- **Window icon** shows your app icon

### Mobile:
- App icon on **home screen**
- Opens **fullscreen** (no browser UI)
- Appears in **app switcher** as separate app
- Can be **organized in folders** like native apps

---

## 🎯 **Quick Test Checklist**

- [ ] App is served over **HTTPS or localhost**
- [ ] Open **DevTools** → **Application** → Check Manifest loads
- [ ] Check **Service Workers** tab shows active worker
- [ ] **Interact** with page (click, scroll)
- [ ] Wait **2-3 seconds** for install prompt
- [ ] Look for **install icon** in address bar or app header
- [ ] If on **mobile**, check browser menu for "Add to Home screen"

---

## 🚀 **Deployment for Full PWA Support**

To enable PWA install on desktop/laptop, deploy to:

### Free Hosting Options:
- **Vercel** - https://vercel.com (automatic HTTPS)
- **Netlify** - https://netlify.com (automatic HTTPS)
- **GitHub Pages** - https://pages.github.com (automatic HTTPS)
- **Cloudflare Pages** - https://pages.cloudflare.com (automatic HTTPS)

All provide:
✅ Free HTTPS certificates
✅ Automatic deployment from Git
✅ Full PWA support
✅ Custom domains

---

## 📊 **Testing Results**

| Environment | Install Works? | Notes |
|-------------|---------------|-------|
| Localhost | ✅ Yes | Testing only |
| HTTP (production) | ❌ No | Needs HTTPS |
| HTTPS (production) | ✅ Yes | Full support |
| Chrome Desktop | ✅ Yes | With HTTPS |
| Edge Desktop | ✅ Yes | With HTTPS |
| Safari Desktop | ⚠️ Limited | Basic support |
| Chrome Android | ✅ Yes | Full support |
| Samsung Internet | ✅ Yes | Full support |
| Safari iOS | ⚠️ Manual | No API support |

---

Need to deploy? See deployment guides for Vercel, Netlify, or GitHub Pages.
