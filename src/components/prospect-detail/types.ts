import type { Prisma } from "@/generated/prisma/client";

export type ProspectFull = Prisma.ProspectGetPayload<{
  include: {
    analysis: true;
    notes: true;
    activities: true;
    outreach: true;
    lists: { include: { list: { select: { id: true; name: true } } } };
    scans: { include: { scan: { select: { id: true; name: true; createdAt: true } } } };
  };
}>;

/** JSON-serialised variant (Dates → strings) as delivered to the client component */
export type ProspectDTO = Omit<ProspectFull, "analysis" | "notes" | "activities" | "outreach" | "scans" | "dateFound" | "createdAt" | "updatedAt" | "followUpAt" | "contactedAt" | "lastActivityAt" | "lastAnalyzedAt"> & {
  dateFound: string;
  createdAt: string;
  updatedAt: string;
  followUpAt: string | null;
  contactedAt: string | null;
  lastActivityAt: string | null;
  lastAnalyzedAt: string | null;
  analysis: (Omit<NonNullable<ProspectFull["analysis"]>, "fetchedAt" | "createdAt" | "updatedAt" | "aiAnalyzedAt"> & { fetchedAt: string; createdAt: string; updatedAt: string; aiAnalyzedAt: string | null }) | null;
  notes: (Omit<ProspectFull["notes"][number], "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string })[];
  activities: (Omit<ProspectFull["activities"][number], "createdAt"> & { createdAt: string })[];
  outreach: (Omit<ProspectFull["outreach"][number], "createdAt"> & { createdAt: string })[];
  scans: { scan: { id: string; name: string; createdAt: string } }[];
};
