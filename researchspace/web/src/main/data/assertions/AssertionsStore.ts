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
import { Set, OrderedSet } from 'immutable';
import * as uuid from 'uuid';
import * as maybe from 'data.maybe';
import * as moment from 'moment';
import * as _ from 'lodash';

import { Rdf, vocabularies } from 'platform/api/rdf';
import { navigateToResource } from 'platform/api/navigation';
import { SparqlClient, SparqlUtil } from 'platform/api/sparql';
import { ldpc } from 'platform/api/services/ldp';
import { Util } from 'platform/api/services/security';

import { crm, crminf, rso } from '../../data/vocabularies/vocabularies';
import { FieldStore } from '../fields/FieldStore';
import { Entity } from '../Common';
import { FieldInfo, FieldValues, FieldValue, FieldDefinition } from '../fields/Model';
import * as M from './Model';
import { Actions, NewAssertionData, BeliefValue} from './Actions';

interface Config {
  fieldInstanceIri: Rdf.Iri;
}

export class AssertionsStore {
  private _config: Config;
  private _fieldStore: FieldStore;
  private _actions = Actions();
  private _fieldValues: Kefir.Property<FieldValues>;
  private _existingFieldValues: Kefir.Property<FieldValues>;
  private _newFieldValues: Kefir.Property<FieldValues>;

  constructor(config: Config) {
    this._config = config;
    this._fieldStore = new FieldStore(config);

    this._actions.createAssertion.$property.flatMap(
      this.createAssertion
    ).flatMap(
      navigateToResource
    ).onValue(() => {});

    this._existingFieldValues = this._fieldStore.fieldValues;
    this._newFieldValues =
        this._actions.addNewValue.$property.scan<FieldValues>(
          (acc, next) => {
            return acc.add(next);
          }, OrderedSet<FieldValue>()
        );


    this._fieldValues =
        Kefir.merge([
          this._existingFieldValues,
          this._newFieldValues,
        ]).scan<FieldValues>(
          (acc, next) => {
            return acc.union(next);
          }, OrderedSet<FieldValue>()
        );
  }

  public get actions(): Actions {
    return this._actions;
  }

  public get fieldValues() {
    return this._fieldValues;
  }

  public get autosuggestion() {
    return this._fieldStore.fieldDefinition.flatMap(
      def => def.autosuggestion
    ).map(
      SparqlUtil.serializeQuery
    );
  }

  private createAssertion = (opts: NewAssertionData) => {
    return this._fieldStore.fieldInfo.flatMap(
      fieldInfo => this.buildAssertion(fieldInfo, opts)
    );
  }

  private buildAssertion(
    fieldInfo: FieldInfo, {title, beliefValues}: NewAssertionData
  ): Kefir.Property<{}> {

    return Kefir.combine(
      this.buildBeliefs(fieldInfo.entity, beliefValues)
    ).toProperty().map(
      beliefs =>
          M.Assertion({
            title: title, beliefs: Set(beliefs),
          })
    ).flatMap(
      assertion =>
          Kefir.fromPromise(Util.getUser()).toProperty().flatMap(
            user => {
              return evaluate({
                object: fieldInfo.entity,
                fieldIri: this._config.fieldInstanceIri,
                user: Rdf.iri(user.userURI),
              })(assertion);
            }
          )
    ).toProperty();
  }

  private buildBeliefs(
    subject: Entity, beliefValues: Set<BeliefValue>
  ): Array<Kefir.Property<M.Belief>> {
    return beliefValues.map(
      (beliefValue: BeliefValue) =>
          this.isNewFieldValue(beliefValue.value).flatMap(
            isNewFieldValue => {
              if (isNewFieldValue) {
                return this.getPropositionSetForNewValue(subject, beliefValue);
              } else {
                return this.getPropositionSetForExistingValue(subject, beliefValue);
              }
            }
          ).map(
            propositionSet =>
                M.Belief({
                  propositionSet: propositionSet,
                  beliefValue: beliefValue.belief,
                })
          )
    ).toJS();
  }

  private isNewFieldValue(fieldValue: FieldValue): Kefir.Property<boolean> {
    return this._newFieldValues.map(
      newFieldValues => {
        console.log(newFieldValues);
        return newFieldValues.has(fieldValue);
      }
    );
  }

  private getPropositionSetForNewValue(
    subject: Entity, fieldValue?: BeliefValue
  ): Kefir.Property<M.PropositionSet> {
    const getPropositionSetQueryFn =
        fieldDefinition => fieldDefinition.insert.map(buildNewValuePropositionSetQuery);
    return this.getPropositionSet(subject, fieldValue, getPropositionSetQueryFn);
  }

  private getPropositionSetForExistingValue(
    subject: Entity, fieldValue?: BeliefValue
  ): Kefir.Property<M.PropositionSet> {
    const getPropositionSetQueryFn =
        fieldDefinition => fieldDefinition.select.map(buildPropositionSetQuery);
    return this.getPropositionSet(subject, fieldValue, getPropositionSetQueryFn);
  }

