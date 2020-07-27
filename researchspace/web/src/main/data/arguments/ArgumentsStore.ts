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

import * as maybe from 'data.maybe';
import * as uuid from 'uuid';
import * as Kefir from 'kefir';
import { Set } from 'immutable';
import * as _ from 'lodash';

import { Rdf, vocabularies} from 'platform/api/rdf';
import { SparqlClient } from 'platform/api/sparql';
import { LdpService, ldpc } from 'platform/api/services/ldp';
import * as SecurityService from 'platform/api/services/security';

import { Actions } from './Actions';
import * as M from './Model';
import { Entity } from '../Common';
import { rso, crm, crmdig, crminf, crmsci } from '../vocabularies/vocabularies';
import { FieldStore } from '../fields/FieldStore';
import * as F from '../fields/Model';
import { Belief } from '../assertions/Model';
import {
  evalBelief, savePropositionSet, savePropositionSets, buildPropositionSetQuery, createBeliefIri,
  createPropositionSetIri,
} from '../assertions/AssertionsStore';

export interface Config {
  assertionUri: Rdf.Iri;
  entity: Entity;
}

export class ArgumentsStore {
  private _config: Config;
  private _actions = Actions();

  constructor(config: Config) {
    this._config = config;

    this._actions.createArgument.$property.flatMap(
      this.createArgument
    ).onValue(
      () => document.location.reload(true)
    );
  }

  public get actions(): Actions {
    return this._actions;
  }

  private createArgument = (argument: M.Argument) => {
    const argumentIri =
        Rdf.iri(`${this._config.assertionUri.value}/argument/${uuid.v4()}`);
    return this.createContext().flatMap(
      context =>
          getBeliefsForArgument(
            argumentIri, this._config.entity, argument
          ).map(
            beliefs => serializeArgument(context, argumentIri, argument, beliefs)
          )
    ).flatMap(
      argumentGraph =>
          ldpc(
            rso.ArgumentsContainer.value
          ).addResource(
            argumentGraph, maybe.Just(argumentIri.value)
          )
    );
  }

  private createContext(): Kefir.Property<Context> {
    return this.getUser().flatMap(
      user =>
          getBeliefsForAssertion(this._config.assertionUri).map(
            assertionBeliefs => {
              return {
                user: Rdf.iri(user.userURI),
                entity: this._config.entity,
                assertionUri: this._config.assertionUri,
                assertionBeliefs: assertionBeliefs,
              };
            }
          )
    ).toProperty();
  }

  private getUser(): Kefir.Property<SecurityService.UserI> {
    return Kefir.fromPromise(SecurityService.Util.getUser()).toProperty();
  }
}

interface Context {
  entity: Entity;
  assertionUri: Rdf.Iri;
  assertionBeliefs: Rdf.Iri[];
  user: Rdf.Iri;
}

export function getBeliefsForArgument(
  argumentIri: Rdf.Iri, entity: Entity, argument: M.Argument
): Kefir.Property<Set<Rdf.Iri>> {
  if (argument instanceof M.Observation) {
    return Kefir.constant(Set<Rdf.Iri>());
  } else if (argument instanceof M.BeliefAdoption) {
    return createBeliefsForBeliefAdoption(
      argumentIri, entity, argument as M.BeliefAdoption
    );
  } else if (argument instanceof M.InferenceMaking) {
    return createBeliefsForInferenceMaking(
      argumentIri, entity, argument as M.InferenceMaking
    );
  }
}

/**
 * Belief adoption for citation is represented as a truthful belief in citation.
 */
export function createBeliefsForBeliefAdoption(
  argumentIri: Rdf.Iri, entity: Entity, beliefAdoption: M.BeliefAdoption
): Kefir.Property<Set<Rdf.Iri>> {
  const citation = beliefAdoption.citation;
  const citationGraph =
      Set.of(
        Rdf.triple(citation.iri, vocabularies.rdf.type, crm.E31_Document),
        Rdf.triple(citation.iri, vocabularies.rdfs.label, citation.label),
        Rdf.triple(citation.iri, rso.displayLabel, citation.label)
      );

  const belief =
      Belief({
        propositionSet: {
          propositions: citationGraph,
          metadata: {fieldLabel: '', fieldValue: Set<any>()},
        },
        beliefValue: true,
      });

  return savePropositionSet(argumentIri, entity, belief).map(
    () => evalBelief(entity, argumentIri)(belief)
  ).flatMap(
    createOrGetExistingBelief
  ).map(
    beliefIri => Set.of(beliefIri)
  ).toProperty();
}

