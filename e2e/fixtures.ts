import { test as base, expect, type Page } from "@playwright/test";

// L'indicateur de développement de Next.js se déplace dans n'importe quel coin de l'écran
// (réglage gardé dans .next/dev/cache) : en haut à droite, il couvre l'avatar du compte et
// intercepte le clic. Il n'existe pas en production : on le masque pendant les tests (aussi
// sur les pages des contextes ouverts à la main : un second téléphone).
export async function hideDevIndicator(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  });
}

export const test = base.extend({
  // « provide » et non « use » : le lint de React prendrait ce nom pour un hook.
  page: async ({ page }, provide) => {
    await hideDevIndicator(page);
    await provide(page);
  },
});

export { expect };
