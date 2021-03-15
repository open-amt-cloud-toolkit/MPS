/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: MPS and Web Server TLS Configuration Interface
**********************************************************************/

import * as path from 'path'
import * as fs from 'fs'

import { logger as log } from './logger'
import { mpsConfigType, webConfigType, directConfigType } from '../models/Config'
import { constants } from 'crypto'

const webTlsConfigPath = path.join(__dirname, '../../private/webtlsconfig.json')
const mpsTlsConfigPath = path.join(__dirname, '../../private/mpstlsconfig.json')
const directConnTlsConfigPath = path.join(__dirname, '../../private/directConntlsconfig.json')
export class tlsConfig {
  static web (): webConfigType {
    try {
      let webConfig: webConfigType
      // Parse Web TLS Configuration json file
      try {
        if (fs.existsSync(webTlsConfigPath)) {
          webConfig = JSON.parse(fs.readFileSync(webTlsConfigPath, 'utf8'))
        } else {
          log.error(`webtls config file does not exists ${webTlsConfigPath}`)
          return
        }
      } catch (ex) {
        log.error('Failed to parse json file. Exception:', ex.message)
        process.exit()
      }

      for (const i in webConfig) {
        if (webConfig[i] == null) {
          delete webConfig[i]
        }
        if (webConfig[i] instanceof Array) {
          if (webConfig[i].length === 0) {
            delete webConfig[i]
            continue
          }
        }
      }

      // Load SSL Cert and key
      if (webConfig.key && webConfig.cert) {
        if (
          !fs.existsSync(path.join(__dirname, webConfig.key)) &&
          !fs.existsSync(path.join(__dirname, webConfig.cert))
        ) {
          log.error('Error: TLS certificate or private key does not exist.')
          process.exit()
        } else {
          webConfig.key = fs.readFileSync(
            path.join(__dirname, webConfig.key),
            'utf8'
          )
          webConfig.cert = fs.readFileSync(
            path.join(__dirname, webConfig.cert),
            'utf8'
          )
        }
      } else {
        log.error(
          'Error: WebServer Configuration missing either TLS Cert or Private Key.'
        )
        process.exit()
      }

      // Load CA certificates
      if (webConfig.ca) {
        const caCertLocationArr = webConfig.ca
        const caCertArr = []
        for (let i: number = 0; i < caCertLocationArr.length; i++) {
          if (!fs.existsSync(path.join(__dirname, caCertLocationArr[i]))) {
            caCertArr.push(
              fs.readFileSync(
                path.join(__dirname, caCertLocationArr[i]),
                'utf8'
              )
            )
          }
        }
        webConfig.ca = caCertArr
      } else {
        log.error('Error: WebServer Configuration missing CA Certificate')
        process.exit()
      }

      // Perform 'OR' operation between SecureOptions
      // Example: { secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3 |  constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv11}
      if (webConfig.secureOptions) {
        if (webConfig.secureOptions.length === 1) {
          // No need of 'OR' if only one option
          webConfig.secureOptions = webConfig.secureOptions[0]
        } else {
          const optionArr = webConfig.secureOptions
          let secoption: any = constants[optionArr[0]] | constants[optionArr[1]]
          for (let i: number = 2; i < optionArr.length; i++) {
            secoption = secoption | constants[optionArr[i]]
          }
          webConfig.secureOptions = secoption
        }
      }
      return webConfig
    } catch (ex) {
      log.error('Web TLS webConfiguration exception:', ex)
      process.exit()
    }
  }

