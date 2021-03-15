/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/
import { DeviceDb } from '../../db/devices'
import { logger as log } from '../../utils/logger'

export async function deleteDevice (req, res): Promise<void> {
  const db = new DeviceDb()
  try {
    await db.delete(req.params.id)
    res.status(204).end()
  } catch (err) {
    log.error(err)
    res.status(500).end()
  }
}
