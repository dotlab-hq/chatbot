import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: Drizzle ORM requires namespace imports for schema resolution
import * as schema from "@/lib/db/schema";

const client = postgres(process.env.POSTGRES_URL ?? "");

export const db = drizzle(client, { schema });
