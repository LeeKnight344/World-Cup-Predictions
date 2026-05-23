using System.Net.Http.Headers;
using System.Text.Json;
using FixturePredictions.Models;
using Microsoft.Extensions.Options;

namespace FixturePredictions.Services;

public sealed class DataversePredictionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DataverseOptions _options;
    private readonly ILogger<DataversePredictionService> _logger;

    public DataversePredictionService(
        IHttpClientFactory httpClientFactory,
        IOptions<DataverseOptions> options,
        ILogger<DataversePredictionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<Prediction>> GetPredictionsAsync(CancellationToken cancellationToken)
    {
        ValidateOptions();

        var accessToken = await GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient();

        var baseUrl = _options.EnvironmentUrl.TrimEnd('/');
        var entitySet = Uri.EscapeDataString(_options.PredictionEntitySetName);
        var select = Uri.EscapeDataString(_options.PredictionSelectColumns);
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
            _logger.LogWarning("Dataverse prediction request failed. Status={Status}. Body={Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Dataverse prediction request failed: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("value", out var values) || values.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<Prediction>();
        }

        return values.EnumerateArray().Select(MapPrediction).ToList();
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

    private static Prediction MapPrediction(JsonElement item)
    {
        var id = GetFirstString(item, "ann_predictionid", "ann_PredictionId") ?? string.Empty;
        var identifier = GetFirstString(item, "ann_identifier", "ann_Identifier");
        var fixtureId = GetFirstString(item, "_ann_fixtures_value", "_ann_Fixtures_value");
        var fixtureName = GetFirstString(
            item,
            "_ann_fixtures_value@OData.Community.Display.V1.FormattedValue",
            "_ann_Fixtures_value@OData.Community.Display.V1.FormattedValue");

        return new Prediction(
            id,
            identifier,
            fixtureId,
            fixtureName,
            ParseNullableInt(GetFirstString(item, "ann_team1scoreprediction", "ann_Team1ScorePrediction")),
            ParseNullableInt(GetFirstString(item, "ann_team2scoreprediction", "ann_Team2ScorePrediction"))
        );
    }

    private static int? ParseNullableInt(string? value)
    {
        return int.TryParse(value, out var parsed) ? parsed : null;
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
        if (string.IsNullOrWhiteSpace(_options.PredictionEntitySetName)) missing.Add("Dataverse:PredictionEntitySetName");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException("Missing configuration: " + string.Join(", ", missing));
        }
    }
}
