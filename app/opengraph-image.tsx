import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_COLORS, cocotteSvg, tileSvg } from "@/components/brand/cocotte";

// L'image des partages (messageries, réseaux) : le logo et le slogan sur fond crème, avec à
// droite l'icône de l'appli, un peu penchée. Générée une fois, au build.
export const alt = "Popote : les repas de la semaine, sans prise de tête.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export default async function OpengraphImage() {
  // next/font ne sert pas ici : la police est lue depuis le dépôt (app/fonts/README.md).
  const fraunces = await readFile(join(process.cwd(), "app/fonts/fraunces-600-soft.ttf"));
  const mark = dataUri(cocotteSvg({ tomato: BRAND_COLORS.tomato, brown: BRAND_COLORS.brown }));
  const tile = dataUri(tileSvg({ size: 290, radius: 0.225 }));

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "0 100px 0 96px",
          background: BRAND_COLORS.paper,
          color: BRAND_COLORS.brown,
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img src={mark} width={92} height={92} alt="" />
            <span style={{ fontSize: 84, lineHeight: 1, letterSpacing: -1 }}>Popote</span>
          </div>
          {/* Deux lignes choisies : pas de mot seul en bout de slogan. */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48, fontSize: 58, lineHeight: 1.12, letterSpacing: -0.6 }}>
            <span>Les repas de la semaine,</span>
            <span>sans prise de tête.</span>
          </div>
        </div>
        <img
          src={tile}
          width={290}
          height={290}
          alt=""
          style={{ transform: "rotate(-6deg)", boxShadow: "0 30px 60px -24px rgba(92, 58, 32, 0.45)", borderRadius: 65 }}
        />
      </div>
    ),
    { ...size, fonts: [{ name: "Fraunces", data: fraunces, weight: 600, style: "normal" }] },
  );
}
