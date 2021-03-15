/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to get amt device version
**********************************************************************/

import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { IAmtHandler } from '../../models/IAmtHandler'
import { MPSMicroservice } from '../../mpsMicroservice'
import { amtPort } from '../../utils/constants'
import { ErrorResponse } from '../../utils/amtHelper'
import AMTStackFactory from '../../amt_libraries/amt-connection-factory.js'

export class VersionHandler implements IAmtHandler {
  mpsService: MPSMicroservice
  name: string
  amtFactory: any

  constructor (mpsService: MPSMicroservice) {
    this.name = 'Version'
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
          amtstack.BatchEnum('', ['CIM_SoftwareIdentity', '*AMT_SetupAndConfigurationService'],
            (stack, name, responses, status) => {
              //stack.wsman.comm.socket.sendchannelclose()
              if (status == 200) {
                return res.send(responses)
              } else {
                log.error(`Request failed during AMTVersion BatchEnum Exec for guid : ${payload.guid}.`)
                res.status(status).send(ErrorResponse(status, `Request failed during AMTVersion BatchEnum Exec for guid : ${payload.guid}.`))
              }
            })
        } else {
          res.set({ 'Content-Type': 'application/json' })
          res.status(404).send(ErrorResponse(404, `guid : ${payload.guid}`, 'device'))
        }
      } else {
        res.set({ 'Content-Type': 'application/json' })
        res.status(404).send(ErrorResponse(404, null, 'guid'))
      }
    } catch (error) {
      log.error(`Exception in AMT Version : ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed during AMTVersion BatchEnum Exec.'))
    }
  }
}
