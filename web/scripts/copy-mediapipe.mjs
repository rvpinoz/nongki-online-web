// Menyalin file wasm MediaPipe ke public/ supaya di-host sendiri (tanpa CDN pihak ketiga).
// Dijalankan otomatis lewat "postinstall" dan "prebuild"; versinya selalu sama dengan node_modules.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const target = join(root, "public/mediapipe/wasm");
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(source)) {
  console.warn("[copy-mediapipe] @mediapipe/tasks-vision belum terpasang, dilewati.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of files) copyFileSync(join(source, file), join(target, file));
console.log(`[copy-mediapipe] ${files.length} file disalin ke public/mediapipe/wasm`);
