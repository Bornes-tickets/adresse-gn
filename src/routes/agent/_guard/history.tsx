import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/agent/_guard/history")({
  component: History,
});

function History() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Historique</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Clock className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Vos installations apparaîtront ici.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
