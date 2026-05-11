import "dotenv/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../../app.js";

const prisma = new PrismaClient();
const app = createApp();
const runId = `tdd-${Date.now()}`;

let adminToken = "";
let crewToken = "";
let shipId = "";
let crewId = "";
let taskId = "";
let drillId = "";

async function cleanup() {
  await prisma.drillAttendance.deleteMany({ where: { crew: { email: { contains: runId } } } });
  await prisma.safetyDrill.deleteMany({ where: { ship: { imoNumber: `IMO-${runId}` } } });
  await prisma.maintenanceComment.deleteMany({ where: { task: { ship: { imoNumber: `IMO-${runId}` } } } });
  await prisma.maintenanceTask.deleteMany({ where: { ship: { imoNumber: `IMO-${runId}` } } });
  await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  await prisma.ship.deleteMany({ where: { imoNumber: `IMO-${runId}` } });
}

describe("maritime assessment workflows", () => {
  beforeAll(async () => {
    await cleanup();

    const admin = await request(app).post("/api/auth/register").send({
      name: "TDD Admin",
      email: `admin-${runId}@maritime.test`,
      password: "Admin123!",
      role: "ADMIN"
    });
    expect(admin.status).toBe(201);
    adminToken = admin.body.token;

    const ship = await request(app)
      .post("/api/ships")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "TDD Integrity", imoNumber: `IMO-${runId}` });
    expect(ship.status).toBe(201);
    shipId = ship.body.id;

    const crew = await request(app).post("/api/auth/register").send({
      name: "TDD Crew",
      email: `crew-${runId}@maritime.test`,
      password: "Crew123!",
      role: "CREW",
      shipId
    });
    expect(crew.status).toBe(201);
    crewToken = crew.body.token;
    crewId = crew.body.user.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("allows admins to create maintenance and crew to update assigned task status", async () => {
    const created = await request(app)
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test ballast pump inspection",
        description: "Inspect pump vibration and log findings",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        shipId,
        assignedToId: crewId
      });

    expect(created.status).toBe(201);
    taskId = created.body.id;

    const crewTasks = await request(app).get("/api/maintenance").set("Authorization", `Bearer ${crewToken}`);
    expect(crewTasks.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]));

    const updated = await request(app)
      .patch(`/api/maintenance/${taskId}`)
      .set("Authorization", `Bearer ${crewToken}`)
      .send({ status: "COMPLETED" });

    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("COMPLETED");
    expect(updated.body.completedAt).toBeTruthy();
  });

  it("prevents crew from creating admin-only maintenance records", async () => {
    const denied = await request(app)
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${crewToken}`)
      .send({
        title: "Unauthorized task",
        description: "Crew should not create this",
        dueDate: new Date().toISOString(),
        shipId
      });

    expect(denied.status).toBe(403);
  });

  it("creates drill attendance rows and lets crew mark attendance", async () => {
    const created = await request(app)
      .post("/api/drills")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "TDD fire drill",
        type: "Fire Drill",
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        shipId
      });

    expect(created.status).toBe(201);
    drillId = created.body.id;

    const attended = await request(app)
      .post(`/api/drills/${drillId}/attendance`)
      .set("Authorization", `Bearer ${crewToken}`)
      .send({ attended: true });

    expect(attended.status).toBe(200);
    expect(attended.body.attended).toBe(true);
    expect(attended.body.submittedAt).toBeTruthy();
  });

  it("highlights overdue maintenance and missed drills in compliance summary", async () => {
    await request(app)
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Expired hull inspection",
        description: "Should count as overdue until completed",
        dueDate: new Date(Date.now() - 86400000).toISOString(),
        shipId
      });

    await request(app)
      .post("/api/drills")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Expired evacuation drill",
        type: "Evacuation",
        scheduledDate: new Date(Date.now() - 86400000).toISOString(),
        shipId
      });

    const summary = await request(app)
      .get(`/api/compliance/summary?shipId=${shipId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(summary.status).toBe(200);
    expect(summary.body.overdueMaintenance).toBeGreaterThanOrEqual(1);
    expect(summary.body.missedDrills).toBeGreaterThanOrEqual(1);
    expect(summary.body.maintenanceCompliance).toBeLessThan(100);
    expect(summary.body.overallCompliance).toBeLessThan(100);
  });
});
