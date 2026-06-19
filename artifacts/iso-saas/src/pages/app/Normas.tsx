import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListStandards, useGetCompanyStandards, useSelectCompanyStandards, getGetCompanyStandardsQueryKey, getListStandardsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Check, Shield, BookOpen, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Normas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: standards, isLoading: isLoadingStandards } = useListStandards({
    query: { queryKey: getListStandardsQueryKey() }
  });

  const { data: companyStandards, isLoading: isLoadingCompanyStandards } = useGetCompanyStandards({
    query: {
      enabled: !!user?.companyId,
      queryKey: user?.companyId ? getGetCompanyStandardsQueryKey({ companyId: user.companyId }) : ["company-standards"]
    }
  });

  const selectStandardsMutation = useSelectCompanyStandards();

  // Initialize selected IDs
  if (companyStandards && !initialized) {
    setSelectedIds(companyStandards.map(s => s.id));
    setInitialized(true);
  }

  const toggleStandard = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!user?.companyId) {
      toast.error("Você precisa configurar sua empresa primeiro");
      return;
    }

    selectStandardsMutation.mutate(
      { data: { standardIds: selectedIds } },
      {
        onSuccess: () => {
          toast.success("Normas selecionadas com sucesso!");
          queryClient.invalidateQueries({ queryKey: getGetCompanyStandardsQueryKey({ companyId: user.companyId! }) });
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolher Normas</h1>
          <p className="text-muted-foreground mt-2">Passo 1: Selecione quais certificações sua empresa busca.</p>
        </div>
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Você precisa configurar o perfil da sua empresa antes de selecionar as normas aplicáveis.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = isLoadingStandards || isLoadingCompanyStandards;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Escolher Normas</h1>
        <p className="text-muted-foreground mt-2">
          Passo 1: Selecione quais certificações ISO você precisa implementar. A IA adaptará toda a documentação para essas normas.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-[250px]">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
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
                  <CardDescription className="text-foreground font-medium">{standard.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {standard.description}
                  </p>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
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

      {standards && standards.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button 
            size="lg" 
            onClick={handleSave} 
            disabled={selectStandardsMutation.isPending || selectedIds.length === 0}
          >
            {selectStandardsMutation.isPending ? "Salvando..." : "Salvar Normas Selecionadas"}
          </Button>
        </div>
      )}
    </div>
  );
}
