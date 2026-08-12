# Attendance Insights

Attendance Insights is a working HR attendance reporting demo for Impro Access Portal transactions. It uses exact Reader Name mappings to classify clockings, pairs daily IN/OUT sessions, calculates attendance hours and breaks, and presents management, employee, department, transaction, and exception reports.

Mock mode is enabled in committed configuration. This workstation can override it through ignored `server/appsettings.Local.json`; no SQL Server is required when that local file is absent, and the application performs no database writes.

## Included reports

- Management dashboard with eight KPIs and four filter-aware charts
- Daily attendance report
- Employee period/monthly summary
- Department summary
- Employee detail with daily results, raw timeline, paired sessions, breaks, and unmatched transactions
- Paginated raw transaction report
- Exception report
- CSV export and print layouts with `Africa/Johannesburg` shown as the reporting timezone

The report field set follows `Transaction Rpt (1).pdf`: Date/Time, Display Name, Reader Name, Transaction Type, Device, First Name, Last Name, Department, and ID Number. Complete ID numbers are deliberately not included in the browser model.

## Technology

- React, TypeScript, Vite, Tailwind CSS, Recharts, and Lucide React
- ASP.NET Core Web API, dependency injection, Dapper, and `Microsoft.Data.SqlClient`
- Vitest for attendance rule tests

## Quick start

Prerequisites:

- Node.js LTS and npm
- .NET 9 SDK

For the development experience, use two PowerShell terminals from the repository root.

Terminal 1:

```powershell
$env:DOTNET_CLI_HOME="$PWD\.dotnet-home"
$env:NUGET_PACKAGES="$PWD\.nuget\packages"
$env:APPDATA="$PWD\.appdata"
dotnet restore .\server\AttendanceInsights.Api.csproj --configfile .\NuGet.Config
dotnet run --project .\server\AttendanceInsights.Api.csproj --urls http://127.0.0.1:5080
```

Terminal 2:

```powershell
Set-Location .\client
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

To test and assemble a production-style single-server demo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-demo.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
```

Open `http://127.0.0.1:5080`.

## Demo presentation

1. Start on the management dashboard with the default 27 July to 7 August 2026 range.
2. Change department, employee, status, and exception filters; every view updates from the same report dataset.
3. Open Daily attendance to show first IN, final OUT, breaks, net hours, variance, status, and exceptions.
4. Open Employee detail and switch between Daily attendance, Transaction timeline, and Sessions & breaks.
5. Open Raw transactions to show Reader Name and direction classification, including unknown readers.
6. Export a report to CSV or use Print to show the reporting timezone in the output.

## Attendance rules

- Timezone: `Africa/Johannesburg`
- Workdays: Monday to Friday
- Scheduled start: 08:00
- Scheduled end: 16:30
- Counted work time is limited to the 08:00-16:30 schedule
- Lunch is one hour and must fall within the 12:00-14:00 window
- A one-hour lunch is deducted for a full scheduled day even when no lunch clockings exist
- Late grace period: 10 minutes
- Required net hours: 7 hours 30 minutes
- Time outside the schedule is excluded and does not create an overtime status or exception
- Reader direction comes only from the explicit map in `client/src/domain/readerMappings.ts`
- Missing clockings never receive assumed timestamps

Source date selection is converted to UTC before the API call. Queries use an inclusive start and exclusive end, never `BETWEEN`. The API rejects ranges longer than 62 days and caps raw transaction pages at 500 rows.

## SQL Server mode

The SQL provider is dormant until all of the following are true:

1. `AttendanceDataSource` is set to `SqlServer` outside committed source.
2. `ConnectionStrings__PortalDatabase` is supplied through an environment variable or user secrets.
3. Required descriptive mappings are confirmed and supplied in local configuration.

Example environment variable names, with intentionally blank values:

```text
AttendanceDataSource=SqlServer
ConnectionStrings__PortalDatabase=
SqlFieldMappings__DisplayNameColumn=
SqlFieldMappings__DepartmentNameColumn=
SqlFieldMappings__ReaderNameSource=
SqlFieldMappings__ReaderNameColumn=
```

`ReaderNameSource` must be a confirmed alias such as `TR`, `ReaderHostMaster`, `Terminal`, `Controller`, or `Location`. Optional fields use the other `SqlFieldMappings` keys in `server/appsettings.json`. Do not populate them until a redacted sample result confirms the actual columns.

The local Portal inspection confirmed `TR.TR_DEV_NAME` as both Reader Name and Device, terminal IDs `79`, `80`, and `95` as the T&A reporting scope, and fixed-width ISO text in `TR.TR_DATETIMEUTC`. These values are stored only in ignored local configuration. The API pages through that terminal-scoped result set; the client retrieves all server pages needed for attendance calculations.

The provider:

- Rejects connections whose database is not `Portal`
- Adds `ApplicationIntent=ReadOnly`
- Uses only confirmed joins and adds optional device/location joins only when mapped fields require them
- Validates configured SQL identifiers
- Parameterises UTC dates, employee/department filters, offset, and page size
- Has no insert, update, delete, DDL, migration, or database-object creation code

The SQL login should have `SELECT` permission only. Never commit the connection string or place it in `appsettings.json`; local settings, `.env` files, secrets, and user-specific configuration are ignored by Git.

The currently detected Windows identity has broader Portal permissions and is suitable only for a temporary local demonstration. Replace the integrated-security connection with a dedicated SELECT-only login before operational use. The provider itself contains only SELECT statements and cannot create or modify database objects.

See [docs/database-field-mapping.md](docs/database-field-mapping.md) for confirmed relationships and every pending descriptive field.

## Project layout

```text
client/                         React reporting application and rule engine
server/                         ASP.NET Core API and data providers
docs/database-field-mapping.md  Confirmed and pending Portal mappings
scripts/build-demo.ps1          Tests and assembles the production demo
scripts/start-demo.ps1          Starts the assembled demo on port 5080
```
