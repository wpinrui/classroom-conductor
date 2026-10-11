import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "../firebase/config";

/** Current user, null when signed out, undefined while loading. */
export function useAuth(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(
    auth.currentUser ?? undefined,
  );
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
