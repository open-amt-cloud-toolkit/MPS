/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Handler to download MPS root certificate
**********************************************************************/

import { logger as log } from '../../utils/logger'
import { IAdminHandler } from '../../models/IAdminHandler'
import * as fs from 'fs'
import * as path from 'path'
import { Response, Request } from 'express'
import { ErrorResponse } from '../../utils/amtHelper'

export class MPSRootCertHandler implements IAdminHandler {
  name: string

  constructor () {
    this.name = 'MPSRootCertificate'
  }

  // Get list of CIRA connected devices.
  // For the server version of Mesh Commander, we send the computer list without credential and insertion credentials in the stream.
  async adminAction (req: Request, res: Response): Promise<void> {
    try {
      const certPath = path.join(__dirname, '../../../private/root-cert-public.crt')
      if (fs.existsSync(certPath)) {
        res.send(fs.readFileSync(certPath))
      } else {
        res.status(500).send(ErrorResponse(500, 'MPS root certificate does not exists.'))
      }
    } catch (error) {
      log.error(`Exception while downloading MPS root certificate: ${error}`)
      res.status(500).send(ErrorResponse(500, 'Request failed while downloading MPS root certificate.'))
    }
  }
}
