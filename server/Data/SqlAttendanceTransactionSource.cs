using System.Globalization;
using System.Text.RegularExpressions;
using AttendanceInsights.Api.Configuration;
using AttendanceInsights.Api.Models;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;

namespace AttendanceInsights.Api.Data;

public sealed partial class SqlAttendanceTransactionSource : IAttendanceTransactionSource, IEmployeeRosterSource
{
    private static readonly IReadOnlySet<string> AllowedSourceAliases = new HashSet<string>(StringComparer.Ordinal)
    {
        "TR", "ReaderHostMaster", "Terminal", "Controller", "Location"
    };

    private readonly string _connectionString;
    private readonly SqlFieldMappings _mappings;

    public SqlAttendanceTransactionSource(IConfiguration configuration, IOptions<SqlFieldMappings> mappings)
    {
        var configured = configuration.GetConnectionString("PortalDatabase")
            ?? throw new InvalidOperationException(
                "SQL mode requires ConnectionStrings__PortalDatabase in the environment or user secrets.");

        var builder = new SqlConnectionStringBuilder(configured);
        if (!string.Equals(builder.InitialCatalog, "Portal", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The SQL reporting connection must target the Portal database.");
        }

        builder.ApplicationIntent = ApplicationIntent.ReadOnly;
        _connectionString = builder.ConnectionString;
        _mappings = mappings.Value;
    }

    public async Task<PagedResult<AttendanceTransaction>> GetTransactionsAsync(
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        AttendanceFilters filters,
        CancellationToken cancellationToken)
    {
        EnsureRequiredMappings();
        var query = BuildTransactionQuery();
        var parameters = new
        {
            StartUtc = FormatUtc(startUtc),
            EndUtc = FormatUtc(endUtc),
            filters.EmployeeSourceId,
            filters.DepartmentId,
            Offset = (filters.Page - 1) * filters.PageSize,
            filters.PageSize,
            _mappings.AttendanceTerminalIds
        };

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        using var results = await connection.QueryMultipleAsync(new CommandDefinition(
            query,
            parameters,
            cancellationToken: cancellationToken,
            commandTimeout: 60));

        var totalCountValue = await results.ReadSingleAsync<long>();
        var totalCount = checked((int)totalCountValue);
        var rows = (await results.ReadAsync<SqlAttendanceTransactionRow>()).ToArray();
        var items = rows.Select(row => row.ToCanonical()).ToArray();
        return new PagedResult<AttendanceTransaction>(items, filters.Page, filters.PageSize, totalCount);
    }

    public async Task<IReadOnlyList<EmployeeSummary>> GetEmployeesAsync(CancellationToken cancellationToken)
    {
        EnsureRequiredMappings();
        var displayName = Column("EmployeeMaster", _mappings.DisplayNameColumn!);
        var employeeNumber = OptionalColumn("EmployeeMaster", _mappings.EmployeeNumberColumn, "nvarchar(256)");
        var firstName = OptionalColumn("EmployeeMaster", _mappings.FirstNameColumn, "nvarchar(256)");
        var lastName = OptionalColumn("EmployeeMaster", _mappings.LastNameColumn, "nvarchar(256)");
        var departmentName = Column("EmployeeDepartment", _mappings.DepartmentNameColumn!);

        var sql = $"""
            SELECT
                CONVERT(nvarchar(128), EmployeeMaster.MASTER_ID) AS EmployeeSourceId,
                {employeeNumber} AS EmployeeNumber,
                {displayName} AS DisplayName,
                {firstName} AS FirstName,
                {lastName} AS LastName,
                CONVERT(nvarchar(128), EmployeeMaster.DEPARTMENT_ID) AS DepartmentId,
                {departmentName} AS DepartmentName
            FROM dbo.MASTER AS EmployeeMaster
            INNER JOIN (
                SELECT RosterTransaction.TR_MASTER_ID
                FROM dbo.TRANSACK AS RosterTransaction
                WHERE RosterTransaction.TR_TERMINAL_ID IN @AttendanceTerminalIds
                GROUP BY RosterTransaction.TR_MASTER_ID
            ) AS AttendanceEmployee
                ON AttendanceEmployee.TR_MASTER_ID = EmployeeMaster.MASTER_ID
            LEFT JOIN dbo.DEPARTMENT AS EmployeeDepartment
                ON EmployeeMaster.DEPARTMENT_ID = EmployeeDepartment.DEPARTMENT_ID
            WHERE {displayName} IS NOT NULL
              AND {departmentName} IS NOT NULL
            ORDER BY {displayName};
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        var employees = await connection.QueryAsync<EmployeeSummary>(new CommandDefinition(
            sql,
            new { _mappings.AttendanceTerminalIds },
            cancellationToken: cancellationToken,
            commandTimeout: 60));
        return employees.ToArray();
    }

    private string BuildTransactionQuery()
    {
        var displayName = Column("EmployeeMaster", _mappings.DisplayNameColumn!);
        var employeeNumber = OptionalColumn("EmployeeMaster", _mappings.EmployeeNumberColumn, "nvarchar(256)");
        var firstName = OptionalColumn("EmployeeMaster", _mappings.FirstNameColumn, "nvarchar(256)");
        var lastName = OptionalColumn("EmployeeMaster", _mappings.LastNameColumn, "nvarchar(256)");
        var departmentName = Column("TransactionDepartment", _mappings.DepartmentNameColumn!);
        var transactionTypeName = OptionalColumn("TransactionType", _mappings.TransactionTypeNameColumn, "nvarchar(256)");
        var readerName = SourceColumn(_mappings.ReaderNameSource!, _mappings.ReaderNameColumn!);
        var deviceName = OptionalSourceColumn(_mappings.DeviceNameSource, _mappings.DeviceNameColumn, "nvarchar(256)");
        var terminalName = OptionalSourceColumn(_mappings.TerminalNameSource, _mappings.TerminalNameColumn, "nvarchar(256)");
        var controllerName = OptionalSourceColumn(_mappings.ControllerNameSource, _mappings.ControllerNameColumn, "nvarchar(256)");
        var locationName = OptionalSourceColumn(_mappings.LocationNameSource, _mappings.LocationNameColumn, "nvarchar(256)");
        var optionalJoins = BuildOptionalJoins();

        return $"""
            SELECT COUNT_BIG(1)
            FROM dbo.TRANSACK AS TR
            WHERE TR.TR_DATETIMEUTC >= @StartUtc
              AND TR.TR_DATETIMEUTC < @EndUtc
              AND TR.TR_TERMINAL_ID IN @AttendanceTerminalIds
              AND (@EmployeeSourceId IS NULL OR CONVERT(nvarchar(128), TR.TR_MASTER_ID) = @EmployeeSourceId)
              AND (@DepartmentId IS NULL OR CONVERT(nvarchar(128), TR.TR_DEPARTMENT_ID) = @DepartmentId);

            SELECT
                CONVERT(nvarchar(128), TR.TRANSACK_ID) AS TransactionId,
                CONVERT(nvarchar(128), TR.TR_MASTER_ID) AS EmployeeSourceId,
                {employeeNumber} AS EmployeeNumber,
                {displayName} AS DisplayName,
                {firstName} AS FirstName,
                {lastName} AS LastName,
                CONVERT(nvarchar(128), TR.TR_DEPARTMENT_ID) AS DepartmentId,
                {departmentName} AS DepartmentName,
                TR.TR_DATETIMEUTC AS OccurredAtUtc,
                CONVERT(nvarchar(128), TR.TR_HOSTID) AS ReaderSourceId,
                {readerName} AS ReaderName,
                TR.TRANSACK_TYPE_ID AS TransactionTypeId,
                {transactionTypeName} AS TransactionTypeName,
                {deviceName} AS DeviceName,
                {terminalName} AS TerminalName,
                {controllerName} AS ControllerName,
                {locationName} AS LocationName
            FROM dbo.TRANSACK AS TR
            INNER JOIN dbo.MASTER AS EmployeeMaster
                ON TR.TR_MASTER_ID = EmployeeMaster.MASTER_ID
            LEFT JOIN dbo.DEPARTMENT AS TransactionDepartment
                ON TR.TR_DEPARTMENT_ID = TransactionDepartment.DEPARTMENT_ID
            {optionalJoins}
            WHERE TR.TR_DATETIMEUTC >= @StartUtc
              AND TR.TR_DATETIMEUTC < @EndUtc
              AND TR.TR_TERMINAL_ID IN @AttendanceTerminalIds
              AND (@EmployeeSourceId IS NULL OR CONVERT(nvarchar(128), TR.TR_MASTER_ID) = @EmployeeSourceId)
              AND (@DepartmentId IS NULL OR CONVERT(nvarchar(128), TR.TR_DEPARTMENT_ID) = @DepartmentId)
            ORDER BY TR.TR_DATETIMEUTC DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            """;
    }

    private string BuildOptionalJoins()
    {
        var aliases = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(_mappings.ReaderNameSource)) aliases.Add(_mappings.ReaderNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.DeviceNameSource) && !string.IsNullOrWhiteSpace(_mappings.DeviceNameColumn)) aliases.Add(_mappings.DeviceNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.TransactionTypeNameColumn)) aliases.Add("TransactionType");
        if (!string.IsNullOrWhiteSpace(_mappings.TerminalNameSource) && !string.IsNullOrWhiteSpace(_mappings.TerminalNameColumn)) aliases.Add(_mappings.TerminalNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.ControllerNameSource) && !string.IsNullOrWhiteSpace(_mappings.ControllerNameColumn)) aliases.Add(_mappings.ControllerNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.LocationNameSource) && !string.IsNullOrWhiteSpace(_mappings.LocationNameColumn)) aliases.Add(_mappings.LocationNameSource);

        var joins = new List<string>();
        if (aliases.Contains("ReaderHostMaster"))
        {
            joins.Add("LEFT JOIN dbo.MASTER AS ReaderHostMaster ON TR.TR_HOSTID = ReaderHostMaster.MASTER_ID");
        }
        if (aliases.Contains("TransactionType"))
        {
            joins.Add("LEFT JOIN dbo.TRANSACK_TYPE AS TransactionType ON TR.TRANSACK_TYPE_ID = TransactionType.TRANSACK_TYPE_ID");
        }
        if (aliases.Contains("Terminal"))
        {
            joins.Add("LEFT JOIN dbo.TERMINAL AS Terminal ON TR.TR_TERMINAL_ID = Terminal.TERMINAL_ID");
        }
        if (aliases.Contains("Controller"))
        {
            joins.Add("LEFT JOIN dbo.CONTROLLER AS Controller ON TR.TR_CONTROLLER_ID = Controller.CONTROLLER_ID");
        }
        if (aliases.Contains("Location"))
        {
            joins.Add("LEFT JOIN dbo.LOCATION AS Location ON TR.TR_LOCATION_ID = Location.LOCATION_ID");
        }
        return string.Join(Environment.NewLine, joins);
    }

    private void EnsureRequiredMappings()
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(_mappings.DisplayNameColumn)) missing.Add(nameof(_mappings.DisplayNameColumn));
        if (string.IsNullOrWhiteSpace(_mappings.DepartmentNameColumn)) missing.Add(nameof(_mappings.DepartmentNameColumn));
        if (string.IsNullOrWhiteSpace(_mappings.ReaderNameSource)) missing.Add(nameof(_mappings.ReaderNameSource));
        if (string.IsNullOrWhiteSpace(_mappings.ReaderNameColumn)) missing.Add(nameof(_mappings.ReaderNameColumn));
        if (_mappings.AttendanceTerminalIds.Length == 0) missing.Add(nameof(_mappings.AttendanceTerminalIds));

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"SQL descriptive-column mappings are incomplete: {string.Join(", ", missing)}. See docs/database-field-mapping.md.");
        }

        ValidateSource(_mappings.ReaderNameSource!);
        if (!string.IsNullOrWhiteSpace(_mappings.DeviceNameSource)) ValidateSource(_mappings.DeviceNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.TerminalNameSource)) ValidateSource(_mappings.TerminalNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.ControllerNameSource)) ValidateSource(_mappings.ControllerNameSource);
        if (!string.IsNullOrWhiteSpace(_mappings.LocationNameSource)) ValidateSource(_mappings.LocationNameSource);
    }

    private static string SourceColumn(string source, string column)
    {
        ValidateSource(source);
        return Column(source, column);
    }

    private static string OptionalSourceColumn(string? source, string? column, string sqlType)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(column))
        {
            return $"CAST(NULL AS {sqlType})";
        }

        return SourceColumn(source, column);
    }

    private static string OptionalColumn(string alias, string? column, string sqlType) =>
        string.IsNullOrWhiteSpace(column) ? $"CAST(NULL AS {sqlType})" : Column(alias, column);

    private static string Column(string alias, string column)
    {
        if (!IdentifierPattern().IsMatch(column))
        {
            throw new InvalidOperationException($"Invalid configured SQL identifier for {alias}.");
        }

        return $"[{alias}].[{column}]";
    }

    private static void ValidateSource(string source)
    {
        if (!AllowedSourceAliases.Contains(source))
        {
            throw new InvalidOperationException(
                $"Reader/device source alias must be one of: {string.Join(", ", AllowedSourceAliases)}.");
        }
    }

    private static string FormatUtc(DateTimeOffset value) =>
        value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture);

    [GeneratedRegex("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant)]
    private static partial Regex IdentifierPattern();

    private sealed class SqlAttendanceTransactionRow
    {
        public required string TransactionId { get; init; }
        public required string EmployeeSourceId { get; init; }
        public string? EmployeeNumber { get; init; }
        public required string DisplayName { get; init; }
        public string? FirstName { get; init; }
        public string? LastName { get; init; }
        public string? DepartmentId { get; init; }
        public required string DepartmentName { get; init; }
        public required string OccurredAtUtc { get; init; }
        public string? ReaderSourceId { get; init; }
        public required string ReaderName { get; init; }
        public int TransactionTypeId { get; init; }
        public string? TransactionTypeName { get; init; }
        public string? DeviceName { get; init; }
        public string? TerminalName { get; init; }
        public string? ControllerName { get; init; }
        public string? LocationName { get; init; }

        public AttendanceTransaction ToCanonical() => new(
            TransactionId,
            EmployeeSourceId,
            EmployeeNumber,
            DisplayName,
            FirstName,
            LastName,
            DepartmentId,
            DepartmentName,
            DateTimeOffset.ParseExact(
                OccurredAtUtc,
                "yyyy-MM-dd'T'HH:mm:ss.fff",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal),
            ReaderSourceId,
            ReaderName,
            TransactionTypeId,
            TransactionTypeName,
            DeviceName,
            TerminalName,
            ControllerName,
            LocationName);
    }
}
