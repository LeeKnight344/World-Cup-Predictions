//use a .js formatting tool from VS otherwise i'm going to ddos you


import { useState, useEffect, useCallback } from "react";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
  useMsal,
} from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import "./App.css";
import { FixturePredictionTile } from "./FixturePredictiontile";
import FixtureTile from "./FixtureTile";

const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

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
      Sign Out
    </button>
  );
}

function UserHeader() {
  const { accounts, instance } = useMsal();
  const account = accounts[0];
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadProfilePhoto = async () => {
      if (!account) {
        setProfilePhotoUrl(null);
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });

        const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });

        if (!response.ok) {
          setProfilePhotoUrl(null);
          return;
        }

        const photoBlob = await response.blob();
        objectUrl = URL.createObjectURL(photoBlob);

        if (!cancelled) {
          setProfilePhotoUrl(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setProfilePhotoUrl(null);
        }
      }
    };

    loadProfilePhoto();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [account, instance]);

  return (
    <div className="auth-header">
      <div className="auth-avatar" aria-hidden="true">
        {profilePhotoUrl ? (
          <img src={profilePhotoUrl} alt="" />
        ) : (
          account?.username?.charAt(0)?.toUpperCase() ?? "U"
        )}
      </div>
      <div className="auth-user">
        <span className="auth-label">Signed in as</span>
        <span className="auth-email">{account?.username}</span>
      </div>
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
          <img
              className="AnnataLogo"
              src="/AnnataLogo.svg"
              alt="Annata logo"
            />
          <div className="LoginHeader">
            <h1>Annata World Cup Predictions Competition</h1>  
          </div>
          <p>Please sign in to view and submit predictions.</p>
          <SignInButton />
        </main>
      </UnauthenticatedTemplate>
    </>
  );
}

