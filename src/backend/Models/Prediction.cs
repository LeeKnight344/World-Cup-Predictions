namespace FixturePredictions.Models;

public sealed record Prediction(
    string Id,
    string? Identifier,
    string? FixtureId,
    string? FixtureName,
    int? Team1ScorePrediction,
    int? Team2ScorePrediction
);
