import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateFr, formatDateTimeFr } from "@/lib/admin";
import {
  adminAgents,
  adminCreateAgent,
  adminUpdateAgent,
  adminZones,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/agents")({
  head: () => ({
    meta: [
      { title: "Agents terrain — Administration Adresse GN" },
      { name: "description", content: "Gestion des agents installateurs et de leurs zones." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAgents,
});

function AdminAgents() {
  const lister = useServerFn(adminAgents);
  const maj = useServerFn(adminUpdateAgent);
  const creer = useServerFn(adminCreateAgent);
  const listerZones = useServerFn(adminZones);
  const qc = useQueryClient();

  const [ouvrir, setOuvrir] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    badgeNumber: "",
    zoneId: "",
  });

  const agents = useQuery({ queryKey: ["admin", "agents"], queryFn: () => lister() });
  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => listerZones() });

  const muter = useMutation({
    mutationFn: (v: Record<string, unknown>) => maj({ data: v }),
    onSuccess: () => {
      toast.success("Agent mis à jour.");
      void qc.invalidateQueries({ queryKey: ["admin", "agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterCreation = useMutation({
    mutationFn: () => creer({ data: { ...form, zoneId: form.zoneId || null } }),
    onSuccess: () => {
      toast.success("Agent créé.");
      setOuvrir(false);
      setForm({
        email: "",
        password: "",
        fullName: "",
        phone: "",
        badgeNumber: "",
        zoneId: "",
      });
      void qc.invalidateQueries({ queryKey: ["admin", "agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof agents.data>[number];

  const colonnes: Colonne<Ligne>[] = [
    { cle: "badge", entete: "Badge", rendu: (l) => l.badge_number },
    { cle: "nom", entete: "Nom", rendu: (l) => l.full_name ?? "—" },
    { cle: "tel", entete: "Téléphone", rendu: (l) => l.phone ?? "—" },
    {
      cle: "zone",
      entete: "Zone",
      rendu: (l) => (
        <Select
          value={l.zone_id ?? "aucune"}
          onValueChange={(v) => muter.mutate({ id: l.id, zoneId: v === "aucune" ? null : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aucune">Aucune</SelectItem>
            {(zones.data?.communes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { cle: "recrute", entete: "Recruté le", rendu: (l) => formatDateFr(l.hired_at) },
    { cle: "installs", entete: "Installations", rendu: (l) => String(l.installations) },
    {
      cle: "derniere",
      entete: "Dernière activité",
      rendu: (l) => formatDateTimeFr(l.derniere_installation),
    },
    {
      cle: "actif",
      entete: "Statut",
      rendu: (l) =>
        l.active ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Inactif</Badge>,
    },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => muter.mutate({ id: l.id, active: !l.active })}
        >
          {l.active ? "Désactiver" : "Activer"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOuvrir(true)}>Créer un agent</Button>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={agents.data ?? []}
        chargement={agents.isLoading}
        cle={(l) => l.id}
      />

      <Dialog open={ouvrir} onOpenChange={setOuvrir}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Créer un agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Numéro de badge</Label>
              <Input
                value={form.badgeNumber}
                onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })}
                placeholder="AG002"
              />
            </div>
            <div>
              <Label>Nom complet</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Mot de passe (8 caractères minimum)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Zone (commune)</Label>
              <Select value={form.zoneId} onValueChange={(v) => setForm({ ...form, zoneId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une commune" />
                </SelectTrigger>
                <SelectContent>
                  {(zones.data?.communes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={muterCreation.isPending} onClick={() => muterCreation.mutate()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
