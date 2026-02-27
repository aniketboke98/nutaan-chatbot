import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import { execSync } from "child_process";
import express from "express";

installGlobals();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Validate critical env vars (warn, don't crash) ──────────────────────────
const requiredEnvVars = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.warn(`⚠️  WARNING: Environment variable ${key} is not set.`);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────
// Must respond immediately — this is what Railway polls.
// No DB or async dependencies here.
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node: process.version,
  });
});

// ─── Start listening IMMEDIATELY ──────────────────────────────────────────────
// Railway considers the service healthy once /health returns 200.
// We bind BEFORE running any async work.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);

  // ─── Push Prisma schema to MongoDB (no migrations needed for MongoDB) ──────
  if (process.env.DATABASE_URL) {
    console.log("🔄 Syncing Prisma schema to MongoDB...");
    try {
      execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
      console.log("✅ Prisma schema synced.");
    } catch (err) {
      console.error("⚠️  Prisma db push failed:", err.message);
      // Don't crash — app can still serve if schema already exists
    }
  } else {
    console.warn("⚠️  DATABASE_URL not set — skipping Prisma schema sync.");
  }

  // Load Remix app after DB is ready
  loadRemixHandler();
});

// ─── Remix handler (loaded async after DB sync) ───────────────────────────────
let remixHandler;

async function loadRemixHandler() {
  try {
    const build = await import("./build/server/index.js");
    remixHandler = createRequestHandler({ build, mode: process.env.NODE_ENV });
    console.log("✅ Remix app loaded and ready.");
  } catch (err) {
    console.error("❌ Failed to load Remix build:", err.message);
    console.error("   Make sure `npm run build` ran successfully before starting.");
  }
}

// ─── All routes → Remix ───────────────────────────────────────────────────────
app.all("*", (req, res, next) => {
  if (!remixHandler) {
    // Server is warming up — tell the client to retry
    res.set("Retry-After", "5");
    return res.status(503).json({
      status: "starting",
      message: "App is starting up. Please retry in a few seconds.",
    });
  }
  return remixHandler(req, res, next);
});
