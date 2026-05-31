namespace FixturePredictions.Services;

public static class PredictionScoring
{
    public static int? CalculateScore(
        int? actualTeam1Score,
        int? actualTeam2Score,
        int? predictedTeam1Score,
        int? predictedTeam2Score)
    {
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

        if (actualDifference == predictedDifference)
        {
            return 3;
        }

        if (actualDifference != 0 &&
            predictedDifference != 0 &&
            Math.Sign(actualDifference) == Math.Sign(predictedDifference))
        {
            return 1;
        }

        return 0;
    }
}
