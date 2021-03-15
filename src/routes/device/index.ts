/*********************************************************************
 * Copyright (c) Intel Corporation 2021
 * SPDX-License-Identifier: Apache-2.0
 **********************************************************************/

import { Router } from 'express'
import { insertDevice } from './create'
import { deleteDevice } from './delete'
import { get } from './get'
import { getAll } from './getAll'
import { updateDevice } from './update'

const deviceRouter: Router = Router()

deviceRouter.get('/', getAll)
deviceRouter.get('/:id', get)
deviceRouter.post('/', insertDevice)
deviceRouter.patch('/', updateDevice)
deviceRouter.delete('/:id', deleteDevice)

export default deviceRouter
