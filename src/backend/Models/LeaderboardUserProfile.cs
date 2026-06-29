namespace FixturePredictions.Models;

public sealed record LeaderboardUserProfile(
    string Email,
    string? FirstName,
    string? LastName,
    string? FullName,
    string? Region);
