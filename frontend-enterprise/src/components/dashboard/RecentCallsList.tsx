'use client';

export function RecentCallsList({ calls }: { calls: any[] }) {
  if (!calls || calls.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 text-lg font-semibold">Chamadas Recentes</div>
        <div className="text-center text-sm text-gray-500">
          Nenhuma chamada recente
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 text-lg font-semibold">Chamadas Recentes</div>
      <div className="space-y-3">
        {calls.map((call) => (
          <div key={call.id} className="rounded-lg border p-3">
            <div className="font-medium">{call.phoneNumber}</div>
            <div className="mt-1 text-sm text-gray-500">
              {call.direction === 'INBOUND' ? 'Recebida' : 'Realizada'}
            </div>
            <div className="mt-2">
              <span className={`inline-block rounded px-2 py-1 text-xs ${
                call.status === 'COMPLETED' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {call.status === 'COMPLETED' ? 'Concluída' : call.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}