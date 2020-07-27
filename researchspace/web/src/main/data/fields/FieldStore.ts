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
import { List, OrderedSet, Map } from 'immutable';
import * as _ from 'lodash';

import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { Rdf, vocabularies } from 'platform/api/rdf';
import { getLabels } from 'platform/api/services/resource-label';

import { crminf } from '../../data/vocabularies/vocabularies';
import { Entity } from '../Common';
import { FieldDefinition, FieldValue, FieldValues, FieldInfo } from './Model';

const SELECT_FIELD_DEFINITIONS_QUERY = Kefir.constant(SparqlUtil.Sparql`
  prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  prefix sp: <http://spinrdf.org/sp#>
  prefix field: <http://www.metaphacts.com/ontology/fields#>

  select distinct ?iri ?label ?select ?insert ?autosuggestion {
    ?iri a field:Field ;
       rdfs:label ?label ;
       field:selectPattern/sp:text ?select ;
       field:insertPattern/sp:text ?insert ;
       field:autosuggestionPattern/sp:text ?autosuggestion .
  }
`);

const SELECT_FIELD_FOR_INSTANCE = Kefir.constant(SparqlUtil.Sparql`
  prefix rso: <http://www.researchspace.org/ontology/>
  prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>

  select distinct ?field ?fieldLabel ?entity ?entityLabel {
    ?fieldInstance rso:targetField ?field ;
      rso:targetEntity ?entity .
    ?field rdfs:label ?fieldLabel .
    ?entity rso:displayLabel ?entityLabel .
  }
`);

/**
 * Retrievs Field Instance for the $_field of the specific $_entity.
 */
const SELECT_FIELD_INSTANCE_FOR_ENTITY = Kefir.constant(SparqlUtil.Sparql`
  prefix rso: <http://www.researchspace.org/ontology/>

  select ?fieldInstance {
    ?fieldInstance rso:targetField $_field ;
      rso:targetEntity $_entity .
  }
`);

export interface Config {
  fieldInstanceIri: Rdf.Iri
}

/**
 *
 */
export class FieldStore {
  private _fieldDefinition: Kefir.Property<FieldDefinition>;
  private _fieldValues: Kefir.Property<FieldValues>;
  private _fieldInfo: Kefir.Property<FieldInfo>;

  constructor(config: Config) {
    this._fieldInfo = getFieldIriForInstance(config.fieldInstanceIri);

    this._fieldDefinition =
        this._fieldInfo.flatMap(
          ({field}) => getFieldDefiniton(field.iri)
        ).toProperty();

    this._fieldValues =
        Kefir.combine(
          [this._fieldInfo, this._fieldDefinition]
        ).flatMap(
          ([{entity}, def]) => queryFieldValues(entity.iri, def)
        ).toProperty();
  }

  public get fieldInfo() {
    return this._fieldInfo;
  }

  public get fieldDefinition() {
    return this._fieldDefinition;
  }

  public get fieldValues() {
    return this._fieldValues;
  }
}

function getFieldIriForInstance(fieldInstance: Rdf.Iri): Kefir.Property<FieldInfo> {
  return SELECT_FIELD_FOR_INSTANCE
      .map(SparqlClient.prepareParsedQuery([{'fieldInstance': fieldInstance}]))
      .flatMap(SparqlClient.select).map(
        res => {
          const binding = res.results.bindings[0];
          return {
            field: Entity({
              iri: <Rdf.Iri>binding['field'],
              label: <Rdf.Literal>binding['fieldLabel'],
              tuple: binding,
            }),
            entity: Entity({
              iri: <Rdf.Iri>binding['entity'],
              label: <Rdf.Literal>binding['entityLabel'],
              tuple: binding,
            }),
          };
        }
      ).toProperty();
}

export function getFieldInstanceForEntity(
  entityIri: Rdf.Iri, fieldDefinitionIri: Rdf.Iri
): Kefir.Property<Rdf.Iri> {
  return SELECT_FIELD_INSTANCE_FOR_ENTITY.map(
    SparqlClient.prepareParsedQuery([{
      '_entity': entityIri, '_field': fieldDefinitionIri,
    }])
  ).flatMap(SparqlClient.select).map(
    res => res.results.bindings[0]['fieldInstance'] as Rdf.Iri
  ).toProperty();
}

