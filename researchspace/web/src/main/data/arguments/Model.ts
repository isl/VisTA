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

import { List, Record } from 'immutable';
import * as moment from 'moment';

import { Rdf } from 'platform/api/rdf';
import { Entity } from '../../data/Common';

export interface ArgumentI {
  title?: string
  note?: string
}

interface ObservationI extends ArgumentI {
  place: Entity;
  time: moment.Moment;
}

interface BeliefAdoptionI extends ArgumentI {
  citation: Entity
}

interface InferenceMakingI extends ArgumentI {
  logicType: Entity;
  premises: List<{value: Entity, type: Rdf.Iri}>;
}

export type Argument = Observation | InferenceMaking | BeliefAdoption;

export type Observation = Record.IRecord<ObservationI>;
export const Observation = Record<ObservationI>({
  place: null, time: null, note: null, title: null,
});

export type InferenceMaking = Record.IRecord<InferenceMakingI>;
export const InferenceMaking = Record<InferenceMakingI>({
  logicType: null, premises: null, note: null, title: null,
});

export type BeliefAdoption = Record.IRecord<BeliefAdoptionI>;
export const BeliefAdoption = Record<BeliefAdoptionI>({
  citation: null, note: null, title: null,
});
