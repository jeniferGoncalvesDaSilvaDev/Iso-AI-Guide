import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import NotFound from "@/pages/not-found";

import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Dashboard from "@/pages/app/Dashboard";
import Normas from "@/pages/app/Normas";
import Diagnostico from "@/pages/app/Diagnostico";
import Documentos from "@/pages/app/Documentos";
import DocumentoDetail from "@/pages/app/DocumentoDetail";
import Chat from "@/pages/app/Chat";
import Empresas from "@/pages/app/Empresas";
import Auditoria from "@/pages/app/Auditoria";
import Configuracoes from "@/pages/app/Configuracoes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 0, // Always fetch fresh data on mount/focus to avoid stale displays
      gcTime: 1000 * 60 * 5, // 5min garbage collection
    },
  },
});

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/app/dashboard" component={Dashboard} />
        <Route path="/app/normas" component={Normas} />
        <Route path="/app/diagnostico" component={Diagnostico} />
        <Route path="/app/documentos" component={Documentos} />
        <Route path="/app/documentos/:id" component={DocumentoDetail} />
        <Route path="/app/chat" component={Chat} />
        <Route path="/app/empresas" component={Empresas} />
        <Route path="/app/auditoria" component={Auditoria} />
        <Route path="/app/configuracoes" component={Configuracoes} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/cadastro" component={Register} />
      <Route path="/app/*" component={() => <PrivateRoute component={AppRoutes} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