  private getPropositionSet(
    subject: Entity, fieldValue: BeliefValue,
    getQueryFn: (fieldDefinition: FieldDefinition) => Kefir.Property<SparqlJs.ConstructQuery>
  ): Kefir.Property<M.PropositionSet> {
    return this._fieldStore.fieldDefinition.flatMap(
      fieldDefinition =>
          getQueryFn(fieldDefinition).map(
            SparqlClient.prepareParsedQuery([{'_subject': subject.iri, '_value': fieldValue.value.value}])
          ).flatMap(SparqlClient.construct).map(Set).map(
            propositions => {
              return {
                propositions: propositions,
                metadata: {
                  fieldLabel: fieldDefinition.label,
                  fieldValue: Set.of(fieldValue.value),
                },
              };
            }
          )
    ).toProperty();
  }
}
export default AssertionsStore;


interface EvaluationContext {
  object: Entity;
  fieldIri: Rdf.Iri;
  user: Rdf.Iri;
}

/**
 * In case when user make assertions for existing field value,
 * where clause from selectPattern of Field Definition is used as a construct pattern
 * for proposition set
 */
export function buildPropositionSetQuery (
  selectQuery: SparqlJs.ConstructQuery
): SparqlJs.ConstructQuery {
  return {
    'prefixes': {},
    'type': 'query',
    'queryType': 'CONSTRUCT',
    'template': <any>_.cloneDeep(selectQuery.where), // TODO: incompatible types
    'where': _.cloneDeep(selectQuery.where),
  };
}

/**
 * In case when user asserts new value for a field,
 * insertPattern from Field Definition is used as a construct pattern
 * for proposition set
 */
function buildNewValuePropositionSetQuery(
  insertQuery: SparqlJs.Update
): SparqlJs.ConstructQuery {
  const operation = insertQuery.updates[0] as SparqlJs.InsertDeleteOperation;
  return {
    'prefixes': {},
    'type': 'query',
    'queryType': 'CONSTRUCT',
    'template': <any>_.cloneDeep(operation.insert), // TODO: incompatible types
    'where': _.cloneDeep(operation.where),
  };
}

export function evaluate(context: EvaluationContext) {
  return (assertion: M.Assertion) => {
    const assertionIri = Rdf.iri(`${context.fieldIri.value}/assertion/${uuid.v4()}`);
    const combinedBeliefs =
        combineBeliefs(
          assertion.beliefs
        );

    return savePropositionSets(assertionIri, context.object, combinedBeliefs).map(
      () => evaluateAssertion(context, assertionIri)(assertion, combinedBeliefs)
    ).flatMap(
      assertionPg => {
        return ldpc(rso.AssertionsContainer.value).addResource(
          assertionPg.graph, maybe.Just(assertionIri.value)
        );
      }
    );
  };
}

export function savePropositionSets(
  baseIri: Rdf.Iri, object: Entity, beliefs: M.Beliefs
): Kefir.Property<Array<Rdf.Iri>> {
  const savedPropositionSetIris =
      beliefs.map(
        (belief: M.Belief): Kefir.Property<Rdf.Iri> => {
          return savePropositionSet(baseIri, object, belief);
        }
      );
  return Kefir.combine(savedPropositionSetIris.toJS()).toProperty();
}

export function savePropositionSet(
  baseIri: Rdf.Iri, object: Entity, belief: M.Belief
): Kefir.Property<Rdf.Iri> {
  const { propositionSet, beliefValue } = belief;

  const propositionSetIri =
      createPropositionSetIri(
        createBeliefIri(baseIri, beliefValue)
      );
  const propositionSetGraph =
      evalPropositionSet(object)(propositionSet);
  return ldpc(rso.PropositionsContainer.value).addResource(
    propositionSetGraph, maybe.Just(propositionSetIri.value)
  );
}

export function evaluateAssertion(context: EvaluationContext, baseIri: Rdf.Iri) {
  return (assertion: M.Assertion, beliefs: M.Beliefs): Rdf.PointedGraph => {
    const beliefsPgs: Set<Rdf.PointedGraph> = beliefs.map(evalBelief(context.object, baseIri));
    const assertionIri = Rdf.BASE_IRI;
    const beliefsTriples =
        beliefsPgs.map(
          beliefPg =>
              Rdf.union(
                Rdf.graph(
                  Rdf.triple(assertionIri, rso.PX_asserts, beliefPg.pointer)
                ),
                beliefPg.graph
              ).triples
        ).flatten().toJS();
    const assertionTimePg = createAssertionTimeSpan();
    return Rdf.pg(
          assertionIri,
          Rdf.graph(
            Rdf.triple(assertionIri, vocabularies.rdf.type, rso.EX_Assertion),
            Rdf.triple(assertionIri, vocabularies.rdfs.label, Rdf.literal(assertion.title)),
            Rdf.triple(assertionIri, rso.displayLabel, Rdf.literal(assertion.title)),
            Rdf.triple(assertionIri, rso.targetField, context.fieldIri),
            Rdf.triple(assertionIri, crm.P14_carried_out_by, context.user),
            Rdf.triple(assertionIri, crm.P4_has_time_span, assertionTimePg.pointer),
            ...beliefsTriples,
            ...assertionTimePg.graph.triples.toJS()
          )
        );
  };
}

