namespace AttendanceInsights.Api.Models;

public sealed record AttendanceTransaction(
    string TransactionId,
    string EmployeeSourceId,
    string? EmployeeNumber,
    string DisplayName,
    string? FirstName,
    string? LastName,
    string? DepartmentId,
    string DepartmentName,
    DateTimeOffset OccurredAtUtc,
    string? ReaderSourceId,
    string ReaderName,
    int TransactionTypeId,
    string? TransactionTypeName,
    string? DeviceName,
    string? TerminalName,
    string? ControllerName,
    string? LocationName);

