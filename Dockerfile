#compile react, I have NO idea if the react version matters as I've not worked with it much lol
FROM node:20-alpine AS react-build 
WORKDIR /app/react
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/. ./

ARG REACT_APP_ENTRA_CLIENT_ID
ARG REACT_APP_ENTRA_TENANT_ID
ARG REACT_APP_ENTRA_REDIRECT_URI

ENV REACT_APP_ENTRA_CLIENT_ID=$REACT_APP_ENTRA_CLIENT_ID
ENV REACT_APP_ENTRA_TENANT_ID=$REACT_APP_ENTRA_TENANT_ID
ENV REACT_APP_ENTRA_REDIRECT_URI=$REACT_APP_ENTRA_REDIRECT_URI

RUN npm run build

#dotnet
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /src/backend
COPY src/backend/FixturePredictions.csproj ./
RUN dotnet restore
COPY src/backend/. ./

#put compiled code into wwwroot
COPY --from=react-build /app/react/build ./wwwroot
RUN dotnet publish -c Release -o /app/publish --no-restore

#runtimwe
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=dotnet-build /app/publish ./
ENTRYPOINT ["dotnet", "FixturePredictions.dll"]