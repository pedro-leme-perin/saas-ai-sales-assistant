const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/calls/page.tsx', 'utf8');

// 1. Add analyzeMutation after endCallMutation
const oldMutation = "  const handleStartCall = () => {";
const newMutation = `  const analyzeCallMutation = useMutation({
    mutationFn: (callId: string) => callsService.analyzeCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-detail', selectedCall?.id] });
    },
  });

  const handleStartCall = () => {`;
content = content.replace(oldMutation, newMutation);

// 2. Replace "Sem sugestões registradas" section with button
const oldSuggestions = "                ) : (\r\n                  <p className=\"text-sm text-muted-foreground italic\">Sem sugestões registradas.</p>\r\n                )}";
const newSuggestions = "                ) : (\r\n                  <div className=\"flex flex-col items-center gap-3 py-2\">\r\n                    <p className=\"text-sm text-muted-foreground italic\">Sem sugestões registradas.</p>\r\n                    {callDetail?.transcript && (\r\n                      <button\r\n                        onClick={() => analyzeCallMutation.mutate(selectedCall!.id)}\r\n                        disabled={analyzeCallMutation.isPending}\r\n                        className=\"flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50\"\r\n                      >\r\n                        {analyzeCallMutation.isPending ? (\r\n                          <>\r\n                            <div className=\"animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full\" />\r\n                            Analisando...\r\n                          </>\r\n                        ) : (\r\n                          <>\r\n                            <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z\"/></svg>\r\n                            Analisar com IA\r\n                          </>\r\n                        )}\r\n                      </button>\r\n                    )}\r\n                  </div>\r\n                )}";
content = content.replace(oldSuggestions, newSuggestions);

fs.writeFileSync('src/app/dashboard/calls/page.tsx', content);
console.log('mutation:', content.includes('analyzeCallMutation'));
console.log('button:', content.includes('Analisar com IA'));
