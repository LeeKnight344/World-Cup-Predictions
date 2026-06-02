// FixtureTile.jsx

export function FixturePredictionTile({ fixture = {}, prediction = null, value = {}, onPredictionChange }) {
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
  const normalizedStatus = status.trim().toLowerCase();
  const statusClass = ["live", "scheduled", "complete", "completed"].includes(normalizedStatus)
    ? `status-${normalizedStatus === "completed" ? "complete" : normalizedStatus}`
    : "";
  const predictionsEnabled = normalizedStatus === "scheduled";
  const matchId = fixture.matchId != null ? `Match ${fixture.matchId}` : null;
  const homeScorePrediction = value.team1ScorePrediction ?? prediction?.team1ScorePrediction ?? 0;
  const awayScorePrediction = value.team2ScorePrediction ?? prediction?.team2ScorePrediction ?? 0;

  const handlePredictionInput = (team) => (event) => {
    if (!predictionsEnabled) return;

    const rawValue = event.target.value.replace(/[^0-9]/g, '');
    onPredictionChange?.({
      fixture,
      prediction,
      team,
      value: rawValue === "" ? "0" : rawValue,
    });
  };

  return (
    <div className={`PredictionFixtureTileBox ${statusClass}`}>
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" value={homeScorePrediction} disabled={!predictionsEnabled} onChange = {handlePredictionInput("team1")}></input>
        <div className = "PredictionFixtureDetails">
            <div className = "PredictionFixtureTeams">
                <div className = "PredictionFixtureHomeTeam">{homeTeam}</div>
                V
                <div className = "PredictionFixtureAwayTeam">{awayTeam}</div>
            </div>
            <div className = "PredictionFixtureTimes">
                {kickoffDate} {kickoffTime}
            </div>
            {matchId && <div className="PredictionFixtureMatchId">{matchId}</div>}
            <div className = {`PredictionFixtureStatus ${statusClass}`}>{status || "Status"}</div>
        </div>
        <input className = "ScorePrediction" type = "number" inputMode = "numeric" pattern = "[0-9]*" step = "1" min = "0" value={awayScorePrediction} disabled={!predictionsEnabled} onChange = {handlePredictionInput("team2")}></input>
    </div>
  );
}
