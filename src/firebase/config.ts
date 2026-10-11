import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

const env = import.meta.env;
export const useEmulator = env.VITE_FIREBASE_EMULATOR === "true";
const projectId = env.VITE_FIREBASE_PROJECT_ID || "demo-classroom-conductor";

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  databaseURL:
    env.VITE_FIREBASE_DATABASE_URL ||
    `http://127.0.0.1:9000?ns=${projectId}-default-rtdb`,
  projectId,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getDatabase(app);

if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}
