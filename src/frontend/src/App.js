//use a .js formatting tool from VS otherwise i'm going to ddos you


import { useState, useEffect } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import "./App.css";
import { FixturePredictionTile } from "./FixturePredictiontile";
import FixtureTile from "./FixtureTile";

function SignInButton() {
  const { instance } = useMsal();

  return (
    <button className="SignInButton" onClick={() => instance.loginRedirect(loginRequest)}>
      Sign in with Microsoft
    </button>
  );
}

function SignOutButton() {
  const { instance } = useMsal();

  return (
    <button className="SignOutButton" onClick={() => instance.logoutRedirect()}>
      Sign out
    </button>
  );
}

function UserHeader() {
  const { accounts } = useMsal();
  const account = accounts[0];

  return (
    <div className="auth-header">
      <span>Signed in as {account?.username}</span>
      <SignOutButton />
    </div>
  );
}

function App() {
  return (
    <>
      <AuthenticatedTemplate>
        <UserHeader />
        <Dashboard />
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <main className="login-page">
          <h1>Fixture Predictions</h1>
          <p>Please sign in to view and submit predictions.</p>
          <SignInButton />
        </main>
      </UnauthenticatedTemplate>
    </>
  );
}

function Dashboard() {
  const [fixturesOnTop, setFixturesOnTop] = useState(true);
  const [fixtures, setFixtures] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionEdits, setPredictionEdits] = useState({});
  const [savingPredictions, setSavingPredictions] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [, setSelectedFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [fixturesResponse, predictionsResponse] = await Promise.all([
          fetch("/api/fixtures"),
          fetch("/api/predictions"),
        ]);

        if (!fixturesResponse.ok) {
          throw new Error("Failed to fetch fixtures");
        }

        if (!predictionsResponse.ok) {
          throw new Error("Failed to fetch predictions");
        }

        const [fixturesData, predictionsData] = await Promise.all([
          fixturesResponse.json(),
          predictionsResponse.json(),
        ]);

        setFixtures(fixturesData);
        setPredictions(predictionsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const scores = [
    ["Ben Dover", "67 points"],
    ["John Dingle", "69 points"],
  ];

  const scoresList = scores.map((player) => (
    <button key={player[0]} className="UserScoreTile">
      <p className="Name">{player[0]}</p>
      <p className="Points">{player[1]}</p>
    </button>
  ));

  const fixtureById = fixtures.reduce((acc, fixture) => {
    const fixtureId = fixture.id?.toLowerCase();
    if (fixtureId) {
      acc[fixtureId] = fixture;
    }
    return acc;
  }, {});

  const isFixtureScheduled = (fixture) => {
    return fixture.matchStatus?.toLowerCase() === "scheduled";
  };

  const parsePredictionScore = (value) => {
    return value === "" ? null : Number(value);
  };

  const handlePredictionChange = ({ fixture, prediction, team, value }) => {
    if (!prediction?.id || !isFixtureScheduled(fixture)) return;

    setPredictionEdits((current) => {
      const existing = current[prediction.id] ?? {
        fixtureId: fixture.id,
        team1ScorePrediction: prediction.team1ScorePrediction ?? "",
        team2ScorePrediction: prediction.team2ScorePrediction ?? "",
      };

      return {
        ...current,
        [prediction.id]: {
          ...existing,
          [team === "team1" ? "team1ScorePrediction" : "team2ScorePrediction"]: value,
        },
      };
    });
  };

  const savePredictionChanges = async () => {
    const changedPredictions = Object.entries(predictionEdits);
    if (changedPredictions.length === 0 || savingPredictions) return;

    setSavingPredictions(true);
    setSaveError(null);

    try {
      await Promise.all(
        changedPredictions.map(([predictionId, edit]) =>
          fetch(`/api/predictions/${encodeURIComponent(predictionId)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fixtureId: edit.fixtureId,
              team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
              team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
            }),
          }).then((response) => {
            if (!response.ok) {
              throw new Error("Failed to save predictions");
            }
          })
        )
      );

      setPredictions((current) =>
        current.map((prediction) => {
          const edit = predictionEdits[prediction.id];
          if (!edit) return prediction;

          return {
            ...prediction,
            team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
            team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
          };
        })
      );
      setPredictionEdits({});
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSavingPredictions(false);
    }
  };

  const predictionFixturesByDay = Object.values(
    predictions
      .map((prediction) => {
        const fixture = prediction.fixtureId
          ? fixtureById[prediction.fixtureId.toLowerCase()]
          : null;

        return {
          prediction,
          fixture: fixture ?? {
            id: prediction.fixtureId,
            homeTeam: prediction.fixtureName ?? "Fixture",
            awayTeam: "",
            kickoff: null,
            matchStatus: "",
          },
        };
      })
      .sort((a, b) => {
        const aTime = a.fixture.kickoff ? new Date(a.fixture.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.fixture.kickoff ? new Date(b.fixture.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .reduce((acc, item) => {
        const kickoff = item.fixture.kickoff ? new Date(item.fixture.kickoff) : null;
        const key = kickoff ? kickoff.toISOString().slice(0, 10) : "nodate";
        if (!acc[key]) acc[key] = { date: kickoff, items: [] };
        acc[key].items.push(item);
        return acc;
      }, {})
  );

  const fixturesByDay = Object.values(
    fixtures
      .slice()
      .sort((a, b) => {
        const aTime = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .reduce((acc, fixture) => {
        const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
        const key = kickoff ? kickoff.toISOString().slice(0, 10) : "nodate";
        if (!acc[key]) acc[key] = { date: kickoff, items: [] };
        acc[key].items.push(fixture);
        return acc;
      }, {})
  );

  const fixtureList = fixturesByDay.map((group) => (
    <div className="MatchDayGroup" key={group.date?.toISOString() ?? "nodate"}>
      <h3 className="MatchDayHeader">
        {group.date
          ? group.date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })
          : "No date"}
      </h3>
      {group.items.map((fixture) => (
        <div
          key={fixture.id ?? fixture.matchId ?? `${fixture.homeTeam}-${fixture.awayTeam}`}
          className="FixtureTile"
          onClick={() => setSelectedFixture(fixture)}
        >
          <FixtureTile fixture={fixture} />
        </div>
      ))}
    </div>
  ));

  return (
    <div className="App">
      <div className="Titlebar">
        <h1>Fixture Predictions</h1>
        <p>Dataverse-backed fixture list and predictions dashboard</p>
      </div>

      <div className="Tabs">
        <button
          className="FixturesTab"
          onClick={() => {
            setFixturesOnTop(true);
          }}
        >
          Fixtures
        </button>

        <button
          className="PredictionsTab"
          onClick={() => {
            setFixturesOnTop(false);
          }}
        >
          Predictions
        </button>
      </div>

      <div className="MainBody">
        <div
          className="Predictions"
          style={{
            zIndex: fixturesOnTop ? 0 : 2,
            visibility: fixturesOnTop ? "hidden" : "visible",
          }}
        >
          <div className="Groups">
            <p className="PredictionsTitle">Predictions</p>
            <p className="StageTitle">Groups</p>

            <div className="PredictionsBody">
              <div className="PredictionsFixtures">
                <div className="PredictionFixturesBody">
                  {predictions.length === 0 ? (
                    <div className="loading">No predictions found</div>
                  ) : (
                    predictionFixturesByDay.map((g) => (
                      <div className="MatchDayGroup" key={g.date?.toISOString() ?? "nodate"}>
                        <h3 className="MatchDayHeader">
                          {g.date
                            ? g.date.toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })
                            : "No date"}
                        </h3>
                        <div className="PredictionFixturesGrid">
                          {g.items.map(({ fixture, prediction }) => (
                            <div
                              className="FixtureTile"
                              key={prediction.id ?? fixture.id ?? `${fixture.homeTeam}-${fixture.awayTeam}`}
                            >
                              <FixturePredictionTile
                                fixture={fixture}
                                prediction={prediction}
                                value={predictionEdits[prediction.id]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  {saveError && <div className="error">Error: {saveError}</div>}
                  <button
                    className="SaveButton"
                    disabled={Object.keys(predictionEdits).length === 0 || savingPredictions}
                    onClick={savePredictionChanges}
                  >
                    {savingPredictions ? "Saving" : "Save"}
                  </button>
                </div>
              </div>
              
            </div>
          </div>
        </div>

        <div
          className="FixturesBody"
          style={{
            visibility: fixturesOnTop ? "visible" : "hidden",
          }}
        >
          <div className="Fixtures">
            <p className="FixturesTitle">Fixtures</p>

            {loading && <div className="loading">Loading fixtures…</div>}

            {error && <div className="error">Error: {error}</div>}

            {!loading && !error && fixtures.length === 0 && (
              <div className="loading">No fixtures found</div>
            )}

            {!loading && !error && fixtures.length > 0 && fixtureList}
          </div>

          <div className="Leaderboard">
            <p className="LeaderboardTitle">Leaderboard</p>

            <div className="LeaderboardList">
              <ul className="LeaderboardScoresList">{scoresList}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
