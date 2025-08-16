# PowerShell script for running FaVault automated tests
# Usage: .\run-tests.ps1

Write-Host "🚀 FaVault Automated Test Suite" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Function to run a command and check exit code
function Invoke-TestCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "🧪 $Description..." -ForegroundColor Yellow
    
    $result = Invoke-Expression $Command
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $Description completed successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $Description failed" -ForegroundColor Red
        return $false
    }
}

# Initialize results
$results = @{
    timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    tests = @()
    summary = @{
        total = 0
        passed = 0
        failed = 0
        success = $false
    }
}

# Test 1: Build Extension
$buildResult = Invoke-TestCommand "npm run build:chrome" "Building Extension"
$results.tests += @{
    name = "Build Extension"
    passed = $buildResult
    command = "npm run build:chrome"
}

if (-not $buildResult) {
    Write-Host "❌ Cannot proceed without successful build" -ForegroundColor Red
    exit 1
}

# Test 2: Simple Validation
$simpleResult = Invoke-TestCommand "npm run test:simple" "Simple Validation Tests"
$results.tests += @{
    name = "Simple Validation"
    passed = $simpleResult
    command = "npm run test:simple"
}

# Test 3: Try Playwright Demo (may fail if browser not available)
Write-Host "🧪 Attempting Playwright Demo..." -ForegroundColor Yellow
try {
    $playwrightResult = Invoke-TestCommand "npm run test:demo" "Playwright Demo"
    $results.tests += @{
        name = "Playwright Demo"
        passed = $playwrightResult
        command = "npm run test:demo"
    }
} catch {
    Write-Host "⚠️ Playwright demo skipped (browser automation may not be available)" -ForegroundColor Yellow
    $results.tests += @{
        name = "Playwright Demo"
        passed = $false
        command = "npm run test:demo"
        error = "Browser automation not available"
    }
}

# Calculate summary
$results.summary.total = $results.tests.Count
$results.summary.passed = ($results.tests | Where-Object { $_.passed }).Count
$results.summary.failed = $results.summary.total - $results.summary.passed
$results.summary.success = $results.summary.failed -eq 0

# Display results
Write-Host ""
Write-Host "📊 Test Results Summary:" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

if ($results.summary.success) {
    Write-Host "Status: ✅ PASSED" -ForegroundColor Green
} else {
    Write-Host "Status: ❌ FAILED" -ForegroundColor Red
}

Write-Host "Tests: $($results.summary.passed)/$($results.summary.total) passed"

if ($results.summary.failed -gt 0) {
    Write-Host ""
    Write-Host "❌ Failed Tests:" -ForegroundColor Red
    $results.tests | Where-Object { -not $_.passed } | ForEach-Object {
        Write-Host "  - $($_.name)" -ForegroundColor Red
    }
}

# Save results to JSON
$resultsJson = $results | ConvertTo-Json -Depth 3
$resultsPath = "test-results\powershell-test-results.json"

# Ensure directory exists
if (-not (Test-Path "test-results")) {
    New-Item -ItemType Directory -Path "test-results" | Out-Null
}

$resultsJson | Out-File -FilePath $resultsPath -Encoding UTF8

Write-Host ""
Write-Host "📄 Results saved: $(Resolve-Path $resultsPath)" -ForegroundColor Cyan

# Display structured results
Write-Host ""
Write-Host "📋 Structured Test Results:" -ForegroundColor Cyan
$summary = @{
    success = $results.summary.success
    passed = $results.summary.passed
    total = $results.summary.total
    timestamp = $results.timestamp
}
$summary | ConvertTo-Json | Write-Host

# Exit with appropriate code
if ($results.summary.success) {
    exit 0
} else {
    exit 1
}
