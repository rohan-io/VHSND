import { apiRequest } from "@/src/api/client";
import {
  AlertItem,
  ChildImmunization,
  ChildRecord,
  ANCVisit,
  MaternalImmunization,
  NotificationItem,
  PregnancyRecord,
} from "@/src/types";

// ---- Dashboard ----
export interface CriticalPregnancySummary {
  id: string;
  full_name: string;
  village: string;
  gestational_age_label: string;
  high_risk_reasons: string[];
}
export interface DashboardResponse {
  summary: Record<string, number>;
  todays_alerts: AlertItem[];
  recent_pregnancies: PregnancyRecord[];
  critical_pregnancies: CriticalPregnancySummary[];
  last_updated: string;
}
export const getDashboard = () => apiRequest<DashboardResponse>("/dashboard");

// ---- Pregnancies ----
export interface PregnancyListParams {
  search?: string;
  trimester?: number;
  village?: string;
  high_risk?: boolean;
  status_filter?: string;
}
export const listPregnancies = (params: PregnancyListParams = {}) => {
  const q = new URLSearchParams();
  if (params.search) q.append("search", params.search);
  if (params.trimester) q.append("trimester", String(params.trimester));
  if (params.village) q.append("village", params.village);
  if (params.high_risk != null) q.append("high_risk", String(params.high_risk));
  if (params.status_filter) q.append("status_filter", params.status_filter);
  const qs = q.toString();
  return apiRequest<{ total: number; items: PregnancyRecord[] }>(
    `/pregnancies${qs ? `?${qs}` : ""}`
  );
};

export const getPregnancy = (id: string) =>
  apiRequest<{
    pregnancy: PregnancyRecord;
    visits: ANCVisit[];
    immunizations: MaternalImmunization[];
    children: ChildRecord[];
  }>(`/pregnancies/${id}`);

export const createPregnancy = (body: any) =>
  apiRequest<PregnancyRecord>("/pregnancies", { method: "POST", body });

export const createANCVisit = (id: string, body: any) =>
  apiRequest<ANCVisit>(`/pregnancies/${id}/visits`, { method: "POST", body });

export const completeMaternalImm = (pid: string, immId: string, body: any = {}) =>
  apiRequest(`/pregnancies/${pid}/immunizations/${immId}/complete`, {
    method: "POST",
    body,
  });

export const markPmsmaAttended = (pid: string) =>
  apiRequest<PregnancyRecord>(`/pregnancies/${pid}/pmsma/attend`, { method: "POST" });

// ---- Children ----
export interface ChildListParams {
  search?: string;
  village?: string;
  gender?: string;
}
export const listChildren = (params: ChildListParams = {}) => {
  const q = new URLSearchParams();
  if (params.search) q.append("search", params.search);
  if (params.village) q.append("village", params.village);
  if (params.gender) q.append("gender", params.gender);
  const qs = q.toString();
  return apiRequest<{ total: number; items: ChildRecord[] }>(
    `/children${qs ? `?${qs}` : ""}`
  );
};

export const getChild = (id: string) =>
  apiRequest<{
    child: ChildRecord;
    immunizations: ChildImmunization[];
    mother: PregnancyRecord | null;
  }>(`/children/${id}`);

export const createChild = (body: any) =>
  apiRequest<ChildRecord>("/children", { method: "POST", body });

export const completeChildImm = (cid: string, immId: string, body: any = {}) =>
  apiRequest(`/children/${cid}/immunizations/${immId}/complete`, {
    method: "POST",
    body,
  });

export const rescheduleChildImm = (cid: string, immId: string, body: any) =>
  apiRequest(`/children/${cid}/immunizations/${immId}/reschedule`, {
    method: "POST",
    body,
  });

// ---- Alerts ----
export interface AlertListParams {
  priority?: string;
  status_filter?: string;
  category?: string;
}
export const listAlerts = (params: AlertListParams = {}) => {
  const q = new URLSearchParams();
  if (params.priority) q.append("priority", params.priority);
  if (params.status_filter) q.append("status_filter", params.status_filter);
  if (params.category) q.append("category", params.category);
  const qs = q.toString();
  return apiRequest<{ total: number; items: AlertItem[] }>(
    `/alerts${qs ? `?${qs}` : ""}`
  );
};
export const acknowledgeAlert = (id: string) =>
  apiRequest(`/alerts/${id}/acknowledge`, { method: "POST" });
export const recalcAlerts = () =>
  apiRequest("/alerts/recalculate", { method: "POST" });

// ---- Notifications ----
export const getNotifications = () =>
  apiRequest<{ unread_count: number; items: NotificationItem[] }>("/notifications");
export const markNotificationRead = (id: string) =>
  apiRequest(`/notifications/${id}/read`, { method: "POST" });

// ---- Admin ----
export const getAdminKpis = () => apiRequest<any>("/admin/kpis");
export const getAuditLogs = () => apiRequest<any[]>("/audit-logs");
