/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to get the connected devices to MPS
**********************************************************************/

import { logger as log } from '../../utils/logger'
import { IAdminHandler } from '../../models/IAdminHandler'
import { Response, Request } from 'express'
import { MPSMicroservice } from '../../mpsMicroservice'
import { Credentials } from '../../models/models'

export class ConnectedDeviceHandler implements IAdminHandler {
  mpsService: MPSMicroservice
  name: string

  constructor (mpsService: MPSMicroservice) {
    this.name = 'ConnectedDevices'
    this.mpsService = mpsService
  }

  // Get list of CIRA connected devices.
  // For the server version of Mesh Commander, we send the computer list without credential and insertion credentials in the stream.
  async adminAction (req: Request, res: Response): Promise<void> {
    try {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      })
      let amtCredentials: Credentials = {}
      try {
        amtCredentials = await this.mpsService.db.getAllAmtCredentials()
      } catch (e) {
        log.error(e)
      }
      const list = []
      for (const i in this.mpsService.mpsComputerList) {
        list.push({
          amtuser: amtCredentials[i].amtuser,
          conn: 1,
          host: i,
          mpsuser: amtCredentials[i].amtuser ?? this.mpsService.mpsComputerList[i].amtuser,
          name: amtCredentials[i].name
        })
      }
      res.json(list)
    } catch (error) {
      log.error(`Exception in Connected devices: ${error}`)
    }
  }
}
