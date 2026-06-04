namespace FixturePredictions.Models;

public sealed record Fixture(
    string Id,
    int MatchId,
    string HomeTeam,
    string AwayTeam,
    DateTimeOffset? Kickoff,
    int? HomeTeamScore,
    int? AwayTeamScore,
    int? HomeTeamPenaltyScore,
    int? AwayTeamPenaltyScore,
    bool PenaltyBoolean,
    string GroupName,
    string MatchStatus,
    string? Title = null,
    string? Prediction = null
);
