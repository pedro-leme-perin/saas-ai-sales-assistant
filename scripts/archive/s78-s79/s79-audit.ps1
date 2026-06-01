# S79-PostCNPJ security audit - enumerate HIGH vulns
$ErrorActionPreference = "Continue"
$repoPath = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repoPath

Write-Host "=== pnpm audit --prod --audit-level=high --json ==="
& pnpm audit --prod --audit-level=high --json > "scripts\s79-audit.json" 2>&1
Write-Host "exit: $LASTEXITCODE"

Write-Host "=== summary ==="
$json = Get-Content "scripts\s79-audit.json" -Raw | ConvertFrom-Json
Write-Host "Total advisories: $($json.metadata.vulnerabilities.high + $json.metadata.vulnerabilities.critical)"
Write-Host ($json.metadata.vulnerabilities | ConvertTo-Json)

if ($json.advisories) {
    $json.advisories.PSObject.Properties | ForEach-Object {
        $adv = $_.Value
        Write-Host "ADV id=$($adv.github_advisory_id) sev=$($adv.severity) module=$($adv.module_name) vuln=$($adv.vulnerable_versions) patched=$($adv.patched_versions)"
        Write-Host "  paths:"
        $adv.findings | ForEach-Object {
            Write-Host "    $($_.version) via $($_.paths -join ', ')"
        }
    }
}
