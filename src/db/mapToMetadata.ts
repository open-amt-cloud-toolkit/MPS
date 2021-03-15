/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/
import { DeviceMetadata } from '../models/models'

export function mapToMetadata (result): DeviceMetadata {
  return {
    guid: result.guid,
    hostname: result.hostname,
    tags: result.tags
  }
}
