const fs = require('fs');
let content = fs.readFileSync('src/services/api.ts', 'utf8');

const old = "  async delete(id: string): Promise<void> {\r\n    const companyId = apiClient.getCompanyId();\r\n    return apiClient.delete(`/calls/${companyId}/${id}`);\r\n  },";

const newContent = "  async analyzeCall(id: string): Promise<Call> {\r\n    const companyId = apiClient.getCompanyId();\r\n    return apiClient.post(`/calls/${companyId}/${id}/analyze`);\r\n  },\r\n  async delete(id: string): Promise<void> {\r\n    const companyId = apiClient.getCompanyId();\r\n    return apiClient.delete(`/calls/${companyId}/${id}`);\r\n  },";

content = content.replace(old, newContent);
fs.writeFileSync('src/services/api.ts', content);
console.log('done:', content.includes('analyzeCall'));
