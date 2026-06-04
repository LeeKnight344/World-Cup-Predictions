param container_instance_name string

param Dataverse__EnvironmentUrl string
param Dataverse__ClientId string
param Dataverse__EntitySetName string
param Dataverse__SelectColumns string
param REACT_APP_ENTRA_CLIENT_ID string
param REACT_APP_PREDICTION_SAVE_ENDPOINT string
param PredictionGeneration__Endpoint string
param Dataverse__PredictionScoreColumnName string

param ContainerRegistry_User_Id string
@secure()
param ContainerRegistry_Image string


param keyvault_name string
param container_instance_dns_label string

var container_instance_fqdn = '${container_instance_dns_label}.${resourceGroup().location}.azurecontainer.io'
var entra_redirect_uri = 'http://${container_instance_fqdn}:8080/'

resource keyvault 'Microsoft.KeyVault/vaults@2025-05-01' existing = {
  name: keyvault_name
}
@secure()
param ContainerRegistry_Password string

resource container_instance 'Microsoft.ContainerInstance/containerGroups@2025-09-01' = {
  name: container_instance_name
  location: resourceGroup().location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    sku: 'Standard'
    containers: [
      {
        name: container_instance_name
        properties: {
          image: ContainerRegistry_Image
          ports: [
            {
              protocol: 'TCP'
              port: 8080
            }
          ]
          environmentVariables: [
            {
              name: 'Dataverse__EnvironmentUrl'
              value: Dataverse__EnvironmentUrl
            }
            {
              name: 'Dataverse__TenantId'
              value: subscription().tenantId
            }
            {
              name: 'Dataverse__ClientId'
              value: Dataverse__ClientId
            }
            {
              name: 'Dataverse__ClientSecret'
              value: '@Microsoft.KeyVault(SecretUri=https://${keyvault.name}.vault.azure.net/secrets/Dataverse-ClientSecret/)'
            }
            {
              name: 'Dataverse__EntitySetName'
              value: Dataverse__EntitySetName
            }
            {
              name: 'Dataverse__SelectColumns'
              value: Dataverse__SelectColumns
            }
            {
              name: 'REACT_APP_ENTRA_CLIENT_ID'
              value: REACT_APP_ENTRA_CLIENT_ID
            }
            {
              name: 'REACT_APP_ENTRA_TENANT_ID'
              value: subscription().tenantId
            }
            {
              name: 'REACT_APP_ENTRA_REDIRECT_URI'
              value: entra_redirect_uri
            }
            {
              name: 'REACT_APP_PREDICTION_SAVE_ENDPOINT'
              value: REACT_APP_PREDICTION_SAVE_ENDPOINT
            }
            {
              name: 'PredictionGeneration__Endpoint'
              value: PredictionGeneration__Endpoint
            }
            {
              name: 'Dataverse__PredictionScoreColumnName'
              value: Dataverse__PredictionScoreColumnName
            }
          ]
          configMap: {
            keyValuePairs: {}
          }
          resources: {
            requests: {
              memoryInGB: json('1')
              cpu: json('1')
            }
          }
        }
      }
    ]
    initContainers: []
    imageRegistryCredentials: [
      {
        server: 'ghcr.io'
        username: ContainerRegistry_User_Id
        password: ContainerRegistry_Password
      }
    ]
    restartPolicy: 'OnFailure'
    ipAddress: {
      ports: [
        {
          protocol: 'TCP'
          port: 8080
        }
      ]
      type: 'Public'
      dnsNameLabel: container_instance_dns_label
    }
    osType: 'Linux'
  }
}

output container_instance_ip string = container_instance.properties.ipAddress.ip
output container_instance_fqdn string = container_instance.properties.ipAddress.fqdn
output entra_redirect_uri string = entra_redirect_uri


resource roleDefinitionKeyVaultCertUser 'Microsoft.Authorization/roleDefinitions@2022-05-01-preview' existing = {
  name: 'db79e9a7-68ee-4b58-9aeb-b90e7c24fcba'
  scope: subscription()
}

resource roleDefinitionKeyVaultSecretsUser 'Microsoft.Authorization/roleDefinitions@2022-05-01-preview' existing = {
  name: '4633458b-17de-408a-b874-0445c86b69e6'
  scope: subscription()
}

resource keyVaultCertUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().name, container_instance_name, 'keyVaultCertUser')
  scope: keyvault
  properties: {
    description: container_instance_name
    principalId: container_instance.identity.principalId
    roleDefinitionId: roleDefinitionKeyVaultCertUser.id
    principalType: 'ServicePrincipal'
  }
}

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().name, container_instance_name, 'keyVaultSecretsUser')
  scope: keyvault
  properties: {
    description: container_instance_name
    principalId: container_instance.identity.principalId
    roleDefinitionId: roleDefinitionKeyVaultSecretsUser.id
    principalType: 'ServicePrincipal'
  }
}
