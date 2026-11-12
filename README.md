# SkillSwap — Peer-to-Peer Skill Exchange Platform

SkillSwap is a cross-platform mobile and web application built with **React Native (Expo Router)** and **Supabase**. It enables students and community peers to trade academic and lifestyle skills using a time-and-coin credit economy, complete with real-time chat, session scheduling, and public class Q&A.

> **Live Demo:** `[Insert your Vercel / Netlify / Expo Web URL here]`

---

## Key Features

* **Personalized Home Dashboard:** Displays daily skill recommendations matched to the user's learning goals, upcoming scheduled sessions, and quick-action cards to browse teachers or publish new skill offers.
* **Skill Marketplace & Discovery (`Explore`):** Search and filter peer-offered skills across *Academic* and *Lifestyle* categories, view instructor ratings and coin costs, and participate in expandable public **Class Q&A** threads.
* **Session & Swap Request Management (`Sessions`):** Track `Upcoming`, `Past`, and incoming/outgoing `Requests` with one-tap approval/decline workflows that automatically generate scheduled sessions and meeting links.
* **Real-Time Peer Messaging (`Messages`):** Instant 1-on-1 chat rooms powered by **Supabase Realtime** (`postgres_changes`), supporting dynamic room creation directly from skill listings or active sessions.
* **Coin Economy & Ledger (`Wallet`):** Tracks available coin balances, pending coins awaiting session confirmation, and a filterable transaction history (`All`, `Earned`, `Spent`, `Pending`).
* **User Profiles & Skill Portfolios (`Profile`):** Highlights member trust ratings, session counts, bio, skills offered to teach, and skills sought to learn.

---

## Tech Stack

* **Frontend:** React Native, Expo SDK, Expo Router (file-based navigation), TypeScript
* **UI & Design:** Custom editorial warm-cream & forest-green design system (`#FDF6EC`, `#214E41`, `#F05A28`), ticket-stub card layouts, and `@expo/vector-icons` (`Ionicons`)
* **Backend & Database:** Supabase (PostgreSQL, Row-Level Security, Realtime Subscriptions, Auth)
* **Deployment:** Expo Web static export (`npx expo export --platform web`) hosted on Vercel / Netlify

---

## Project Structure

```text
├── assets/               # App logos, header icons, and visual assets
├── src/                  # Application screens, navigation, and Supabase client
│   ├── app/              # Expo Router pages (Home, Explore, Sessions, Messages, Wallet, Profile)
│   └── lib/              # Supabase client configuration
├── supabase/             # Database schema and seed scripts
├── app.json              # Expo configuration
├── package.json          # Project dependencies and scripts
└── tsconfig.json         # TypeScript configuration

```

---

## Getting Started

### Prerequisites

* Node.js (v18 or newer)
* npm or yarn
* A Supabase project with the required tables (`users`, `skills`, `offered_skills`, `skill_requests`, `swap_requests`, `sessions`, `conversations`, `messages`, `wallet_transactions`)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
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

## Building for Web Deployment

To generate a production-ready static web bundle for Vercel, Netlify, or EAS Hosting:

```bash
npx expo export --platform web

```

The compiled output is generated in the `dist/` directory.

---

## License

This project is licensed under the terms specified in the `LICENSE` file.
