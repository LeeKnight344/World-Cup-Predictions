namespace FixturePredictions.Models;

public sealed record Fixture(
    string Id,
    int MatchId,
    string HomeTeam,
    string AwayTeam,
    DateTimeOffset? Kickoff,
    int? HomeTeamScore,
    int? AwayTeamScore,
    string GroupName,
    string MatchStatus,
    string? Title = null,
    string? Prediction = null
);
