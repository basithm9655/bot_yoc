# Manavar Illam - Club Attendance Tracker (Supabase + Vercel Free Plan)

A sleek, dark-mode, sapphire-glass daily club attendance PWA designed for mobile devices and iPhones, powered by **Supabase Free Tier** and deployed on **Vercel Free Tier**.

---

## 📱 Highlights & Features

- **Manavar Illam Club Architecture**: Built specifically for club attendance tracking with **Club Admin**, **Coordinator**, and **Member** workflows.
- **Admin Exemption from Attendance**: Club Admins never have to mark attendance for themselves! On login, admins enter directly into the executive management suite.
- **Admin Approval Dashboard**:
  - Prominent verification queue for pending club members.
  - One-tap **✓ Approve** and **✕ Reject** buttons.
  - Batch **Approve All** button when multiple members register.
  - Ethereal floating ghost empty state when the queue is clear.
- **Attendance Leaderboard & Rankings 🏆**:
  - Members are dynamically ranked from highest attendance to lowest.
  - 🥇 **Rank #1 Champion** with gold crown and shimmering gold card.
  - 🥈 **Rank #2 Silver** and 🥉 **Rank #3 Bronze** podium awards.
  - Displays sessions attended, attendance percentage, streak indicators, and animated gradient progress bars.
- **Database Danger Zone (Wipe Complete Data Directly from App)**:
  - Admin can wipe all attendance logs or perform a complete factory wipe (removing all attendance + all non-admin club members from Supabase).
  - Multi-tier safety verification requiring typing `DELETE` to prevent accidental resets.
- **Beautiful Vector Ghost Mascot App Icons**:
  - High-resolution frosted glass ghost mascot icon with glowing sapphire aura and attendance checkmark badge.
  - Generated in all resolutions (`icon-512.png`, `icon-192.png`, `icon-maskable.png`, `apple-touch-icon.png`, and `favicon.png`).
- **Reusable Floating Ghost Loading Animations**:
  - Interactive ghost loading screen during login, member approvals, data wipes, and CSV exports.
- **Roll Number & Department Auto-Detection (PSG Tech Mapping)**:
  - Members enter their Roll Number (e.g. `25U201`, `24Z105`).
  - The app **automatically detects and auto-fills** the Batch Year (e.g. `2025`) and Department (e.g. `Instrumentation & Control Engineering (B.E.)`, `Computer Science & Engineering`) using [`DEPT_CODES.md`](file:///home/basi/Projects/YOC%20BOT/DEPT_CODES.md) mapping in real-time.
  - Members can seamlessly log in with their Roll Number (e.g. `25U201`), Email, or Phone.
- **One-Time Persistent Login & Fast-Boot Cache**:
  - `localStorage` profile pre-caching ensures **instant 0ms cold launch** on mobile phones without waiting for network roundtrips.
  - Tokens are automatically kept alive by Supabase GoTrue Auth so members never have to re-enter passwords once logged in.
- **Download Attendance CSV**: One-tap export with UTF-8 BOM encoding for direct opening in Excel or Google Sheets, including Member Name, Roll Number, Department, Batch Year, Email/Phone, Date, Status, and Time.
- **Ultra-Polished Ghost Theme Login Page**:
  - Centerpiece floating ghost mascot holding a glowing sapphire attendance shield badge.
  - Dynamic status island pill (`Manavar Illam Portal`) with pulsing LED indicator.
  - Deep frosted glass elevated card (`zentra-card-elevated`) with top specular refraction edge.
  - Sleek input fields with user ID & lock SVG icons and mobile password visibility reveal toggle.
  - High-conversion gradient action button with subtle shimmer and tactile tap scaling.
- **Living Animated Member Attendance Page**:
  - **Concentric Living Ripple Waves**: Radiant photonic rings radiating continuously behind the attendance button orb (`ripple-wave-1`, `ripple-wave-2`).
  - **Interactive Companion Ghost**: Floating mini mascot in the header that switches to celebratory dance (`ghost-celebrate`) when attendance is logged. Tap/poke the mascot for encouraging club toasts!
  - **Staggered Smooth Entrance Transitions**: Header (`anim-stagger-1`), action orb (`anim-stagger-2`), and summary card (`anim-stagger-3`) rise smoothly into place.
  - **Fluid Circular Progress Bar**: Smooth vector stroke transition (`stroke-dashoffset`) showing attendance percentage.
- **Live Real-Time Password & Confirm Verification**:
  - Instant live validation as users type on mobile with dynamic status indicator pill.
  - Interactive eye toggle buttons to reveal and verify passwords.
  - Length meter (`Password needs at least 6 characters`) and match indicator (`✓ Passwords match`).
  - Active color-coded focus rings (emerald on match, rose on mismatch).
- **PWA Capabilities**:
  - Installable on Android, Chrome, and iOS (iPhone Safari).
  - Service Worker cache (`manavar-illam-pwa-v7`) for instant loading and offline support.

---

## 🚀 Deployment to Vercel (100% Free Tier)

Deploying takes less than 1 minute:

### Option 1: Via Vercel CLI (Instant)
```bash
npx vercel --prod
```

### Option 2: Via GitHub & Vercel Dashboard
1. Push this folder to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Manavar Illam Club Attendance Tracker PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/manavar-illam-tracker.git
   git push -u origin main
   ```
2. Go to [https://vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Leave Framework Preset as **Other** (static web app).
5. Click **Deploy**.
6. Your app is live at `https://your-project.vercel.app`!

---

## 📲 Installing the PWA on Phones

### On Android / Chrome:
1. Open your Vercel URL in Chrome.
2. Tap the **Install App** button on the banner at the bottom (or tap the 3-dots menu -> **Install app** / **Add to Home screen**).
3. The app icon appears on your home screen and launches in full-screen standalone mode.

### On iPhone (iOS Safari):
1. Open your Vercel URL in Safari.
2. Tap the **Share** button (the square with an arrow pointing upward `↑` at the bottom navigation bar).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The app launches full-screen with Apple SF Pro typography and native status bar styling.

---

## 🔐 Credentials Summary

- **Club Admin Username**: `yoc@psg`
- **Club Admin Password**: `yoc@basi`
- **Supabase Backend**: Fully configured and active on `https://itsgtoippjfkvspooodb.supabase.co`

---

## 👥 Roles & Workflow

1. **Club Admin (`yoc@psg`)**:
   - Accesses the **Admin Console** tab.
   - Reviews pending member approvals.
   - Approves or removes members with one tap.
   - Monitors live attendance logs and exports comprehensive CSV reports.
2. **Club Members**:
   - Register with Roll Number (auto-fills Department and Batch Year), Email, and Password.
   - Wait for instant one-tap admin approval.
   - Check in daily with tactile glass chime and confetti.
   - Persistent one-time login with instant cold-boot caching.
