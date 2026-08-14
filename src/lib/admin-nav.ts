/** Configuration de navigation du back-office (présentation uniquement). */
import {
  Activity,
  BarChart3,
  FileCheck2,
  FileClock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Languages,
  MapPin,
  Newspaper,
  Tags,
  Users,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";

/** Couleurs d'accent par section : mappées sur les tokens --color-admin-*. */
export type AccentAdmin =
  | "blue"
  | "green"
  | "orange"
  | "violet"
  | "pink"
  | "cyan"
  | "amber"
  | "red"
  | "slate"
  | "lime";

export const ACCENT_CLASSES: Record
  AccentAdmin,
  { texte: string; fond: string; bordure: string; puce: string; barre: string; variable: string }
> = {
  blue: {
    texte: "text-admin-blue",
    fond: "bg-admin-blue/10",
    bordure: "border-admin-blue/25",
    puce: "bg-admin-blue",
    barre: "from-admin-blue/25 to-transparent",
    variable: "var(--color-admin-blue)",
  },
  green: {
    texte: "text-admin-green",
    fond: "bg-admin-green/10",
    bordure: "border-admin-green/25",
    puce: "bg-admin-green",
    barre: "from-admin-green/25 to-transparent",
    variable: "var(--color-admin-green)",
  },
  orange: {
    texte: "text-admin-orange",
    fond: "bg-admin-orange/10",
    bordure: "border-admin-orange/25",
    puce: "bg-admin-orange",
    barre: "from-admin-orange/25 to-transparent",
    variable: "var(--color-admin-orange)",
  },
  violet: {
    texte: "text-admin-violet",
    fond: "bg-admin-violet/10",
    bordure: "border-admin-violet/25",
    puce: "bg-admin-violet",
    barre: "from-admin-violet/25 to-transparent",
    variable: "var(--color-admin-violet)",
  },
  pink: {
    texte: "text-admin-pink",
    fond: "bg-admin-pink/10",
    bordure: "border-admin-pink/25",
    puce: "bg-admin-pink",
    barre: "from-admin-pink/25 to-transparent",
    variable: "var(--color-admin-pink)",
  },
  cyan: {
    texte: "text-admin-cyan",
    fond: "bg-admin-cyan/10",
    bordure: "border-admin-cyan/25",
    puce: "bg-admin-cyan",
    barre: "from-admin-cyan/25 to-transparent",
    variable: "var(--color-admin-cyan)",
  },
  amber: {
    texte: "text-admin-amber",
    fond: "bg-admin-amber/10",
    bordure: "border-admin-amber/25",
    puce: "bg-admin-amber",
    barre: "from-admin-amber/25 to-transparent",
    variable: "var(--color-admin-amber)",
  },
  red: {
    texte: "text-admin-red",
    fond: "bg-admin-red/10",
    bordure: "border-admin-red/25",
    puce: "bg-admin-red",
    barre: "from-admin-red/25 to-transparent",
    variable: "var(--color-admin-red)",
  },
  slate: {
    texte: "text-admin-slate",
    fond: "bg-admin-slate/10",
    bordure: "border-admin-slate/25",
    puce: "bg-admin-slate",
    barre: "from-admin-slate/25 to-transparent",
    variable: "var(--color-admin-slate)",
  },
  lime: {
    texte: "text-admin-lime",
    fond: "bg-admin-lime/10",
    bordure: "border-admin-lime/25",
    puce: "bg-admin-lime",
    barre: "from-admin-lime/25 to-transparent",
    variable: "var(--color-admin-lime)",
  },
};

export interface SectionAdmin {
  to: string;
  label: string;
  icon: LucideIcon;
  accent: AccentAdmin;
  groupe: string;
  exact?: boolean;
}

export const SECTIONS_ADMIN: SectionAdmin[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, accent: "blue", groupe: "Pilotage", exact: true },
  { to: "/admin/analytics", label: "Statistiques", icon: BarChart3, accent: "violet", groupe: "Pilotage" },
  { to: "/admin/addresses", label: "Adresses", icon: MapPin, accent: "cyan", groupe: "Configuration" },
  { to: "/admin/zones", label: "Zones", icon: Activity, accent: "lime", groupe: "Configuration" },
  { to: "/admin/agents", label: "Agents", icon: UserSquare2, accent: "cyan", groupe: "Configuration" },
  { to: "/admin/justificatifs", label: "Justificatifs", icon: FileCheck2, accent: "lime", groupe: "Configuration" },
  { to: "/admin/cms", label: "Contenu du site", icon: FileText, accent: "blue", groupe: "Contenu", exact: true },
  { to: "/admin/cms/pages", label: "Pages", icon: FileText, accent: "cyan", groupe: "Contenu" },
  { to: "/admin/cms/blog", label: "Blog", icon: Newspaper, accent: "pink", groupe: "Contenu" },
  { to: "/admin/cms/faq", label: "FAQ", icon: HelpCircle, accent: "cyan", groupe: "Contenu" },
  { to: "/admin/cms/traductions", label: "Traductions", icon: Languages, accent: "violet", groupe: "Contenu" },
  { to: "/admin/cms/tarifs", label: "Tarifs", icon: Tags, accent: "amber", groupe: "Contenu" },
  { to: "/admin/users", label: "Utilisateurs", icon: Users, accent: "violet", groupe: "Système" },
  { to: "/admin/audit", label: "Journal d'audit", icon: FileClock, accent: "slate", groupe: "Système" },
];

export const GROUPES_ADMIN = [...new Set(SECTIONS_ADMIN.map((s) => s.groupe))];

export function sectionCourante(pathname: string): SectionAdmin {
  return (
    [...SECTIONS_ADMIN]
      .sort((a, b) => b.to.length - a.to.length)
      .find((s) => (s.exact ? pathname === s.to : pathname.startsWith(s.to))) ?? SECTIONS_ADMIN[0]!
  );
}
