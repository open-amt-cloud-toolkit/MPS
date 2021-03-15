/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Routes all the amt endpoint post calls
**********************************************************************/

import { amtController } from '../controllers/amtController'
import { MPSMicroservice } from '../mpsMicroservice'
import { RootContainer } from '../dependencyHandlers/RootContainer'
import { AMTHandlerRegistrar } from '../dependencyHandlers/AMTHandlerRegistrar'
import * as express from 'express'

export class AMTRoutes {
  mpsService: MPSMicroservice
  container: RootContainer
  amtController: amtController
  AMTHandlerRegistrar: AMTHandlerRegistrar
  router: any
  constructor (mpsService: MPSMicroservice) {
    this.mpsService = mpsService
    amtController.init(this.mpsService)
    this.router = express.Router()
    this.buildRoutes()
  }

  buildRoutes (): any {
    this.router.post('/', amtController.HandlePostRoute)
  }
}
