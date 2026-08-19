import express, { type Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { sqliteConnection } from "./db";
import { startIncentiveScheduler } from "./incentive-scheduler";
import { serveStatic } from "./static";
import { processScheduledEmails } from "./scheduled-jobs";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Register all limiters before application routes.
app.use("/api", apiLimiter);
app.use("/api/admin/upload", uploadLimiter);
app.use("/api/proposal/:token/message", authLimiter);
app.use("/api/proposals/:token/messages", authLimiter);
app.use("/api/proposals/:token/financing/apply", authLimiter);
app.use("/api/proposals/:token/sign", authLimiter);
app.use("/api/proposals/:token/review", authLimiter);
app.use("/api/proposals/:token/warranty/register", authLimiter);
app.use("/api/referrals/:code", authLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  setInterval(
    () => {
      processScheduledEmails().catch((error) =>
        console.error("[scheduled-jobs]", error),
      );
    },
    15 * 60 * 1000,
  );
  processScheduledEmails().catch((error) =>
    console.error("[scheduled-jobs]", error),
  );

  // Start yearly + quarterly auto-refresh of county incentives.
  // Fires Jan 1 (full refresh) and Apr 1 / Jul 1 / Oct 1 (safety checks).
  try {
    startIncentiveScheduler(sqliteConnection);
  } catch (e) {
    console.error("[incentive-refresh] Scheduler failed to start:", e);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: "request_error",
        method: _req.method,
        path: _req.path,
        status,
        message,
        stack: err.stack,
      }),
    );

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
