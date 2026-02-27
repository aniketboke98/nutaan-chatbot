import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import { execSync } from "child_process";
import express from "express";

installGlobals();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Health check ────────────────────────────────────────────────────────────
// Responds IMMEDIATELY before any async work — this is what Railway polls.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start listening FIRST ────────────────────────────────────────────────────
// Railway considers the service healthy once this port is open and /health returns 200.
// We MUST bind before doing any async work (DB migrations, etc.).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);

  // ─── Run DB migrations AFTER server is already up ─────────────────────────
  // This ensures Railway healthcheck passes even if migrations take a few seconds.
  if (process.env.DATABASE_URL) {
    console.log("🔄 Running database migrations...");
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("✅ Database migrations complete.");
    } catch (err) {
      // Log but don't crash — app can still serve cached/static content
      console.error("⚠️  Database migration failed:", err.message);
    }
  } else {
    console.warn("⚠️  DATABASE_URL not set — skipping migrations.");
  }

  // ─── Load Remix handler once DB is ready ──────────────────────────────────
  loadRemixHandler();
});

// ─── Remix handler ────────────────────────────────────────────────────────────
// Loaded asynchronously so it doesn't block server startup.
let remixHandler;

async function loadRemixHandler() {
  try {
    const build = await import("./build/server/index.js");
    remixHandler = createRequestHandler({ build, mode: process.env.NODE_ENV });
    console.log("✅ Remix app loaded successfully.");
  } catch (err) {
    console.error("❌ Failed to load Remix build:", err.message);
    console.error("   Did you run `npm run build` before starting?");
  }
}

// ─── All other routes go to Remix ────────────────────────────────────────────
app.all("*", (req, res, next) => {
  if (!remixHandler) {
    // Remix is still loading — return a friendly 503 with Retry-After header
    res.set("Retry-After", "5");
    return res.status(503).json({
      status: "starting",
      message: "Server is starting up, please retry in a few seconds.",
    });
  }
  return remixHandler(req, res, next);
});
