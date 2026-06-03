# Dataverse Fixture Predictions ASP.NET Container App

test
A Dockerized ASP.NET Core 8 app that reads fixtures from Dataverse and displays a two-column fixtures/predictions dashboard.

## Dataverse assumptions

Default table entity set: `cr2ef_fixtures`

Default selected columns:

- `cr2ef_fixtureid`
- `cr2ef_name`
- `cr2ef_hometeam`
- `cr2ef_awayteam`
- `cr2ef_date`
- `cr2ef_prediction`

If your Dataverse column logical names are different, update `Dataverse__SelectColumns` in `docker-compose.yml` and adjust the fallback names in `Services/DataverseFixtureService.cs`.

The Web API entity set name is sometimes different from the table logical name. If `/api/fixtures` returns a Dataverse 404, check the table's Web API entity set name in Power Apps and update `Dataverse__EntitySetName`.

## Required Dataverse setup

1. Register an app in Microsoft Entra ID.
2. Create a client secret for that app.
3. In Power Platform Admin Center, add the app registration as an application user for the Dataverse environment.
4. Assign it a security role that can read `cr2ef_fixtures`.
5. Fill in these environment variables in `docker-compose.yml`:
   - `Dataverse__EnvironmentUrl`
   - `Dataverse__TenantId`
   - `Dataverse__ClientId`
   - `Dataverse__ClientSecret`

## Run locally with Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Health check:

```text
http://localhost:8080/health
```

Fixtures API:

```text
http://localhost:8080/api/fixtures
```

## Run without Docker

```bash
cd src
Dataverse__EnvironmentUrl="https://YOUR-ORG.crm.dynamics.com" \
Dataverse__TenantId="YOUR-TENANT-ID" \
Dataverse__ClientId="YOUR-APP-CLIENT-ID" \
Dataverse__ClientSecret="YOUR-APP-CLIENT-SECRET" \
dotnet run
```
