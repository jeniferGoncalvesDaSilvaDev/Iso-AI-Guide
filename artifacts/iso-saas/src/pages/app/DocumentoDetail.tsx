import { useParams, Link } from "wouter";
import { useState } from "react";
import { 
  useGetDocument, 
  useUpdateDocument,
  useGetDocumentRevisions,
  getGetDocumentQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Download, History, FileText, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatMarkdown } from "@/lib/format";
import { toast } from "sonner";
import type { DocumentUpdateStatus } from "@workspace/api-client-react";

export default function DocumentoDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: doc, isLoading } = useGetDocument(id!, {
    query: {
      enabled: !!id,
      queryKey: getGetDocumentQueryKey(id!)
    }
  });

  const { data: revisions } = useGetDocumentRevisions(id!, {
    query: {
      enabled: !!id,
      queryKey: ["document-revisions", id]
    }
  });

  const updateMutation = useUpdateDocument();

  if (doc && !initialized) {
    setContent(doc.content || "");
    setInitialized(true);
  }

  const handleSave = () => {
    updateMutation.mutate(
      { id: id!, data: { content, revisionReason: "Atualização manual do conteúdo" } },
      {
        onSuccess: () => {
          toast.success("Documento salvo com sucesso!");
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id!) });
          queryClient.invalidateQueries({ queryKey: ["document-revisions", id] });
        },
        onError: () => toast.error("Erro ao salvar o documento.")
      }
    );
  };

  const handleStatusChange = (newStatus: DocumentUpdateStatus) => {
    updateMutation.mutate(
      { id: id!, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success("Status atualizado!");
          queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id!) });
        }
      }
    );
  };

  const handleDownload = () => {
    toast.info("Preparando download...");
    // Chama o endpoint POST diretamente com o token de autenticação
    // O endpoint agora retorna o arquivo diretamente (não mais um JSON com URL)
    const token = localStorage.getItem("iso_access_token");
    fetch(`/api/documents/${id}/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ format: "pdf" }),
    })
      .then(response => {
        if (!response.ok) throw new Error("Erro ao baixar");
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?(.+?)"?$/);
        const filename = match ? match[1] : "documento.pdf";
        return response.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast.success("Download concluído!");
      })
      .catch((err) => {
        console.error("Download error:", err);
        toast.error("Erro ao fazer download. Tente novamente.");
      });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!doc) return <div className="p-8 text-center text-muted-foreground">Documento não encontrado.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/documentos">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{doc.title}</h1>
            <Badge variant="outline">v{doc.version}</Badge>
            {doc.status === 'aprovado' ? (
              <Badge className="bg-green-500">Aprovado</Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">Rascunho</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {doc.standardCode} • {doc.type} • Editado em {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {doc.status !== 'aprovado' && (
            <Button variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatusChange("aprovado")}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Aprovar
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Editar Documento</Button>
          ) : (
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-green-600 hover:bg-green-700">
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger value="content" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
            <FileText className="h-4 w-4 mr-2" />
            Conteúdo
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3">
            <History className="h-4 w-4 mr-2" />
            Histórico de Versões
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="pt-6">
          <Card className="border-border shadow-sm min-h-[500px]">
            {isEditing ? (
              <Textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] border-0 rounded-none focus-visible:ring-0 resize-y p-6 font-mono text-sm leading-relaxed"
              />
            ) : (
              <CardContent className="p-8 prose prose-slate max-w-none dark:prose-invert">
                {doc.content ? (
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(doc.content) }} />
                ) : (
                  <p className="text-muted-foreground italic text-center py-12">Conteúdo vazio.</p>
                )}
              </CardContent>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Revisões</CardTitle>
              <CardDescription>Acompanhe todas as mudanças feitas neste documento.</CardDescription>
            </CardHeader>
            <CardContent>
              {revisions && revisions.length > 0 ? (
                <div className="space-y-4">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
                      <div className="bg-primary/10 p-2 rounded-full shrink-0">
                        <History className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-foreground">Versão {rev.version}</h4>
                          <span className="text-sm text-muted-foreground">
                            {new Date(rev.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rev.revisionReason || "Sem motivo especificado"}</p>
                        <p className="text-xs text-muted-foreground mt-2">Por: {rev.createdBy || "Sistema IA"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum histórico de revisão disponível.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
