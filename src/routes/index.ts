/*********************************************************************
* Copyright (c) Intel Corporation 2021
* SPDX-License-Identifier: Apache-2.0
**********************************************************************/

import { Router } from 'express'
import deviceRouter from './device/index'

const router: Router = Router()
router.use('/', deviceRouter)

export default router
