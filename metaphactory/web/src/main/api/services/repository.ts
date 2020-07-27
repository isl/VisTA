/*
 * Copyright (C) 2015-2017, metaphacts GmbH
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import * as Kefir from 'kefir';
import * as request from 'superagent';
import * as Immutable from 'immutable';

const ENDPOINT = '/rest/repositories';

export function getRepositoryStatus(): Kefir.Property<Immutable.Map<string, boolean>> {
  const req = request.get(ENDPOINT)
    .type('application/json')
    .accept('application/json');
  return Kefir.fromNodeCallback(
    (cb) => req.end((err, res) => cb(err, res.body))
  ).map(status => Immutable.Map(status)).toProperty();
}
