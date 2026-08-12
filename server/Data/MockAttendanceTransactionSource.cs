using AttendanceInsights.Api.Models;

namespace AttendanceInsights.Api.Data;

public sealed class MockAttendanceTransactionSource : IAttendanceTransactionSource, IEmployeeRosterSource
{
    private const string InReader = "Main Door T and A Reader (IN)";
    private const string OutReader = "Main Door T and A Reader (OUT)";
    private const string BasementInReader = "Basement T and A (IN)";

    private static readonly IReadOnlyList<EmployeeSummary> Employees =
    [
        new("EMP-001", "1001", "Anele Dlamini", "Anele", "Dlamini", "FIN", "Finance"),
        new("EMP-002", "1002", "Thabo Mokoena", "Thabo", "Mokoena", "ICT", "ICT"),
        new("EMP-003", "1003", "Naledi Molefe", "Naledi", "Molefe", "PPL", "People & Culture"),
        new("EMP-004", "1004", "Rene Jacobs", "Rene", "Jacobs", "OPS", "Operations"),
        new("EMP-005", "1005", "Zanele Ndlovu", "Zanele", "Ndlovu", "FIN", "Finance"),
        new("EMP-006", "1006", "Mpho Sekgobela", "Mpho", "Sekgobela", "ICT", "ICT"),
        new("EMP-007", "1007", "Ayesha Khan", "Ayesha", "Khan", "OPS", "Operations"),
        new("EMP-008", "1008", "Sipho Mthembu", "Sipho", "Mthembu", "PPL", "People & Culture")
    ];

    private static readonly IReadOnlyList<AttendanceTransaction> Transactions = BuildTransactions();

    public Task<PagedResult<AttendanceTransaction>> GetTransactionsAsync(
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        AttendanceFilters filters,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var query = Transactions
            .Where(item => item.OccurredAtUtc >= startUtc && item.OccurredAtUtc < endUtc)
            .Where(item => filters.DepartmentId is null || item.DepartmentId == filters.DepartmentId)
            .Where(item => filters.EmployeeSourceId is null || item.EmployeeSourceId == filters.EmployeeSourceId)
            .OrderByDescending(item => item.OccurredAtUtc);

        var totalCount = query.Count();
        var items = query
            .Skip((filters.Page - 1) * filters.PageSize)
            .Take(filters.PageSize)
            .ToArray();

        return Task.FromResult(new PagedResult<AttendanceTransaction>(items, filters.Page, filters.PageSize, totalCount));
    }

    public Task<IReadOnlyList<EmployeeSummary>> GetEmployeesAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(Employees);
    }

    private static IReadOnlyList<AttendanceTransaction> BuildTransactions()
    {
        var transactions = new List<AttendanceTransaction>();
        var transactionNumber = 1;

        for (var date = new DateOnly(2026, 7, 20); date <= new DateOnly(2026, 8, 7); date = date.AddDays(1))
        {
            if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                continue;
            }

            for (var employeeIndex = 0; employeeIndex < Employees.Count; employeeIndex++)
            {
                var employee = Employees[employeeIndex];
                var key = date.DayNumber + employeeIndex * 7;

                if (key % 19 == 0 || (date == new DateOnly(2026, 8, 7) && employee.EmployeeSourceId == "EMP-004"))
                {
                    continue;
                }

                var startMinutes = 7 * 60 + 47 + Math.Abs(key % 31);
                var firstIn = Time(date, startMinutes / 60, startMinutes % 60);
                var lunchOut = Time(date, 12, 0 + Math.Abs(key % 9));
                var lunchIn = Time(date, 12, 54 + Math.Abs(key % 6));
                var finalHour = key % 5 == 0 ? 17 : key % 7 == 0 ? 15 : 16;
                var finalMinute = key % 5 == 0 ? 22 : key % 7 == 0 ? 38 : 30 + Math.Abs(key % 13);
                var finalOut = Time(date, finalHour, finalMinute);

                if (key % 4 == 0)
                {
                    firstIn = Time(date, 8, 0);
                    lunchOut = Time(date, 12, 0);
                    lunchIn = Time(date, 13, 0);
                    finalOut = Time(date, 16, 30);
                }

                if (key % 23 == 0)
                {
                    Add(employee, finalOut, OutReader, "MD-OUT");
                    continue;
                }

                Add(employee, firstIn, InReader, "MD-IN");

                if (key % 29 == 0)
                {
                    Add(employee, Time(date, 10, 41), "West Wing Visitor Reader", "WW-01");
                }

                if (key % 13 == 0)
                {
                    Add(employee, firstIn.AddMinutes(3), BasementInReader, "B1-IN");
                }

                if (key % 17 != 0)
                {
                    Add(employee, lunchOut, OutReader, "MD-OUT");
                    Add(employee, lunchIn, BasementInReader, "B1-IN");
                }

                if (key % 31 == 0)
                {
                    Add(employee, lunchIn, BasementInReader, "B1-IN");
                }

                if (key % 11 != 0)
                {
                    Add(employee, finalOut, OutReader, "MD-OUT");
                    if (key % 37 == 0)
                    {
                        Add(employee, finalOut.AddMinutes(1), OutReader, "MD-OUT");
                    }
                }
            }
        }

        return transactions;

        void Add(EmployeeSummary employee, DateTimeOffset occurredAtUtc, string readerName, string readerSourceId)
        {
            transactions.Add(new AttendanceTransaction(
                $"TX-{transactionNumber++:00000}",
                employee.EmployeeSourceId,
                employee.EmployeeNumber,
                employee.DisplayName,
                employee.FirstName,
                employee.LastName,
                employee.DepartmentId,
                employee.DepartmentName,
                occurredAtUtc,
                readerSourceId,
                readerName,
                1,
                "Access",
                readerName,
                readerName,
                "Main Access Controller",
                readerName.StartsWith("Basement", StringComparison.Ordinal) ? "Basement" : "Ground floor"));
        }
    }

    private static DateTimeOffset Time(DateOnly date, int hour, int minute)
    {
        var local = date.ToDateTime(new TimeOnly(hour, minute), DateTimeKind.Unspecified);
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Africa/Johannesburg");
        return new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
