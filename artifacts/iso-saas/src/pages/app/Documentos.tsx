import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
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
import {
  FileText, Wand2, FileSearch, RefreshCw, FileCheck, FileWarning, Clock,
  ChevronDown, ChevronRight, FolderOpen, Folder, Cloud, ArrowRight, AlertCircle
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StepProgress, useWorkflowSteps } from "@/components/ui/StepProgress";

// ─── Document type → folder mapping ───────────────────────────────────────────
const FOLDER_ORDER = [
  "Estrutura do SGQ",
  "Procedimentos",
  "Registros",
  "Formulários",
  "Documentos Externos",
  "Outros",
];

function getFolderForDoc(doc: { type: string; title: string }): string {
  const t = doc.type?.toLowerCase() ?? "";
  const title = doc.title?.toUpperCase() ?? "";

  if (title.match(/^SGQ-/) || t === "escopo" || t === "politica" || t === "mapa" || t === "manual")
    return "Estrutura do SGQ";
  if (title.match(/^PQ-/) || t === "procedimento")
    return "Procedimentos";
  if (title.match(/^(NC-|AI-|OP-|RQ-|RT-|RC-)/) || t === "registro")
    return "Registros";
  if (title.match(/^FQ-/) || t === "formulario" || t === "formulário")
    return "Formulários";
  if (t === "externo" || t === "externo_cliente" || t === "especificacao" || t === "especificação")
    return "Documentos Externos";
  return "Outros";
}

function groupDocsByFolder(docs: Array<{ id: string; title: string; type: string; status: string; standardCode?: string | null; version?: string | null }>) {
  const map: Record<string, typeof docs> = {};
  for (const doc of docs) {
    const folder = getFolderForDoc(doc);
    if (!map[folder]) map[folder] = [];
    map[folder].push(doc);
  }
  return map;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "aprovado":
      return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-0">Aprovado</Badge>;
    case "em_revisao":
      return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-0">Em Revisão</Badge>;
    case "obsoleto":
      return <Badge variant="destructive">Obsoleto</Badge>;
    default:
      return <Badge variant="outline">Rascunho</Badge>;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "aprovado":   return <FileCheck   className="h-4 w-4 text-green-500" />;
    case "em_revisao": return <Clock       className="h-4 w-4 text-amber-500" />;
    case "obsoleto":   return <FileWarning className="h-4 w-4 text-destructive" />;
    default:           return <FileText    className="h-4 w-4 text-muted-foreground" />;
  }
}

interface FolderRowProps {
  name: string;
  docs: Array<{ id: string; title: string; type: string; status: string; standardCode?: string | null; version?: string | null }>;
}

