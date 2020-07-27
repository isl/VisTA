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

import { Rdf } from 'platform/api/rdf';

import { FinalizedModel } from '../FieldValues';

export interface TriplestorePersistence {
  persist(initialModel: FinalizedModel, currentModel: FinalizedModel): Kefir.Property<void>;
}

export default TriplestorePersistence;

export function valuesDifference(
  oldValues: ReadonlyArray<Rdf.Node>,
  newValues: ReadonlyArray<Rdf.Node>
) {
  const oldSet = Immutable.Set<Rdf.Node>(oldValues);
  const newSet = Immutable.Set<Rdf.Node>(newValues);
  return {
    deleted: oldSet.subtract(newSet).toList(),
    inserted: newSet.subtract(oldSet).toList(),
  };
}
