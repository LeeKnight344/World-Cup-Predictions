// FixtureTile.jsx

export function FixtureTile({ fixture, onPredictionChange }) {


  return (
    <div className = "FixtureTileBox">
        <input className = "ScorePrediction" type = "number"></input>
        <div className = "PredictionFixtureDetails">
            <div className = "PredictionFixtureTeams">
                <div className = "PredictionFixtureHomeTeam">Home Team</div>
                V
                <div className = "PredictionFixtureAwayTeam">Away Team</div>
            </div>
            <div className = "PredictionFixtureTimes">
                Date   Time
            </div>
        </div>
        <input className = "ScorePrediction"></input>
    </div>
  );
}