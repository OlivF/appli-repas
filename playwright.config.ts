import { defineConfig, devices } from "@playwright/test";

// Lancé par `docker compose run --rm e2e`, sur le réseau de l'hôte : l'appli de dev y répond sur
// http://localhost:3000 et Supabase sur http://127.0.0.1:54321 (le direct de la liste de courses).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      // L'appli est pensée d'abord pour le téléphone.
      name: "telephone",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
