/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
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
import * as _ from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';

const ZOTERO_ENDPOINT = '/rest/extension/zotero/search/';

export function searchCitations(query: string): Kefir.Property<SparqlClient.Bindings> {
  const req = request
      .get(ZOTERO_ENDPOINT + decodeURIComponent(query))
      .accept('application/json');
  return Kefir.fromNodeCallback<request.Response>(
    req.end.bind(req)
  ).map(
    res =>
        _.map(
          res.body,
          x => _.transform(x as _.Dictionary<string>, (res: SparqlClient.Binding, value: string, key: string) => {
            res[key] = (key == 'link' || key == 'url') ? Rdf.iri(value) : Rdf.literal(value);
            return res;
          })
        )
  ).toProperty();
}