export function createAssertionTimeSpan(): Rdf.PointedGraph {
  const timeIri = Rdf.iri(`/time/${uuid.v4()}`);
  const time = moment();
  const timeLiteral = Rdf.literal(time.toISOString(), vocabularies.xsd.dateTime);
  const label = Rdf.literal(time.format('LL'));
  return Rdf.pg(
    timeIri,
    Rdf.graph(
      Rdf.triple(timeIri, crm.P82a_begin_of_the_begin, timeLiteral),
      Rdf.triple(timeIri, crm.P82a_end_of_the_end, timeLiteral),
      Rdf.triple(timeIri, rso.displayLabel, label),
      Rdf.triple(timeIri, vocabularies.rdfs.label, label)
    )
  );
}

export function evalBelief(object: Entity, baseIri: Rdf.Iri) {
  return (belief: M.Belief): Rdf.PointedGraph => {
    const beliefIri = createBeliefIri(baseIri, belief.beliefValue);
    const label = createBeliefLabel(object, belief.propositionSet, belief.beliefValue);

    const beliefPg =
        Rdf.pg(beliefIri,
           Rdf.union(
             Rdf.graph(
               Rdf.triple(beliefIri, vocabularies.rdf.type, crminf.I2_Belief),
               Rdf.triple(beliefIri, crminf.J4_that, createPropositionSetIri(beliefIri)),
               Rdf.triple(beliefIri, crminf.J5_holds_to_be, Rdf.literal(belief.beliefValue)),
               Rdf.triple(beliefIri, vocabularies.rdfs.label, Rdf.literal(label)),
               Rdf.triple(beliefIri, rso.displayLabel, Rdf.literal(label))
             )
           )
          );
    return beliefPg;
  };
}

export function evalPropositionSet(object: Entity) {
  return (propositionSet: M.PropositionSet): Rdf.Graph => {
    const propositionSetIri = Rdf.iri('');
    const label = createPropositionSetLabel(object, propositionSet);
    return Rdf.union(
      Rdf.graph(propositionSet.propositions),
      Rdf.graph(
        Rdf.triple(propositionSetIri, vocabularies.rdf.type, crminf.I4_Proposition_Set),
        Rdf.triple(propositionSetIri, vocabularies.rdfs.label, Rdf.literal(label)),
        Rdf.triple(propositionSetIri, rso.displayLabel, Rdf.literal(label))
      )
    );
  };
}

export function combineBeliefs(beliefs: M.Beliefs): M.Beliefs {
  const grouped = beliefs.groupBy(belief => belief.beliefValue);
  return grouped.valueSeq().map(mergeBeliefs).toSet();
}

export function mergeBeliefs(beliefs: M.Beliefs): M.Belief {
  const combinedSet =
      <Set<Rdf.Triple>>beliefs.map(
        belief => belief.propositionSet.propositions
      ).flatten();

  const combinedValues =
      <Set<FieldValue>>beliefs.map(
        belief => belief.propositionSet.metadata.fieldValue
      ).flatten();

  return M.Belief({
    propositionSet: {
      propositions: combinedSet,
      metadata: {
        fieldLabel: beliefs.first().propositionSet.metadata.fieldLabel,
        fieldValue: combinedValues,
      },
    },
    beliefValue: beliefs.first().beliefValue,
  });
}

export function createBeliefIri(assertionIri: Rdf.Iri, beliefValue: boolean): Rdf.Iri {
  return Rdf.iri(`${assertionIri.value}/belief/${beliefValue}`);
}

export function createPropositionSetIri(beliefIri: Rdf.Iri): Rdf.Iri {
  return Rdf.iri(`${beliefIri.value}/proposition`);
}

export function createBeliefLabel(
  subject: Entity, propositionSet: M.PropositionSet, beliefValue: M.BeliefValue
): string {
  const start = beliefValue ? 'Agree with proposition ' : 'Disagree with proposition ';
  const propositionSetLabel = createPropositionSetLabel(subject, propositionSet);
  return `${start} "${propositionSetLabel}"`;
}

export function createPropositionSetLabel(
  subject: Entity, propositionSet: M.PropositionSet
): string {
  const valuesLabel =
    // we need to convert fieldValues Set to Seq because after mapping
    // there can be duplicated labels which will be eliminated in case of Set,
    // but we need to preserve them, see VD-31.
    propositionSet.metadata.fieldValue.toSeq().map(
      fieldValue => `'${fieldValue.label}'`
    ).join(' and ');
  return `'${subject.label.value}' > ${propositionSet.metadata.fieldLabel} > ${valuesLabel}`;
}
