/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to get power capabilities of amt device
**********************************************************************/

import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { IAmtHandler } from '../../models/IAmtHandler'
import { MPSMicroservice } from '../../mpsMicroservice'
import { ErrorResponse } from '../../utils/amtHelper'
import { amtPort } from '../../utils/constants'
import AMTStackFactory from '../../amt_libraries/amt-connection-factory.js'

export class PowerCapabilitiesHandler implements IAmtHandler {
  mpsService: MPSMicroservice
  name: string
  amtFactory: any

  constructor (mpsService: MPSMicroservice) {
    this.name = 'PowerCapabilities'
    this.mpsService = mpsService
    this.amtFactory = new AMTStackFactory(this.mpsService)
  }

  async AmtAction (req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body.payload
      if (payload.guid) {
        const ciraconn = await this.mpsService.CiraConnectionFactory.getConnection(payload.guid)
        if (ciraconn && ciraconn.readyState == 'open') {
          const cred = await this.mpsService.db.getAmtPassword(payload.guid)
          const amtstack = this.amtFactory.getAmtStack(payload.guid, amtPort, cred[0], cred[1], 0)
          this.getVersion(amtstack, res, (responses, res) => {
            const versionData = responses
            amtstack.Get('AMT_BootCapabilities', async (stack, name, responses, status) => {
              if (status !== 200) {
                log.error(`Request failed during GET AMT_BootCapabilities for guid : ${payload.guid}`)
                return res.status(status).send(ErrorResponse(status, `Request failed during GET AMT_BootCapabilities for guid : ${payload.guid}`))
              }
              // console.log("AMT_BootCapabilities info of " + uuid + " sent.");
              const powerCap = await this.bootCapabilities(versionData, responses.Body)
              return res.send(powerCap)
            }, 0, 1)
          })
        } else {
          res.set({ 'Content-Type': 'application/json' })
          return res.status(404).send(ErrorResponse(404, `guid : ${payload.guid}`, 'device'))
        }
      } else {
        res.set({ 'Content-Type': 'application/json' })
        return res.status(404).send(ErrorResponse(404, null, 'guid'))
      }
    } catch (error) {
      log.error(`Exception in AMT PowerCapabilities : ${error}`)
      return res.status(500).send(ErrorResponse(500, 'Request failed during AMT PowerCapabilities.'))
    }
  }

  // Return Boot Capabilities
  bootCapabilities (amtVersionData, response): any {
    const amtversion = this.parseVersionData(amtVersionData)
    const data: any = { 'Power up': 2, 'Power cycle': 5, 'Power down': 8, Reset: 10 }
    if (amtversion > 9) {
      data['Soft-off'] = 12
      data['Soft-reset'] = 14
      data.Sleep = 4
      data.Hibernate = 7
    }
    if (response.BIOSSetup === true) {
      data['Power up to BIOS'] = 100
      data['Reset to BIOS'] = 101
    }
    if (response.SecureErase === true) {
      data['Reset to Secure Erase'] = 104
    }
    data['Reset to IDE-R Floppy'] = 200
    data['Power on to IDE-R Floppy'] = 201
    data['Reset to IDE-R CDROM'] = 202
    data['Power on to IDE-R CDROM'] = 203
    if (response.ForceDiagnosticBoot === true) {
      data['Power on to diagnostic'] = 300
      data['Reset to diagnostic'] = 301
    }
    data['Reset to PXE'] = 400
    data['Power on to PXE'] = 401
    return data
  }

  // Parse Version Data
  parseVersionData (amtVersionData): number {
    const verList = amtVersionData.CIM_SoftwareIdentity.responses
    for (const i in verList) {
      if (verList[i].InstanceID === 'AMT') {
        return parseInt(verList[i].VersionString.split('.')[0])
      }
    }
  }

  // Returns AMT version data
  getVersion (amtstack, res, func): void {
    try {
      amtstack.BatchEnum('', ['CIM_SoftwareIdentity', '*AMT_SetupAndConfigurationService'],
        function (stack, name, responses, status) {
          //stack.wsman.comm.socket.sendchannelclose()
          if (status !== 200) {
            res.status(status).send(ErrorResponse(status, 'Request failed during AMTVersion BatchEnum Exec.'))
            return
          }
          if (!func) {
            res.send(JSON.stringify(responses))
          } else {
            func(responses, res)
          }
        })
    } catch (ex) {
      res.status(500).send(ErrorResponse(500, 'Request failed during AMTVersion BatchEnum Exec.'))
    }
  }
}
