/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to download Mescript
**********************************************************************/

// import * as fs from "fs";
import * as path from 'path'
import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { ErrorResponse } from '../../utils/amtHelper'
import { IAdminHandler } from '../../models/IAdminHandler'
import { MPSMicroservice } from '../../mpsMicroservice'
import { CreateAmtScriptEngine } from '../../utils/amtscript.js'

import fs from 'fs'
const scriptEngine = CreateAmtScriptEngine()

export class MEScriptHandler implements IAdminHandler {
  mps: MPSMicroservice
  name: string

  constructor (mps: MPSMicroservice) {
    this.name = 'MEScript'
    this.mps = mps
  }

  // Get list of CIRA connected devices.
  // For the server version of Mesh Commander, we send the computer list without credential and insertion credentials in the stream.
  async adminAction (req: Request, res: Response): Promise<void> {
    try {
      const filepath = path.join(__dirname, '../../../agent/cira_setup_script_dns.mescript')
      if (fs.existsSync(filepath)) {
        fs.readFile(filepath, (err, data) => {
          if (err) {
            log.error(err)
            res
              .status(500)
              .send(ErrorResponse(500, 'Request failed while downloading MEScript.'))
            return
          }
          const scriptFile = JSON.parse(Buffer.from(data).toString())

          // Change a few things in the script
          scriptFile.scriptBlocks[2].vars.CertBin.value = (process.env.ROOT_CA_CERT
            ? this.base64(process.env.ROOT_CA_CERT)
            : this.getRootCertBase64(
              path.join(__dirname, '../../../private/root-cert-public.crt')
            )) // Set the root certificate
          scriptFile.scriptBlocks[3].vars.FQDN.value = this.mps.config.common_name // Set the server DNS name
          scriptFile.scriptBlocks[3].vars.Port.value = this.mps.config.port // Set the server MPS port
          scriptFile.scriptBlocks[3].vars.username.value = this.mps.config.username // Set the username
          scriptFile.scriptBlocks[3].vars.password.value = this.mps.config.pass // Set the password
          scriptFile.scriptBlocks[4].vars.AccessInfo1.value = `${this.mps.config.common_name}:${this.mps.config.port}` // Set the primary server name:port to set periodic timer
          scriptFile.scriptBlocks[6].vars.DetectionStrings.value = 'dummy.com' // Set the environment detection local FQDN's

          // Compile the script
          const runscript = scriptEngine.script_blocksToScript(
            scriptFile.blocks,
            scriptFile.scriptBlocks
          )
          scriptFile.mescript = Buffer.from(scriptEngine.script_compile(runscript), 'binary').toString('base64')
          scriptFile.scriptText = runscript
          res.send(JSON.stringify(scriptFile, null, 3))
        })
      }
    } catch (error) {
      log.error(`Exception while downloading MEScript: ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed while downloading MEScript.'))
    }
  }

  base64 (rootcert): string {
    try {
      // console.log(rootcert)
      let i: number = rootcert.indexOf('-----BEGIN CERTIFICATE-----')
      if (i >= 0 && rootcert.charAt(i + 27) === '\r') {
        // console.log('CRLF linefeed')
        i = 27 + 2
      } else if (i >= 0 && rootcert.charAt(i + 27) === '\n') {
        // console.log('LF linefeed')
        i = 27 + 1
      }
      if (i >= 0) {
        rootcert = rootcert.substring(i)
      }
      i = rootcert.indexOf('-----END CERTIFICATE-----')
      if (i >= 0) {
        rootcert = rootcert.substring(i, 0)
      }
      // console.log(rootcert)
      const result = Buffer.from(rootcert, 'base64').toString('base64')
      // console.log(result)
      return result
    } catch (error) {
      log.error(`Exception in getRootCertBase64 : ${error}`)
    }
    return ''
  }

  getRootCertBase64 (path): string {
    try {
      if (fs.existsSync(path)) {
        const rootcert = fs.readFileSync(path, 'utf8')
        return this.base64(rootcert)
      }
    } catch (error) {
      log.error(`Exception in getRootCertBase64 : ${error}`)
    }
    return ''
  }
}
