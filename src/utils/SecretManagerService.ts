/*********************************************************************
 * Copyright (c) Intel Corporation 2019
 * SPDX-License-Identifier: Apache-2.0
 * Description: stores amt profiles
 * Author: Ramu Bachala
 **********************************************************************/

import { ISecretManagerService } from '../models/ISecretManagerService'
import { configType } from '../models/Config'
import NodeVault = require('node-vault')

export class SecretManagerService implements ISecretManagerService {
  vaultClient: NodeVault.client
  logger: any
  constructor (config: configType, logger: any, vault?: any) {
    this.logger = logger
    if (vault) {
      this.vaultClient = vault
      return
    }

    const options: NodeVault.VaultOptions = {
      apiVersion: 'v1', // default
      endpoint: config.vault_address, // default
      token: config.vault_token // optional client token; can be fetched after valid initialization of the server
    }

    this.vaultClient = NodeVault(options)
  }

  async listSecretsAtPath (path: string): Promise<any> {
    try {
      this.logger.info('list secret ' + path)
      const data = await this.vaultClient.list(path)
      this.logger.info('got data back from vault ')
      this.logger.info(JSON.stringify(data))
      // { data: data: { "key": "keyvalue"}}
      return data.data.keys
    } catch (error) {
      this.logger.error('listSecretFromKey error \r\n')
      this.logger.error(error)
      return null
    }
  }

  async getSecretFromKey (path: string, key: string): Promise<string> {
    try {
      this.logger.info('getting secret ' + path + ' ' + key)
      const data = await this.vaultClient.read(path)
      this.logger.info('got data back from vault ')
      // { data: data: { "key": "keyvalue"}}
      return data.data.data[key]
    } catch (error) {
      this.logger.error('getSecretFromKey error \r\n')
      this.logger.error(error)
      return null
    }
  }

  async getSecretAtPath (path: string): Promise<any> {
    try {
      this.logger.info('getting secrets from ' + path)
      const data = await this.vaultClient.read(path)
      // this.logger.info(`got data back from vault : ${data}`)
      return data.data
    } catch (error) {
      this.logger.error('getSecretAtPath error \r\n')
      this.logger.error(error)
      return null
    }
  }

  async readJsonFromKey (path: string, key: string): Promise<string> {
    const data = await this.getSecretFromKey(path, key)
    return (data ? JSON.parse(data) : null)
  }

  async writeSecretWithKey (path: string, key: string, keyValue: any): Promise<void> {
    const data = { data: {} }
    data.data[key] = keyValue
    // this.logger.info('writing:' + JSON.stringify(data))
    this.logger.info('writing data to vault:')
    await this.vaultClient.write(path, data)
    this.logger.info('Successfully written data to vault')
  }
}
