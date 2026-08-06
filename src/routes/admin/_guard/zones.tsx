import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable, type Colonne } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { adminDeleteZone, adminSaveZone, adminZones } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/_guard/zones")({
  head: () => ({
    meta: [
      { title: "Zones administratives — Administration Adresse GN" },
      {
        name: "description",
        content: "Régions, communes et quartiers du référentiel Adresse GN.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminZones,
});

type Niveau = "region" | "commune" | "district";

function AdminZones() {
  const lister = useServerFn(adminZones);
  const enregistrer = useServerFn(adminSaveZone);
  const supprimer = useServerFn(adminDeleteZone);
  const qc = useQueryClient();

  const [niveau, setNiveau] = useState<Niveau>("commune");
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [parent, setParent] = useState("");
  const [geojson, setGeojson] = useState("");

  const zones = useQuery({ queryKey: ["admin", "zones"], queryFn: () => lister() });
  const invalider = () => void qc.invalidateQueries({ queryKey: ["admin", "zones"] });

  const muter = useMutation({
    mutationFn: () =>
      enregistrer({
        data: {
          niveau,
          name: nom,
          code: code || null,
          parentId: parent || null,
          geojson: geojson.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Zone enregistrée.");
      setNom("");
      setCode("");
      setGeojson("");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const muterSuppression = useMutation({
    mutationFn: (v: { niveau: Niveau; id: string }) => supprimer({ data: v }),
    onSuccess: () => {
      toast.success("Zone supprimée.");
      invalider();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const colonnesRegion: Colonne<{ id: string; name: string; code: string }>[] = [
    { cle: "nom", entete: "Nom", rendu: (l) => l.name },
    { cle: "code", entete: "Code", rendu: (l) => l.code },
    {
      cle: "actions",
      entete: "",
      rendu: (l) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => muterSuppression.mutate({ niveau: "region", id: l.id })}
        >
          Supprimer
        </Button>
      ),
    },
  ];

  const nomRegion = (id: string | null) =>
    (zones.data?.regions ?? []).find((r) => r.id === id)?.name ?? "—";
  const nomCommune = (id: string | null) =>
    (zones.data?.communes ?? []).find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Tabs defaultValue="communes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regions">Régions ({zones.data?.regions.length ?? 0})</TabsTrigger>
          <TabsTrigger value="communes">Communes ({zones.data?.communes.length ?? 0})</TabsTrigger>
          <TabsTrigger value="districts">Quartiers ({zones.data?.districts.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="regions">
          <AdminTable
            colonnes={colonnesRegion}
            lignes={(zones.data?.regions ?? []) as any[]}
            chargement={zones.isLoading}
            cle={(l) => l.id}
          />
        </TabsContent>

        <TabsContent value="communes">
          <AdminTable
            colonnes={[
              { cle: "nom", entete: "Nom", rendu: (l: any) => l.name },
              { cle: "region", entete: "Région", rendu: (l: any) => nomRegion(l.region_id) },
              {
                cle: "actions",
                entete: "",
                rendu: (l: any) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => muterSuppression.mutate({ niveau: "commune", id: l.id })}
                  >
                    Supprimer
                  </Button>
                ),
              },
            ]}
            lignes={(zones.data?.communes ?? []) as any[]}
            chargement={zones.isLoading}
            cle={(l) => l.id}
          />
        </TabsContent>

        <TabsContent value="districts">
          <AdminTable
            colonnes={[
              { cle: "nom", entete: "Nom", rendu: (l: any) => l.name },
              { cle: "commune", entete: "Commune", rendu: (l: any) => nomCommune(l.commune_id) },
              {
                cle: "actions",
                entete: "",
                rendu: (l: any) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => muterSuppression.mutate({ niveau: "district", id: l.id })}
                  >
                    Supprimer
                  </Button>
                ),
              },
            ]}
            lignes={(zones.data?.districts ?? []) as any[]}
            chargement={zones.isLoading}
            cle={(l) => l.id}
          />
        </TabsContent>
      </Tabs>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Ajouter / modifier une zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Niveau</Label>
            <Select value={niveau} onValueChange={(v) => setNiveau(v as Niveau)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="region">Région</SelectItem>
                <SelectItem value="commune">Commune</SelectItem>
                <SelectItem value="district">Quartier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nom</Label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          {niveau === "region" && (
            <div>
              <Label className="text-xs">Code (ex. CKY)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
          )}
          {niveau !== "region" && (
            <div>
              <Label className="text-xs">
                {niveau === "commune" ? "Région parente" : "Commune parente"}
              </Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {(niveau === "commune" ? zones.data?.regions : zones.data?.communes ?? [])?.map(
                    (z: any) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          {niveau !== "region" && (
            <div>
              <Label className="text-xs">Contour GeoJSON (Polygon, optionnel)</Label>
              <Textarea
                rows={6}
                value={geojson}
                onChange={(e) => setGeojson(e.target.value)}
                placeholder='{"type":"Polygon","coordinates":[[[-13.7,9.5],…]]}'
                className="font-mono text-xs"
              />
            </div>
          )}
          <Button className="w-full" disabled={!nom || muter.isPending} onClick={() => muter.mutate()}>
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
