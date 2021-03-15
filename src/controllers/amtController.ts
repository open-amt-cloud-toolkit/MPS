/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: handles all the amt endpoint calls
**********************************************************************/

import { RootContainer } from '../dependencyHandlers/RootContainer'
import { ErrorResponse } from '../utils/amtHelper'
import { Response, Request } from 'express'

export class amtController {
  static container: RootContainer

  static init (mps): void {
    amtController.container = new RootContainer(mps)
    amtController.container.amtBuild()
  }

  static async HandlePostRoute (req: Request, res: Response): Promise<void> {
    const method = req.body.method || ''
    if (method) {
      const payload = req.body.payload || ''
      if (payload) {
        const handler = amtController.container.amtRegistrar.getHandler(method)
        if (handler) {
          await handler.AmtAction(req, res)
        } else {
          res.status(404).send(ErrorResponse(404, null, 'noMethod'))
        }
      } else {
        res.status(404).send(ErrorResponse(404, null, 'payload'))
      }
    } else {
      res.status(404).send(ErrorResponse(404, null, 'method'))
    }
  }
}
