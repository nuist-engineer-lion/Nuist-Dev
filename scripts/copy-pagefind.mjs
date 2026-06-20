import { cp, rm, access } from "node:fs/promises";
import { constants } from "node:fs";

const source = new URL("../dist/pagefind", import.meta.url);
const target = new URL("../public/pagefind", import.meta.url);

try {
  await access(source, constants.F_OK);
} catch {
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });
