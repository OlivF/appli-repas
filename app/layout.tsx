import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

// Titres : Fraunces, avec son axe SOFT pour des empattements arrondis, « livre de cuisine ».
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});

// Texte : Inter, très lisible à petite taille sur téléphone.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

// Chaque page ne donne que son titre court : « Recettes » devient « Recettes · Popote ».
export const metadata: Metadata = {
  title: {
    default: "Popote · Les repas de la semaine, sans prise de tête.",
    template: "%s · Popote",
  },
  description:
    "Les repas de la semaine, sans prise de tête. Popote propose le menu de toute la famille, en tenant compte des régimes de chacun, et fait la liste de courses.",
  applicationName: "Popote",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1611" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
