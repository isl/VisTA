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

import { DOM as D, ReactElement, Component, createFactory, Props as ReactProps, createElement } from 'react';

import { Rdf } from 'platform/api/rdf';
import { FieldValues } from '../data/fields/Model';
import AssertionsStore from '../data/assertions/AssertionsStore';
import NewAssertion from '../components/assertions/NewAssertionComponent';

interface Props {
  config: {
    fieldInstanceIri: string
  }
}

interface State {
  fieldValues?: FieldValues
  autosuggestion?: string
}

class NewAssertionsWidget extends Component<Props, State> {
  private assertionsStore: AssertionsStore;

  constructor(props: Props) {
    super(props);
    this.state = {};

    this.assertionsStore = new AssertionsStore({
      fieldInstanceIri: Rdf.iri(props.config.fieldInstanceIri),
    });
    this.assertionsStore.fieldValues.onValue(
      values => this.setState({fieldValues: values})
    );
    this.assertionsStore.autosuggestion.onValue(
      autosuggestion => this.setState({autosuggestion: autosuggestion})
    );
  }

  render(): ReactElement<any> {
    if (this.state.fieldValues) {
      return NewAssertion({
        fieldValues: this.state.fieldValues,
        autosuggestion: this.state.autosuggestion,
        actions: this.assertionsStore.actions,
      });
    } else {
      return D.div({});
    }
  }
}

export type c = NewAssertionsWidget;
export const c = NewAssertionsWidget;
export const f = createFactory(c);
export default c;
