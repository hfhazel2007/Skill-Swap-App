# SkillSwap

A cross-platform peer-to-peer skill exchange mobile and web application built with **React Native**, **Expo (SDK 58)**, **TypeScript**, and **Supabase**. Users can discover skills, send learning requests, host live video tutoring sessions, message partners in real time, and earn or spend SkillCoins through an integrated wallet system.

🌐 **Live Web Demo:** [https://freefish012-skillswap.expo.app](https://freefish012-skillswap.expo.app)

---

## Demo Accounts

You can sign in with any of the following pre-configured demo accounts:

| Full Name | Email | Password |
| :--- | :--- | :--- |
| Alex Johnson | `alex@example.com` | `cust123` |
| Sophia Chen | `sophia@example.com` | `cust123` |
| Carlos Gomez | `carlos@example.com` | `cust123` |
| David Miller | `david@example.com` | `cust123` |
| Elena Rostova | `elena@example.com` | `cust123` |
---

## Core Features

* **Authentication & Profiles:** User registration, login, and profile management backed by Supabase and React Context (`auth_context.tsx`).
* **Skill Discovery & Posting:** Browse available courses and peer instructors (`explore.tsx`, `detailPost.tsx`, `lecturerProfile.tsx`) or publish new skills to teach (`post.tsx`).
* **Session & Request Management:** 3-tab session workflow (`Upcoming`, `Past`, `Requests`) supporting incoming teaching approvals, outgoing learning requests, cancellations, and session completion (`session.tsx`).
* **Real-Time Video Calling:** Automatic video meeting link generation upon session approval (`daily.ts`) so learners and teachers can join sessions directly from the app.
* **Coin Wallet & Ledger:** Automated transaction tracking (`wallet.tsx`) that creates `PENDING` coin earnings when a request is approved and credits the teacher's `coin_balance` (`EARNED`) once a session is marked complete.
* **Direct Messaging:** Built-in partner messaging (`messages.tsx`) accessible from session cards and skill listings.

---

## Tech Stack

* **Frontend:** React Native, Expo SDK 58, Expo Router, TypeScript
* **Backend & Database:** Supabase (PostgreSQL, Row-Level Security, Edge Functions)
* **Video Conferencing:** Daily.co / WebRTC Meeting Room Integration
* **Hosting & Deployment:** EAS Hosting (`freefish012-skillswap.expo.app`)

---

## Project Structure

* `src/app/` – File-based screens (`_layout.tsx`, `index.tsx`, `home.tsx`, `explore.tsx`, `detailPost.tsx`, `post.tsx`, `lecturerProfile.tsx`, `messages.tsx`, `session.tsx`, `wallet.tsx`, `profile.tsx`, `navbar.tsx`)
* `src/context/` – Authentication state management (`auth_context.tsx`)
* `src/lib/` – Supabase client configuration (`supabase.ts`) and video room helper (`daily.ts`)

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install



2. **Start the app**
```bash
npx expo start

```


In the output, you'll find options to open the app in a:

* [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
* [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
* [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
* [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project Structure

* `src/app/` — File-based screens (`index.tsx`, `home.tsx`, `explore.tsx`, `post.tsx`, `detail_post.tsx`, `lecture_profile.tsx`, `messages.tsx`, `session.tsx`, `profile.tsx`, `navbar.tsx`)
* `src/context/` — Authentication state management (`auth_context.tsx`)
* `src/lib/` — Supabase client configuration (`supabase.ts`)

