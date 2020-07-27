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

import { DOM as D, Component, createFactory, Props as ReactProps, createElement } from 'react';
import { List } from 'immutable';

import { Rdf } from 'platform/api/rdf';

import { Field } from '../data/object/Model';
import FieldsStore from '../data/object/FieldsStore';
import { FieldsView, FieldsViewComponent } from '../components/assertions/FieldsView';

interface Props extends ReactProps<ObjectViewWidget> {
  config: {
    resource: string
    assertionsQuery: string
    annotationsQuery: string
  };
}

interface State {
  fields?: List<Field>;
}

export class ObjectViewWidget extends Component<Props, State> {
  private store: FieldsStore;

  constructor(props) {
    super(props);
    this.state = {
      fields: List<Field>(),
    };

    this.store = new FieldsStore({
      resource: Rdf.iri(props.config.resource),
      assertionsQuery: props.config.assertionsQuery,
      annotationsQuery: props.config.annotationsQuery,
    });
    this.store.fields.onValue(
      fields =>
          this.setState({
            fields: fields,
          })
    );
  }

  render() {
    return D.div(
      {
        className: 'object-page',
      },
      FieldsView({
        fields: this.state.fields,
        actions: this.store.actions(),
      })
    );
  }
}

export type c = ObjectViewWidget;
export const c = ObjectViewWidget;
export const f = createFactory(c);
export default c;
