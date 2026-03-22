const fs = require('fs');
let c = fs.readFileSync('src/app/dashboard/calls/page.tsx', 'utf8');

// Add useUserStore usage in component
c = c.replace(
  "  const { currentSuggestion, isGenerating } = useAISuggestionsStore();",
  "  const { isLoading: authLoading, user } = useUserStore();\n  const { currentSuggestion, isGenerating } = useAISuggestionsStore();"
);

// Add enabled to calls query - find the calls query
c = c.replace(
  "    queryKey: ['calls', { status: statusFilter, direction: directionFilter, search: searchQuery }],",
  "    queryKey: ['calls', { status: statusFilter, direction: directionFilter, search: searchQuery }],\n    enabled: !authLoading && !!user,"
);

// Add enabled to stats query
c = c.replace(
  "    queryKey: ['call-stats'],\n    queryFn: () => callsService.getStats(),",
  "    queryKey: ['call-stats'],\n    enabled: !authLoading && !!user,\n    queryFn: () => callsService.getStats(),"
);

fs.writeFileSync('src/app/dashboard/calls/page.tsx', c);
console.log('authLoading added:', c.includes('authLoading'));
console.log('enabled calls:', c.includes("enabled: !authLoading && !!user,\n    queryFn: () =>\n      callsService.getAll") || c.includes("enabled: !authLoading && !!user,\n    queryFn: () => callsService"));
