using FixturePredictions.Models;
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

app.MapPatch("/api/predictions/{predictionId}", async (
    string predictionId,
    UpdatePredictionRequest update,
    DataversePredictionService predictionService,
    DataverseFixtureService fixtureService,
    CancellationToken cancellationToken) =>
{
    var fixtures = await fixtureService.GetFixturesAsync(cancellationToken);
    var fixture = fixtures.FirstOrDefault(f => string.Equals(f.Id, update.FixtureId, StringComparison.OrdinalIgnoreCase));

    if (fixture is null)
    {
        return Results.NotFound("Linked fixture was not found.");
    }

    if (!string.Equals(fixture.MatchStatus, "scheduled", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest("Predictions can only be updated while the linked fixture is scheduled.");
    }

    await predictionService.UpdatePredictionAsync(
        predictionId,
        update.Team1ScorePrediction,
        update.Team2ScorePrediction,
        cancellationToken);

    return Results.NoContent();
});

app.Run();
