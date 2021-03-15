/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to get amt device audit logs
**********************************************************************/

import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { IAmtHandler } from '../../models/IAmtHandler'
import { MPSMicroservice } from '../../mpsMicroservice'
import { amtPort } from '../../utils/constants'
import { ErrorResponse } from '../../utils/amtHelper'
import AMTStackFactory from '../../amt_libraries/amt-connection-factory.js'

export class HardwareInfoHandler implements IAmtHandler {
  mpsService: MPSMicroservice
  name: string
  amtFactory: any

  constructor (mpsService: MPSMicroservice) {
    this.name = 'HardwareInformation'
    this.mpsService = mpsService
    this.amtFactory = new AMTStackFactory(this.mpsService)
  }

  async AmtAction (req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body.payload
      if (payload.guid) {
        let ciraconn = await this.mpsService.CiraConnectionFactory.getConnection(payload.guid)
        if (ciraconn && ciraconn.readyState == 'open') {
          const cred = await this.mpsService.db.getAmtPassword(payload.guid)
          const amtstack = this.amtFactory.getAmtStack(payload.guid, amtPort, cred[0], cred[1], 0)
          amtstack.BatchEnum('', ['*CIM_ComputerSystemPackage',
            'CIM_SystemPackaging', '*CIM_Chassis', 'CIM_Chip', '*CIM_Card', '*CIM_BIOSElement',
            'CIM_Processor', 'CIM_PhysicalMemory', 'CIM_MediaAccessDevice', 'CIM_PhysicalPackage'],
          (stack, name, responses, status) => {
            //stack.wsman.comm.socket.sendchannelclose()
            if (status != 200) {
              log.error(`Request failed during AMTHardware Information BatchEnum Exec for guid : ${payload.guid}.`)
              return res.status(status).send(ErrorResponse(status, `Request failed during AMTHardware Information BatchEnum Exec for guid : ${payload.guid}.`))
            } else {
            // console.log("Hardware info of " + uuid + " sent.");
              res.send(responses)
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
      log.error(`Exception in AMT HardwareInformation : ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed during AMTHardware Information.'))
    }
  }
}
