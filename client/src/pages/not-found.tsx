import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Page Not Found</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This link may be incorrect or the proposal may no longer be available.
            </p>
          </div>
          <div className="pt-2 space-y-1">
            <p className="text-sm font-medium text-foreground">McCurdy Roofing Inc.</p>
            <p className="text-xs text-muted-foreground">License #477152</p>
            <a
              href="tel:6509520233"
              className="block text-sm text-primary hover:underline font-medium"
            >
              650-952-0233
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
