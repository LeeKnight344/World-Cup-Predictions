// FixtureTile.jsx

export function FixturePredictionTile({ fixture = {}, onPredictionChange }) {
  const homeTeam = fixture.homeTeam ?? "Home Team";
  const awayTeam = fixture.awayTeam ?? "Away Team";
  const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
  const kickoffDate = kickoff
    ? kickoff.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "Date";
  const kickoffTime = kickoff
    ? kickoff.toLocaleTimeString(undefined, { timeStyle: "short" })
    : "Time";
  const status = fixture.matchStatus ?? "";
  const isNotScheduled = status !== "Scheduled";

  return (
    <div className={`PredictionFixtureTileBox${isNotScheduled ? " PredictionFixtureTileBox--unscheduled" : ""}`}>
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" defaultValue={fixture.homeTeamScore ?? 0} onInput = {(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}></input>
        <div className = "PredictionFixtureDetails">
            <div className = "PredictionFixtureTeams">
                <div className = "PredictionFixtureHomeTeam">{homeTeam}</div>
                V
                <div className = "PredictionFixtureAwayTeam">{awayTeam}</div>
            </div>
            <div className = "PredictionFixtureTimes">
                {kickoffDate} {kickoffTime}
            </div>
            <div className = "PredictionFixtureStatus">{status || "Status"}</div>
        </div>
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" defaultValue={fixture.awayTeamScore ?? 0} onInput = {(e) => e.target.value = e.target.value.replace(/[^0-9]/g, '')}></input>
    </div>
  );
}