targetScope = 'resourceGroup'

param keyvault_name string
param container_instance_name string
param container_instance_dns_label string

@secure()
param Dataverse__ClientSecret string

@secure()
param ContainerRegistry_Password string

param ContainerRegistry_User_Id string = 'LeeKnight344'
param ContainerRegistry_Image string = 'ghcr.io/leeknight344/worldcuppredictions-fixture-predictions:latest'

param Dataverse__EnvironmentUrl string
param Dataverse__ClientId string
param Dataverse__EntitySetName string
param Dataverse__SelectColumns string
param Dataverse__PredictionScoreColumnName string

param REACT_APP_ENTRA_CLIENT_ID string
param REACT_APP_PREDICTION_SAVE_ENDPOINT string

param PredictionGeneration__Endpoint string

module keyvault 'keyvault/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    keyvault_name: keyvault_name
    Dataverse__ClientSecret: Dataverse__ClientSecret
    ContainerRegistry_Password: ContainerRegistry_Password
  }
}

module containerinstance 'containerinstance/containerinstance.bicep' = {
  name: 'containerinstance'
  params: {
    container_instance_name: container_instance_name
    container_instance_dns_label: container_instance_dns_label
    keyvault_name: keyvault.outputs.keyvault_name
    ContainerRegistry_User_Id: ContainerRegistry_User_Id
    ContainerRegistry_Image: ContainerRegistry_Image
    Dataverse__EnvironmentUrl: Dataverse__EnvironmentUrl
    Dataverse__ClientId: Dataverse__ClientId
    Dataverse__EntitySetName: Dataverse__EntitySetName
    Dataverse__SelectColumns: Dataverse__SelectColumns
    Dataverse__PredictionScoreColumnName: Dataverse__PredictionScoreColumnName
    REACT_APP_ENTRA_CLIENT_ID: REACT_APP_ENTRA_CLIENT_ID
    REACT_APP_PREDICTION_SAVE_ENDPOINT: REACT_APP_PREDICTION_SAVE_ENDPOINT
    PredictionGeneration__Endpoint: PredictionGeneration__Endpoint
    ContainerRegistry_Password: ContainerRegistry_Password
  }
}

output container_instance_ip string = containerinstance.outputs.container_instance_ip
output container_instance_fqdn string = containerinstance.outputs.container_instance_fqdn
output entra_redirect_uri string = containerinstance.outputs.entra_redirect_uri