export function getFieldDefiniton(
  field: Rdf.Iri
): Kefir.Property<FieldDefinition> {
  return getFieldsDefinitions(
    List.of(field)
  ).map(
    defs => defs.first()
  );
}

export function getFieldsDefinitions(
  fields: List<Rdf.Iri>
): Kefir.Property<Map<Rdf.Iri, FieldDefinition>> {
  const parameters = fields.map(field => { return {'iri': field}; }).toJS();
  const preparedQuery: Kefir.Property<SparqlJs.SparqlQuery> =
      SELECT_FIELD_DEFINITIONS_QUERY.map(
        SparqlClient.prepareParsedQuery(parameters)
      );

  return preparedQuery.flatMap(SparqlClient.select).map(
    res => bindingsToFields(res.results.bindings)
  ).toProperty();
}

export function queryFieldValues(
  subject: Rdf.Iri, fieldDefinition: FieldDefinition
): Kefir.Property<OrderedSet<FieldValue>> {
  const query =
      fieldDefinition.select.map(
        SparqlClient.prepareParsedQuery([{'_subject': subject}])
      ).map(filterValuesFromPropositionSets);
  return query.flatMap(SparqlClient.select).flatMap(
    res => toFieldValues(res.results.bindings)
  ).toProperty();
}

export function filterValuesFromPropositionSets(query: SparqlJs.Query): SparqlJs.Query {
  const queryCopy = _.cloneDeep(query);
  const graphVaribale = `?${SparqlUtil.randomVariableName()}` as SparqlJs.Term;
  const filterNot: SparqlJs.FilterPattern = {
    type: 'filter',
    expression: {
      type: 'operation',
      operator: 'notexists',
      args: [{
        type: 'bgp',
        triples: [{
          subject: graphVaribale,
          predicate: vocabularies.rdf.type.value as SparqlJs.Term,
          object: crminf.I4_Proposition_Set.value as SparqlJs.Term,
        }],
      }],
    },
  };
  const graph: SparqlJs.GraphPattern = {
    type: 'graph',
    name: graphVaribale,
    patterns: queryCopy.where,
  };
  queryCopy.where = [graph, filterNot];
  return queryCopy;
}

function toFieldValues(result: SparqlClient.Bindings): Kefir.Property<OrderedSet<FieldValue>> {
  const values = queryResultToValues(result);
  return fetchValuesLabels(values);
}

function queryResultToValues(result: SparqlClient.Bindings): OrderedSet<Rdf.Iri> {
  return OrderedSet(
    _.map(result, binding => <Rdf.Iri>binding['_value'])
  );
}

function fetchValuesLabels(values: OrderedSet<Rdf.Iri>): Kefir.Property<OrderedSet<FieldValue>> {
  return getLabels(values.toJS()).map(
    labels => createFieldValues(values, labels)
  );
}

function createFieldValues(
  values: OrderedSet<Rdf.Iri>, labels: Map<Rdf.Iri, string>
): OrderedSet<FieldValue> {
  return values.map(
    value => {
      return {
        value: value,
        label: labels.get(value),
      };
    }
  );
}

function bindingsToFields(bindings: SparqlClient.Bindings): Map<Rdf.Iri, FieldDefinition> {
  const bindingPairs =
      List(bindings).map(bindingToField).map(
        field => [field.iri, field]
      );
  return Map<Rdf.Iri, FieldDefinition>(bindingPairs);
}

function bindingToField(binding: SparqlClient.Binding): FieldDefinition {
  return {
    iri: <Rdf.Iri>binding['iri'],
    label: binding['label'].value,
    select: SparqlUtil.parseQueryAsync(binding['select'].value),
    insert: SparqlUtil.parseQueryAsync(binding['insert'].value),
    autosuggestion: SparqlUtil.parseQueryAsync(binding['autosuggestion'].value),
  };
}
