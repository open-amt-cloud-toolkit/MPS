/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Implements amt handle registry
**********************************************************************/

import { IAmtHandler } from '../models/IAmtHandler'

export class AMTHandlerRegistrar {
  amtHandlers: any
  constructor () {
    this.amtHandlers = {}
  }

  registerHandler (handler: IAmtHandler): void {
    this.amtHandlers[handler.name] = handler
  }

  getHandler (name: string): IAmtHandler {
    return this.amtHandlers[name]
  }
}
