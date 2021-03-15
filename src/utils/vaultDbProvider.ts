/*********************************************************************
* Copyright (c) Intel Corporation 2020
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/
import { IDbProvider } from '../models/IDbProvider'
import { ISecretManagerService } from '../models/ISecretManagerService'
import { configType } from '../models/Config'
import { Credentials } from '../models/models'

export class SecretsDbProvider implements IDbProvider {
  secretsManager: ISecretManagerService
  secretsPath: string
  logger: any
  config: configType
  constructor (secretsManager: ISecretManagerService, logger: any, config: configType) {
    this.secretsManager = secretsManager
    this.secretsPath = config.secrets_path
    this.logger = logger
    this.config = config
  }

  async CIRAAuth (guid: string, username: string, password: string, cb: any): Promise<boolean> {
    try {
      // let user = await this.secretsManager.getSecretFromKey(`${this.secretsPath}devices/${guid}`, `username`);
      // let pwd = await this.secretsManager.getSecretFromKey(`${this.secretsPath}devices/${guid}`, `password`);
      let user, pwd
      if (this.config.use_global_mps_credentials) {
        // user = await this.secretsManager.getSecretFromKey(`${this.secretsPath}global`, `username`);
        // pwd = await this.secretsManager.getSecretFromKey(`${this.secretsPath}global`, `password`);

        // TODO: move this to vault.
        user = this.config.username
        pwd = this.config.pass

        if (username === user && password === pwd) {
          if (cb) {
            cb(true)
          }
          return
        }
        this.logger.info('invalid mps credentials')
        if (cb) cb(false)
      } else {
        user = await this.secretsManager.getSecretFromKey(`${this.secretsPath}devices/${guid}`, 'mps_username')
        pwd = await this.secretsManager.getSecretFromKey(`${this.secretsPath}devices/${guid}`, 'mps_password')

        if (username === user && password === pwd) {
          if (cb) {
            cb(true)
          }
          return
        }
        this.logger.info('invalid mps credentials')
        if (cb) cb(false)
      }
    } catch (error) {
      this.logger.error('Error while retrieving server credentials\r\n')
      this.logger.error(error)
      return false
    }
  }

  async getAmtPassword (guid: string): Promise<string[]> {
    try {
      const user = 'admin'
      const data: any = await this.secretsManager.getSecretAtPath(`${this.secretsPath}devices/${guid}`)
      const amtpass = data.data.AMT_PASSWORD
      return [user, amtpass]
    } catch (error) {
      this.logger.error('Error while retrieving device credentials\r\n')
      this.logger.error(error)
      return null
    }
  }

  async IsGUIDApproved (guid: string, cb: any): Promise<void> {
    try {
      let result = false
      const guids = await this.secretsManager.getSecretFromKey(`${this.secretsPath}global`, 'guids_allowlist')
      if (guids.includes(guid)) {
        result = true
      }
      if (cb) {
        cb(result)
      }
    } catch (error) {
      this.logger.error('Error while retrieving guids allowlist\r\n')
      this.logger.error(error)
    }
  }

  async IsOrgApproved (org: string, cb: any): Promise<void> {
    try {
      let result = false
      const orgs = await this.secretsManager.getSecretFromKey(`${this.secretsPath}global`, 'orgs_allowlist')

      if (orgs.includes(org)) {
        result = true
      }
      if (cb) {
        cb(result)
      }
    } catch (error) {
      this.logger.error('Error while retrieving org allowlist\r\n')
      this.logger.error(error)
      if (cb) {
        cb(null, 'error while retrieving org allowlist')
      }
    }
  }

  async getAllAmtCredentials (): Promise<Credentials> {
    try {
      try {
        const path = this.secretsPath.replace('data', 'metadata')
        const creds = await this.secretsManager.listSecretsAtPath(`${path}devices`)

        return creds.reduce((acc, cur) => {
          acc[cur] = {}
          return acc
        }, {})
      } catch (error) {
        this.logger.error('Error while retrieving org allowlist\r\n')
        this.logger.error(error)
      }
    } catch (error) {
      this.logger.error('Error while retrieving all amt device list\r\n')
      this.logger.error(error)
      return null
    }
  }
}
