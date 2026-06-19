import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  MessageSquare, 
  Building2, 
  History, 
  Settings, 
  LogOut,
  Menu,
  ShieldCheck,
  BookOpen
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navigation = [
  { name: "Visão Geral", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Escolher Normas", href: "/app/normas", icon: CheckSquare },
  { name: "Diagnóstico AI", href: "/app/diagnostico", icon: ShieldCheck },
  { name: "Meus Documentos", href: "/app/documentos", icon: FileText },
  { name: "Consultor IA", href: "/app/chat", icon: MessageSquare },
  { name: "Minha Empresa", href: "/app/empresas", icon: Building2 },
  { name: "Histórico", href: "/app/auditoria", icon: History },
  { name: "Configurações", href: "/app/configuracoes", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <div className="space-y-1">
      {navigation.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.name} href={item.href} onClick={onClick}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 border-r border-border bg-card">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">ISO Gestão IA</span>
        </div>

        <div className="flex-1 px-4 py-2 overflow-y-auto">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'User'}`} />
              <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg text-foreground">ISO Gestão IA</span>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <div className="p-6 border-b border-border">
              <span className="font-bold text-xl text-foreground">Menu</span>
            </div>
            <div className="flex-1 px-4 py-4 overflow-y-auto">
              <NavLinks onClick={() => setMobileMenuOpen(false)} />
            </div>
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
