// Deterministischer VM-Name aus E-Mail des Anfragers + Quell-Template + neuer
// VMID. Komplett lowercase, jedes Zeichen außerhalb [a-z0-9-] -> '-', dann auf
// 60 Zeichen gekürzt. Siehe KONZEPT.md → "VM-Namensschema (Hostname)".
export function buildVmName(
  email: string,
  templateId: number,
  vmid: number
): string {
  return `${email.split("@")[0]}-tpl${templateId}-${vmid}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 60);
}
