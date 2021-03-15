/*********************************************************************
* Copyright (c) Intel Corporation 2019
* SPDX-License-Identifier: Apache-2.0
* Description: Registers both admin and amt handlers
**********************************************************************/

import { IAdminHandler } from '../models/IAdminHandler'
import { IAmtHandler } from '../models/IAmtHandler'

import { AdminHandlerRegistrar } from '../dependencyHandlers/AdminHandlerRegistrar'
import { AMTHandlerRegistrar } from '../dependencyHandlers/AMTHandlerRegistrar'
import { MPSMicroservice } from '../mpsMicroservice'

import { ConnectedDeviceHandler } from '../controllers/Admin/ConnectedDeviceHandler'
import { AllDevicesHandler } from '../controllers/Admin/AllDevicesHandler'
import { DisconnectHandler } from '../controllers/Admin/DisconnectHandler'
import { MEScriptHandler } from '../controllers/Admin/MEScriptHandler'
import { MPSRootCertHandler } from '../controllers/Admin/MPSRootCertHandler'

import { GeneralSettingsHandler } from '../controllers/AMT/GeneralSettingsHandler'
import { HardwareInfoHandler } from '../controllers/AMT/HardwareInfoHandler'
import { PowerCapabilitiesHandler } from '../controllers/AMT/PowerCapabilitiesHandler'
import { PowerStateHandler } from '../controllers/AMT/PowerStateHandler'
import { VersionHandler } from '../controllers/AMT/VersionHandler'
import { AuditLogHandler } from '../controllers/AMT/AuditLogHandler'
import { EventLogHandler } from '../controllers/AMT/EventLogHandler'
import { PowerActionHandler } from '../controllers/AMT/PowerActionHandler'
import { SetAMTFeaturesHandler } from '../controllers/AMT/SetAMTFeaturesHandler'
import { GetAMTFeaturesHandler } from '../controllers/AMT/GetAMTFeaturesHandler'

export class RootContainer {
  adminRegistrar: AdminHandlerRegistrar
  amtRegistrar: AMTHandlerRegistrar
  mpsService: MPSMicroservice

  /**
     *
     */
  constructor (mpsService: MPSMicroservice) {
    this.mpsService = mpsService
    this.adminRegistrar = new AdminHandlerRegistrar()
    this.amtRegistrar = new AMTHandlerRegistrar()
  }

  addAdminHandler (handler: IAdminHandler): void {
    this.adminRegistrar.registerHandler(handler)
  }

  addAmtHandler (handler: IAmtHandler): void {
    this.amtRegistrar.registerHandler(handler)
  }

  adminBuild (): void {
    this.addAdminHandler(new ConnectedDeviceHandler(this.mpsService))
    this.addAdminHandler(new AllDevicesHandler(this.mpsService))
    this.addAdminHandler(new DisconnectHandler(this.mpsService))
    this.addAdminHandler(new MEScriptHandler(this.mpsService))
    this.addAdminHandler(new MPSRootCertHandler())
  }

  amtBuild (): void {
    this.addAmtHandler(new GeneralSettingsHandler(this.mpsService))
    this.addAmtHandler(new HardwareInfoHandler(this.mpsService))
    this.addAmtHandler(new VersionHandler(this.mpsService))
    this.addAmtHandler(new PowerActionHandler(this.mpsService))
    this.addAmtHandler(new PowerCapabilitiesHandler(this.mpsService))
    this.addAmtHandler(new PowerStateHandler(this.mpsService))
    this.addAmtHandler(new AuditLogHandler(this.mpsService))
    this.addAmtHandler(new EventLogHandler(this.mpsService))
    this.addAmtHandler(new SetAMTFeaturesHandler(this.mpsService))
    this.addAmtHandler(new GetAMTFeaturesHandler(this.mpsService))
  }
}
