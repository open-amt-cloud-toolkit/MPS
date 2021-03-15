/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/
import { DeviceMetadata } from '../models/models'

export interface IDeviceDb {
  get: () => Promise<DeviceMetadata[]>
  getById: (guid: string) => Promise<DeviceMetadata>
  delete: (guid: string) => Promise<boolean>
  insert: (data: DeviceMetadata) => Promise<DeviceMetadata>
  update: (data: DeviceMetadata) => Promise<DeviceMetadata>
}
