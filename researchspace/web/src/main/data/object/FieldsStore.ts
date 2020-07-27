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
import { List, Map, OrderedSet } from 'immutable';
import { constant } from 'core.lambda';

import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';

import { FieldDefinition, FieldValue } from '../fields/Model';
import { getFieldsDefinitions, queryFieldValues } from '../fields/FieldStore';
import { Field } from './Model';
import { Action } from 'platform/components/utils';

export enum FieldViewTabs {
  ANNOTATIONS, ASSERTIONS,
}

export interface Actions {
  navigateToField: Action<{field: Field, view?: FieldViewTabs}>
}

function Actions(): Actions {
  return Object.freeze({
    navigateToField: Action<{field: Field, view?: FieldViewTabs}>(),
  });
}

export interface Config {
  resource: Rdf.Iri
  assertionsQuery: string
  annotationsQuery: string
}

export class FieldsStore {
  private static FIELDS_FOR_OBJECT_QUERY = Kefir.constant(SparqlUtil.Sparql`
    PREFIX rso: <http://www.researchspace.org/ontology/>

    SELECT ?fieldInstance ?field WHERE {
      ?fieldInstance a rso:FieldInstance ;
         rso:targetEntity $_subject ;
         rso:targetField ?field .
    }
`);

  private _config: Config;
  private _fields: Kefir.Property<List<Field>>;
  private _actions = Actions();

  constructor(config: Config) {
    this._config = config;
    this._fields =
        this.fieldsDefinitionsForObject(config.resource).flatMap(
          definitions =>
              Kefir.combine(
                definitions.map(this.getFieldValues(config.resource)).toArray()
              ).map(List)
        ).toProperty();

    this._actions.navigateToField.$property.flatMap(
      ({field, view}) => navigateToResource(field.iri)
    ).onValue(constant);
  }

  public get fields(): Kefir.Property<List<Field>> {
    return this._fields;
  }

  public actions(): Actions {
    return this._actions;
  }

  private getFieldValues = (object: Rdf.Iri) =>
      ({fieldIri, fieldDefinition}): Kefir.Property<Field> => {
        return queryFieldValues(object, fieldDefinition).flatMap(
          (values: OrderedSet<FieldValue>) =>
            Kefir.combine(
              [
                this.annotationsForField(fieldIri), this.assertionsForField(fieldIri),
              ],
              (an: Rdf.Iri[], as: Rdf.Iri[]) => {
                return <Field>{
                  iri: fieldIri,
                  definition: fieldDefinition,
                  values: values.toList(),
                  annotations: List(an),
                  assertions: List(as),
                };
              })
        ).toProperty();
      }

  public fieldsDefinitionsForObject(
    object: Rdf.Iri
  ): Kefir.Property<List<{fieldIri: Rdf.Iri; fieldDefinition: FieldDefinition}>> {
    return this.fieldsForObject(object).flatMap(
      fields =>
          getFieldsDefinitions(
            fields.map(field => field.fieldDefinitionIri)
          ).map(
            defs => {
              return fields.map(
                field => {
                  return {
                    fieldIri: field.fieldIri,
                    fieldDefinition: defs.get(field.fieldDefinitionIri),
                  };
                }
              );
            }
          )
    ).toProperty();
  }

  public fieldsForObject(
    object: Rdf.Iri
  ): Kefir.Property<List<{fieldIri: Rdf.Iri, fieldDefinitionIri: Rdf.Iri}>> {
    return FieldsStore.FIELDS_FOR_OBJECT_QUERY.map(
      SparqlClient.prepareParsedQuery([{'_subject': object}])
    ).flatMap(SparqlClient.select).map(
      res => this.extractFields(res.results.bindings)
    ).toProperty();
  }

  public annotationsForField(
    field: Rdf.Iri
  ): Kefir.Property<Array<Rdf.Iri>> {
    return SparqlUtil.parseQueryAsync(
      this._config.annotationsQuery
    ).map(
      SparqlClient.prepareParsedQuery([{'_subject': field}])
    ).flatMap(SparqlClient.select).map(
      res => this.extractAnnotations(res.results.bindings)
    ).toProperty();
  }

  private extractAnnotations(
    bindings: SparqlClient.Bindings
  ): Array<Rdf.Iri> {
    return bindings.map(
      binding => <Rdf.Iri>binding['annotation']
    );
  }

  public assertionsForField(
    field: Rdf.Iri
  ): Kefir.Property<Array<Rdf.Iri>> {
    return SparqlUtil.parseQueryAsync(
      this._config.assertionsQuery
    ).map(
      SparqlClient.prepareParsedQuery([{'_subject': field}])
    ).flatMap(SparqlClient.select).map(
      res => this.extractAssertions(res.results.bindings)
    ).toProperty();
  }

  private extractAssertions(
    bindings: SparqlClient.Bindings
  ): Array<Rdf.Iri> {
    return bindings.map(
      binding => <Rdf.Iri>binding['assertion']
    );
  }

  private extractFields(
    bindings: SparqlClient.Bindings
  ): List<{fieldIri: Rdf.Iri, fieldDefinitionIri: Rdf.Iri}> {
    return List(bindings).map(
      binding => {
        return {
          fieldIri: <Rdf.Iri>binding['fieldInstance'],
          fieldDefinitionIri: <Rdf.Iri>binding['field'],
        };
      }
    );
  }
}

export default FieldsStore;
