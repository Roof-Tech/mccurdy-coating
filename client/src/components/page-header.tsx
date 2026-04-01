import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export function PageHeader({ title, subtitle, badge, icon, accentColor }: PageHeaderProps) {
  return (
    <div className="mb-8 animate-fade-in-up" data-testid="page-header">
      <div className="flex items-center gap-3.5 mb-2">
        {icon && (
          <div className={`w-11 h-11 rounded-xl ${accentColor ? accentColor : 'bg-accent/10'} flex items-center justify-center text-accent flex-shrink-0 shadow-sm`}>
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">{title}</h1>
            {badge && <Badge variant="secondary" className="text-[10px] font-semibold">{badge}</Badge>}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl leading-relaxed" data-testid="text-page-subtitle">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="premium-divider mt-5" />
    </div>
  );
}
