import type { FontData } from "astro:assets";

export function getFontPathByWeight(
  fonts: FontData[],
  weight: number,
  options?: {
    style?: "normal" | "italic";
    format?: string;
  }
): string | undefined {
  const style = options?.style ?? "normal";
  const format = options?.format ?? "truetype";

  let fallback: string | undefined;

  for (const font of fonts) {
    if (font.style !== style) continue;

    const hasExactWeight = font.weight === String(weight);
    const hasRangeWeight =
      typeof font.weight === "string" &&
      font.weight.includes(" ") &&
      (() => {
        const [min, max] = font.weight.split(" ").map(Number);
        return Number.isFinite(min) && Number.isFinite(max)
          ? weight >= min && weight <= max
          : false;
      })();

    if (hasExactWeight || hasRangeWeight) {
      const src = font.src.find(file => file.format === format) ?? font.src[0];
      if (src) return src.url;
    } else if (!fallback) {
      const src = font.src.find(file => file.format === format) ?? font.src[0];
      if (src) fallback = src.url;
    }
  }

  return fallback;
}
