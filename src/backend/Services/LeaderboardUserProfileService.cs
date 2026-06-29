using System.Net.Http.Headers;
using System.Text.Json;
using FixturePredictions.Models;
using Microsoft.Extensions.Options;

namespace FixturePredictions.Services;

public sealed class LeaderboardUserProfileService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DataverseOptions _options;
    private readonly ILogger<LeaderboardUserProfileService> _logger;

    public LeaderboardUserProfileService(
        IHttpClientFactory httpClientFactory,
        IOptions<DataverseOptions> options,
        ILogger<LeaderboardUserProfileService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<LeaderboardUserProfile>> GetProfilesAsync(
        IReadOnlyList<string> emails,
        CancellationToken cancellationToken)
    {
        ValidateOptions();

        var normalizedEmails = emails
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Select(email => email.Trim().ToLowerInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedEmails.Count == 0)
        {
            return Array.Empty<LeaderboardUserProfile>();
        }

        var dataverseToken = await GetAccessTokenAsync(
            $"{_options.EnvironmentUrl.TrimEnd('/')}/.default",
            cancellationToken);
        var systemUsers = await GetSystemUsersAsync(normalizedEmails, dataverseToken, cancellationToken);
        var profiles = new List<LeaderboardUserProfile>();

        foreach (var email in normalizedEmails)
        {
            if (!systemUsers.TryGetValue(email, out var systemUser))
            {
                profiles.Add(new LeaderboardUserProfile(email, null, null, null, null));
                continue;
            }

            profiles.Add(new LeaderboardUserProfile(
                email,
                systemUser.FirstName,
                systemUser.LastName,
                systemUser.FullName,
                systemUser.Region));
        }

        return profiles;
    }

    private async Task<Dictionary<string, SystemUserProfile>> GetSystemUsersAsync(
        IReadOnlyList<string> emails,
        string accessToken,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var users = new Dictionary<string, SystemUserProfile>(StringComparer.OrdinalIgnoreCase);

        foreach (var emailBatch in emails.Chunk(20))
        {
            var baseUrl = _options.EnvironmentUrl.TrimEnd('/');
            var select = Uri.EscapeDataString("internalemailaddress,firstname,lastname,fullname,address1_country");
            var filter = Uri.EscapeDataString(
                string.Join(" or ", emailBatch.Select(email => $"internalemailaddress eq '{EscapeODataString(email)}'")));
            var requestUri = $"{baseUrl}/api/data/v9.2/systemusers?$select={select}&$filter={filter}";

            while (!string.IsNullOrWhiteSpace(requestUri))
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                request.Headers.Add("OData-MaxVersion", "4.0");
                request.Headers.Add("OData-Version", "4.0");
                request.Headers.Add("Prefer", "odata.maxpagesize=5000");

                using var response = await client.SendAsync(request, cancellationToken);
                var body = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Dataverse systemuser request failed. Status={Status}. Body={Body}",
                        response.StatusCode,
                        body);
                    throw new InvalidOperationException(
                        $"Dataverse systemuser request failed: {(int)response.StatusCode} {response.ReasonPhrase}");
                }

                using var document = JsonDocument.Parse(body);
                if (document.RootElement.TryGetProperty("value", out var values) &&
                    values.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in values.EnumerateArray())
                    {
                        var email = GetFirstString(item, "internalemailaddress")?.ToLowerInvariant();
                        if (string.IsNullOrWhiteSpace(email))
                        {
                            continue;
                        }

                        users[email] = new SystemUserProfile(
                            email,
                            GetFirstString(item, "firstname"),
                            GetFirstString(item, "lastname"),
                            GetFirstString(item, "fullname"),
                            GetFirstString(item, "address1_country"));
                    }
                }

                requestUri = GetNextLink(document.RootElement);
            }
        }

        return users;
    }

    private async Task<string> GetAccessTokenAsync(string scope, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var tokenEndpoint = $"https://login.microsoftonline.com/{_options.TenantId}/oauth2/v2.0/token";

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
            _logger.LogWarning(
                "Token request failed for scope {Scope}. Status={Status}. Body={Body}",
                scope,
                response.StatusCode,
                body);
            throw new InvalidOperationException(
                $"Token request failed for scope {scope}: {(int)response.StatusCode} {response.ReasonPhrase}");
        }

        using var document = JsonDocument.Parse(body);
        return document.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Token response did not include access_token.");
    }

    private static string? GetNextLink(JsonElement root)
    {
        return root.TryGetProperty("@odata.nextLink", out var nextLink) && nextLink.ValueKind == JsonValueKind.String
            ? nextLink.GetString()
            : null;
    }

    private static string EscapeODataString(string value)
    {
        return value.Replace("'", "''", StringComparison.Ordinal);
    }

    private static string? GetFirstString(JsonElement item, params string[] names)
    {
        foreach (var name in names)
        {
            if (!item.TryGetProperty(name, out var value))
            {
                continue;
            }

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

        if (missing.Count > 0)
        {
            throw new InvalidOperationException("Missing configuration: " + string.Join(", ", missing));
        }
    }

    private sealed record SystemUserProfile(
        string Email,
        string? FirstName,
        string? LastName,
        string? FullName,
        string? Region);
}
