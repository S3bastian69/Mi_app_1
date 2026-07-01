import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

await import("./converter.test.mjs");

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const port = 4174;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server.mjs"], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("El servidor de prueba no inició.");
}

try {
  await waitForServer();
  const resources = [
    "/", "/app.js", "/startup-check.js", "/converter-core.mjs", "/excel-workbook.mjs", "/excel-style.mjs", "/firebase-config.js", "/firebase-cloud.js", "/styles.css", "/service-worker.js",
    "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png",
    "/vendor/pdf.min.mjs", "/vendor/pdf.worker.min.mjs", "/vendor/xlsx.full.min.js", "/vendor/jszip.min.js",
    "/vendor/firebase-app-compat.js", "/vendor/firebase-auth-compat.js",
    "/vendor/firebase-firestore-compat.js", "/vendor/firebase-storage-compat.js"
  ];
  for (const resource of resources) {
    const response = await fetch(`${origin}${resource}`);
    assert.equal(response.status, 200, `${resource} debe responder 200`);
    await response.arrayBuffer();
    assert.ok(Number(response.headers.get("content-length") || 1) > 0, `${resource} no debe estar vacío`);
  }

  const converterResponse = await fetch(`${origin}/converter-core.mjs`);
  assert.match(converterResponse.headers.get("content-type") || "", /javascript/);
  await converterResponse.arrayBuffer();

  const html = await (await fetch(origin)).text();
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /apple-touch-icon\.png/);
  assert.match(html, /id="selectButton"/);
  assert.match(html, /startup-check\.js/);
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:\/\//, "Los SDK deben servirse localmente");
  assert.match(html, /id="authButton"/);
  assert.match(html, /id="historySection"/);

  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  const cloudCode = await readFile(new URL("../firebase-cloud.js", import.meta.url), "utf8");
  const firestoreRules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  const storageRules = await readFile(new URL("../storage.rules", import.meta.url), "utf8");
  assert.match(cloudCode, /users\/\$\{currentUser\.uid\}\/conversions/);
  assert.match(firestoreRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /100 \* 1024 \* 1024/);
  console.log(`OK: ${resources.length} recursos PWA disponibles; manifiesto instalable validado.`);
} finally {
  server.kill();
}
