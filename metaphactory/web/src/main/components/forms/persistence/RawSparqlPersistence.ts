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

import { Rdf } from 'platform/api/rdf';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';

import { FinalizedModel } from '../FieldValues';
import { parseQueryStringAsUpdateOperation } from './PersistenceUtils';
import { TriplestorePersistence, valuesDifference } from './TriplestorePersistence';

export class RawSparqlPersistence implements TriplestorePersistence {
  persist(
    initialModel: FinalizedModel,
    currentModel: FinalizedModel
  ): Kefir.Property<void> {
    const updateQueries = createFormUpdateQueries(initialModel, currentModel);
    if (updateQueries.size === 0) {
      return Kefir.constant<void>(undefined);
    }
    updateQueries.forEach(query => {
      console.log(SparqlUtil.serializeQuery(query));
    });
    const updateOperations = Kefir.zip<void>(updateQueries.map(
      query => SparqlClient.executeSparqlUpdate(query)).toArray());
    return updateOperations.map(() => {/* void */}).toProperty();
  }
}

export function createFormUpdateQueries(
  intialModel: FinalizedModel,
  currentModel: FinalizedModel
): Immutable.List<SparqlJs.Update> {
  const initialValues = intialModel.values;
  const currentValues = currentModel.values;

  const emptyValues: ReadonlyArray<Rdf.Node> = [];
  return Immutable.List(currentValues)
    .filter(({definition}) => definition.insertPattern && definition.deletePattern)
    .map(({definition, subject, values}) => {
      const deleteQuery = parseQueryStringAsUpdateOperation(definition.deletePattern);
      const insertQuery = parseQueryStringAsUpdateOperation(definition.insertPattern);

      const initial = initialValues.find(value => value.definition.id === definition.id);
      return createFieldUpdateQueries(
        deleteQuery,
        insertQuery,
        initial ? initial.values : emptyValues,
        values,
        subject,
      );
    }).filter(update => update.size > 0).flatten().toList();
}

export default new RawSparqlPersistence();

function createFieldUpdateQueries(
  deleteQuery: SparqlJs.Update | undefined,
  insertQuery: SparqlJs.Update | undefined,
  oldValues: ReadonlyArray<Rdf.Node>,
  newValues: ReadonlyArray<Rdf.Node>,
  subject: Rdf.Iri
): Immutable.List<SparqlJs.Update> {
  let queries = Immutable.List<SparqlJs.Update>();

  const {deleted, inserted} = valuesDifference(oldValues, newValues);
  if (deleted.size === 0 && inserted.size === 0) {
    return queries;
  }

  const paramterize = (query: SparqlJs.Update, value: Rdf.Node) =>
    SparqlClient.setBindings(query, {
      'subject': subject,
      'value': value,
    });

  if (deleteQuery) {
    queries = queries.concat(
      deleted.map(value => paramterize(deleteQuery, value)));
  }
  if (insertQuery) {
    queries = queries.concat(
      inserted.map(value => paramterize(insertQuery, value)));
  }
  return queries;
}
