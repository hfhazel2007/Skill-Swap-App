
# 🤝 SkillSwap — Peer-to-Peer Skill Exchange Platform

**SkillSwap** is a cross-platform mobile and web application built with **React Native (Expo Router)** and **Supabase**. It enables students and community peers to trade academic and lifestyle skills using a time-and-coin credit economy, complete with real-time chat, session booking, request tracking, and public class Q&A.

[![Expo Web Deploy](https://img.shields.io/badge/Live_Demo-freefish012--myfirstapp.expo.app-245748?style=for-the-badge&logo=expo&logoColor=fff)](https://freefish012-myfirstapp.expo.app/) 
[![GitHub license](https://img.shields.io/github/license/freefish012/SkillSwap?style=for-the-badge&color=B84E38)](LICENSE)

> 🚀 **Try the Live Demo:** [https://freefish012-myfirstapp.expo.app/](https://freefish012-myfirstapp.expo.app/)

<p align="center">
  <img src="assets/headerIcon/skillSwap.png" width="220" alt="SkillSwap Logo" />
</p>

---

## ✨ Key Features

* **🏠 Personal Dashboard (`Home`):** Displays daily skill recommendations matched to the user's learning goals, upcoming scheduled sessions, and quick-action cards to browse teachers or publish new skill offers.
* **🔍 Skill Marketplace & Booking (`Explore`):** Search and filter peer-offered skills across *Academic* and *Lifestyle* categories, view instructor ratings, send session booking requests with custom notes, and participate in expandable public **Class Q&A** threads.
* **📅 Sessions & Swap Requests (`Sessions`):** Organize schedules across `Upcoming`, `Past`, and `Requests`. Manage incoming teaching requests with one-tap **Approve / Decline** workflows that auto-generate scheduled sessions and meeting links, and track outgoing **Pending** learning requests with cancellation status updates.
* **💬 Real-Time Peer Messaging (`Messages`):** Instant 1-on-1 chat rooms powered by **Supabase Realtime** (`postgres_changes`), supporting dynamic room creation directly from skill listings or active sessions.
* **🪙 Coin Economy & Ledger (`Wallet`):** Tracks available coin balances, pending coins awaiting session confirmation, and a filterable transaction history (`All`, `Earned`, `Spent`, `Pending`).
* **👤 Dynamic Skill Portfolio (`Profile`):** Highlights member trust ratings, session counts, bio, and interactive **Add / Delete** management for skills offered to teach and skills sought to learn.

---

## 🛠 Tech Stack

```text
💻 FRONTEND    : React Native (Expo SDK), Expo Router, TypeScript
🎨 UI & DESIGN : Warm editorial design system (#FDF6EC, #214E41, #F05A28), Ticket-stub layouts
🗄️ BACKEND     : Supabase (PostgreSQL Database, Row-Level Security, Realtime Subscriptions)
🚀 DEPLOYMENT  : Expo Web Static Export hosted on EAS Hosting

```

---

## 📁 Project Structure

```text
├── 🎨 assets/           # App logos, header icons, and visual assets
├── 📦 src/              # Application screens, navigation, and Supabase client
│   ├── 📱 app/          # Expo Router pages (Home, Explore, Sessions, Messages, Wallet, Profile)
│   └── 🔌 lib/          # Supabase client configuration
├── 🗃️ supabase/         # Database schema, RLS policies, and seed scripts
├── ⚙️ app.json          # Expo configuration
├── 📄 package.json      # Project dependencies and scripts
└── 🛠️ tsconfig.json     # TypeScript configuration

```

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v18 or newer)
* npm or yarn
* A Supabase project with the required database tables (`users`, `skills`, `offered_skills`, `skill_requests`, `swap_requests`, `sessions`, `conversations`, `messages`, `wallet_transactions`) and RLS policies configured.

### Installation

1. **Clone the repository:**
```bash
git clone [https://github.com/freefish012/](https://github.com/freefish012/)<your-repo-name>.git
cd <your-repo-name>

```


2. **Install dependencies:**
```bash
npm install

```


3. **Configure environment variables:**
Create a `.env` file in the root directory and add your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

```


4. **Run the application:**
* **Start Expo Dev Server (Mobile & Web):**
```bash
npx expo start

```


* **Run directly in Web Browser:**
```bash
npx expo start --web

```





---

## 📦 Building for Web Deployment

To generate a production-ready static web bundle for EAS Hosting, Vercel, or Netlify:

```bash
npx expo export --platform web

```

The compiled output is generated in the `dist/` directory.

---

## 📜 License

This project is licensed under the terms specified in the `LICENSE` file.

```

```
