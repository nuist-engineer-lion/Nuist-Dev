import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

export const GET: APIRoute = async () => {
  const background = await readFile("public/default-og.jpg");

  const pngBuffer = await sharp(background)
    .resize(1200, 630, { fit: "cover" })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
