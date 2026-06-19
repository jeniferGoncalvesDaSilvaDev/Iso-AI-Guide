import { useAuth } from "@/lib/auth";
import { useListAuditLogs, getListAuditLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

export default function Auditoria() {
  const { user } = useAuth();

  const auditParams = { companyId: user?.companyId ?? undefined };
  const { data: logs, isLoading } = useListAuditLogs(
    auditParams,
    { query: { enabled: !!user?.companyId, queryKey: getListAuditLogsQueryKey(auditParams) } }
  );

  if (!user?.companyId) {
    return <div className="p-8 text-center text-muted-foreground">Configure sua empresa para ver os registros.</div>;
  }

  const getActionBadge = (action: string) => {
    if (action.includes("create") || action.includes("gerar")) {
      return <Badge className="bg-green-500 hover:bg-green-600">Criação</Badge>;
    }
    if (action.includes("update") || action.includes("edit")) {
      return <Badge variant="secondary" className="bg-blue-500/20 text-blue-700">Edição</Badge>;
    }
    if (action.includes("delete") || action.includes("remove")) {
      return <Badge variant="destructive">Exclusão</Badge>;
    }
    if (action.includes("login") || action.includes("auth")) {
      return <Badge variant="outline" className="bg-muted">Sistema</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Histórico de Ações</h1>
          <p className="text-muted-foreground mt-1">
            Registro de auditoria com todas as ações realizadas na plataforma.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Data e Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead className="text-right">Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : !logs || logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-medium">
                      {new Date(log.createdAt).toLocaleDateString("pt-BR", { 
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" 
                      })}
                    </TableCell>
                    <TableCell>{log.userName || "Sistema IA"}</TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="capitalize">{log.resourceType || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm font-mono">
                      {log.action} {log.resourceId ? `(${log.resourceId.slice(0,8)}...)` : ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
