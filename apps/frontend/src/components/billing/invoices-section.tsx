'use client';

import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatCurrency } from '@/lib/utils';

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pago', color: 'text-green-700 bg-green-100' },
  PAID: { label: 'Pago', color: 'text-green-700 bg-green-100' },
  open: { label: 'Pendente', color: 'text-yellow-700 bg-yellow-100' },
  void: { label: 'Cancelado', color: 'text-muted-foreground bg-muted' },
  uncollectible: { label: 'Incobrável', color: 'text-red-700 bg-red-100' },
};

interface InvoicesSectionProps {
  invoices: Array<{
    id: string;
    createdAt: string;
    amount?: number;
    status: string;
    pdfUrl?: string | null;
  }>;
}

export default function InvoicesSection({ invoices }: InvoicesSectionProps) {
  const memoizedInvoices = useMemo(() => invoices, [invoices]);

  if (memoizedInvoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma fatura encontrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Data
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Valor
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {memoizedInvoices.map((inv) => {
                const st =
                  INVOICE_STATUS[inv.status] || {
                    label: inv.status,
                    color: 'text-muted-foreground bg-muted',
                  };
                return (
                  <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatCurrency((inv.amount || 0) / 100)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          <FileText className="w-3.5 h-3.5" /> Baixar
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
