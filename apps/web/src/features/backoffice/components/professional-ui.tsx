"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  AlertTriangle,
  Check,
  Inbox,
  LoaderCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";


type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};


export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_18px_50px_rgba(30,54,96,0.08)] sm:px-7 sm:py-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#2E4A7B]/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#0EA5A4]/8 blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            {Icon ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E3660] text-white shadow-lg shadow-slate-950/10">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}

            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2E4A7B]">
                  {eyebrow}
                </p>
              ) : null}

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {title}
              </h1>

              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {meta ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {meta}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}


type MetricCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  accent?: "brand" | "teal" | "amber" | "violet" | "rose";
  className?: string;
};


const METRIC_ACCENTS = {
  brand: "bg-[#2E4A7B]/10 text-[#2E4A7B]",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  rose: "bg-rose-50 text-rose-700",
} as const;


export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "brand",
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-2xl border border-slate-200/80 bg-white py-0 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]",
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">
              {label}
            </p>

            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {value}
            </div>

            {detail ? (
              <div className="mt-2 text-xs leading-5 text-slate-500">
                {detail}
              </div>
            ) : null}
          </div>

          {Icon ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                METRIC_ACCENTS[accent],
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}


const STATUS_PRESENTATION: Record<
  string,
  { label: string; className: string }
> = {
  generated: {
    label: "Générée",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  ordered: {
    label: "Commandée",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  in_production: {
    label: "En fabrication",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  shipped: {
    label: "Expédiée",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  received: {
    label: "Réceptionnée",
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  available: {
    label: "Disponible",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  assigned: {
    label: "Affectée",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  planned: {
    label: "Planifiée",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  installed: {
    label: "Installée",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  active: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pending: {
    label: "En attente",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  paid: {
    label: "Payée",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  success: {
    label: "Réussi",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Échec",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  suspended: {
    label: "Suspendue",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  cancelled: {
    label: "Annulée",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
  private: {
    label: "Privée",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  public: {
    label: "Publique",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  verified: {
    label: "Vérifiée",
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  unverified: {
    label: "Non vérifiée",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};


export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const normalized =
    status.trim().toLowerCase();

  const presentation =
    STATUS_PRESENTATION[normalized] ?? {
      label: normalized || "—",
      className:
        "border-slate-200 bg-slate-100 text-slate-700",
    };

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2.5 text-[11px] font-semibold capitalize",
        presentation.className,
        className,
      )}
    >
      {label ?? presentation.label}
    </Badge>
  );
}


export type WorkflowStep = {
  key: string;
  label: string;
  description?: string;
  state?: "complete" | "current" | "upcoming" | "blocked";
};


export function WorkflowStepper({
  steps,
  className,
}: {
  steps: WorkflowStep[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]",
        className,
      )}
    >
      {steps.map((step, index) => {
        const state =
          step.state ?? "upcoming";

        const complete =
          state === "complete";

        const current =
          state === "current";

        return (
          <li
            key={step.key}
            className={cn(
              "relative rounded-2xl border p-4 transition",
              complete
                ? "border-emerald-200 bg-emerald-50/70"
                : current
                  ? "border-[#2E4A7B]/30 bg-[#2E4A7B]/5 shadow-sm"
                  : state === "blocked"
                    ? "border-rose-200 bg-rose-50/60"
                    : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  complete
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : current
                      ? "border-[#2E4A7B] bg-[#2E4A7B] text-white"
                      : state === "blocked"
                        ? "border-rose-300 bg-rose-100 text-rose-700"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                )}
              >
                {complete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </span>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {step.label}
                </p>

                {step.description ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}


export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-2xl border border-slate-200/80 bg-white py-0 shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#2E4A7B]">
                <Icon className="h-4 w-4" />
              </div>
            ) : null}

            <div className="min-w-0">
              {title ? (
                <h2 className="font-semibold text-slate-950">
                  {title}
                </h2>
              ) : null}

              {description ? (
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="p-5">
        {children}
      </div>
    </Card>
  );
}


export function EmptyState({
  title = "Aucune donnée",
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-4 font-semibold text-slate-900">
        {title}
      </p>

      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}

      {action ? (
        <div className="mt-5">
          {action}
        </div>
      ) : null}
    </div>
  );
}


export function LoadingState({
  label = "Chargement…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2E4A7B]/8 text-[#2E4A7B]">
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </div>

      <p className="mt-4 text-sm font-medium text-slate-600">
        {label}
      </p>
    </div>
  );
}


export function ErrorState({
  title = "Une erreur est survenue",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm ring-1 ring-rose-200">
        <AlertTriangle className="h-5 w-5" />
      </div>

      <p className="mt-4 font-semibold text-rose-950">
        {title}
      </p>

      {description ? (
        <p className="mt-1 max-w-md text-sm leading-6 text-rose-700">
          {description}
        </p>
      ) : null}

      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="mt-5 border-rose-200 bg-white text-rose-700 hover:bg-rose-100 hover:text-rose-800"
        >
          Réessayer
        </Button>
      ) : null}
    </div>
  );
}
