import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useListDiagnostics, useCreateDiagnostic, getListDiagnosticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Activity, CheckCircle, RefreshCcw, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { StepProgress, useWorkflowSteps } from "@/components/ui/StepProgress";

export default function Diagnostico() {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  const aiSteps = [
    "Iniciando diagnóstico...",
    "Analisando o contexto da empresa...",
    "Mapeando processos principais...",
    "Identificando riscos e oportunidades...",
    "Gerando recomendações...",
    "Finalizando diagnóstico..."
  ];

  const steps = useWorkflowSteps(location);

  const diagParams = { companyId: user?.companyId ?? undefined };
  const { data: diagnostics, isLoading } = useListDiagnostics(
    diagParams,
    { 
      query: { 
        enabled: !!user?.companyId, 
        queryKey: getListDiagnosticsQueryKey(diagParams),
        // Poll every 3s while a diagnostic is being generated
        refetchInterval: (query) => {
          const data = query.state.data;
          if (data && data.length > 0 && data[0]?.status === "generating") return 3000;
          return false;
        },
      } 
    }
  );

  const createDiagnosticMutation = useCreateDiagnostic();

  // Poll for diagnostic completion using refetchInterval instead of simulated progress
  useEffect(() => {
    if (isGenerating && diagnostics && diagnostics.length > 0) {
      const latest = diagnostics[0];
      if (latest?.status === "completed" || latest?.status === "failed") {
        setIsGenerating(false);
        setGenerationStep(0);
      } else if (latest?.status === "generating") {
        // Update progress step based on time elapsed
        const elapsed = Date.now() - new Date(latest.createdAt).getTime();
        const step = Math.min(Math.floor(elapsed / 8000), aiSteps.length - 1);
        setGenerationStep(step);
      }
    }
  }, [isGenerating, diagnostics, aiSteps.length]);

  const handleGenerate = () => {
    if (!user?.companyId) return;
    setIsGenerating(true);
    setGenerationStep(0);
    createDiagnosticMutation.mutate(
      { data: { companyId: user.companyId, additionalInfo } },
      {
        onError: () => { setIsGenerating(false); }
      }
    );
  };

  if (!user?.companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Diagnóstico IA</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Configure sua empresa antes de realizar o diagnóstico.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const latestDiagnostic = diagnostics && diagnostics.length > 0 ? diagnostics[0] : null;

  // Check if diagnostic is outdated
  if (latestDiagnostic?.status === "outdated") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Diagnóstico IA</h1>
          <p className="text-muted-foreground mt-1">
            A IA analisa sua empresa e cria um plano de adequação sob medida.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <StepProgress steps={steps} />
        </div>

        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Seus dados foram atualizados. O diagnóstico anterior ficou desatualizado e precisa ser regenerado com as novas informações.
          </AlertDescription>
        </Alert>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Regenerar Diagnóstico</CardTitle>
            <CardDescription>
              Clique no botão abaixo para gerar um novo diagnóstico com os dados atualizados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="additionalInfo">Informações adicionais <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                id="additionalInfo"
                placeholder="Ex: Já temos processos de RH documentados, mas precisamos estruturar a área de produção e controle de qualidade."
                className="h-32 resize-none"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0" />
              A IA leva em torno de 30–60 segundos para gerar seu diagnóstico completo.
            </p>
            <Button onClick={handleGenerate} size="lg" className="gap-2 w-full sm:w-auto">
              Regenerar agora
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Diagnóstico IA</h1>
        <p className="text-muted-foreground mt-1">
          A IA analisa sua empresa e cria um plano de adequação sob medida.
        </p>
      </div>

      {/* Step progress */}
      <div className="bg-card border border-border rounded-xl p-4">
        <StepProgress steps={steps} />
      </div>

      {isLoading ? (
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
      ) : isGenerating ? (
        <Card className="border-primary/50 bg-primary/5 shadow-lg overflow-hidden">
          <div className="h-1.5 bg-primary/20 w-full relative">
            <div
              className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${(generationStep / (aiSteps.length - 1)) * 100}%` }}
            />
          </div>
          <CardContent className="pt-14 pb-14 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-20 animate-pulse" />
              <div className="bg-primary/20 p-5 rounded-full relative z-10">
                <RefreshCcw className="h-12 w-12 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">Analisando sua empresa...</h3>
              <p className="text-primary font-medium animate-pulse">{aiSteps[generationStep]}</p>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns instantes. Não feche esta janela.</p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              ☁️ Seus dados ficam salvos automaticamente na plataforma
            </div>
          </CardContent>
        </Card>
      ) : !latestDiagnostic || latestDiagnostic.status === "failed" ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Iniciar Diagnóstico</CardTitle>
            <CardDescription>
              Conte um pouco sobre o momento atual da sua empresa (opcional) — isso deixa o resultado mais preciso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="additionalInfo">Informações adicionais <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                id="additionalInfo"
                placeholder="Ex: Já temos processos de RH documentados, mas precisamos estruturar a área de produção e controle de qualidade."
                className="h-32 resize-none"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0" />
              A IA leva em torno de 30–60 segundos para gerar seu diagnóstico completo.
            </p>
            <Button onClick={handleGenerate} size="lg" className="gap-2 w-full sm:w-auto">
              Gerar meu diagnóstico agora
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Diagnóstico concluído!</p>
                <p className="text-sm text-green-700">Seu plano de adequação está pronto. Agora você pode gerar os documentos.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate} className="shrink-0 hidden sm:flex gap-2">
              <RefreshCcw className="h-4 w-4" />
              Refazer
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Contexto Organizacional</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {latestDiagnostic.organizationalContext || "Informação não disponível"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Partes Interessadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {latestDiagnostic.stakeholders || "Informação não disponível"}
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recomendações e Próximos Passos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed mb-6">
                  {latestDiagnostic.recommendations || "Nenhuma recomendação gerada."}
                </p>
                <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mr-auto">
                    ✅ Diagnóstico salvo automaticamente na sua conta
                  </p>
                  <Link href="/app/documentos">
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      Criar meus documentos
                      <ArrowRight className="h-4 w-4" />
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
