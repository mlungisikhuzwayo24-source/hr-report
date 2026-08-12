namespace AttendanceInsights.Api.Models;

public sealed record AttendanceFilters(
    string? DepartmentId,
    string? EmployeeSourceId,
    int Page,
    int PageSize);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public sealed class AttendanceQuery
{
    public DateTimeOffset StartUtc { get; init; }
    public DateTimeOffset EndUtc { get; init; }
    public string? DepartmentId { get; init; }
    public string? EmployeeSourceId { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 500;
}

