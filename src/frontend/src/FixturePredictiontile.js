// FixtureTile.jsx

export function FixtureTile({ fixture = {}, onPredictionChange }) {
  const homeTeam = fixture.homeTeam ?? "Home Team";
  const awayTeam = fixture.awayTeam ?? "Away Team";
  const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
  const kickoffDate = kickoff
    ? kickoff.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "Date";
  const kickoffTime = kickoff
    ? kickoff.toLocaleTimeString(undefined, { timeStyle: "short" })
    : "Time";

  return (
    <div className = "FixtureTileBox">
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" onInput = {(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}></input>
        <div className = "PredictionFixtureDetails">
            <div className = "PredictionFixtureTeams">
                <div className = "PredictionFixtureHomeTeam">{homeTeam}</div>
                V
                <div className = "PredictionFixtureAwayTeam">{awayTeam}</div>
            </div>
            <div className = "PredictionFixtureTimes">
                {kickoffDate} {kickoffTime}
            </div>
        </div>
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" onInput = {(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}></input>
    </div>
  );
}