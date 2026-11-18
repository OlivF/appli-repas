import { test as base, expect } from "@playwright/test";

// L'indicateur de développement de Next.js se déplace dans n'importe quel coin de l'écran
// (réglage gardé dans .next/dev/cache) : en haut à droite, il couvre l'avatar du compte et
// intercepte le clic. Il n'existe pas en production : on le masque pendant les tests.
export const test = base.extend({
  // « provide » et non « use » : le lint de React prendrait ce nom pour un hook.
  page: async ({ page }, provide) => {
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal { display: none !important; }";
        document.head.append(style);
      });
    });
    await provide(page);
  },
});

export { expect };
