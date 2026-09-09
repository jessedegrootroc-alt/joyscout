"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe, MapPin, Phone, Mail, Star, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProspectDTO } from "./types";
import type { InsightRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpportunityBadge, ScoreRing } from "@/components/score";
import { PriorityLabel, SourceTag, StatusBadge } from "@/components/status-badge";
import { OverviewTab } from "./overview-tab";
import { SeoAuditTab } from "./seo-audit-tab";
import { PerformanceTab } from "./performance-tab";
import { TechContactTab } from "./tech-contact-tab";
import { CrmPanel } from "./crm-panel";
import { OutreachPanel } from "./outreach-panel";
import { fmtRelative } from "@/lib/format";

export function ProspectDetail({ prospect: initial, lists, initialTab, aiConfigured, outreachLanguage }: { prospect: ProspectDTO; lists: { id: string; name: string }[]; initialTab?: string; aiConfigured: boolean; outreachLanguage: string }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  // The server component re-renders after router.refresh() (e.g. list added, note saved);
  // adopt the fresh prospect when the prop identity changes so chips and the timeline update.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setP(initial);
  }
  const [reanalyzing, setReanalyzing] = useState(false);
  const a = p.analysis;
  const insights = ((a?.insights as InsightRecord[] | null) ?? p.insights.map((t) => ({ key: t, text: t, severity: "info", source: "derived" }) as InsightRecord)).slice(0, 6);
  const analyzing = p.analysisStatus === "PENDING" || p.analysisStatus === "ANALYZING";

  async function reanalyze(withAi: boolean) {
    setReanalyzing(true);
    const res = await fetch(`/api/prospects/${p.id}/reanalyze${withAi ? "?ai=1" : ""}`, { method: "POST" });
    setReanalyzing(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error ?? "Could not queue analysis");
      return;
    }
    toast.success(withAi ? "AI analysis queued — refresh in a minute" : "Re-analysis queued");
    setP((x) => ({ ...x, analysisStatus: "PENDING" }));
    setTimeout(() => router.refresh(), 4000);
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-4">
        <Link href="/prospects" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3" /> Prospects
        </Link>
      </div>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-6 rounded-[1.5rem] border border-border bg-card p-6 md:p-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display text-[1.75rem] md:text-[2.25rem]">{p.name}</h1>
            <StatusBadge status={p.status} />
            {p.priorityLabels.map((l) => (
              <PriorityLabel key={l} label={l} />
            ))}
            {analyzing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 py-1 text-[12px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Analysis in progress
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[14px] text-muted-foreground">
            <span>{p.industry}</span>
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                <Globe className="size-3.5" /> {p.domain} <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#8a3d12]">
                <Globe className="size-3.5" /> No website found
              </span>
            )}
            {(p.city || p.address) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {p.address ?? p.city}
              </span>
            )}
            {p.googleRating != null && (
              <a href={p.googleMapsUrl ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                <Star className="size-3.5 fill-tint-yellow text-tint-yellow" /> {p.googleRating.toFixed(1)} · {p.googleReviewCount ?? 0} reviews
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {p.phone}
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {p.email}
              </a>
            )}
          </div>
          {insights.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {insights.map((i) => (
                <li key={i.key} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] ${i.severity === "hot" ? "bg-primary text-primary-foreground" : i.severity === "high" ? "bg-tint-yellow/30 text-foreground" : "bg-foreground/6 text-foreground/85"}`}>
                  {i.severity === "hot" ? "🔥 " : ""}
                  {i.text}
                  <SourceTag source={i.source} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-[13px] text-muted-foreground">
            Found {fmtRelative(p.dateFound)} via {p.source === "google_places" ? "Google Places" : "OpenStreetMap"}
            {p.lastAnalyzedAt ? ` · analysed ${fmtRelative(p.lastAnalyzedAt)}` : ""}
            {p.recommendedService ? (
              <>
                {" "}
                · Recommended: <span className="font-medium text-foreground">{p.recommendedService}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <OpportunityBadge score={p.opportunityScore} className="h-[76px] min-w-[76px] text-[22px]" />
            <span className="eyebrow">Opportunity</span>
          </div>
          {p.hasWebsite && <ScoreRing score={p.websiteScore} label="Website Score" />}
          <div className="flex flex-col gap-2">
            {p.hasWebsite && (
              <Button variant="outline" size="sm" disabled={reanalyzing || analyzing} onClick={() => reanalyze(false)}>
                <RefreshCw className={`size-3.5 ${reanalyzing ? "animate-spin" : ""}`} /> Re-analyse
              </Button>
            )}
            {p.hasWebsite && aiConfigured && a?.aiStatus !== "completed" && (
              <Button variant="outline" size="sm" disabled={reanalyzing || analyzing} onClick={() => reanalyze(true)}>
                <Sparkles className="size-3.5" /> Run AI analysis
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Tabs defaultValue={initialTab === "outreach" ? "outreach" : "overview"} className="min-w-0">
          <TabsList variant="line" className="scroll-thin mb-4 h-10 w-full justify-start gap-1 overflow-x-auto border-b border-border [&>button]:flex-none [&>button]:whitespace-nowrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="seo">SEO audit</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="tech">Contact & technology</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab p={p} />
          </TabsContent>
          <TabsContent value="seo">
            <SeoAuditTab p={p} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceTab p={p} />
          </TabsContent>
          <TabsContent value="tech">
            <TechContactTab p={p} />
          </TabsContent>
          <TabsContent value="outreach">
            <OutreachPanel p={p} aiConfigured={aiConfigured} defaultLanguage={outreachLanguage} onChange={(outreach) => setP((x) => ({ ...x, outreach }))} />
          </TabsContent>
        </Tabs>
        <CrmPanel p={p} lists={lists} onChange={(patch) => setP((x) => ({ ...x, ...patch }))} />
      </div>
    </div>
  );
}
