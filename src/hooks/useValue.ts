import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { db } from "../firebase/config";

/**
 * Live value at a database path. undefined while loading, null when absent or
 * unreadable. A null path subscribes to nothing.
 */
export function useValue<T>(path: string | null): T | null | undefined {
  const [value, setValue] = useState<{ path: string | null; v: T | null }>();
  useEffect(() => {
    if (!path) return;
    return onValue(
      ref(db, path),
      (snap) => setValue({ path, v: snap.exists() ? (snap.val() as T) : null }),
      () => setValue({ path, v: null }),
    );
  }, [path]);
  if (!path) return null;
  return value?.path === path ? value.v : undefined;
}
