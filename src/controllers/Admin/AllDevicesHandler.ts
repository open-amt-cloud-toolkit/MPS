/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

import { Response, Request } from 'express'
import { logger as log } from '../../utils/logger'
import { IAdminHandler } from '../../models/IAdminHandler'
import { ErrorResponse } from '../../utils/amtHelper'
import { MPSMicroservice } from '../../mpsMicroservice'
import { Credentials, Device, DeviceMetadata } from '../../models/models'
import { Environment } from '../../utils/Environment'
import { DeviceDb } from '../../db/devices'

export class AllDevicesHandler implements IAdminHandler {
  mpsService: MPSMicroservice
  name: string

  constructor (mpsService: MPSMicroservice) {
    this.name = 'AllDevices'
    this.mpsService = mpsService
  }

  // Get existing device list from credentials file.
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
      let metadata: DeviceMetadata[] = []
      if (Environment.Config.use_db) {
        const db = new DeviceDb()
        metadata = await db.get()
      }
      const list: Device[] = []

      for (const i in amtCredentials) {
        list.push({
          amtuser: amtCredentials[i].amtuser,
          conn: this.mpsService.mpsComputerList[i] == null ? 0 : 1,
          host: i,
          mpsuser: amtCredentials[i].mpsuser,
          name: amtCredentials[i].name,
          metadata: metadata.find(z => z.guid === i) ?? {}
        })
      }
      res.json(list)
    } catch (error) {
      log.error(`Exception in All devices : ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed while it gets all devices.'))
    }
  }
}