function Dashboard() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [fixturesOnTop, setFixturesOnTop] = useState(true);
  const [selectedStage, setSelectedStage] = useState("group");
  const [fixtures, setFixtures] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [predictionEdits, setPredictionEdits] = useState({});
  const [savingPredictions, setSavingPredictions] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loadingPredictionsPage, setLoadingPredictionsPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
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

    return { fixtures: fixturesData, predictions: predictionsData };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshInProgress = false;

    const loadDashboardData = async () => {
      if (refreshInProgress) return;

      refreshInProgress = true;

      try {
        await fetchDashboardData();
        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        refreshInProgress = false;

        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboardData();

    const refreshInterval = setInterval(loadDashboardData, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
    };
  }, [fetchDashboardData]);

  const calculatePredictionScore = ({
    matchStatus,
    homeTeamScore,
    awayTeamScore,
    homeTeamPenaltyScore,
    awayTeamPenaltyScore,
    penaltyBoolean,
    team1ScorePrediction,
    team2ScorePrediction,
  }) => {
    if (!["complete", "completed"].includes(String(matchStatus ?? "").toLowerCase())) {
      return null;
    }

    if (
      homeTeamScore == null ||
      awayTeamScore == null ||
      team1ScorePrediction == null ||
      team2ScorePrediction == null
    ) {
      return null;
    }

    if (homeTeamScore === team1ScorePrediction && awayTeamScore === team2ScorePrediction) {
      return 5;
    }

    const actualDifference = homeTeamScore - awayTeamScore;
    const predictedDifference = team1ScorePrediction - team2ScorePrediction;
    const actualWinnerDifference =
      actualDifference !== 0 ||
      !penaltyBoolean ||
      homeTeamPenaltyScore == null ||
      awayTeamPenaltyScore == null
        ? actualDifference
        : homeTeamPenaltyScore - awayTeamPenaltyScore;

    if (actualDifference === predictedDifference) {
      return 3;
    }

    if (
      actualWinnerDifference !== 0 &&
      predictedDifference !== 0 &&
      Math.sign(actualWinnerDifference) === Math.sign(predictedDifference)
    ) {
      return 1;
    }

    return 0;
  };

  // Pull every email-looking token out of an identifier. The local-part class
  // is greedy and shares characters (letters, digits, '.', '-', '_', '+', '%')
  // with text that may be glued to the email in the identifier (e.g.
  // "Match12-john.smith@annata.net"). Anchoring the start of the local part to
  // a non-local-part character (or string boundary) prevents the regex from
  // swallowing that prefix and returning a bogus address.
  const EMAIL_TOKEN_REGEX = /(?:^|[^A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![A-Z0-9.-])/gi;

  const getPredictionEmails = (identifier) => {
    if (!identifier) return [];

    const matches = [];
    for (const match of identifier.matchAll(EMAIL_TOKEN_REGEX)) {
      matches.push(match[1].toLowerCase());
    }
    return matches;
  };

  const identifierMatchesEmail = (identifier, email) => {
    if (!identifier || !email) return false;
    return getPredictionEmails(identifier).includes(email);
  };

  const scores = Object.values(
    predictions.reduce((acc, prediction) => {
      const [email] = getPredictionEmails(prediction.identifier);
      if (!email) return acc;

      if (!acc[email]) {
        acc[email] = {
          name: email,
          points: 0,
        };
      }

      acc[email].points += prediction.score ?? 0;
      return acc;
    }, {})
  ).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const scoresList = scores.map((player) => (
    <button key={player.name} className="UserScoreTile">
      <p className="Name">{player.name}</p>
      <p className="Points">{player.points} points</p>
    </button>
  ));

  const indexById = (items) => {
    return items.reduce((acc, item) => {
      const itemId = item.id?.toLowerCase();
      if (itemId) {
        acc[itemId] = item;
      }
      return acc;
    }, {});
  };

  const fixtureById = indexById(fixtures);
  const userEmail = account?.username?.toLowerCase() ?? "";

  const predictionsForUser = predictions.filter((prediction) => {
    return userEmail && identifierMatchesEmail(prediction.identifier, userEmail);
  });

  const getFixtureStage = (fixture) => {
    const matchId = Number(fixture?.matchId ?? 0);
    return matchId > 72 ? "knockouts" : "group";
  };

  const isSelectedStageFixture = (fixture) => {
    return getFixtureStage(fixture) === selectedStage;
  };

  const parsePredictionScore = (value) => {
    return value === "" ? null : Number(value);
  };

  const handlePredictionChange = ({ fixture, prediction, team, value }) => {
    if (!prediction?.id) return;

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

  const loadPredictionsPage = async () => {
    if (loadingPredictionsPage) return;

    setLoadingPredictionsPage(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/predictions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: account?.username ?? null,
        }),
      });

      if (response.status !== 202) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate predictions");
      }

      await fetchDashboardData();
      setFixturesOnTop(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setLoadingPredictionsPage(false);
    }
  };

  const savePredictionChanges = async () => {
    const changedPredictions = Object.entries(predictionEdits);
    if (changedPredictions.length === 0 || savingPredictions) return;

    setSavingPredictions(true);
    setSaveError(null);

    try {
      const { fixtures: latestFixtures, predictions: latestPredictions } = await fetchDashboardData();
      const latestFixtureById = indexById(latestFixtures);
      const latestPredictionById = indexById(latestPredictions);

      const payload = {
        submittedAt: new Date().toISOString(),
        submittedBy: account?.username ?? null,
        predictions: changedPredictions.map(([predictionId, edit]) => {
          const currentPrediction = latestPredictionById[predictionId.toLowerCase()] ?? null;
          const fixtureId = currentPrediction?.fixtureId ?? edit.fixtureId;
          const fixture = fixtureId ? latestFixtureById[fixtureId.toLowerCase()] : null;
          const team1ScorePrediction = parsePredictionScore(edit.team1ScorePrediction);
          const team2ScorePrediction = parsePredictionScore(edit.team2ScorePrediction);
          const score = calculatePredictionScore({
            matchStatus: fixture?.matchStatus,
            homeTeamScore: fixture?.homeTeamScore,
            awayTeamScore: fixture?.awayTeamScore,
            homeTeamPenaltyScore: fixture?.homeTeamPenaltyScore,
            awayTeamPenaltyScore: fixture?.awayTeamPenaltyScore,
            penaltyBoolean: fixture?.penaltyBoolean,
            team1ScorePrediction,
            team2ScorePrediction,
          });

          return {
            predictionId: currentPrediction?.id ?? predictionId,
            predictionIdentifier: currentPrediction?.identifier ?? null,
            predictionEmail: getPredictionEmails(currentPrediction?.identifier)[0] ?? null,
            predictionRecord: currentPrediction,
            fixtureId,
            fixtureRecord: fixture,
            fixtureName: fixture?.title ?? null,
            matchId: fixture?.matchId ?? null,
            matchStatus: fixture?.matchStatus ?? null,
            homeTeam: fixture?.homeTeam ?? null,
            awayTeam: fixture?.awayTeam ?? null,
            kickoff: fixture?.kickoff ?? null,
            currentTeam1ScorePrediction: currentPrediction?.team1ScorePrediction ?? null,
            currentTeam2ScorePrediction: currentPrediction?.team2ScorePrediction ?? null,
            team1ScorePrediction,
            team2ScorePrediction,
            score,
          };
        }),
      };

      const response = await fetch("/api/predictions/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save predictions");
      }

      setPredictions((current) =>
        current.map((prediction) => {
          const edit = predictionEdits[prediction.id];
          if (!edit) return prediction;

          return {
            ...prediction,
            team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
            team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
            score: calculatePredictionScore({
              matchStatus: latestFixtureById[edit.fixtureId?.toLowerCase()]?.matchStatus,
              homeTeamScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.homeTeamScore,
              awayTeamScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.awayTeamScore,
              homeTeamPenaltyScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.homeTeamPenaltyScore,
              awayTeamPenaltyScore: latestFixtureById[edit.fixtureId?.toLowerCase()]?.awayTeamPenaltyScore,
              penaltyBoolean: latestFixtureById[edit.fixtureId?.toLowerCase()]?.penaltyBoolean,
              team1ScorePrediction: parsePredictionScore(edit.team1ScorePrediction),
              team2ScorePrediction: parsePredictionScore(edit.team2ScorePrediction),
            }),
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
    predictionsForUser
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
            matchId: prediction.matchId ?? 0,
            homeTeamPenaltyScore: null,
            awayTeamPenaltyScore: null,
            penaltyBoolean: false,
            matchStatus: "",
          },
        };
      })
      .filter((item) => isSelectedStageFixture(item.fixture))
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
      .filter(isSelectedStageFixture)
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
        >
          <FixtureTile fixture={fixture} />
        </div>
      ))}
    </div>
  ));

  return (
    <div className="App">
      <img
              className="AnnataLogo"
              src="/AnnataLogo.svg"
              alt="Annata logo"
            />
      <div className="Titlebar">
        <h1>
          Annata - World Cup 2026
        </h1>
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
          disabled={loadingPredictionsPage}
          onClick={loadPredictionsPage}
        >
          {loadingPredictionsPage ? "Loading" : "Predictions"}
        </button>
      </div>

      {saveError && <div className="error">Error: {saveError}</div>}

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
            <div className="StageButtons" aria-label="Prediction stage">
              <button
                className={selectedStage === "group" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("group")}
              >
                Group Stage
              </button>
              <button
                className={selectedStage === "knockouts" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("knockouts")}
              >
                Knockouts
              </button>
            </div>

            <div className="PredictionsBody">
              <div className="PredictionsFixtures">
                <div className="PredictionFixturesBody">
                  {predictionsForUser.length === 0 ? (
                    <div className="loading">No predictions found</div>
                  ) : predictionFixturesByDay.length === 0 ? (
                    <div className="loading">No predictions found for this stage</div>
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
                              className="PredictionFixtureTileHost"
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
                </div>
                
              </div>
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

        <div
          className="FixturesBody"
          style={{
            visibility: fixturesOnTop ? "visible" : "hidden",
          }}
        >
          <div className="Fixtures">
            <p className="FixturesTitle">Fixtures</p>
            <div className="StageButtons" aria-label="Fixture stage">
              <button
                className={selectedStage === "group" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("group")}
              >
                Group Stage
              </button>
              <button
                className={selectedStage === "knockouts" ? "StageButton StageButtonActive" : "StageButton"}
                onClick={() => setSelectedStage("knockouts")}
              >
                Knockouts
              </button>
            </div>

            {loading && <div className="loading">Loading fixtures…</div>}

            {error && <div className="error">Error: {error}</div>}

            {!loading && !error && fixtures.length === 0 && (
              <div className="loading">No fixtures found</div>
            )}

            {!loading && !error && fixtures.length > 0 && fixtureList.length === 0 && (
              <div className="loading">No fixtures found for this stage</div>
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
