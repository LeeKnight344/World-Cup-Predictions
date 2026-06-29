using FixturePredictions.Models;
using FixturePredictions.Services;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<DataverseOptions>(builder.Configuration.GetSection("Dataverse"));
builder.Services.AddHttpClient();
builder.Services.AddScoped<DataverseFixtureService>();
builder.Services.AddScoped<DataversePredictionService>();
builder.Services.AddScoped<LeaderboardUserProfileService>();
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHealthChecks("/health");

app.MapGet("/api/client-config", (IConfiguration configuration) =>
{
    var clientId = configuration["Entra:ClientId"] ?? configuration["REACT_APP_ENTRA_CLIENT_ID"];
    var tenantId = configuration["Entra:TenantId"] ?? configuration["REACT_APP_ENTRA_TENANT_ID"];
    var redirectUri = configuration["Entra:RedirectUri"] ?? configuration["REACT_APP_ENTRA_REDIRECT_URI"];

    if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(tenantId))
    {
        return Results.Problem(
            "Client authentication is not configured.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    return Results.Ok(new
    {
        entraClientId = clientId,
        entraTenantId = tenantId,
        entraRedirectUri = redirectUri
    });
});

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

app.MapPost("/api/leaderboard/users", async (
    LeaderboardUserLookupRequest request,
    LeaderboardUserProfileService service,
    CancellationToken cancellationToken) =>
{
    try
    {
        var profiles = await service.GetProfilesAsync(request.Emails, cancellationToken);
        return Results.Ok(profiles);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Problem(ex.Message, statusCode: StatusCodes.Status502BadGateway);
    }
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

    var enrichedSubmission = EnrichSubmissionWithScores(submission);

    var client = httpClientFactory.CreateClient();
    using var content = new StringContent(enrichedSubmission, Encoding.UTF8, "application/json");
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

app.MapPost("/api/predictions/generate", async (
    JsonElement requestBody,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var endpoint = configuration["PredictionGeneration:Endpoint"] ?? configuration["REACT_APP_PREDICTION_GENERATION_ENDPOINT"];

    if (string.IsNullOrWhiteSpace(endpoint))
    {
        return Results.Problem("Prediction generation endpoint is not configured.", statusCode: StatusCodes.Status500InternalServerError);
    }

    if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri) || endpointUri.Scheme != Uri.UriSchemeHttps)
    {
        return Results.Problem("Prediction generation endpoint must be an HTTPS URL.", statusCode: StatusCodes.Status500InternalServerError);
    }

    var client = httpClientFactory.CreateClient();
    using var content = new StringContent(requestBody.GetRawText(), Encoding.UTF8, "application/json");
    var response = await client.PostAsync(endpointUri, content, cancellationToken);

    if ((int)response.StatusCode != StatusCodes.Status202Accepted)
    {
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        logger.LogWarning(
            "Prediction generation endpoint did not return 202 Accepted. Status={Status}. Body={Body}",
            response.StatusCode,
            responseBody);

        return Results.Problem(
            $"Prediction generation endpoint returned {(int)response.StatusCode} {response.ReasonPhrase}.",
            statusCode: StatusCodes.Status502BadGateway);
    }

    return Results.Accepted();
});

app.MapPatch("/api/predictions/{predictionId}", async (
    string predictionId,
    UpdatePredictionRequest update,
    DataversePredictionService predictionService,
    DataverseFixtureService fixtureService,
    CancellationToken cancellationToken) =>
{
    int? score = null;
    var fixtures = await fixtureService.GetFixturesAsync(cancellationToken);
    var fixture = fixtures.FirstOrDefault(f => string.Equals(f.Id, update.FixtureId, StringComparison.OrdinalIgnoreCase));

    if (fixture is not null)
    {
        score = PredictionScoring.CalculateScore(
            fixture.MatchStatus,
            fixture.HomeTeamScore,
            fixture.AwayTeamScore,
            fixture.HomeTeamPenaltyScore,
            fixture.AwayTeamPenaltyScore,
            fixture.PenaltyBoolean,
            update.Team1ScorePrediction,
            update.Team2ScorePrediction);
    }

    await predictionService.UpdatePredictionAsync(
        predictionId,
        update.Team1ScorePrediction,
        update.Team2ScorePrediction,
        score,
        cancellationToken);

    return Results.NoContent();
});

app.Run();

static string EnrichSubmissionWithScores(JsonElement submission)
{
    var node = JsonNode.Parse(submission.GetRawText());
    if (node is not JsonObject payload ||
        payload["predictions"] is not JsonArray predictions)
    {
        return submission.GetRawText();
    }

    foreach (var predictionNode in predictions)
    {
        if (predictionNode is not JsonObject prediction)
        {
            continue;
        }

        var fixtureRecord = prediction["fixtureRecord"] as JsonObject;
        var actualTeam1Score = GetNullableInt(fixtureRecord, "homeTeamScore");
        var actualTeam2Score = GetNullableInt(fixtureRecord, "awayTeamScore");
        var actualTeam1PenaltyScore = GetNullableInt(fixtureRecord, "homeTeamPenaltyScore");
        var actualTeam2PenaltyScore = GetNullableInt(fixtureRecord, "awayTeamPenaltyScore");
        var penaltyBoolean = GetBoolean(fixtureRecord, "penaltyBoolean");
        var matchStatus = GetString(fixtureRecord, "matchStatus");
        var predictedTeam1Score = GetNullableInt(prediction, "team1ScorePrediction");
        var predictedTeam2Score = GetNullableInt(prediction, "team2ScorePrediction");
        var score = PredictionScoring.CalculateScore(
            matchStatus,
            actualTeam1Score,
            actualTeam2Score,
            actualTeam1PenaltyScore,
            actualTeam2PenaltyScore,
            penaltyBoolean,
            predictedTeam1Score,
            predictedTeam2Score);

        prediction["score"] = score is null ? null : JsonValue.Create(score.Value);
    }

    return payload.ToJsonString();
}

static int? GetNullableInt(JsonObject? obj, string propertyName)
{
    if (obj is null || obj[propertyName] is not JsonValue value)
    {
        return null;
    }

    if (value.TryGetValue<int>(out var intValue))
    {
        return intValue;
    }

    if (value.TryGetValue<string>(out var stringValue) && int.TryParse(stringValue, out var parsed))
    {
        return parsed;
    }

    return null;
}

static bool GetBoolean(JsonObject? obj, string propertyName)
{
    if (obj is null || obj[propertyName] is not JsonValue value)
    {
        return false;
    }

    if (value.TryGetValue<bool>(out var boolValue))
    {
        return boolValue;
    }

    if (value.TryGetValue<string>(out var stringValue) && bool.TryParse(stringValue, out var parsed))
    {
        return parsed;
    }

    return false;
}

static string? GetString(JsonObject? obj, string propertyName)
{
    if (obj is null || obj[propertyName] is not JsonValue value)
    {
        return null;
    }

    return value.TryGetValue<string>(out var stringValue) ? stringValue : value.ToString();
}
