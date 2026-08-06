import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, StatutBadge, type Colonne } from "@/components/admin/AdminTable";
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
import { USER_ROLES, formatDateFr, statusLabel } from "@/lib/admin";
import {
  adminCreateUser,
  adminDisableUser,
  adminResetPassword,
  adminSetRole,
  adminUsers,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/users")({
  head: () => ({
    meta: [
      { title: "Utilisateurs — Administration Adresse GN" },
      { name: "description", content: "Comptes, rôles et accès de la plateforme Adresse GN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const lister = useServerFn(adminUsers);
  const changerRole = useServerFn(adminSetRole);
  const desactiver = useServerFn(adminDisableUser);
  const reinit = useServerFn(adminResetPassword);
  const creer = useServerFn(adminCreateUser);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState("");
  const [ouvrir, setOuvrir] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "user",
    fullName: "",
    phone: "",
  });

  const utilisateurs = useQuery({
    queryKey: ["admin", "users", page, recherche],
    queryFn: () => lister({ data: { page, q: recherche.trim() || null } }),
  });

  const invalider = () => void qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const muterRole = useMutation({
    mutationFn: (v: { userId: string; role: string }) => changerRole({ data: v }),
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterDesactivation = useMutation({
    mutationFn: (v: { userId: string; disable: boolean }) => desactiver({ data: v }),
    onSuccess: () => {
      toast.success("Accès mis à jour.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterReinit = useMutation({
    mutationFn: (email: string) =>
      reinit({ data: { email, origin: window.location.origin } }),
    onSuccess: () => toast.success("Email de réinitialisation envoyé."),
    onError: (e: Error) => toast.error(e.message),
  });

  const muterCreation = useMutation({
    mutationFn: () =>
      creer({
        data: {
          email: form.email,
          password: form.password,
          role: form.role,
          fullName: form.fullName || null,
          phone: form.phone || null,
        },
      }),
    onSuccess: () => {
      toast.success("Compte créé.");
      setOuvrir(false);
      setForm({ email: "", password: "", role: "user", fullName: "", phone: "" });
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Ligne = NonNullable<typeof utilisateurs.data>["rows"][number];

  const colonnes: Colonne<Ligne>[] = [
    { cle: "email", entete: "Email", rendu: (l) => l.email ?? "—" },
    { cle: "nom", entete: "Nom", rendu: (l) => l.full_name ?? "—" },
    { cle: "tel", entete: "Téléphone", rendu: (l) => l.phone ?? "—" },
    {
      cle: "role",
      entete: "Rôle",
      rendu: (l) => (
        <Select value={l.role} onValueChange={(v) => muterRole.mutate({ userId: l.id, role: v })}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {statusLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { cle: "cree", entete: "Inscrit le", rendu: (l) => formatDateFr(l.created_at) },
    {
      cle: "acces",
      entete: "Accès",
      rendu: (l) =>
        l.banned ? <Badge variant="destructive">Désactivé</Badge> : <StatutBadge valeur="active" />,
    },
    {
      cle: "actions",
      entete: "Actions",
      rendu: (l) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={!l.email}
            onClick={() => muterReinit.mutate(l.email!)}
          >
            Réinitialiser le mot de passe
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={l.banned ? undefined : "text-destructive"}
            onClick={() => muterDesactivation.mutate({ userId: l.id, disable: !l.banned })}
          >
            {l.banned ? "Réactiver" : "Désactiver"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Label className="text-xs">Recherche (email, nom, téléphone)</Label>
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Button className="ml-auto" onClick={() => setOuvrir(true)}>
          Créer un compte
        </Button>
      </div>

      <AdminTable
        colonnes={colonnes}
        lignes={utilisateurs.data?.rows ?? []}
        chargement={utilisateurs.isLoading}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Précédent
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          disabled={!utilisateurs.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Suivant
        </Button>
      </div>

      <Dialog open={ouvrir} onOpenChange={setOuvrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Label>Nom complet</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
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
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {statusLabel(r)}
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
