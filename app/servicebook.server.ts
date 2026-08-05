export type ServiceBookAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  url: string | null;
  createdAt: string;
};

function text(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

function optionalText(value: unknown, maximum: number) {
  const result = text(value, maximum);
  return result || null;
}

function dateOnly(value: unknown, required = false) {
  const raw = text(value, 10);
  if (!raw) {
    if (required) throw new Error("Vul een datum in");
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Gebruik voor datums het formaat jjjj-mm-dd");
  }
  const result = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== raw) {
    throw new Error("Vul een geldige datum in");
  }
  return result;
}

function optionalInteger(value: unknown, label: string, maximum = 10_000_000) {
  if (value === "" || value === null || value === undefined) return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0 || result > maximum) {
    throw new Error(`${label} moet een positief geheel getal zijn`);
  }
  return result;
}

function optionalCost(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const result = Number(normalized);
  if (!Number.isFinite(result) || result < 0 || result > 10_000_000) {
    throw new Error("Vul bij kosten een geldig bedrag in");
  }
  return Math.round(result * 100);
}

export function cleanServiceBookInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Ongeldige serviceboekgegevens");
  }
  const data = input as Record<string, unknown>;
  const category = text(data.category, 100);
  const description = text(data.description, 10_000);
  if (!category) throw new Error("Kies een categorie");
  if (!description) throw new Error("Beschrijf de werkzaamheden");

  const status: "PLANNED" | "COMPLETED" =
    data.status === "PLANNED" ? "PLANNED" : "COMPLETED";
  const component = optionalText(data.component, 250);
  const title = optionalText(data.title, 250) || component || category;
  const performedBy = optionalText(data.performedBy, 250);
  if (status === "COMPLETED" && !performedBy) {
    throw new Error("Vul in wie de werkzaamheden heeft uitgevoerd");
  }

  return {
    status,
    serviceDate: dateOnly(data.serviceDate, true)!,
    category,
    component,
    title,
    description,
    engineHours: optionalInteger(data.engineHours, "Motoruren"),
    performedBy,
    partsMaterials: optionalText(data.partsMaterials, 5_000),
    reference: optionalText(data.reference, 250),
    costCents: optionalCost(data.cost),
    nextServiceHours: optionalInteger(data.nextServiceHours, "Volgende beurt in motoruren"),
    nextServiceDate: dateOnly(data.nextServiceDate),
    reminderEnabled: data.reminderEnabled !== false,
  };
}

export function serviceBookAttachments(value: unknown): ServiceBookAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const id = text(source.id, 250);
    const filename = text(source.filename, 160);
    if (!id || !filename) return [];
    return [{
      id,
      filename,
      mimeType: text(source.mimeType, 100) || "application/octet-stream",
      url: optionalText(source.url, 2_000),
      createdAt: text(source.createdAt, 40) || new Date(0).toISOString(),
    }];
  }).slice(0, 10);
}

export function serializeServiceBookEntry(
  entry: ServiceBookEntry,
  resolvedUrls: Map<string, string> = new Map(),
) {
  const attachments = serviceBookAttachments(entry.attachments).map((attachment) => ({
    ...attachment,
    url: resolvedUrls.get(attachment.id) || attachment.url,
  }));
  return {
    id: entry.id,
    profileId: entry.profileId,
    status: entry.status,
    serviceDate: entry.serviceDate.toISOString().slice(0, 10),
    category: entry.category,
    component: entry.component ?? "",
    title: entry.title,
    description: entry.description,
    engineHours: entry.engineHours ?? "",
    performedBy: entry.performedBy ?? "",
    partsMaterials: entry.partsMaterials ?? "",
    reference: entry.reference ?? "",
    cost: entry.costCents === null || entry.costCents === undefined
      ? ""
      : (entry.costCents / 100).toFixed(2).replace(".", ","),
    nextServiceHours: entry.nextServiceHours ?? "",
    nextServiceDate: entry.nextServiceDate?.toISOString().slice(0, 10) ?? "",
    reminderEnabled: entry.reminderEnabled,
    attachments,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
import type {ServiceBookEntry} from "@prisma/client";
