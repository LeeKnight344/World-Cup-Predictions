param keyvault_name string
@secure()
param Dataverse__ClientSecret string
@secure()
param ContainerRegistry_Password string


resource keyvault 'Microsoft.KeyVault/vaults@2025-05-01' = {
  name: keyvault_name
  location: resourceGroup().location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: true
    provisioningState: 'Succeeded'
    publicNetworkAccess: 'Enabled'
  }
}

resource dataverse_secret 'Microsoft.KeyVault/vaults/secrets@2025-05-01' = {
  name: 'Dataverse-ClientSecret'
  parent: keyvault
  properties: {
    value: Dataverse__ClientSecret
  }
}

resource ghcr_secret 'Microsoft.KeyVault/vaults/secrets@2025-05-01' = {
  name: 'ContainerRegistry-Password'
  parent: keyvault
  properties: {
    value: ContainerRegistry_Password
  }
}


output keyvault_name string = keyvault.name
