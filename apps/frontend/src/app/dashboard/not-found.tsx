import Link from 'next/link';
import { Sparkles, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <p className="text-5xl font-bold text-primary mb-2">404</p>
          <h2 className="text-lg font-semibold mb-2">Página não encontrada</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A página que você está procurando não existe ou foi movida.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard">
              <Button className="gap-2">
                <Home className="h-4 w-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
