const fs = require('fs');
let c = fs.readFileSync('src/app/dashboard/calls/page.tsx', 'utf8');

// Add state for phone input
c = c.replace(
  "  const [selectedCall, setSelectedCall] = useState<Call | null>(null);",
  "  const [selectedCall, setSelectedCall] = useState<Call | null>(null);\n  const [newCallPhone, setNewCallPhone] = useState('');\n  const [showNewCallModal, setShowNewCallModal] = useState(false);"
);

// Replace handleStartCall
c = c.replace(
  `  const handleStartCall = () => {
    const phoneNumber = prompt('Digite o número de telefone:');
    if (phoneNumber) {
      startCallMutation.mutate(phoneNumber);
    }
  };`,
  `  const handleStartCall = () => {
    setShowNewCallModal(true);
  };
  const handleConfirmCall = () => {
    if (newCallPhone.trim()) {
      startCallMutation.mutate(newCallPhone.trim());
      setShowNewCallModal(false);
      setNewCallPhone('');
    }
  };`
);

// Add modal before closing </div> of the page
const modalHtml = `
      {/* New Call Modal */}
      {showNewCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewCallModal(false)}>
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md m-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Nova Ligação</h2>
            <input
              type="tel"
              placeholder="+55 11 99999-9999"
              className="w-full px-4 py-2 border rounded-lg bg-background mb-4"
              value={newCallPhone}
              onChange={(e) => setNewCallPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmCall()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewCallModal(false)}>Cancelar</Button>
              <Button onClick={handleConfirmCall} disabled={!newCallPhone.trim() || startCallMutation.isPending}>
                {startCallMutation.isPending ? 'Iniciando...' : 'Ligar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

c = c.replace(
  `    </div>
  );
}`,
  modalHtml
);

fs.writeFileSync('src/app/dashboard/calls/page.tsx', c);
console.log('modal added:', c.includes('showNewCallModal'));
console.log('handleConfirmCall:', c.includes('handleConfirmCall'));
