"use client";

import { ExternalLink } from "lucide-react";
import type { ProspectDTO } from "./types";
import { SourceTag } from "@/components/status-badge";

export function TechContactTab({ p }: { p: ProspectDTO }) {
  const a = p.analysis;
  const social = (p.socialLinks as Record<string, string> | null) ?? {};
  const tech = (a?.technologies as { name: string; category: string; evidence: string }[] | null) ?? [];
  const libs = (a?.jsLibraries as { name: string; version: string | null }[] | null) ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="surface p-5 text-[13.5px] [&_dt]:eyebrow [&_dt]:pt-0.5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-[15px] font-medium">
          Contact information <SourceTag source={p.source === "google_places" ? "google_business" : "osm"} />
        </h2>
        <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-[130px_1fr]">
          <dt className="text-muted-foreground">Email</dt>
          <dd>
            {p.email ? (
              <>
                <a href={`mailto:${p.email}`} className="hover:underline">
                  {p.email}
                </a>{" "}
                <span className="text-xs text-muted-foreground">({p.emailSource === "website" ? "found on website" : p.emailSource === "manual" ? "entered manually" : p.emailSource ?? "directory"})</span>
              </>
            ) : (
              <em className="text-muted-foreground">not found</em>
            )}
          </dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{p.phone ? <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a> : <em className="text-muted-foreground">not found</em>}</dd>
          <dt className="text-muted-foreground">Address</dt>
          <dd>{p.address ?? ([p.street, p.postalCode, p.city].filter(Boolean).join(", ") || <em className="text-muted-foreground">unknown</em>)}</dd>
          <dt className="text-muted-foreground">Google Maps</dt>
          <dd>
            {p.googleMapsUrl ? (
              <a href={p.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                Open listing <ExternalLink className="size-3" />
              </a>
            ) : (
              <em className="text-muted-foreground">n/a</em>
            )}
          </dd>
          <dt className="text-muted-foreground">Business status</dt>
          <dd>{p.businessStatus ?? <em className="text-muted-foreground">unknown</em>}</dd>
          <dt className="text-muted-foreground">Social</dt>
          <dd className="flex flex-wrap gap-2">
            {Object.keys(social).length ? (
              Object.entries(social).map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="rounded-full border border-input px-2.5 py-0.5 text-[12px] capitalize transition-colors hover:bg-foreground/5">
                  {k}
                </a>
              ))
            ) : (
              <em className="text-muted-foreground">none found</em>
            )}
          </dd>
          {a && (
            <>
              <dt className="text-muted-foreground">On website</dt>
              <dd className="text-xs text-muted-foreground">
                {[a.phoneVisible && "phone visible", a.emailVisible && "email visible", a.hasContactForm && "contact form", a.hasWhatsApp && "WhatsApp", a.hasChat && "live chat", a.hasBookingFlow && "online booking", a.hasMapEmbed && "map embed"].filter(Boolean).join(" · ") || "no contact options detected"}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="surface p-5 text-[13.5px] [&_dt]:eyebrow [&_dt]:pt-0.5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-[15px] font-medium">
          Technology <SourceTag source="derived" />
        </h2>
        {!a ? (
          <p className="text-muted-foreground">No website analysed.</p>
        ) : (
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-[130px_1fr]">
            <dt className="text-muted-foreground">CMS</dt>
            <dd>{a.cms ?? <em className="text-muted-foreground">unknown</em>}</dd>
            <dt className="text-muted-foreground">Framework</dt>
            <dd>{a.framework ?? <em className="text-muted-foreground">none detected</em>}</dd>
            <dt className="text-muted-foreground">Analytics</dt>
            <dd>{a.analytics.length ? a.analytics.join(", ") : <em className="text-muted-foreground">none detected</em>}</dd>
            <dt className="text-muted-foreground">Tracking pixels</dt>
            <dd>{a.pixels.length ? a.pixels.join(", ") : <em className="text-muted-foreground">none detected</em>}</dd>
            <dt className="text-muted-foreground">Hosting / CDN</dt>
            <dd>
              {a.hosting ?? <em className="text-muted-foreground">unknown</em>}
              {a.server ? <span className="text-xs text-muted-foreground"> · server: {a.server}</span> : null}
            </dd>
            <dt className="text-muted-foreground">Libraries</dt>
            <dd>{libs.length ? libs.map((l) => `${l.name}${l.version ? ` ${l.version}` : ""}`).join(", ") : <em className="text-muted-foreground">none detected</em>}</dd>
            <dt className="text-muted-foreground">Website age</dt>
            <dd>
              <span className="font-medium capitalize">{a.ageVerdict.replace("_", " ")}</span>
              {a.ageSignals.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {a.ageSignals.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
              {a.copyrightYear && <div className="text-xs text-muted-foreground">Copyright year on page: {a.copyrightYear}</div>}
            </dd>
            <dt className="text-muted-foreground">Fonts</dt>
            <dd>
              {a.fontFamilies.join(", ") || "—"} {a.usesWebFonts ? <span className="text-xs text-muted-foreground">(web fonts)</span> : <span className="text-xs text-muted-foreground">(system fonts)</span>}
            </dd>
            <dt className="text-muted-foreground">Transport</dt>
            <dd className="text-xs text-muted-foreground">
              HTTP {a.httpStatus ?? "?"} · {a.isHttps ? "HTTPS" : "HTTP"} {a.httpsRedirects ? "(redirects to https)" : ""} · {a.redirectCount} redirect{a.redirectCount === 1 ? "" : "s"}
              {a.sslError ? ` · SSL error: ${a.sslError}` : ""}
            </dd>
          </dl>
        )}
        {tech.length > 0 && (
          <details className="mt-4 text-[12.5px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detection evidence ({tech.length})</summary>
            <ul className="mt-2 space-y-1 rounded-xl bg-background p-3 font-mono text-[11px] text-muted-foreground">
              {tech.map((t) => (
                <li key={t.name}>
                  {t.name} · {t.category} · {t.evidence}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {p.scans.length > 0 && (
        <section className="surface p-5 text-[13.5px] lg:col-span-2">
          <h2 className="mb-3 text-[15px] font-medium">Found in scans</h2>
          <ul className="flex flex-wrap gap-2">
            {p.scans.map((s) => (
              <li key={s.scan.id}>
                <a href={`/scans/${s.scan.id}`} className="rounded-full border border-input px-3 py-1 text-[12.5px] transition-colors hover:bg-foreground/5">
                  {s.scan.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
