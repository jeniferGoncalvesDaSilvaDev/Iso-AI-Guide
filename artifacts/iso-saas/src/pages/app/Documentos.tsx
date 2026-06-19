import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  useListDocuments, 
  useGenerateDocuments, 
  useGetCompanyStandards,
  useListDiagnostics,
  getListDocumentsQueryKey,
  getGetCompanyStandardsQueryKey,
  getListDiagnosticsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Wand2, FileSearch, ArrowRight, RefreshCw, FileCheck, FileWarning, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Documentos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterNorma, setFilterNorma] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  const companyId = user?.companyId ?? "";
  const docParams = {
    companyId: user?.companyId ?? undefined,
    ...(filterNorma !== "all" ? { standardId: filterNorma } : {})
  };
  const { data: documents, isLoading } = useListDocuments(
    docParams,
    { query: { enabled: !!user?.companyId, queryKey: getListDocumentsQueryKey(docParams) } }
  );

  const { data: standards } = useGetCompanyStandards(
    companyId,
    { query: { enabled: !!user?.companyId, queryKey: getGetCompanyStandardsQueryKey(companyId) } }
  );

  const diagParams = { companyId: user?.companyId ?? undefined };
  const { data: diagnostics } = useListDiagnostics(
    diagParams,
    { query: { enabled: !!user?.companyId, queryKey: getListDiagnosticsQueryKey(diagParams) } }
  );

  const generateDocsMutation = useGenerateDocuments();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && generationProgress < 95) {
      interval = setTimeout(() => {
        setGenerationProgress(prev => prev + 5);
      }, 500);
    } else if (isGenerating && generationProgress >= 95) {
      // End simulation
      setIsGenerating(false);
      setGenerationProgress(0);
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({ companyId: user?.companyId! }) });
      toast.success("Documentos gerados com sucesso!");
    }
    return () => clearTimeout(interval);
  }, [isGenerating, generationProgress, queryClient, user?.companyId]);

  const handleGenerate = () => {
    if (!user?.companyId) return;
    if (!standards || standards.length === 0) {
      toast.error("Você precisa selecionar normas primeiro.");
      return;
    }

    const diagnosticId = diagnostics && diagnostics.length > 0 ? diagnostics[0].id : undefined;

    setIsGenerating(true);
    setGenerationProgress(0);

    generateDocsMutation.mutate(
      { 
        data: { 
          companyId: user.companyId,
          standardId: standards[0].id, // generating for first standard for demo
          diagnosticId
        } 
      },
      {
        onError: () => {
          setIsGenerating(false);
          toast.error("Erro ao solicitar geração de documentos.");
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
      case 'em_revisao':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30">Em Revisão</Badge>;
      case 'obsoleto':
        return <Badge variant="destructive">Obsoleto</Badge>;
      default:
        return <Badge variant="outline">Rascunho</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <FileCheck className="h-5 w-5 text-green-500" />;
      case 'em_revisao':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'obsoleto':
        return <FileWarning className="h-5 w-5 text-destructive" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Documentos</h1>
          <p className="text-muted-foreground mt-2">
            Passo 3: Gere, gerencie e revise toda a documentação da sua empresa.
          </p>
        </div>
        
        {documents && documents.length > 0 && !isGenerating && (
          <Button onClick={handleGenerate} className="gap-2 shrink-0">
            <Wand2 className="h-4 w-4" />
            Criar Mais Documentos
          </Button>
        )}
      </div>

      {isGenerating && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6 pb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                  <h3 className="font-medium text-foreground">A IA está criando seus documentos...</h3>
                </div>
                <span className="font-bold text-primary">{generationProgress}%</span>
              </div>
              <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out" 
                  style={{ width: `${generationProgress}%` }} 
                />
              </div>
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                Redigindo políticas, manuais e procedimentos adaptados à sua realidade.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !documents || documents.length === 0 ? (
        <Card className="border-dashed border-2 py-12">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <FileSearch className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium text-foreground">Nenhum documento gerado ainda</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                A mágica acontece aqui. Clique no botão abaixo para que nossa IA gere toda a documentação baseada nas normas que você selecionou.
              </p>
            </div>
            <Button size="lg" onClick={handleGenerate} disabled={isGenerating} className="mt-4 gap-2">
              <Wand2 className="h-5 w-5" />
              Criar Meus Documentos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-muted/50 p-3 rounded-lg border border-border">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">Filtrar por Norma:</span>
            <Select value={filterNorma} onValueChange={setFilterNorma}>
              <SelectTrigger className="w-[250px] bg-background">
                <SelectValue placeholder="Todas as Normas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Normas</SelectItem>
                {standards?.map(std => (
                  <SelectItem key={std.id} value={std.id}>{std.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            {documents.map((doc) => (
              <Link key={doc.id} href={`/app/documentos/${doc.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-2 rounded-md">
                        {getStatusIcon(doc.status)}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">{doc.standardCode}</span>
                          <span className="text-xs text-muted-foreground capitalize">• {doc.type}</span>
                          <span className="text-xs text-muted-foreground">• v{doc.version}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(doc.status)}
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
