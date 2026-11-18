// Écrit les icônes de Popote à partir du dessin de components/brand/cocotte.ts :
//   app/icon.svg          favicon vectoriel (couvercle crème dans un onglet sombre)
//   app/favicon.ico       16, 32 et 48 px, pour les navigateurs qui ne lisent pas le SVG
//   app/apple-icon.png    180 px, carré plein (iOS arrondit lui-même)
//   public/icons/icon-192.png, icon-512.png   icônes d'appli (PWA), tuile arrondie
//
// À relancer après une retouche du logo :
//   docker compose exec web node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/brand-icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BRAND_COLORS, cocotteSvg, tileSvg } from "../components/brand/cocotte.ts";

const FAVICON_SVG = cocotteSvg({
  tomato: BRAND_COLORS.tomato,
  brown: BRAND_COLORS.brown,
  darkBrown: BRAND_COLORS.cream,
});

const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

// Un .ico peut contenir des PNG : en-tête, une entrée de 16 octets par taille, puis les images.
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

writeFileSync("app/icon.svg", FAVICON_SVG);

const sizes = [16, 32, 48];
const favicons = await Promise.all(
  sizes.map(async (size) => ({
    size,
    data: await png(cocotteSvg({ tomato: BRAND_COLORS.tomato, brown: BRAND_COLORS.brown, size })),
  })),
);
writeFileSync("app/favicon.ico", ico(favicons));

writeFileSync("app/apple-icon.png", await png(tileSvg({ size: 180, radius: 0 })));
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, await png(tileSvg({ size, radius: 0.225 })));
}

console.log("Icônes écrites : app/icon.svg, app/favicon.ico, app/apple-icon.png, public/icons/icon-{192,512}.png");
