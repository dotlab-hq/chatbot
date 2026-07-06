// import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  account,
  invitation,
  member,
  organization as orgTable,
  session,
  user,
  verification,
} from "@/lib/db/schema";

const schema = {
  user,
  session,
  account,
  verification,
  organization: orgTable,
  member,
  invitation,
};

export type UserType = "guest" | "regular";

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    type: UserType;
    role: string;
  };
}

export interface User {
  id?: string;
  email?: string | null;
  name?: string | null;
  type?: UserType;
}

export const betterAuthInstance = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: false,
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      type: {
        type: "string",
        required: false,
        defaultValue: "regular",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoLogin: false,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
  plugins: [admin(), organization(), sso(), nextCookies()],
});

/**
 * Server-side session getter. Drop-in replacement for NextAuth's auth().
 * Returns: { user: { id, email, name, type } } | null
 */
export async function auth(): Promise<Session | null> {
  const session = await betterAuthInstance.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const u = session.user as Record<string, unknown>;
  return {
    user: {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      image: (u.image as string) || null,
      type: (u.type as UserType) || "regular",
      role: (u.role as string) || "user",
    },
  };
}

/** Route handler for the catch-all API route */
export const handler = betterAuthInstance.handler;
