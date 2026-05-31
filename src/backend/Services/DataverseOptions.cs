namespace FixturePredictions.Services;

public sealed class DataverseOptions
{
    public string EnvironmentUrl { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string EntitySetName { get; set; } = "cr2ef_fixtures";
    public string SelectColumns { get; set; } = "cr2ef_fixtureid,cr2ef_matchid,cr2ef_name,cr2ef_hometeam,cr2ef_awayteam,cr2ef_date,cr2ef_prediction,cr2ef_matchstatus,cr2ef_groupname,cr2ef_team1score,cr2ef_team2score";
    public string PredictionEntitySetName { get; set; } = "ann_predictions";
    public string PredictionSelectColumns { get; set; } = "ann_predictionid,ann_identifier,_ann_fixtures_value,ann_team1scoreprediction,ann_team2scoreprediction";
    public string PredictionScoreColumnName { get; set; } = "ann_score";
}
