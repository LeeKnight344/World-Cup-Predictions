namespace FixturePredictions.Models;

public sealed record Fixture(
    string Id,
    string Title,
    string HomeTeam,
    string AwayTeam,
    DateTimeOffset? Kickoff,
    string Prediction
);
