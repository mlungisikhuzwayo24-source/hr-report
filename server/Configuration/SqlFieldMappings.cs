namespace AttendanceInsights.Api.Configuration;

public sealed class SqlFieldMappings
{
    public string? EmployeeNumberColumn { get; init; }
    public string? DisplayNameColumn { get; init; }
    public string? FirstNameColumn { get; init; }
    public string? LastNameColumn { get; init; }
    public string? DepartmentNameColumn { get; init; }
    public string? TransactionTypeNameColumn { get; init; }
    public string? ReaderNameSource { get; init; }
    public string? ReaderNameColumn { get; init; }
    public string? DeviceNameSource { get; init; }
    public string? DeviceNameColumn { get; init; }
    public string? TerminalNameSource { get; init; }
    public string? TerminalNameColumn { get; init; }
    public string? ControllerNameSource { get; init; }
    public string? ControllerNameColumn { get; init; }
    public string? LocationNameSource { get; init; }
    public string? LocationNameColumn { get; init; }
    public int[] AttendanceTerminalIds { get; init; } = [];
}
