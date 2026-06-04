using System.Net.Http.Headers;
using System.Text.Json;
using FixturePredictions.Models;
using Microsoft.Extensions.Options;

namespace FixturePredictions.Services;


/*
Boiler plate Dataverse authentication and request API, REMEMBER TO update the class names where you can otherwise you'll look dumb -_-
*/


public sealed class DataverseFixtureService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DataverseOptions _options;
    private readonly ILogger<DataverseFixtureService> _logger;

    public DataverseFixtureService(
        IHttpClientFactory httpClientFactory,
        IOptions<DataverseOptions> options,
        ILogger<DataverseFixtureService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<Fixture>> GetFixturesAsync(CancellationToken cancellationToken)
    {
        ValidateOptions();

        var accessToken = await GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient();

        var baseUrl = _options.EnvironmentUrl.TrimEnd('/');
        var entitySet = Uri.EscapeDataString(_options.EntitySetName);
        var select = Uri.EscapeDataString(_options.SelectColumns);
        var requestUri = $"{baseUrl}/api/data/v9.2/{entitySet}?$select={select}";

        using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Add("OData-MaxVersion", "4.0");
        request.Headers.Add("OData-Version", "4.0");
        request.Headers.Add("Prefer", "odata.include-annotations=OData.Community.Display.V1.FormattedValue");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Dataverse request failed. Status={Status}. Body={Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Dataverse request failed: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("value", out var values) || values.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<Fixture>();
        }

        return values.EnumerateArray().Select(MapFixture).ToList();
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var tokenEndpoint = $"https://login.microsoftonline.com/{_options.TenantId}/oauth2/v2.0/token";
        var scope = $"{_options.EnvironmentUrl.TrimEnd('/')}/.default";

        using var request = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
                ["grant_type"] = "client_credentials",
                ["scope"] = scope
            })
        };

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Token request failed. Status={Status}. Body={Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Token request failed: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        using var document = JsonDocument.Parse(body);
        return document.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Token response did not include access_token.");
    }

    private static Fixture MapFixture(JsonElement item)
    {
        var id = GetFirstString(item, "cr2ef_fixturesid", "cr2ef_fixtureid") ?? string.Empty;
        var matchIdText = GetFirstString(item, "cr2ef_matchid", "matchid");
        var homeTeam = GetFirstString(item, "cr2ef_team1", "cr2ef_hometeam", "cr2ef_home") ?? "Home";
        var awayTeam = GetFirstString(item, "cr2ef_team2", "cr2ef_awayteam", "cr2ef_away") ?? "Away";
        var title = GetFirstString(item, "cr2ef_name", "name", "subject");
        var groupName = GetFirstString(item, "cr2ef_groupname", "groupname") ?? string.Empty;
        var matchStatus = GetFirstString(item, "cr2ef_matchstatus", "cr2ef_MatchStatus") ?? string.Empty;
        var kickoffText = GetFirstString(item, "cr2ef_kickofftime", "cr2ef_date@OData.Community.Display.V1.FormattedValue", "cr2ef_date", "scheduledstart");
        var homeTeamScoreText = GetFirstString(item, "cr2ef_team1score", "cr2ef_homescore");
        var awayTeamScoreText = GetFirstString(item, "cr2ef_team2score", "cr2ef_awayscore");
        var homeTeamPenaltyScoreText = GetFirstString(item, "ann_team1penaltyscore", "ann_Team1PenaltyScore");
        var awayTeamPenaltyScoreText = GetFirstString(item, "ann_team2penaltyscore", "ann_Team2PenaltyScore");
        var penaltyBooleanText = GetFirstString(item, "ann_penaltyboolean", "ann_PenaltyBoolean");

        var matchId = int.TryParse(matchIdText, out var parsed) ? parsed : 0;
        
        DateTimeOffset? kickoff = null;
        if (DateTimeOffset.TryParse(kickoffText, out var kickoffParsed))
        {
            kickoff = kickoffParsed;
        }

        int? homeTeamScore = null;
        if (int.TryParse(homeTeamScoreText, out var homeScore))
        {
            homeTeamScore = homeScore;
        }

        int? awayTeamScore = null;
        if (int.TryParse(awayTeamScoreText, out var awayScore))
        {
            awayTeamScore = awayScore;
        }

        int? homeTeamPenaltyScore = null;
        if (int.TryParse(homeTeamPenaltyScoreText, out var homePenaltyScore))
        {
            homeTeamPenaltyScore = homePenaltyScore;
        }

        int? awayTeamPenaltyScore = null;
        if (int.TryParse(awayTeamPenaltyScoreText, out var awayPenaltyScore))
        {
            awayTeamPenaltyScore = awayPenaltyScore;
        }

        var penaltyBoolean = bool.TryParse(penaltyBooleanText, out var parsedPenaltyBoolean) && parsedPenaltyBoolean;

        return new Fixture(
            id,
            matchId,
            homeTeam,
            awayTeam,
            kickoff,
            homeTeamScore,
            awayTeamScore,
            homeTeamPenaltyScore,
            awayTeamPenaltyScore,
            penaltyBoolean,
            groupName,
            matchStatus,
            title
            //prediction: null
        );
    }

    private static string? GetFirstString(JsonElement item, params string[] names)
    {
        foreach (var name in names)
        {
            if (!item.TryGetProperty(name, out var value)) continue;

            if (value.ValueKind == JsonValueKind.String)
            {
                return value.GetString();
            }

            if (value.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
            {
                return value.ToString();
            }
        }

        return null;
    }

    private void ValidateOptions()
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(_options.EnvironmentUrl)) missing.Add("Dataverse:EnvironmentUrl");
        if (string.IsNullOrWhiteSpace(_options.TenantId)) missing.Add("Dataverse:TenantId");
        if (string.IsNullOrWhiteSpace(_options.ClientId)) missing.Add("Dataverse:ClientId");
        if (string.IsNullOrWhiteSpace(_options.ClientSecret)) missing.Add("Dataverse:ClientSecret");
        if (string.IsNullOrWhiteSpace(_options.EntitySetName)) missing.Add("Dataverse:EntitySetName");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException("Missing configuration: " + string.Join(", ", missing));
        }
    }
}
