import { useMemo } from "react";
import { useAuth } from "../auth/TeamsAuthProvider";

export type VmStatus = "running" | "stopped" | "paused" | "unknown";

export interface Template {
  vmid: number;
  node: string;
  name: string;
  classes: string[];
  ownerOid: string | null;
  isPublic: boolean;
  tags: string[];
}

export interface VmDTO {
  vmid: number;
  node: string;
  name: string;
  status: VmStatus;
  ownerOid: string | null;
  sourceTemplateVmid: number | null;
  cpus?: number;
  maxmem?: number;
  tags: string[];
}

export interface ClassInfo {
  oid: string;
  displayName: string | null;
  description: string | null;
  visibility: string | null;
}

export interface TaskRef {
  node: string;
  upid: string;
}

export function useBridgeApi() {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const baseHeaders = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};

    async function call<T>(url: string, init?: RequestInit): Promise<T> {
      const r = await fetch(url, {
        ...init,
        headers: { ...baseHeaders, ...(init?.headers || {}) },
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`${r.status} ${text}`);
      }
      return r.json() as Promise<T>;
    }

    return {
      listTemplates: () =>
        call<{ templates: Template[] }>("/api/templates").then((d) => d.templates),
      listVms: () => call<{ vms: VmDTO[] }>("/api/vms").then((d) => d.vms),
      listClasses: () =>
        call<{ classes: ClassInfo[] }>("/api/classes").then((d) => d.classes),
      createVmFromTemplate: (templateId: number) =>
        call<{ task: TaskRef; newVmid: number }>(
          `/api/vms/from-template/${templateId}`,
          { method: "POST" }
        ),
      startVm: (vmid: number) =>
        call<{ task: TaskRef }>(`/api/vms/${vmid}/start`, { method: "POST" }),
      stopVm: (vmid: number) =>
        call<{ task: TaskRef }>(`/api/vms/${vmid}/stop`, { method: "POST" }),
      deleteVm: (vmid: number) =>
        call<{ task: TaskRef }>(`/api/vms/${vmid}`, { method: "DELETE" }),
    };
  }, [accessToken]);
}
