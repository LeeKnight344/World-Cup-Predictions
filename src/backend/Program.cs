using FixturePredictions.Models;
using FixturePredictions.Services;
using System.Text;
using System.Text.Json;

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

app.MapPost("/api/predictions/submit", async (
    JsonElement submission,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var endpoint = configuration["PredictionSave:Endpoint"] ?? configuration["REACT_APP_PREDICTION_SAVE_ENDPOINT"];

    if (string.IsNullOrWhiteSpace(endpoint))
    {
        return Results.Problem("Prediction save endpoint is not configured.", statusCode: StatusCodes.Status500InternalServerError);
    }

    if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri) || endpointUri.Scheme != Uri.UriSchemeHttps)
    {
        return Results.Problem("Prediction save endpoint must be an HTTPS URL.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var client = httpClientFactory.CreateClient();
    using var content = new StringContent(submission.GetRawText(), Encoding.UTF8, "application/json");
    var response = await client.PostAsync(endpointUri, content, cancellationToken);

    if (!response.IsSuccessStatusCode)
    {
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        logger.LogWarning(
            "Prediction save endpoint failed. Status={Status}. Body={Body}",
            response.StatusCode,
            responseBody);

        return Results.Problem(
            $"Prediction save endpoint returned {(int)response.StatusCode} {response.ReasonPhrase}.",
            statusCode: StatusCodes.Status502BadGateway);
    }

    return Results.NoContent();
});

app.MapPatch("/api/predictions/{predictionId}", async (
    string predictionId,
    UpdatePredictionRequest update,
    DataversePredictionService predictionService,
    CancellationToken cancellationToken) =>
{
    await predictionService.UpdatePredictionAsync(
        predictionId,
        update.Team1ScorePrediction,
        update.Team2ScorePrediction,
        cancellationToken);

    return Results.NoContent();
});

app.Run();
