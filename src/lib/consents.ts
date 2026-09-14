/**
 * Demo guardian-consent rows (prototype seed content). Looked up by roster
 * index modulo length — shared by the Students "Shared view" tab and the
 * Sharing page.
 */
export type ConsentRow = [string, string[], string, string];

export const CONSENTS_RAW: ConsentRow[] = [
  ["Lorna Reyes · Mother", ["Grades", "Attendance", "Missing work"], "Aug 22, 2026", "Active"],
  ["Rosa Aquino · Mother", ["Grades", "Attendance", "Missing work", "Remarks"], "Aug 19, 2026", "Active"],
  ["Ernesto Bautista · Father", ["Grades"], "Aug 20, 2026", "Active"],
  ["—", [], "—", "Not linked"],
  ["Teresa Garcia · Mother", ["Grades", "Attendance"], "Aug 23, 2026", "Active"],
  ["Ben Mendoza · Guardian", ["Grades", "Missing work"], "Aug 25, 2026", "Active"],
  ["Lita Ramos · Mother", ["Grades", "Attendance", "Missing work"], "Aug 18, 2026", "Revoked Sep 1"],
  ["Marites Santos · Mother", ["Grades", "Attendance", "Missing work", "Remarks"], "Aug 21, 2026", "Active"],
  ["—", [], "—", "Not linked"],
  ["Jun Villanueva · Father", ["Grades", "Attendance"], "Aug 27, 2026", "Active"],
];

export const SCOPES = ["Grades", "Attendance", "Missing work", "Remarks"];
