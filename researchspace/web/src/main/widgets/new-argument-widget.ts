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
import { Config as ArgumentsConfig, NewArgument } from '../components/assertions/NewArgumentComponent';
import { Entity } from '../data/Common';
import { ArgumentsStore } from '../data/arguments/ArgumentsStore';

interface Config extends ArgumentsConfig {
  assertionUri: string
  entity: {
    uri: string
    label: string
  }
}

interface Props {
  config: Config
}

export class NewArgumentWidget extends Component<Props, {}> {
  private argumentsStore: ArgumentsStore;

  constructor(props: Props) {
    super(props);

    this.argumentsStore = new ArgumentsStore({
      assertionUri: Rdf.iri(props.config.assertionUri),
      entity: Entity({
        iri: Rdf.iri(props.config.entity.uri),
        label: Rdf.literal(props.config.entity.label),
        tuple: null,
      }),
    });
  }

  render() {
    return NewArgument({
      config: this.props.config,
      actions: this.argumentsStore.actions,
    });
  }
}

export type c = NewArgumentWidget;
export const c = NewArgumentWidget;
export const f = createFactory(c);
export default c;