/**
 * Premise for inference making can be only crminf:Belief or rso:EX_Assertion
 * (which contains beliefs).
 * To use other object as a premise we need to construct a belief out of it.
 * e.g in case of a digital image as a Premise we construct belief that object
 * has this image as a representation.
 */
export function createBeliefsForInferenceMaking (
  argumentIri: Rdf.Iri, entity: Entity, argument: M.InferenceMaking
): Kefir.Property<Set<Rdf.Iri>> {
  // check whether premises is assertions
  const assertions: Array<{value: Entity; type: Rdf.Iri}> = argument.premises.filter(
      ({value, type}: {value: Entity; type: Rdf.Iri}) =>
          type.equals(rso.EX_Assertion)
  ).toJS();

  // check whether premise is image
  const images: Array<{value: Entity; type: Rdf.Iri}> = argument.premises.filter(
      ({value, type}: {value: Entity; type: Rdf.Iri}) =>
          type.equals(rso.EX_Digital_Image)
  ).toJS();

  // check whether premise is image regions
  const imageRegions: Array<{value: Entity; type: Rdf.Iri}> = argument.premises.filter(
      ({value, type}: {value: Entity; type: Rdf.Iri}) =>
          type.equals(rso.EX_Digital_Image_Region)
  ).toJS();

  // check whether premise is field instances
  const fieldsInstances: Array<{value: Entity; type: Rdf.Iri}> = argument.premises.filter(
      ({value, type}: {value: Entity; type: Rdf.Iri}) =>
          type.equals(rso.FieldInstance)
  ).toJS();

  // check whether premise is annotation object
  const annotationObjects: Array<{value: Entity; type: Rdf.Iri}> = argument.premises.filter(
      ({value, type}: {value: Entity; type: Rdf.Iri}) =>
          type.equals(crmdig.D29_Annotation_Object)
  ).toJS();

  // get beliefs for all possible types of premise
  return Kefir.combine(
    getBeliefsForAssertionPremises(assertions).concat(
      getBeliefsForImageRegionPremises(imageRegions)
    ).concat(
      getBeliefsForImagePremises(images)
    ).concat(
      getBeliefsForFieldInstancesPremises(argumentIri, entity, fieldsInstances)
    ).concat(
      getBeliefsForAnnotationObjectPremises(annotationObjects)
    )
  ).map(
    (sets: Array<Set<Rdf.Iri>>) => {
      return sets.reduce((acc, s) => acc.union(s), Set<Rdf.Iri>());
    }
  ).toProperty();
}

function getBeliefsForAssertionPremises(
  assertions: Array<{value: Entity; type: Rdf.Iri}>
): Array<Kefir.Property<Set<Rdf.Iri>>> {
    // Option 1: If premise is an assertion
    // we point to the beliefs of the assertion, but possibly
    // loose the original reference to the assertion
  return assertions.map(
    assertionValue => {
      return getBeliefsForAssertion(assertionValue.value.iri).map(
        (iris: Rdf.Iri[]) => Set(iris)
      );
    }
  );
  // Option 2: We point to the assertion itself, which is ontologically wrong
  // return Kefir.constant<Set<PointedGraph>>(
  //   Set.of(new Rdf.PointedGraph(assertionEntity.iri, Rdf.graph()))
  // );
}

function getBeliefsForImageRegionPremises(
  assertions: Array<{value: Entity; type: Rdf.Iri}>
): Array<Kefir.Property<Set<Rdf.Iri>>> {
  // if premise is an image region,
  // we need to "manually" create the belief according to CRMdig
  return assertions.map(
    assertionValue => {
      return createAndSaveBeliefForImageRegion(assertionValue.value).map<Set<Rdf.Iri>>(
        imageRegionBeliefIri =>
            Set.of(imageRegionBeliefIri)
      );
    }
  );
}

function getBeliefsForAnnotationObjectPremises(
  annotationObjects: Array<{value: Entity; type: Rdf.Iri}>
): Array<Kefir.Property<Set<Rdf.Iri>>> {
  return annotationObjects.map(
      annotationObject => {
      return createAndSaveBeliefForAnnotationObject(annotationObject.value).map<Set<Rdf.Iri>>(
        annotationObjectBeliefIri => Set.of(annotationObjectBeliefIri)
      );
    }
  );
}

function getBeliefsForImagePremises(
  assertions: Array<{value: Entity; type: Rdf.Iri}>
): Array<Kefir.Property<Set<Rdf.Iri>>> {
      // if premise is an image
  // we need to "manually" create the belief according to CRMdig
    return assertions.map(
      assertionValue => {
        return createAndSaveBeliefForImage(assertionValue.value).map<Set<Rdf.Iri>>(
          imageBeliefIri =>
              Set.of(imageBeliefIri)
        );
      }
    );
}