function FolderRow({ name, docs }: FolderRowProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Folder header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <FolderOpen className="h-4 w-4 text-primary shrink-0" />
          : <Folder     className="h-4 w-4 text-primary shrink-0" />}
        <span className="font-semibold text-sm text-foreground flex-1">{name}</span>
        <Badge variant="outline" className="text-xs">{docs.length} doc{docs.length !== 1 ? "s" : ""}</Badge>
        {open
          ? <ChevronDown  className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
      </button>

      {/* File list */}
      {open && (
        <div className="divide-y divide-border">
          {docs.map((doc) => (
            <Link key={doc.id} href={`/app/documentos/${doc.id}`}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer group">
                <div className="shrink-0 ml-3">
                  <StatusIcon status={doc.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.standardCode && (
                      <span className="text-xs text-muted-foreground">{doc.standardCode}</span>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">• {doc.type}</span>
                    {doc.version && (
                      <span className="text-xs text-muted-foreground">• v{doc.version}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={doc.status} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Documentos() {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMsg, setGenerationMsg] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const steps = useWorkflowSteps(location);

  const GENERATION_MSGS = [
    "Preparando a estrutura de documentos...",
    "Redigindo políticas e escopo do SGQ...",
    "Criando procedimentos operacionais...",
    "Gerando formulários e registros...",
    "Revisando conformidade com a norma...",
    "Finalizando e salvando na nuvem...",
  ];

  const companyId = user?.companyId ?? "";
  const docParams  = { companyId: user?.companyId ?? undefined };

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

  // Poll job progress in real time instead of simulating
  useEffect(() => {
    if (!isGenerating || !jobId) return;
    
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Job not found");
        const job = await res.json();
        
        const total = job.totalDocuments || 1;
        const pct = Math.round((job.progress / total) * 100);
        setGenerationProgress(pct);
        const msgIdx = Math.floor((pct / 100) * (GENERATION_MSGS.length - 1));
        setGenerationMsg(GENERATION_MSGS[Math.min(msgIdx, GENERATION_MSGS.length - 1)]);

        if (job.status === "completed") {
          setGenerationProgress(100);
          setGenerationMsg("Finalizado!");
          setIsGenerating(false);
          setJobId(null);
          setGenerationProgress(0);
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({ companyId: user?.companyId! }) });
          toast.success("Documentos criados e salvos na sua conta!");
        } else if (job.status === "failed") {
          setIsGenerating(false);
          setJobId(null);
          setGenerationProgress(0);
          toast.error(job.errorMessage || "Erro ao gerar documentos. Tente novamente.");
        }
      } catch {
        // Keep polling even if request fails
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isGenerating, jobId, queryClient, user?.companyId]);

  const handleGenerate = () => {
    if (!user?.companyId) return;
    if (!standards || standards.length === 0) {
      toast.error("Você precisa selecionar normas primeiro (Passo 1).");
      return;
    }
    const diagnosticId = diagnostics && diagnostics.length > 0 ? diagnostics[0].id : undefined;
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationMsg(GENERATION_MSGS[0]);
    setJobId(null);

    generateDocsMutation.mutate(
      { data: { companyId: user.companyId, standardId: standards[0].id, diagnosticId } },
      {
        onSuccess: (res: any) => {
          if (res?.jobId) setJobId(res.jobId);
        },
        onError: () => {
          setIsGenerating(false);
          setJobId(null);
          toast.error("Não foi possível gerar os documentos. Tente novamente ou contate o suporte.");
        }
      }
    );
  };

  const hasStandards = standards && standards.length > 0;
  const grouped = documents && documents.length > 0 ? groupDocsByFolder(documents) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Documentos</h1>
          <p className="text-muted-foreground mt-1">
            Toda a documentação da sua empresa, organizada e pronta para auditoria.
          </p>
        </div>
        {documents && documents.length > 0 && !isGenerating && (
          <Button onClick={handleGenerate} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Wand2 className="h-4 w-4" />
            Gerar novos documentos
          </Button>
        )}
      </div>

      {/* Step progress */}
      <div className="bg-card border border-border rounded-xl p-4">
        <StepProgress steps={steps} />
      </div>

      {/* Cloud backup notice */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
        <Cloud className="h-4 w-4 shrink-0" />
        <span>
          Todos os documentos ficam salvos automaticamente na sua conta. Se você perder o arquivo no computador, é só baixar de novo aqui.
        </span>
      </div>

      {/* Generation progress card */}
      {isGenerating && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="pt-6 pb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                  <h3 className="font-medium text-foreground">Criando seus documentos...</h3>
                </div>
                <span className="font-bold text-primary tabular-nums">{generationProgress}%</span>
              </div>
              <div className="h-2.5 w-full bg-primary/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center animate-pulse">{generationMsg}</p>
              <p className="text-xs text-muted-foreground text-center">☁️ Salvando automaticamente na sua conta — não feche esta janela.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : !documents || documents.length === 0 ? (
        /* Empty state */
        <div className="space-y-6">
          {!hasStandards && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Você ainda não escolheu as normas ISO.{" "}
                <Link href="/app/normas" className="font-semibold underline underline-offset-2">
                  Volte ao Passo 1
                </Link>{" "}
                para selecionar antes de gerar os documentos.
              </span>
            </div>
          )}
          <Card className="border-dashed border-2 py-14">
            <CardContent className="flex flex-col items-center justify-center text-center space-y-5">
              <div className="bg-primary/10 p-5 rounded-full">
                <FileSearch className="h-12 w-12 text-primary" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-xl font-semibold text-foreground">Seus documentos vão aparecer aqui</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Clique no botão abaixo e a IA vai criar toda a documentação necessária para sua certificação ISO — organizada em pastas, pronta para uso.
                </p>
              </div>
              <div className="text-xs text-muted-foreground bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                <Cloud className="h-3.5 w-3.5" />
                Os arquivos ficam salvos automaticamente na plataforma
              </div>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !hasStandards}
                className="gap-2 mt-2"
              >
                <Wand2 className="h-5 w-5" />
                Criar meus documentos agora
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Folder view */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {documents.length} documento{documents.length !== 1 ? "s" : ""} — clique em qualquer um para abrir
            </p>
          </div>
          {FOLDER_ORDER.filter(f => grouped![f]?.length > 0).map(folderName => (
            <FolderRow key={folderName} name={folderName} docs={grouped![folderName]} />
          ))}
        </div>
      )}
    </div>
  );
}
