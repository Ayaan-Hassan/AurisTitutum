# HabitFlow PRO | Project Structure Guide

This document serves as a comprehensive map of the HabitFlow PRO codebase, designed for both developers and AI assistants to understand the architecture, data flow, and design system.

## 🏗️ Core Architecture

HabitFlow PRO is a high-performance React application built with **Vite** and **Tailwind CSS v4**. It utilizes a centralized authentication and theming system.

### 📁 Directory Map

- `src/` - Primary source code
    - `components/` - Reusable UI components
        - `ui/` - Atomic UI primitives (Button, Card, Input, Switch, etc.)
        - `Icon.jsx` - Dynamic Lucide icon wrapper
        - `Sidebar.jsx` - Primary navigation and theme management
        - `ThemeProvider.jsx` - Handles Dark/Light mode persistence
    - `contexts/` - Global State Management
        - `AuthContext.jsx` - Firebase Authentication logic and state
    - `pages/` - View-level components
        - `Dashboard.jsx` - The central "Main Console" with real-time stats
        - `Habits.jsx` - Habit Registry for managing behavioral nodes
        - `Analytics.jsx` - Data visualization and habit comparison
        - `Login.jsx` & `Signup.jsx` - Authentication portals
        - `Settings.jsx` - System parameters and user configuration
    - `App.jsx` - Main router and global modal manager
    - `index.css` - Design system variables, glassmorphism, and global animations
    - `firebase.config.js` - Firebase initialization and resilient env loading

## 🛠️ Key Technical Patterns

### 1. Resilient Firebase Integration
The application is designed to handle missing Firebase configuration gracefully. If `.env` keys are missing, it displays a setup guidance screen rather than crashing.
- **File**: `firebase.config.js`, `AuthContext.jsx`

### 2. Design System (index.css)
Uses CSS Variables for theme tokens. Tailwind v4 `@theme` block maps these variables to utility classes.
- **Dark Mode**: Default (`:root`)
- **Light Mode**: Triggered via `[data-theme="light"]` on the html element.
- **Glassmorphism**: Standardized via `.glass-card` class.

### 3. Data Flow
- **Habits**: Managed in `App.jsx` via `useState` and persisted to `LocalStorage`.
- **Logs**: Nested in habit objects. `logActivity` function in `App.jsx` handles immutable state updates.
- **User Config**: Stores avatar, name, and UI preferences (Compact Mode, Reduced Motion).

### 4. Interactive Components
- **Modals**: Centralized in `App.jsx` but triggered via CustomEvents (e.g., `showModal`).
- **Charts**: Built with `Recharts`, responsive and theme-aware.

## 🚀 Environment Variables
Required in `.env`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

---
*Created for HabitFlow PRO Final Enhancement Pass.*