function getBeliefsForFieldInstancesPremises(
  argumentIri: Rdf.Iri, entity: Entity, fieldsPremises: Array<{value: Entity; type: Rdf.Iri}>
): Array<Kefir.Property<Set<Rdf.Iri>>> {
  // it is a field instance and we use field instances to create the belief
  // this subsumes also the case of images
  return fieldsPremises.map(
    f => {
      const baseBeliefIri = f.value.iri;
      const fieldBeliefProperty = createBeliefForField(f.value.iri);
      return fieldBeliefProperty.flatMap(
        belief => savePropositionSet(baseBeliefIri, entity, belief).map(
          () => evalBelief(entity, baseBeliefIri)(belief)
        ).flatMap(
          createOrGetExistingBelief
        ).map(
          beliefIri => Set.of(beliefIri)
        )
      ).toProperty();
    }
  );
}

/**
 * Function to create crminf:Belief for image regions.
 *
 * While we use field definitions and field instances to generate beliefs when using
 * fields as premises in arguments, the situation for image region is different.
 * For image regions we must use the entire CRMdig pattern
 * D2 Digitisation Process -> L2 has created  -> D9 Data Object <- L49 is primary area of - D35 Area
 * as proposition set. The pattern itself is created when creating the region.
 * As such we simply point to the NamedGraph of the ImageRegion
 */
export function createAndSaveBeliefForImageRegion(imageRegion: Entity): Kefir.Property<Rdf.Iri> {
  const beliefIri = createBeliefIri(imageRegion.iri, true);
  const label = `Belief with \"${imageRegion.label.value}\" (Image Region) as proposition set.`;
  return saveBeliefForPropositionSet(
    beliefIri,
    label,
    getPropositionNamedGraph(imageRegion.iri)
  );
}

export function createAndSaveBeliefForAnnotationObject(
  annotationObject: Entity
): Kefir.Property<Rdf.Iri> {
  const beliefIri = createBeliefIri(annotationObject.iri, true);
  const label =
    `Belief with \"${annotationObject.label.value}\" (Linked Resource) as proposition set.`;
  return createPropositionSetForAnnotationObject(annotationObject.iri).flatMap<Rdf.Iri>(
    savedIri =>
      saveBeliefForPropositionSet(
        beliefIri,
        label,
        savedIri
      )
  ).toProperty();
}

export function createAndSaveBeliefForImage(image: Entity): Kefir.Property<Rdf.Iri> {
  const beliefIri = createBeliefIri(image.iri, true);
  const label = `Belief with \"${image.label.value}\" (Image) as proposition set.`;
  return createAndSavePropositionSetForImage(image.iri).flatMap<Rdf.Iri>( savedIri =>
    saveBeliefForPropositionSet(
      beliefIri,
      label,
      savedIri
    )
  ).toProperty();
}

function createAndSavePropositionSetForImage(imageIri: Rdf.Iri): Kefir.Property<Rdf.Iri> {
  const CONSTRUCT = <string> `
    PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
    PREFIX crmdig: <http://www.ics.forth.gr/isl/CRMdig/>
    PREFIX rso: <http://www.researchspace.org/ontology/>

    CONSTRUCT{
      $_image a crmdig:D9_Data_Object.
      ?digiProcess crmdig:L20_has_created $_image.
      ?digiProcess crmdig:L1_digitized ?thing.
      ?thing crm:P138i_has_representation $_image
    }WHERE{
      $_image a rso:EX_Digital_Image.
      {
        ?thing crm:P138i_has_representation $_image
      }UNION{
        ?digiProcess crmdig:L20_has_created $_image.
        ?digiProcess crmdig:L1_digitized ?thing.
      }
    }
    `;
  const propositionSetIri = createPropositionSetIri(
    createBeliefIri(imageIri, true)
  );
  const propositionContainer = ldpc(rso.PropositionsContainer.value);

  return propositionContainer.options(propositionSetIri).map(
    // if propositioinSet already exists, simply return the IRI
    v => propositionSetIri
  ).flatMapErrors( e =>
    // if it does not exists (i.e. options call returns 404 error)
    SparqlClient.prepareQuery(CONSTRUCT, [{'_image': imageIri}])
      .flatMap<Rdf.Triple[]>(SparqlClient.construct)
      .map<Set<Rdf.Triple>>(Set)
      .flatMap( (triples: Set<Rdf.Triple>) =>
        propositionContainer.addResource(
          Rdf.graph(triples), maybe.Just(propositionSetIri.value)
        )
      )
  ).toProperty();
}

