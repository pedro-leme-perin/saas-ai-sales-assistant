'use client';

export function WhatsAppChatsList({ chats }) {
  if (!chats || chats.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 text-lg font-semibold">Conversas WhatsApp</div>
        <div className="text-center text-sm text-gray-500">
          Nenhuma conversa recente
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 text-lg font-semibold">Conversas WhatsApp</div>
      <div className="space-y-3">
        {chats.map((chat) => (
          <div key={chat.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{chat.customerName}</div>
                <div className="text-sm text-gray-500">{chat.customerPhone}</div>
              </div>
              {chat.unreadCount > 0 && (
                <span className="rounded-full bg-blue-500 px-2 py-1 text-xs text-white">
                  {chat.unreadCount}
                </span>
              )}
            </div>
            <div className="mt-2 text-sm text-gray-600">{chat.lastMessage}</div>
            <div className="mt-2">
              <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                {chat.status === 'ACTIVE' ? 'Ativo' : chat.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}