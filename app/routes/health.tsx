import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Health check endpoint for Railway / uptime monitors.
 * Returns 200 OK with app status info.
 * GET /health
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(
    JSON.stringify({
      status: "ok",
      app: "Nutaan Live Chat",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      node: process.version,
      env: process.env.NODE_ENV,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
};
