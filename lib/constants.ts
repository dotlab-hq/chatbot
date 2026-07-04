import { generateDummyPassword } from "@/lib/db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+@guest\.local$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "Help me write a cover letter for a software engineer role",
  "Explain quantum computing in simple terms",
  "Plan a healthy meal prep for the week",
  "Write me a resignation email that's professional but warm",
];