  static mps (): mpsConfigType {
    try {
      let mpsConfig: mpsConfigType
      // Parse MPS TLS Configuration json file
      try {
        if (fs.existsSync(mpsTlsConfigPath)) {
          mpsConfig = JSON.parse(fs.readFileSync(mpsTlsConfigPath, 'utf8'))
        } else {
          log.error(`webtls config file does not exists ${mpsTlsConfigPath}`)
          return
        }
      } catch (ex) {
        log.error('Failed to parse json file. Exception:', ex.message)
        process.exit()
      }

      // Delete elements that are null
      for (const i in mpsConfig) {
        if (mpsConfig[i] == null) {
          delete mpsConfig[i]
          continue
        }
        if (mpsConfig[i] instanceof Array) {
          if (mpsConfig[i].length === 0) {
            delete mpsConfig[i]
            continue
          }
        }
      }

      // Load SSL Cert and key
      if (mpsConfig.key && mpsConfig.cert) {
        if (
          !fs.existsSync(path.join(__dirname, mpsConfig.key)) ||
          !fs.existsSync(path.join(__dirname, mpsConfig.cert))
        ) {
          log.error('Error: TLS cerficate or private key does not exist.')
          process.exit()
        } else {
          mpsConfig.key = fs.readFileSync(
            path.join(__dirname, mpsConfig.key),
            'utf8'
          )
          mpsConfig.cert = fs.readFileSync(
            path.join(__dirname, mpsConfig.cert),
            'utf8'
          )
        }
      } else {
        log.error(
          'Error: MPS Configuration missing either TLS Cert or Private Key.'
        )
        process.exit()
      }

      // Perform 'OR' operation between SecureOptions
      // Example: { secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3 |  constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv11}
      if (mpsConfig.secureOptions) {
        if (mpsConfig.secureOptions.length === 1) {
          // No need of 'OR' if only one option
          mpsConfig.secureOptions = mpsConfig.secureOptions[0]
        } else {
          const optionArr = mpsConfig.secureOptions
          let secoption: any =
            constants[optionArr[0]] | constants[optionArr[1]]
          for (let i: number = 2; i < optionArr.length; i++) {
            secoption = secoption | constants[optionArr[i]]
          }
          mpsConfig.secureOptions = secoption
        }
      }
      return mpsConfig
    } catch (ex) {
      log.error('Exception mpsTLSConfiguration:', ex.message)
      process.exit()
    }
  }

  static direct (): directConfigType {
    try {
      let directConnConfig: directConfigType
      // Parse MPS TLS Configuration json file
      try {
        if (fs.existsSync(directConnTlsConfigPath)) {
          directConnConfig = JSON.parse(fs.readFileSync(directConnTlsConfigPath, 'utf8'))
        } else {
          log.error(`directtls config file does not exists ${directConnTlsConfigPath}`)
          return
        }
      } catch (ex) {
        log.error('Failed to parse json file. Exception:', ex.message)
        process.exit()
      }

      // Load SSL Cert and key
      if (directConnConfig.key && directConnConfig.cert && directConnConfig.ca) {
        if (!fs.existsSync(path.join(__dirname, directConnConfig.key)) || !fs.existsSync(path.join(__dirname, directConnConfig.cert))) {
          log.error('Error: TLS cerficate or private key does not exist.')
          process.exit()
        } else {
          directConnConfig.key = fs.readFileSync(path.join(__dirname, directConnConfig.key), 'utf8')
          directConnConfig.cert = fs.readFileSync(path.join(__dirname, directConnConfig.cert), 'utf8')
          directConnConfig.ca = fs.readFileSync(path.join(__dirname, directConnConfig.ca), 'utf8')
        }
      } else {
        log.error('Error: Direct Connection Configuration missing either TLS Cert or Private Key.')
        process.exit()
      }
      if (directConnConfig.secureOptions) {
        const optionArr = directConnConfig.secureOptions
        let secoption: any = constants[optionArr[0]] | constants[optionArr[1]]
        for (let i: number = 2; i < optionArr.length; i++) {
          secoption = secoption | constants[optionArr[i]]
        }
        directConnConfig.secureOptions = secoption
      }
      return directConnConfig
    } catch (ex) {
      log.error('Exception directTLSConfiguration:', ex.message)
      process.exit()
    }
  }
}
