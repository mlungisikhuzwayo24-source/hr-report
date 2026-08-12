namespace AttendanceInsights.Api.Configuration;

public sealed class ReportingOptions
{
    public int MaximumDateRangeDays { get; init; } = 62;
    public int MaximumPageSize { get; init; } = 500;
}

