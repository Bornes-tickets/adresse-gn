import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ownerDeactivateAccount, ownerProfile, ownerUpdateProfile } from "@/lib/owner.functions";

export const Route = createFileRoute("/mon-compte/_guard/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres du compte — Adresse GN" },
      {
        name: "description",
        content:
          "Modifiez votre nom et votre téléphone, ou demandez la désactivation de votre compte Adresse GN.",
      },
      { property: "og:title", content: "Paramètres du compte — Adresse GN" },
      { property: "og:description", content: "Gestion de votre profil Adresse GN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParametresPage,
});

function ParametresPage() {
  const navigate = useNavigate();
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["owner-profile"],
    queryFn: () => ownerProfile(),
  });

  useEffect(() => {
    if (data) {
      setNom(data.full_name ?? "");
      setTel(data.phone ?? "");
    }
  }, [data]);

  const enregistrer = useMutation({
    mutationFn: () =>
      ownerUpdateProfile({ data: { fullName: nom.trim() || null, phone: tel.trim() || null } }),
    onSuccess: () => toast.success("Profil mis à jour."),
    onError: (e: Error) => toast.error(e.message),
  });

  const desactiver = useMutation({
    mutationFn: () => ownerDeactivateAccount({ data: { confirm: confirmation } }),
    onSuccess: async () => {
      toast.success("Compte désactivé. À bientôt.");
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Paramètres</h1>
        <p className="text-sm text-muted-foreground">Vos informations personnelles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tel">Téléphone</Label>
            <Input
              id="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              maxLength={30}
              placeholder="+224 ..."
            />
          </div>
          <Button onClick={() => enregistrer.mutate()} disabled={enregistrer.isPending}>
            {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Désactiver mon compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vos adresses seront masquées et votre accès suspendu. Saisissez{" "}
            <span className="font-mono font-medium">DESACTIVER</span> pour confirmer.
          </p>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
            placeholder="DESACTIVER"
            className="font-mono sm:max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={confirmation !== "DESACTIVER" || desactiver.isPending}
            onClick={() => desactiver.mutate()}
          >
            Désactiver définitivement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
