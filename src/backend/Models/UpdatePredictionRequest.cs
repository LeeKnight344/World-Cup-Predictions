namespace FixturePredictions.Models;

public sealed record UpdatePredictionRequest(
    string FixtureId,
    int? Team1ScorePrediction,
    int? Team2ScorePrediction
);