/**
 * Saves the belief in an LDP container.
 */
function saveBeliefForPropositionSet(
  beliefIri: Rdf.Iri, beliefLabel: string, propositionSetGraph: Rdf.Iri
): Kefir.Property<Rdf.Iri> {
  const g = Rdf.graph(
    Rdf.triple(beliefIri, vocabularies.rdf.type, crminf.I2_Belief),
    Rdf.triple(beliefIri, crminf.J4_that, propositionSetGraph),
    Rdf.triple(beliefIri, crminf.J5_holds_to_be, Rdf.literal(true)),
    Rdf.triple(beliefIri, vocabularies.rdfs.label, Rdf.literal(beliefLabel)),
    Rdf.triple(beliefIri, rso.displayLabel, Rdf.literal(beliefLabel))
  );
  const beliefPg = Rdf.pg(beliefIri, g);
  return createOrGetExistingBelief(beliefPg);
}

function createOrGetExistingBelief(
  beliefPg: Rdf.PointedGraph
): Kefir.Property<Rdf.Iri> {
  const ldpContainer = ldpc(rso.AssertionsContainer.value);
  const beliefIri = beliefPg.pointer as Rdf.Iri;
  return ldpContainer.options(beliefIri).map(
    // if belief already exists, return just the beliefIri
    v => beliefIri
  ).flatMapErrors(
    e =>
        ldpContainer.addResource(
          beliefPg.graph, maybe.Just(beliefIri.value)
        )
  ).toProperty();
}

/**
 * To create crminf:Belief for a field we need to convert field SELECT query into CONSTRUCT
 * and use result as a crminf:PropositionSet for a belief.
 */
export function createBeliefForField(fieldInstanceIri: Rdf.Iri): Kefir.Property<Belief> {
  const fieldStore = new FieldStore({fieldInstanceIri: fieldInstanceIri});
  return Kefir.combine(
    [
      fieldStore.fieldDefinition,
      fieldStore.fieldValues,
      fieldStore.fieldInfo,
    ]
  ).flatMap(
    ([definition, values, info]) =>
        createPropositionSetFromField(
          definition, info.entity.iri
        ).map(
          propositions => {
            return Belief({
              propositionSet: {
                propositions: propositions,
                metadata: {
                  fieldLabel: definition.label,
                  fieldValue: values,
                },
              },
              beliefValue: true,
            });
          }
        )
  ).toProperty();
}

export function createPropositionSetFromField(
  fieldDefinition: F.FieldDefinition, entityIri: Rdf.Iri
): Kefir.Property<Set<Rdf.Triple>> {
  return fieldDefinition.select.map(
    buildPropositionSetQuery
  ).map(
    SparqlClient.prepareParsedQuery([{'_subject': entityIri}])
  ).flatMap(SparqlClient.construct).map(Set).toProperty();
}

export function serializeArgument(
  context: Context, newArgumentIri: Rdf.Iri, argument: M.Argument, beliefs: Set<Rdf.Iri>
): Rdf.Graph {
  const conclusionTriples =
      context.assertionBeliefs.map(
        beliefIri => Rdf.triple(Rdf.BASE_IRI, crminf.J2_concluded_that, beliefIri)
      );

  const baseArgumentGraph =
      Rdf.graph(
        Rdf.triple(Rdf.BASE_IRI, vocabularies.rdf.type, crminf.I1_Argumentation),
        Rdf.triple(Rdf.BASE_IRI, vocabularies.rdfs.label, Rdf.literal(argument.title)),
        Rdf.triple(Rdf.BASE_IRI, rso.displayLabel, Rdf.literal(argument.title)),
        Rdf.triple(Rdf.BASE_IRI, crm.P3_has_note, Rdf.literal(argument.note)),
        ... conclusionTriples
      );

  const specificArgumentGraph =
      serializeSpecificArgument(context, argument, beliefs);

  return Rdf.union(baseArgumentGraph, specificArgumentGraph);
}

export function serializeSpecificArgument(
  context: Context, argument: M.Argument, beliefs: Set<Rdf.Iri>
): Rdf.Graph {
  if (argument instanceof M.Observation) {
    return serializeObservation(context, argument as M.Observation);
  } else if (argument instanceof M.BeliefAdoption) {
    return serializeBeliefAdoption(context, argument as M.BeliefAdoption, beliefs);
  } else if (argument instanceof M.InferenceMaking) {
    return serializeInference(context, argument as M.InferenceMaking, beliefs);
  }
}

