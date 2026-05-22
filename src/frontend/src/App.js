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
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFixtures = async () => {
      try {
        const response = await fetch("/api/fixtures");

        if (!response.ok) {
          throw new Error("Failed to fetch fixtures");
        }

        const data = await response.json();
        setFixtures(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFixtures();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return "Date not set";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

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
                  {fixtures.length === 0 ? (
                    <div className="loading">No fixtures available for predictions</div>
                  ) : (
                    (() => {
                      const groups = fixtures.reduce((acc, f) => {
                        const key = f.kickoff ? new Date(f.kickoff).toISOString().slice(0, 10) : "nodate";
                        if (!acc[key]) acc[key] = { date: f.kickoff, items: [] };
                        acc[key].items.push(f);
                        return acc;
                      }, {});

                      return Object.values(groups).map((g) => (
                        <div className="MatchDayGroup" key={g.date ?? "nodate"}>
                          <h3 className="MatchDayHeader">
                            {g.date
                              ? new Date(g.date).toLocaleDateString(undefined, {
                                  weekday: "long",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "No date"}
                          </h3>
                          <div className="PredictionFixturesGrid">
                            {g.items.map((fixture) => (
                              <div
                                className="FixtureTile"
                                key={fixture.id ?? fixture.matchId ?? `${fixture.homeTeam}-${fixture.awayTeam}`}
                              >
                                <FixturePredictionTile fixture={fixture} onPredictionChange={() => {}} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                  <button className="SaveButton">Save</button>
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