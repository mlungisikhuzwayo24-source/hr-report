namespace AttendanceInsights.Api.Models;

public sealed record EmployeeSummary(
    string EmployeeSourceId,
    string? EmployeeNumber,
    string DisplayName,
    string? FirstName,
    string? LastName,
    string? DepartmentId,
    string DepartmentName);

