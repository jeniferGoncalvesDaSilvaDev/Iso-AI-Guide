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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/app/dashboard" component={Dashboard} />
        <Route path="/app/normas" component={() => <div>Normas</div>} />
        <Route path="/app/diagnostico" component={() => <div>Diagnóstico</div>} />
        <Route path="/app/documentos" component={() => <div>Documentos</div>} />
        <Route path="/app/documentos/:id" component={() => <div>Documento Detalhe</div>} />
        <Route path="/app/chat" component={() => <div>Chat</div>} />
        <Route path="/app/empresas" component={() => <div>Empresas</div>} />
        <Route path="/app/auditoria" component={() => <div>Auditoria</div>} />
        <Route path="/app/configuracoes" component={() => <div>Configurações</div>} />
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
