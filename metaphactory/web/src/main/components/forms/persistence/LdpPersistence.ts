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

import * as Immutable from 'immutable';
import * as Kefir from 'kefir';
import * as request from 'superagent';
import {cloneDeep} from 'lodash';

import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { FinalizedModel } from '../FieldValues';
import { parseQueryStringAsUpdateOperation } from './PersistenceUtils';
import { TriplestorePersistence } from './TriplestorePersistence';

export class LdpPersistence implements TriplestorePersistence {
  persist(initialModel: FinalizedModel, currentModel: FinalizedModel): Kefir.Property<void> {
    const listOfConstructs = this.createFormConstructQueries(currentModel);
    return this.sendConstructsToBackend(currentModel.subject, listOfConstructs.toArray());
  }

  createFormConstructQueries(
    currentModel: FinalizedModel
  ): Immutable.List<SparqlJs.ConstructQuery> {
    return Immutable.List(currentModel.values
      .filter(value => value.definition.insertPattern)
      .map(value => {
        const insertQuery = parseQueryStringAsUpdateOperation(value.definition.insertPattern);
        return this.createFieldConstructQueries(
          insertQuery,
          value.values,
          value.subject,
        );
      })
    ).filter(updates => updates.size > 0).flatten().toList();
  }

  /**
   * Takes an SPARQL insert query and turns it into an construct query.
   * The query will be parameterize as many times as number of newValues (will parameterize $value),
   * producing a list of SPARQL construct queries. All queries will be
   * additionally parameterized by the supplied $subject value.
   */
  createFieldConstructQueries(
    insertQuery: SparqlJs.Update | undefined,
    newValues: ReadonlyArray<Rdf.Node>,
    subject: Rdf.Iri
  ): Immutable.List<SparqlJs.ConstructQuery> {

    let constructQueries = Immutable.List<SparqlJs.ConstructQuery>();
    if (!insertQuery) {
      return constructQueries;
    }

    const constructQuery: SparqlJs.ConstructQuery = {
      type: 'query',
      prefixes: {},
      queryType: 'CONSTRUCT',
    };

    const insertDeleteOperations = (<SparqlJs.InsertDeleteOperation[]> insertQuery.updates);

    // According to the SPARQL standard there can be several update operations
    // separated by ; i.e. INSERT {} WHERER{}; INSERT {} WHERER{}
    // However, in forms we always expect a single operation i.e. INSERT clause
    if ( insertDeleteOperations.length !== 1 ) {
      // TODO error handling here ?
      return constructQueries;
    }

    const updateOperation = insertDeleteOperations.pop();

    // TODO silently filtering, logging, error ?
    constructQuery.template = updateOperation.insert.filter(
      // first filter all bgp patters i.e. insert may also be SparqlJs.GraphPattern
      // which is not supported in template of SparqlJs.ConstructQuery
      p => p.type === 'bgp'
    ).reduce(
      (ar: SparqlJs.Triple[], p) =>
        ar.concat(cloneDeep(<SparqlJs.BgpPattern>p).triples), new Array<SparqlJs.Triple>()
    );

    // clone the where part from the insert query to the construct query
    constructQuery.where = cloneDeep(updateOperation.where);

    // parameterization of $subject and $value
    const paramterize = (query: SparqlJs.ConstructQuery, value: Rdf.Node) =>
      SparqlClient.setBindings(query, {
        'subject': subject,
        'value': value,
      });

    if (constructQuery) {
      constructQueries = constructQueries.concat(
        newValues.map(value => paramterize(constructQuery, value))
      );
    }
    return constructQueries;
  }

  sendConstructsToBackend(
    subject: Rdf.Iri, queries: SparqlJs.ConstructQuery[]
  ): Kefir.Property<void> {
    // convert the array of SparqlJs.Update objects to plain strings
    const stringQueries: string [] = queries.map(SparqlUtil.serializeQuery);

    // TODO
    console.log(stringQueries);

    const req = request
      .post('/form-persistence/ldp')
      .type('application/json')
      .query({iri: subject.value})
      .send(stringQueries);
    return Kefir.fromNodeCallback<void>(
       (cb) => req.end((err, res) => cb(err, res.body))
    ).toProperty();
  }
}

export default new LdpPersistence();
