import { generateId } from "ai";
import { NextResponse } from "next/server";
import { auth, betterAuthInstance } from "@/app/(auth)/auth";

/**
 * Fire a request through the Better Auth handler without any wrapper.
 * Returns the raw Response so we can read both body and Set-Cookie headers.
 *
 * The path MUST include the /api/auth prefix so the handler can route
 * the request correctly (its internal routes are defined under that prefix).
 */
function authHandler(path: string, init?: RequestInit & { body?: BodyInit }) {
  return betterAuthInstance.handler(
    new Request(
      `${betterAuthInstance.options.baseURL}/api/auth${path.startsWith("/") ? path : `/${path}`}`,
      init
    )
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  // Already have a session → go home
  const session = await auth();
  if (session) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  const email = `guest-${Date.now()}@guest.local`;
  const password = generateId();

  // 1. Create the guest account (autoLogin is false, so no session yet)
  await authHandler("/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Guest" }),
  });

  // 2. Sign in — this gives us the session cookies
  const signInRes = await authHandler("/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const signInBody = await signInRes.text().catch(() => "");
  const { user } = signInBody ? JSON.parse(signInBody) : {};
  const setCookieHeader = signInRes.headers.get("set-cookie");

  // 3. Mark user as guest type (uses raw handler to bypass input: false)
  if (user?.id && setCookieHeader) {
    try {
      const sessionCookie = setCookieHeader.split(";")[0];
      await authHandler("/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          userId: user.id,
          fields: { type: "guest" },
        }),
      });
    } catch {
      // Non-critical — guest type just won't be persisted in the DB
    }
  }

  // 4. Redirect and forward the session cookie so the browser is logged in
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  if (setCookieHeader) {
    response.headers.set("set-cookie", setCookieHeader);
  }
  return response;
}