export function serializeBeliefAdoption(
  context: Context, beliefAdoption: M.BeliefAdoption, beliefs: Set<Rdf.Iri>
): Rdf.Graph {
  const premises =
      beliefs.map(
        belief =>
            Rdf.triple(Rdf.BASE_IRI, crminf.J6_adopted, belief)
      );

  return Rdf.graph(
    Rdf.triple(Rdf.BASE_IRI, vocabularies.rdf.type, crmsci.S4_Observation),
    Rdf.triple(Rdf.BASE_IRI, crm.P14_carried_out_by, context.user),
    ...premises.toJS()
  );
}


export function serializeObservation(context: Context, observation: M.Observation): Rdf.Graph {
  const observationTimePg = createObservationTimeSpan(observation);
  return Rdf.graph(
    Rdf.triple(Rdf.BASE_IRI, vocabularies.rdf.type, crmsci.S19_Encounter_Event),
    Rdf.triple(Rdf.BASE_IRI, vocabularies.rdf.type, crmsci.S4_Observation),
    Rdf.triple(Rdf.BASE_IRI, crmsci.O21_has_found_at, observation.place.iri),
    Rdf.triple(Rdf.BASE_IRI, crm.P14_carried_out_by, context.user),
    Rdf.triple(Rdf.BASE_IRI, crm.P4_has_time_span, observationTimePg.pointer),
    ... observationTimePg.graph.triples.toJS()
  );
}

export function createObservationTimeSpan(observation: M.Observation): Rdf.PointedGraph {
  const timeIri = Rdf.iri(`/time/${uuid.v4()}`);
  const time = Rdf.literal(observation.time.toISOString(), vocabularies.xsd.dateTime);
  const label = Rdf.literal(observation.time.format('LL'));
  return Rdf.pg(
    timeIri,
    Rdf.graph(
      Rdf.triple(timeIri, crm.P82a_begin_of_the_begin, time),
      Rdf.triple(timeIri, crm.P82a_end_of_the_end, time),
      Rdf.triple(timeIri, vocabularies.rdfs.label, label),
      Rdf.triple(timeIri, rso.displayLabel, label)
    )
  );
}

export function serializeInference(
  context: Context, inference: M.InferenceMaking, beliefs: Set<Rdf.Iri>
): Rdf.Graph {
  const premises =
      beliefs.map(
        belief => Rdf.triple(Rdf.BASE_IRI, crminf.J1_used_as_premise, belief)
      );
  return Rdf.graph(
    Rdf.triple(Rdf.BASE_IRI, vocabularies.rdf.type, crminf.I5_Inference_Making),
    Rdf.triple(Rdf.BASE_IRI, crminf.J3_applies, inference.logicType.iri),
    ... premises.toJS()
  );
}

/*
 * Returns the NamedGraph that captures the proposition set. In cases of images
 * this is the graph containing the entire CRMdig pattern being created
 * when the region is created.
 *
 * Since we are using LDP for both (image regions as well as proposition),
 * we can simply rely on the (backend) convention that LDP resource are located in
 * a graph ldpResourceIri + "/context".
 */
function getPropositionNamedGraph(imageRegionIri: Rdf.Node): Rdf.Iri {
  return Rdf.iri(imageRegionIri.value + '/context') ;
}

function getBeliefsForAssertion(assertionIri: Rdf.Iri): Kefir.Property<Rdf.Iri[]> {
  return ldpc(rso.AssertionsContainer.value).get(assertionIri).map<Rdf.Iri[]>(
    (graph: Rdf.Graph) => {
      return _.filter<Rdf.Triple>(
        graph.triples.toArray(),
        t => t.p.equals(rso.PX_asserts)
      ).map(t => <Rdf.Iri> t.o);
    }
  );
}

function createPropositionSetForAnnotationObject(annotationObject: Rdf.Iri): Kefir.Property<Rdf.Iri> {
  const propositionSetIri = createPropositionSetIri(
    createBeliefIri(annotationObject, true)
  );
  const propositionContainer = ldpc(rso.PropositionsContainer.value);

  return propositionContainer.options(propositionSetIri).map(
    // if propositioinSet already exists, simply return the IRI
    v => propositionSetIri
  ).flatMapErrors(
    e =>
      ldpc(rso.LinkContainer.value).get(annotationObject).flatMap(
        aoGraph =>
          propositionContainer.addResource(
            aoGraph, maybe.Just(propositionSetIri.value)
          )
      )
  ).toProperty();
}
