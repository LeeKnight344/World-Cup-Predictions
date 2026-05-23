using FixturePredictions.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<DataverseOptions>(builder.Configuration.GetSection("Dataverse"));
builder.Services.AddHttpClient();
builder.Services.AddScoped<DataverseFixtureService>();
builder.Services.AddScoped<DataversePredictionService>();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHealthChecks("/health");

app.MapGet("/api/fixtures", async (DataverseFixtureService service, CancellationToken cancellationToken) =>
{
    var fixtures = await service.GetFixturesAsync(cancellationToken);
    return Results.Ok(fixtures);
});

app.MapGet("/api/predictions", async (DataversePredictionService service, CancellationToken cancellationToken) =>
{
    var predictions = await service.GetPredictionsAsync(cancellationToken);
    return Results.Ok(predictions);
});

app.Run();
