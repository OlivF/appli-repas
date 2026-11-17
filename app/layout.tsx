import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Police très lisible, y compris pour les enfants qui lisent leur prénom dans la grille.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
  // Next.js n'a pas les métriques de cette police pour ajuster la police de secours.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Nos repas",
  description: "Le menu de la semaine, pour toute la famille.",
};

export const viewport: Viewport = {
  themeColor: "#2346a0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={atkinson.variable}>
      <body>{children}</body>
    </html>
  );
}
