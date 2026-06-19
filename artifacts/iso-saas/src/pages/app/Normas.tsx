import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useListStandards, useGetCompanyStandards, useSelectCompanyStandards, getGetCompanyStandardsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, AlertTriangle, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StepProgress, useWorkflowSteps } from "@/components/ui/StepProgress";

export default function Normas() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const steps = useWorkflowSteps(location);

  const { data: standards, isLoading: isLoadingStandards } = useListStandards();

  const companyId = user?.companyId ?? "";
  const { data: companyStandards, isLoading: isLoadingCompanyStandards } = useGetCompanyStandards(
    companyId,
    { query: { enabled: !!user?.companyId, queryKey: getGetCompanyStandardsQueryKey(companyId) } }
  );

  const selectStandardsMutation = useSelectCompanyStandards();

  if (companyStandards && !initialized) {
    setSelectedIds(companyStandards.map(s => s.id));
    setInitialized(true);
  }

  const toggleStandard = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleSave = (redirectToDiagnostico = false) => {
    if (!user?.companyId) {
      toast.error("Você precisa configurar sua empresa primeiro");
      return;
    }

    selectStandardsMutation.mutate(
      { id: user.companyId, data: { standardIds: selectedIds } },
      {
        onSuccess: () => {
          toast.success("Normas salvas! Agora gere seu diagnóstico.");
          queryClient.invalidateQueries({ queryKey: getGetCompanyStandardsQueryKey(user.companyId!) });
          if (redirectToDiagnostico) {
            setLocation("/app/diagnostico");
          }
        },
        onError: () => {
          toast.error("Erro ao salvar as normas. Tente novamente.");
        }
      }
    );
  };

  if (!user?.companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolher Normas</h1>
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Configure o perfil da sua empresa antes de selecionar as normas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = isLoadingStandards || isLoadingCompanyStandards;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolher Normas</h1>
        <p className="text-muted-foreground mt-1">
          Selecione quais certificações ISO sua empresa quer conquistar.
        </p>
      </div>

      {/* Step progress */}
      <div className="bg-card border border-border rounded-xl p-4">
        <StepProgress steps={steps} />
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-foreground">
        <span className="text-primary mt-0.5">💡</span>
        <span>Marque as normas que se aplicam ao seu setor. Não tem certeza? Confira as recomendações no seu <a href="/app/dashboard" className="text-primary underline underline-offset-2">Dashboard</a>.</span>
      </div>

      {/* Standards grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-[230px]">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {standards?.map((standard) => {
            const isSelected = selectedIds.includes(standard.id);
            return (
              <Card
                key={standard.id}
                className={`transition-all duration-200 cursor-pointer overflow-hidden ${isSelected ? 'border-primary ring-1 ring-primary/50 shadow-md' : 'hover:border-primary/50'}`}
                onClick={() => toggleStandard(standard.id)}
              >
                <div className={`h-1.5 w-full ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl flex items-center gap-2">
                      {standard.code}
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </CardTitle>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleStandard(standard.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <p className="text-foreground font-medium text-sm">{standard.name}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {standard.description}
                  </p>
                  <div className="mt-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      {standard.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Save + Next */}
      {standards && standards.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mr-auto">
            {selectedIds.length === 0 ? "Nenhuma norma selecionada ainda." : `${selectedIds.length} norma(s) selecionada(s).`}
          </p>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={selectStandardsMutation.isPending || selectedIds.length === 0}
          >
            {selectStandardsMutation.isPending ? "Salvando..." : "Salvar seleção"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={selectStandardsMutation.isPending || selectedIds.length === 0}
            className="gap-2"
          >
            Salvar e ir para o Diagnóstico
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
