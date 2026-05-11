import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

const percent = (part: number, total: number) => (total === 0 ? 100 : Math.round((part / total) * 100));

export async function getComplianceSummary(shipId?: string) {
  const now = new Date();
  const maintenanceWhere: Prisma.MaintenanceTaskWhereInput = { shipId };
  const drillsWhere: Prisma.SafetyDrillWhereInput = { shipId };

  const [
    totalMaintenance,
    completedMaintenance,
    overdueMaintenance,
    totalDrills,
    completedDrills,
    missedDrills,
    attendanceTotal,
    attendanceCompleted
  ] = await Promise.all([
    prisma.maintenanceTask.count({ where: maintenanceWhere }),
    prisma.maintenanceTask.count({ where: { ...maintenanceWhere, status: "COMPLETED" } }),
    prisma.maintenanceTask.count({
      where: { ...maintenanceWhere, status: { not: "COMPLETED" }, dueDate: { lt: now } }
    }),
    prisma.safetyDrill.count({ where: drillsWhere }),
    prisma.safetyDrill.count({ where: { ...drillsWhere, status: "COMPLETED" } }),
    prisma.safetyDrill.count({
      where: { ...drillsWhere, status: { not: "COMPLETED" }, scheduledDate: { lt: now } }
    }),
    prisma.drillAttendance.count({ where: { drill: drillsWhere } }),
    prisma.drillAttendance.count({ where: { drill: drillsWhere, attended: true } })
  ]);

  const maintenanceCompliance = percent(completedMaintenance, totalMaintenance);
  const drillParticipation = percent(attendanceCompleted, attendanceTotal || totalDrills);

  return {
    totalMaintenance,
    completedMaintenance,
    overdueMaintenance,
    totalDrills,
    completedDrills,
    missedDrills,
    maintenanceCompliance,
    drillParticipation,
    overallCompliance: Math.round((maintenanceCompliance + drillParticipation) / 2)
  };
}
