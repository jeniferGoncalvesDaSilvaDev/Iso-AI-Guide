import { useAuth } from "@/lib/auth";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetRecommendations,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetRecommendationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Clock, AlertTriangle, Activity, Sparkles, ChevronRight, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const priorityLabel: Record<string, { label: string; className: string }> = {
  alta:  { label: "Alta prioridade",  className: "bg-red-100 text-red-700 border-red-200" },
  media: { label: "Média prioridade", className: "bg-amber-100 text-amber-700 border-amber-200" },
  baixa: { label: "Baixa prioridade", className: "bg-green-100 text-green-700 border-green-200" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const dashParams = { companyId: user?.companyId ?? undefined };

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    dashParams,
    { query: { enabled: !!user?.companyId, queryKey: getGetDashboardSummaryQueryKey(dashParams) } },
  );

  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity(
    dashParams,
    { query: { enabled: !!user?.companyId, queryKey: getGetRecentActivityQueryKey(dashParams) } },
  );

  const recParams = { companyId: user?.companyId ?? "" };
  const {
    data: recs,
    isLoading: isLoadingRecs,
    refetch: refetchRecs,
    isFetching: isFetchingRecs,
  } = useGetRecommendations(recParams, {
    query: {
      enabled: !!user?.companyId,
      queryKey: getGetRecommendationsQueryKey(recParams),
      staleTime: 1000 * 60 * 10,
    },
  });

  if (!user?.companyId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-2">Bem-vindo, {user?.name}</p>
        </div>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center py-12">
            <AlertTriangle className="h-12 w-12 text-primary mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">Configure sua empresa</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Para começar a usar a plataforma e gerar seus documentos ISO, você precisa configurar os dados da sua empresa.
            </p>
            <Link href="/app/empresas">
              <Button>Configurar Minha Empresa</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe o progresso da certificação da sua empresa.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalDocuments || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.approvedDocuments || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.pendingDocuments || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score de Conformidade</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{summary?.complianceScore || 0}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Recomendações IA</CardTitle>
                <CardDescription>
                  Análise personalizada para a sua empresa
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchRecs()}
              disabled={isFetchingRecs}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetchingRecs ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingRecs || isFetchingRecs ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <div className="space-y-3 mt-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            </div>
          ) : recs ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3 italic">
                {recs.summary}
              </p>
              <div className="space-y-3 pt-1">
                {recs.recommendations.map((rec) => {
                  const p = priorityLabel[rec.priority] ?? priorityLabel.media;
                  return (
                    <div
                      key={rec.standardCode}
                      className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-foreground">{rec.standardCode}</span>
                          <span className="text-muted-foreground text-sm ml-2">{rec.standardName}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs font-medium ${p.className}`}
                        >
                          {p.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      <ul className="space-y-1 pt-1">
                        {rec.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Gerado em {new Date(recs.generatedAt).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Não foi possível carregar as recomendações. Tente novamente.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
          <CardDescription>O que aconteceu na sua conta recentemente</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivity ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="space-y-6">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none mb-1">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma atividade recente encontrada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
