import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import express from "express";

installGlobals();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Warn on missing env vars (do not crash) ──────────────────────────────────
const required = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`⚠️  WARNING: ${key} is not set.`);
  }
}

// ─── Health check — responds immediately, no async dependencies ───────────────
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Load Remix build ─────────────────────────────────────────────────────────
let remixHandler;

try {
  // Build is run as part of Railway's build step (npm run build)
  // so this import should always succeed at runtime.
  const build = await import("./build/server/index.js");

  remixHandler = createRequestHandler({ build, mode: process.env.NODE_ENV });
  console.log("✅ Remix app loaded.");
} catch (err) {
  console.error("❌ Failed to load Remix build:", err.message);
  console.error(
    "   Ensure `npm run build` ran successfully before `npm start`."
  );
}

// ─── All routes → Remix ───────────────────────────────────────────────────────
app.all("*", (req, res, next) => {
  if (!remixHandler) {
    return res.status(503).json({
      status: "error",
      message: "Remix build not loaded. Check build logs.",
    });
  }

  return remixHandler(req, res, next);
});

// ─── Bind to 0.0.0.0 (required for Railway) ──────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`   NODE_ENV : ${process.env.NODE_ENV || "development"}`);
  console.log(`   APP_URL  : ${process.env.SHOPIFY_APP_URL || "(not set)"}`);
});
