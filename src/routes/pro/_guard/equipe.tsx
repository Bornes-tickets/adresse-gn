import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TEAM_ROLE_LABELS } from "@/lib/portal";
import {
  proInviteMember,
  proRemoveMember,
  proTeam,
  proUpdateMemberRole,
} from "@/lib/pro.functions";

export const Route = createFileRoute("/pro/_guard/equipe")({
  head: () => ({
    meta: [
      { title: "Mon équipe — Espace pro Adresse GN" },
      {
        name: "description",
        content:
          "Invitez vos collaborateurs et définissez leur rôle (éditeur ou lecteur) sur les fiches de votre entreprise.",
      },
      { property: "og:title", content: "Mon équipe — Espace pro Adresse GN" },
      { property: "og:description", content: "Gestion des accès collaborateurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EquipePage,
});

function EquipePage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");

  const equipe = useQuery({ queryKey: ["pro-team"], queryFn: () => proTeam() });
  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["pro-team"] });

  const inviter = useMutation({
    mutationFn: () => proInviteMember({ data: { email, role } }),
    onSuccess: () => {
      toast.success("Invitation envoyée.");
      setEmail("");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changerRole = useMutation({
    mutationFn: (input: { id: string; role: string }) => proUpdateMemberRole({ data: input }),
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retirer = useMutation({
    mutationFn: (id: string) => proRemoveMember({ data: { id } }),
    onSuccess: () => {
      toast.success("Membre retiré.");
      rafraichir();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mon équipe</h1>
        <p className="text-sm text-muted-foreground">
          Les membres invités peuvent gérer vos fiches selon leur rôle.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collaborateur@exemple.com"
          />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Éditeur</SelectItem>
              <SelectItem value="viewer">Lecteur</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => inviter.mutate()} disabled={!email || inviter.isPending} className="w-full sm:w-auto">
            <UserPlus className="size-4" />
            Inviter
          </Button>
        </CardContent>
      </Card>

      {equipe.isPending && <Skeleton className="h-32 w-full" />}

      <div className="space-y-3">
        {equipe.data?.members.map((m: any) => (
          <Card key={m.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {m.full_name ?? m.email ?? "Membre invité"}
                </p>
                {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                <Badge variant={m.joined_at ? "secondary" : "outline"}>
                  {m.joined_at ? "Actif" : "Invitation en attente"}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {m.role === "owner" ? (
                  <Badge>{TEAM_ROLE_LABELS['owner']}</Badge>
                ) : (
                  <>
                    <Select
                      value={m.role}
                      onValueChange={(v) => changerRole.mutate({ id: m.id, role: v })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Éditeur</SelectItem>
                        <SelectItem value="viewer">Lecteur</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => retirer.mutate(m.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
