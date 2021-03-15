/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/
export interface Device {
  amtuser: string
  mpsuser: string
  name: string
  conn: number
  host: string
  metadata: DeviceMetadata | {}
}
export interface Credentials {
  [key: string]: AMTCredential
}
export interface AMTCredential {
  name: string
  mpsuser: string
  mpspass: string
  amtuser: string
  amtpass: string
}

export interface DeviceMetadata{
  guid: string
  tags: string[]
  hostname: string
}
