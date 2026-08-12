using AttendanceInsights.Api.Models;

namespace AttendanceInsights.Api.Data;

public interface IAttendanceTransactionSource
{
    Task<PagedResult<AttendanceTransaction>> GetTransactionsAsync(
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        AttendanceFilters filters,
        CancellationToken cancellationToken);
}

public interface IEmployeeRosterSource
{
    Task<IReadOnlyList<EmployeeSummary>> GetEmployeesAsync(CancellationToken cancellationToken);
}

