namespace FixturePredictions.Services;

public sealed class DataverseOptions
{
    public string EnvironmentUrl { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string EntitySetName { get; set; } = "cr2ef_fixtures";
    public string SelectColumns { get; set; } = "cr2ef_fixtureid,cr2ef_name,cr2ef_hometeam,cr2ef_awayteam,cr2ef_date,cr2ef_prediction";
}
