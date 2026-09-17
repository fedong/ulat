import type { GuardianRole } from "./types";

/**
 * Demo guardian seed rows (prototype seed content), looked up by roster index
 * modulo length. v2.1 guardian model: the guardian–student link is
 * account-level; "|" separates multiple linked guardians ("Name · Role").
 * Shared by the Sharing page and the Students "Shared view" tab.
 */
export type ConsentRow = [string, string[], string, string];

export const CONSENTS_RAW: ConsentRow[] = [
  ["Lorna Reyes · Mother", ["Grades", "Attendance", "Missing work"], "Aug 22, 2026", "Active"],
  ["Rosa Aquino · Mother|Carlos Aquino · Father", ["Grades", "Attendance", "Missing work", "Remarks"], "Aug 19, 2026", "Active"],
  ["Ernesto Bautista · Father", ["Grades"], "Aug 20, 2026", "Active"],
  ["—", [], "—", "Not linked"],
  ["Teresa Garcia · Mother", ["Grades", "Attendance"], "Aug 23, 2026", "Active"],
  ["Ben Mendoza · Guardian", ["Grades", "Missing work"], "Aug 25, 2026", "Active"],
  ["Lita Ramos · Mother", ["Grades", "Attendance", "Missing work"], "Aug 18, 2026", "Active"],
  ["Marites Santos · Mother", ["Grades", "Attendance", "Missing work", "Remarks"], "Aug 21, 2026", "Active"],
  ["—", [], "—", "Not linked"],
  ["Jun Villanueva · Father", ["Grades", "Attendance"], "Aug 27, 2026", "Active"],
];

export const SCOPES = ["Grades", "Attendance", "Missing work", "Remarks"];

/** Guardian role chip → [background, text color]. */
export const ROLE_COLORS: Record<GuardianRole, [string, string]> = {
  Mother: ["rgba(212,90,140,0.14)", "#8C2F5A"],
  Father: ["rgba(60,110,200,0.14)", "#28508F"],
  Grandparent: ["rgba(245,183,10,0.18)", "#8A6400"],
  Guardian: ["rgba(90,102,114,0.14)", "#3E4A55"],
};

export const DEFAULT_GUARDIAN_SCOPES: Record<string, boolean> = {
  Grades: true,
  Attendance: true,
  "Missing work": true,
  Remarks: false,
};
