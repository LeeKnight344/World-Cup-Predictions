// FixtureTileReadOnly.jsx

export function FixtureTile({ fixture = {} }) {
  const homeTeam = fixture.homeTeam ?? "Home Team";
  const awayTeam = fixture.awayTeam ?? "Away Team";
  const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
  const kickoffDate = kickoff
    ? kickoff.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "Date";
  const kickoffTime = kickoff
    ? kickoff.toLocaleTimeString(undefined, { timeStyle: "short" })
    : "Time";

  const homeScore = fixture.homeTeamScore ?? 0;
  const awayScore = fixture.awayTeamScore ?? 0;

  return (
    <div className="FixtureTileBox">
      <div className="ScorePrediction" aria-hidden="true">{homeScore}</div>
      <div className="PredictionFixtureDetails">
        <div className="PredictionFixtureTeams">
          <div className="PredictionFixtureHomeTeam">{homeTeam}</div>
          V
          <div className="PredictionFixtureAwayTeam">{awayTeam}</div>
        </div>
        <div className="PredictionFixtureTimes">
          {kickoffDate} {kickoffTime}
        </div>
        <div className="PredictionFixtureStatus">{fixture.matchStatus ?? "Status"}</div>
      </div>
      <div className="ScorePrediction" aria-hidden="true">{awayScore}</div>
    </div>
  );
}

export default FixtureTile;
