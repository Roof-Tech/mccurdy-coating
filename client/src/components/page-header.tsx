import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, icon }: PageHeaderProps) {
  return (
    <div className="mb-6 animate-fade-in-up" data-testid="page-header">
      <div className="flex items-center gap-3 mb-1.5">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground tracking-tight" data-testid="text-page-title">{title}</h1>
            {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl" data-testid="text-page-subtitle">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="premium-divider mt-4" />
    </div>
  );
}
