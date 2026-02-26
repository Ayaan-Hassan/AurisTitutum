# AurisTitutum | PRO

Habit-tracking app with analytics, logs, and Auris AI chatbot.

## Auris AI (OpenAI) API key

To use the **Auris** chatbot in the sidebar:

1. **Get an API key:** Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys), sign in or create an account, and create a new secret key.
2. **Put it in the project:** In the project root, create or edit `.env` and add:
   ```
   VITE_OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart the dev server (`npm run dev`). The key is read at build time and is not editable from the app (Settings shows "Default API key (locked)").

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
