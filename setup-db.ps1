# setup-db.ps1
# ImanaPharma - Database Setup Script
# Run this once to create the database, schema, and seed data.
# Prerequisites: PostgreSQL must be installed and psql must be in PATH.

param(
    [string]$PgUser = "postgres",
    [string]$PgHost = "localhost",
    [string]$PgPort = "5432",
    [string]$DbName = "imanapharma"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ImanaPharma - Database Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Step 1: Create the database (ignore error if it already exists)
Write-Host "`n[1/3] Creating database '$DbName'..." -ForegroundColor Yellow
$env:PGPASSWORD = Read-Host "Enter PostgreSQL password for user '$PgUser'" -AsSecureString | ForEach-Object { [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) }

psql -U $PgUser -h $PgHost -p $PgPort -c "CREATE DATABASE $DbName;" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Database may already exist — continuing..." -ForegroundColor DarkYellow
}
Write-Host "  Done." -ForegroundColor Green

# Step 2: Run schema
Write-Host "`n[2/3] Applying schema..." -ForegroundColor Yellow
psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f "$PSScriptRoot\database\schema.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Schema may already be applied — continuing..." -ForegroundColor DarkYellow
} else {
    Write-Host "  Schema applied." -ForegroundColor Green
}

# Step 3: Run seed
Write-Host "`n[3/3] Seeding initial data..." -ForegroundColor Yellow
psql -U $PgUser -h $PgHost -p $PgPort -d $DbName -f "$PSScriptRoot\database\seed.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: Seed may have partially failed." -ForegroundColor Red
} else {
    Write-Host "  Seed data inserted." -ForegroundColor Green
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "  Default login credentials:" -ForegroundColor White
Write-Host "    Manager:    admin / password123" -ForegroundColor White
Write-Host "    Pharmacist: pharmacist / password123" -ForegroundColor White
Write-Host "    Cashier:    cashier / password123" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "`nNow start the app:" -ForegroundColor Yellow
Write-Host "  Backend:  cd backend && npm run dev" -ForegroundColor White
Write-Host "  Frontend: cd frontend && npm run dev" -ForegroundColor White
