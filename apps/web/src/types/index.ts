export type Role = "ADMIN" | "CREW";
export type MaintenanceStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type DrillStatus = "SCHEDULED" | "COMPLETED" | "MISSED";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  shipId?: string | null;
};

export type Ship = {
  id: string;
  name: string;
  imoNumber: string;
  status: string;
};

export type MaintenanceTask = {
  id: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  dueDate: string;
  completedAt?: string | null;
  ship: Ship;
  assignedTo?: User | null;
};

export type SafetyDrill = {
  id: string;
  title: string;
  type: string;
  status: DrillStatus;
  scheduledDate: string;
  completedAt?: string | null;
  ship: Ship;
  attendances: Array<{ id: string; attended: boolean; crew: Pick<User, "id" | "name"> }>;
};

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
