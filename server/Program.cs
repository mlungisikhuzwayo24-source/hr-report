using AttendanceInsights.Api.Configuration;
using AttendanceInsights.Api.Data;
using AttendanceInsights.Api.Models;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false)
    .AddEnvironmentVariables();

builder.Services.AddProblemDetails();
builder.Services.Configure<ReportingOptions>(builder.Configuration.GetSection("Reporting"));
builder.Services.Configure<SqlFieldMappings>(builder.Configuration.GetSection("SqlFieldMappings"));
builder.Services.AddSingleton<MockAttendanceTransactionSource>();
builder.Services.AddScoped<SqlAttendanceTransactionSource>();

var configuredSource = builder.Configuration["AttendanceDataSource"] ?? "Mock";
var useSqlServer = string.Equals(configuredSource, "SqlServer", StringComparison.OrdinalIgnoreCase);

builder.Services.AddScoped<IAttendanceTransactionSource>(services => useSqlServer
    ? services.GetRequiredService<SqlAttendanceTransactionSource>()
    : services.GetRequiredService<MockAttendanceTransactionSource>());
builder.Services.AddScoped<IEmployeeRosterSource>(services => useSqlServer
    ? services.GetRequiredService<SqlAttendanceTransactionSource>()
    : services.GetRequiredService<MockAttendanceTransactionSource>());

builder.Services.AddCors(options => options.AddPolicy("DevelopmentClient", policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler(errorApplication => errorApplication.Run(async context =>
{
    var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("AttendanceInsights.Api.Errors");
    logger.LogError(exception, "Unhandled error while processing {RequestPath}", context.Request.Path);
    await Results.Problem(
        statusCode: StatusCodes.Status500InternalServerError,
        title: "The attendance report request could not be completed.",
        detail: app.Environment.IsDevelopment() ? exception?.ToString() : null)
        .ExecuteAsync(context);
}));
if (app.Environment.IsDevelopment()) app.UseCors("DevelopmentClient");
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/attendance/meta", () => Results.Ok(new
{
    applicationName = "Attendance Insights",
    dataSource = useSqlServer ? "SqlServer" : "Mock",
    reportingTimeZone = "Africa/Johannesburg",
    sourceTimestamp = "TR.TR_DATETIMEUTC",
    dateBoundary = "Inclusive start, exclusive end"
}));

app.MapGet("/api/attendance/employees", async (
    IEmployeeRosterSource source,
    CancellationToken cancellationToken) =>
{
    var employees = await source.GetEmployeesAsync(cancellationToken);
    return Results.Ok(employees);
});

app.MapGet("/api/attendance/transactions", async (
    [AsParameters] AttendanceQuery query,
    IAttendanceTransactionSource source,
    IOptions<ReportingOptions> options,
    CancellationToken cancellationToken) =>
{
    var validation = ValidateQuery(query, options.Value);
    if (validation is not null) return validation;

    var filters = new AttendanceFilters(
        NullIfEmpty(query.DepartmentId),
        NullIfEmpty(query.EmployeeSourceId),
        query.Page,
        query.PageSize);
    var result = await source.GetTransactionsAsync(
        query.StartUtc.ToUniversalTime(),
        query.EndUtc.ToUniversalTime(),
        filters,
        cancellationToken);
    return Results.Ok(result);
});

app.MapFallbackToFile("index.html");
app.Run();

static IResult? ValidateQuery(AttendanceQuery query, ReportingOptions options)
{
    if (query.StartUtc == default || query.EndUtc == default || query.EndUtc <= query.StartUtc)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = ["Provide a valid startUtc and exclusive endUtc range."]
        });
    }

    if (query.EndUtc - query.StartUtc > TimeSpan.FromDays(options.MaximumDateRangeDays))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["dateRange"] = [$"The reporting range cannot exceed {options.MaximumDateRangeDays} days."]
        });
    }

    if (query.Page < 1 || query.PageSize < 1 || query.PageSize > options.MaximumPageSize)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["pagination"] = [$"Page must be positive and pageSize cannot exceed {options.MaximumPageSize}."]
        });
    }

    return null;
}

static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

public partial class Program;
