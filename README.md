# Tic-Tac-Toe

A responsive Vue 3 Tic-Tac-Toe game with solo play against a beatable computer and online play with a friend via Firebase Realtime Database.

Choose Light, Dark, or System from the header. System follows your device's appearance setting, and your choice is remembered in this browser.

## Requirements

- Node.js 20.19+ or 22.12+
- A Firebase project for online multiplayer

## Run locally

```sh
npm install
npm run dev
```

## Enable online play

1. Create a Firebase project and register a web app.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create a **Realtime Database** and deploy [`database.rules.json`](./database.rules.json) as its rules.
4. Copy `.env.example` to `.env` and fill in the web app's Firebase configuration, including the Realtime Database URL.
5. Restart the dev server after changing environment variables.

Firebase web configuration is public client configuration, not a server secret. Realtime Database rules require anonymous authentication, limit writes to room participants, validate the room data shape, and allow joining only while a room is waiting. Room codes are randomly generated and serve as the invitation. The app applies each move as an atomic transaction so simultaneous moves cannot overwrite each other.

If Firebase is not configured, solo play remains available and the online setup screen explains what is missing.

## Validate and build

```sh
npm test
npm run build
```
