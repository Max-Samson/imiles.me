import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve("dist");
const assetsIgnorePath = resolve(distDir, ".assetsignore");
const legacyTypoPath = resolve(distDir, ".assestsignore");

await mkdir(distDir, { recursive: true });
await rm(legacyTypoPath, { force: true });
await writeFile(assetsIgnorePath, "_worker.js\n", "utf8");
