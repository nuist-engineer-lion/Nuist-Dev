import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { getPostSlug } from "@/utils/getPostPaths";

export async function getStaticPaths() {
  const posts = await getCollection("posts");

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

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
