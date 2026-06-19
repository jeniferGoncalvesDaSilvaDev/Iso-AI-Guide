import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useListDiagnostics, useCreateDiagnostic, getListDiagnosticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, CheckCircle, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Diagnostico() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  const steps = [
    "Iniciando diagnóstico...",
    "Analisando o contexto da empresa...",
    "Mapeando processos principais...",
    "Identificando riscos e oportunidades...",
    "Gerando recomendações...",
    "Finalizando diagnóstico..."
  ];

  const diagParams = { companyId: user?.companyId ?? undefined };
  const { data: diagnostics, isLoading } = useListDiagnostics(
    diagParams,
    { query: { enabled: !!user?.companyId, queryKey: getListDiagnosticsQueryKey(diagParams) } }
  );

  const createDiagnosticMutation = useCreateDiagnostic();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && generationStep < steps.length - 1) {
      interval = setTimeout(() => {
        setGenerationStep(prev => prev + 1);
      }, 2000);
    } else if (isGenerating && generationStep === steps.length - 1) {
      // Finished simulation, should rely on actual polling if it was real background job
      // but for UX we just invalidate query to fetch new result
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: getListDiagnosticsQueryKey({ companyId: user?.companyId! }) });
    }
    return () => clearTimeout(interval);
  }, [isGenerating, generationStep, steps.length, queryClient, user?.companyId]);

  const handleGenerate = () => {
    if (!user?.companyId) return;

    setIsGenerating(true);
    setGenerationStep(0);

    createDiagnosticMutation.mutate(
      { data: { companyId: user.companyId, additionalInfo } },
      {
        onSuccess: () => {
          // The effect will handle the step animation and final invalidation
        },
        onError: () => {
          setIsGenerating(false);
        }
      }
    );
  };

  if (!user?.companyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Diagnóstico AI</h1>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Configure sua empresa antes de realizar o diagnóstico.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const latestDiagnostic = diagnostics && diagnostics.length > 0 ? diagnostics[0] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Diagnóstico AI</h1>
        <p className="text-muted-foreground mt-2">
          Passo 2: Nossa IA analisa o contexto da sua empresa para criar um plano de adequação sob medida.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : isGenerating ? (
        <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden">
          <div className="h-1 bg-primary/20 w-full relative">
            <div 
              className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out" 
              style={{ width: `${(generationStep / (steps.length - 1)) * 100}%` }}
            />
          </div>
          <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-20 animate-pulse" />
              <div className="bg-primary/20 p-4 rounded-full relative z-10">
                <RefreshCcw className="h-12 w-12 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium text-foreground">Trabalhando no seu diagnóstico</h3>
              <p className="text-primary font-medium animate-pulse">{steps[generationStep]}</p>
            </div>
          </CardContent>
        </Card>
      ) : !latestDiagnostic || latestDiagnostic.status === "failed" ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Iniciar Diagnóstico</CardTitle>
            <CardDescription>
              Conte-nos um pouco mais sobre o momento atual da sua empresa (opcional) para resultados mais precisos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Informações adicionais</Label>
                <Textarea 
                  id="additionalInfo" 
                  placeholder="Ex: Já possuímos processos documentados de RH, mas precisamos estruturar a área de produção."
                  className="h-32"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border flex justify-between items-center">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Este processo leva alguns instantes.
            </p>
            <Button onClick={handleGenerate} size="lg">
              Gerar Diagnóstico
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h2 className="text-xl font-medium">Diagnóstico concluído</h2>
            </div>
            <Button variant="outline" onClick={handleGenerate}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refazer
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Contexto Organizacional</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {latestDiagnostic.organizationalContext || "Informação não disponível"}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Partes Interessadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {latestDiagnostic.stakeholders || "Informação não disponível"}
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recomendações e Próximos Passos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-6">
                  {latestDiagnostic.recommendations || "Nenhuma recomendação gerada."}
                </p>
                <div className="flex justify-center pt-4 border-t border-border">
                  <Link href="/app/documentos">
                    <Button size="lg" className="w-full sm:w-auto">
                      Ir para Passo 3: Criar Meus Documentos
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
