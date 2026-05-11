import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { authRouter } from "./modules/auth/routes.js";
import { shipsRouter } from "./modules/ships/routes.js";
import { maintenanceRouter } from "./modules/maintenance/routes.js";
import { drillsRouter } from "./modules/drills/routes.js";
import { complianceRouter } from "./modules/compliance/routes.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // Compiled file is at apps/api/dist/src/app.js; web dist is at apps/web/dist/ (3 levels up)
  const frontendDistCandidates = [
    resolve(currentDir, "../../../web/dist"),
    resolve(currentDir, "../../web/dist"),
  ];
  const frontendDistPath = frontendDistCandidates.find((candidate) => existsSync(candidate)) ?? frontendDistCandidates[0];
  console.log(`[static] serving frontend from: ${frontendDistPath} (exists: ${existsSync(frontendDistPath)})`);
  const frontendIndexPath = join(frontendDistPath, "index.html");

  app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/ships", shipsRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api/drills", drillsRouter);
  app.use("/api/compliance", complianceRouter);
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api).*$/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });
  app.use(errorHandler);

  return app;
}
