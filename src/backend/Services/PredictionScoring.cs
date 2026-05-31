namespace FixturePredictions.Services;

public static class PredictionScoring
{
    public static int? CalculateScore(
        string? matchStatus,
        int? actualTeam1Score,
        int? actualTeam2Score,
        int? actualTeam1PenaltyScore,
        int? actualTeam2PenaltyScore,
        bool penaltyBoolean,
        int? predictedTeam1Score,
        int? predictedTeam2Score)
    {
        if (!IsComplete(matchStatus))
        {
            return null;
        }

        if (actualTeam1Score is null ||
            actualTeam2Score is null ||
            predictedTeam1Score is null ||
            predictedTeam2Score is null)
        {
            return null;
        }

        if (actualTeam1Score == predictedTeam1Score && actualTeam2Score == predictedTeam2Score)
        {
            return 5;
        }

        var actualDifference = actualTeam1Score.Value - actualTeam2Score.Value;
        var predictedDifference = predictedTeam1Score.Value - predictedTeam2Score.Value;
        var actualWinnerDifference = GetActualWinnerDifference(
            actualDifference,
            actualTeam1PenaltyScore,
            actualTeam2PenaltyScore,
            penaltyBoolean);

        if (actualDifference == predictedDifference)
        {
            return 3;
        }

        if (actualWinnerDifference != 0 &&
            predictedDifference != 0 &&
            Math.Sign(actualWinnerDifference) == Math.Sign(predictedDifference))
        {
            return 1;
        }

        return 0;
    }

    private static bool IsComplete(string? matchStatus)
    {
        return string.Equals(matchStatus, "complete", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(matchStatus, "completed", StringComparison.OrdinalIgnoreCase);
    }

    private static int GetActualWinnerDifference(
        int actualDifference,
        int? actualTeam1PenaltyScore,
        int? actualTeam2PenaltyScore,
        bool penaltyBoolean)
    {
        if (actualDifference != 0 || !penaltyBoolean)
        {
            return actualDifference;
        }

        if (actualTeam1PenaltyScore is null || actualTeam2PenaltyScore is null)
        {
            return actualDifference;
        }

        return actualTeam1PenaltyScore.Value - actualTeam2PenaltyScore.Value;
    }
}
