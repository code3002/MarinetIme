export const maintenanceStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;
export const drillStatuses = ["SCHEDULED", "COMPLETED", "MISSED"] as const;
export const roles = ["ADMIN", "CREW"] as const;

export type Role = (typeof roles)[number];
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];
export type DrillStatus = (typeof drillStatuses)[number];

export type ComplianceSummary = {
  totalMaintenance: number;
  completedMaintenance: number;
  overdueMaintenance: number;
  totalDrills: number;
  completedDrills: number;
  missedDrills: number;
  maintenanceCompliance: number;
  drillParticipation: number;
  overallCompliance: number;
};
