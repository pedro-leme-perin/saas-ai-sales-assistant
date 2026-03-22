const fs = require('fs');

// Fix calls page
let calls = fs.readFileSync('src/app/dashboard/calls/page.tsx', 'utf8');
calls = calls.replace(
  "  const { activeCallId, isInCall, callDuration, transcript, setActiveCall, endCall } =\n    useActiveCallStore();",
  "  const { isLoading: authLoading, user } = useUserStore();\n  const { activeCallId, isInCall, callDuration, transcript, setActiveCall, endCall } =\n    useActiveCallStore();"
);
calls = calls.replace(
  "import { useActiveCallStore, useAISuggestionsStore } from '@/stores';",
  "import { useActiveCallStore, useAISuggestionsStore, useUserStore } from '@/stores';"
);
// Add enabled to calls query
calls = calls.replace(
  "    queryFn: () =>\n      callsService.getAll({",
  "    enabled: !authLoading && !!user,\n    queryFn: () =>\n      callsService.getAll({"
);
// Add enabled to stats query
calls = calls.replace(
  "    queryKey: ['call-stats'],\n    queryFn: () => callsService.getStats(),",
  "    queryKey: ['call-stats'],\n    enabled: !authLoading && !!user,\n    queryFn: () => callsService.getStats(),"
);
fs.writeFileSync('src/app/dashboard/calls/page.tsx', calls);
console.log('calls fixed:', calls.includes('authLoading'));

// Fix whatsapp page
let wa = fs.readFileSync('src/app/dashboard/whatsapp/page.tsx', 'utf8');
if (!wa.includes('useUserStore')) {
  wa = wa.replace(
    "from '@/stores'",
    ", useUserStore } from '@/stores'"
  ).replace(
    "from '@/stores';",
    ", useUserStore } from '@/stores';"
  );
  // Add useUserStore usage after first useState or store usage
  wa = wa.replace(
    "export default function WhatsAppPage() {\n",
    "export default function WhatsAppPage() {\n  const { isLoading: authLoading, user } = useUserStore();\n"
  );
  // Add enabled to chats query
  wa = wa.replace(
    "    queryKey: ['whatsapp-chats'],\n    queryFn: () => whatsappService.getChats(),",
    "    queryKey: ['whatsapp-chats'],\n    enabled: !authLoading && !!user,\n    queryFn: () => whatsappService.getChats(),"
  );
  fs.writeFileSync('src/app/dashboard/whatsapp/page.tsx', wa);
  console.log('whatsapp fixed:', wa.includes('authLoading'));
} else {
  console.log('whatsapp already has useUserStore');
}
