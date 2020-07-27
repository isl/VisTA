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

import { Set, Record } from 'immutable';

import { Rdf } from 'platform/api/rdf';

import { FieldValue } from '../fields/Model';

interface AssertionI {
  title: string;
  beliefs: Beliefs;
}

export type Assertion = Record.IRecord<AssertionI>;
export const Assertion = Record<AssertionI>({
  title: '',
  beliefs: Set<Belief>(),
});

export type Beliefs = Set<Belief>;

interface BeliefI {
  propositionSet: PropositionSet;
  beliefValue: BeliefValue;
}
export type Belief = Record.IRecord<BeliefI>;
export const Belief = Record<BeliefI>({propositionSet: null, beliefValue: null});

export interface PropositionSet {
  propositions: Set<Proposition>;
  metadata: {
    fieldLabel: string;
    fieldValue: Set<FieldValue>;
  };
}
export type Proposition = Rdf.Triple;
export type BeliefValue = boolean;
