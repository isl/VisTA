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

import { List } from 'immutable';
import * as Kefir from 'kefir';

import { Rdf } from 'platform/api/rdf';

import { FieldsStore, Actions as FieldsActions } from './FieldsStore';
import { Field } from './Model';

export class Config {
  resource: Rdf.Iri;
}

export class ObjectViewStore {
  private fieldsStore: FieldsStore;

  constructor(config: Config) {
    // TODO typings seem to be all the time wrong here,
    // but somehow worked until we upgraded to typescript 2.0
    this.fieldsStore = new FieldsStore(config.resource as any);
  }

  public get fields(): Kefir.Property<List<Field>> {
    return this.fieldsStore.fields;
  }

  public fieldsActions(): FieldsActions {
    return this.fieldsStore.actions();
  }
}

export default ObjectViewStore;
