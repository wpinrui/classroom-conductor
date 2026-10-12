# Classroom Conductor

A reusable classroom orchestration website. See `design-document.md` for the plan
and `docs/applet-contract.md` for how to write an applet.
`docs/applet-authoring.md` is the full guide for agents that write applets.

## Develop

```
yarn
cp .env.example .env.local   # VITE_FIREBASE_EMULATOR=true, no Firebase project needed
yarn emulators               # auth + database emulators, needs Java
yarn dev
```

Teacher: `/teacher`. Students: `/`. Try it with `examples/counter.html`.

## Checks

```
yarn test        # unit tests
yarn test:rules  # security rules against the database emulator
yarn lint
yarn typecheck
yarn build
```

## Real Firebase project

1. Create a Firebase project with Realtime Database and Authentication.
2. Enable the Google and Anonymous sign-in providers.
3. Fill `.env.local` from the web app config and set `VITE_FIREBASE_EMULATOR=false`.
4. `npx firebase deploy --only database` to publish `database.rules.json`.
