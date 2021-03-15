/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Implements admin handle registry
**********************************************************************/

import { IAdminHandler } from '../models/IAdminHandler'

export class AdminHandlerRegistrar {
  adminHandlers: any
  constructor () {
    this.adminHandlers = {}
  }

  registerHandler (handler: IAdminHandler): void {
    this.adminHandlers[handler.name] = handler
  }

  getHandler (name: string): IAdminHandler {
    return this.adminHandlers[name]
  }
}
