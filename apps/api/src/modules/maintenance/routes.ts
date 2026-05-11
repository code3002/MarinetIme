import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const maintenanceRouter = Router();

maintenanceRouter.use(requireAuth);

maintenanceRouter.get("/", async (req, res) => {
  const { shipId, status, assignedToId, from, to } = req.query;
  const isCrew = req.user!.role === "CREW";

  const tasks = await prisma.maintenanceTask.findMany({
    where: {
      shipId: typeof shipId === "string" ? shipId : undefined,
      status: typeof status === "string" ? status as any : undefined,
      assignedToId: isCrew ? req.user!.id : typeof assignedToId === "string" ? assignedToId : undefined,
      dueDate: {
        gte: typeof from === "string" ? new Date(from) : undefined,
        lte: typeof to === "string" ? new Date(to) : undefined
      }
    },
    include: { ship: true, assignedTo: { select: { id: true, name: true, email: true } }, comments: true },
    orderBy: { dueDate: "asc" }
  });

  res.json(tasks);
});

maintenanceRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(3),
      description: z.string().min(3),
      dueDate: z.string().datetime(),
      shipId: z.string(),
      assignedToId: z.string().optional()
    }).parse(req.body);

    const task = await prisma.maintenanceTask.create({
      data: { ...input, dueDate: new Date(input.dueDate) }
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

maintenanceRouter.patch("/:id", async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().min(3).optional(),
      description: z.string().min(3).optional(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
      dueDate: z.string().datetime().optional(),
      assignedToId: z.string().nullable().optional()
    }).parse(req.body);

    const existing = await prisma.maintenanceTask.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Maintenance task not found" });

    if (req.user!.role === "CREW" && existing.assignedToId !== req.user!.id) {
      return res.status(403).json({ message: "Crew can only update assigned tasks" });
    }

    const task = await prisma.maintenanceTask.update({
      where: { id: req.params.id },
      data: {
        ...input,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        completedAt: input.status === "COMPLETED" ? new Date() : input.status ? null : undefined
      }
    });

    res.json(task);
  } catch (error) {
    next(error);
  }
});

maintenanceRouter.get("/:id/comments", async (req, res) => {
  const comments = await prisma.maintenanceComment.findMany({
    where: { taskId: req.params.id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" }
  });
  res.json(comments);
});

maintenanceRouter.post("/:id/comments", async (req, res, next) => {
  try {
    const input = z.object({ body: z.string().min(1) }).parse(req.body);
    const comment = await prisma.maintenanceComment.create({
      data: { body: input.body, taskId: req.params.id, authorId: req.user!.id }
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});
