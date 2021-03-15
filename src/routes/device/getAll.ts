/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/
import { DeviceDb } from '../../db/devices'
import { logger as log } from '../../utils/logger'

export async function getAll (req, res): Promise<void> {
  const db = new DeviceDb()
  try {
    const results = await db.get()
    res.status(200).json(results).end()
  } catch (err) {
    log.error(err)
    res.status(500).end()
  }
}
