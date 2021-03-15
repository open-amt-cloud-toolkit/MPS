/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to get amt device event logs
**********************************************************************/

import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { IAmtHandler } from '../../models/IAmtHandler'
import { MPSMicroservice } from '../../mpsMicroservice'
import AMTStackFactory from '../../amt_libraries/amt-connection-factory.js'
import { amtPort } from '../../utils/constants'
import { ErrorResponse } from '../../utils/amtHelper'

export class EventLogHandler implements IAmtHandler {
  mpsService: MPSMicroservice
  name: string
  amtFactory: any

  constructor (mpsService: MPSMicroservice) {
    this.name = 'EventLog'
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
          amtstack.GetMessageLog(function (stack, responses, tag, status) {
            //stack.wsman.comm.socket.sendchannelclose()
            if (status == 200) {
              return res.send(responses)
            } else {
              log.error(`Failed during GET MessageLog guid : ${payload.guid}.`)
              res.status(status).send(ErrorResponse(status, `Failed during GET MessageLog guid : ${payload.guid}.`))
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
      log.error(`Exception in AMT EventLog: ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed during AMT EventLog.'))
    }
  }
}
