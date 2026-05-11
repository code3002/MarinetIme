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

  app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/ships", shipsRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api/drills", drillsRouter);
  app.use("/api/compliance", complianceRouter);
  app.use(errorHandler);

  return app;
}
