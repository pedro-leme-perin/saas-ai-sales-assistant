const fs = require('fs');
let c = fs.readFileSync('src/app/dashboard/whatsapp/page.tsx', 'utf8');
c = c.replace(
  /import \{ useActiveChatStore, useAISuggestionsStore \}.*from '@\/stores';/,
  "import { useActiveChatStore, useAISuggestionsStore, useUserStore } from '@/stores';"
);
fs.writeFileSync('src/app/dashboard/whatsapp/page.tsx', c);
console.log('done:', c.includes("useUserStore } from '@/stores'"));
