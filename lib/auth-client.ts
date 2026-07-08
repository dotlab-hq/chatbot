import { createAuthClient } from "better-auth/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { useCallback, useEffect, useState } from "react";

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "",
  plugins: [adminClient(), organizationClient()],
});

export const { signIn, signUp, signOut } = authClient;

/**
 * React hook that subscribes to the Better Auth session nanostore atom.
 * Returns { data, isPending, isRefetching, refetch }.
 *
 * Better Auth's client exposes useSession as a nanostore Atom (not a
 * React hook), so we manually subscribe to it.
 */
export function useSession() {
  const sessionAtom = authClient.useSession;

  // Get the atom's inferred value type via its .get() return.
  type AtomValue = ReturnType<typeof sessionAtom.get>;
  const [value, setValue] = useState<AtomValue>(() => sessionAtom.get());

  useEffect(() => {
    const unsub = sessionAtom.listen((v) => {
      // The listen callback receives the same type as .get()
      setValue(v as AtomValue);
    });
    return unsub;
  }, [sessionAtom.listen]);

  const refetch = useCallback(async () => {
    try {
      await authClient.$fetch("/get-session", { method: "GET" });
    } catch {
      // best-effort refresh
    }
  }, []);

  return {
    data: value?.data ?? null,
    isPending: value?.isPending ?? true,
    isRefetching: value?.isRefetching ?? false,
    refetch,
  };
}
