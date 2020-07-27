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

import { DOM as D, Component, createFactory, Props as ReactProps } from 'react';
import * as ReactSelectComponent from 'react-select';
import * as block from 'bem-cn';
import * as classNames from 'classnames';
import * as Kefir from 'kefir';
import { List } from 'immutable';
import * as maybe from 'data.maybe';

import { BeliefAdoption } from '../../data/arguments/Model';
import { Entity, bindingToEntity } from '../../data/Common';

import { ZoteroSearch, ZoteroSearchConfig } from './ZoteroSearchComponent';

export interface BeliefConfig {
  zoteroSelector: ZoteroSearchConfig
}

export interface Props {
  config: BeliefConfig
  onChange: (beliefAdoption: BeliefAdoption) => void
}

interface State {
  citations: List<Data.Maybe<Entity>>
}

const b = block('argument-belief-adoption');

export class BeliefAdoptionComponent extends Component<Props, {}> {
  constructor(props: Props) {
    super(props);
    this.state = {
      citations: List.of(maybe.Nothing<Entity>()),
    };
  }

  render() {
    return ZoteroSearch({
      className: b('citation').toString(),
      config: this.props.config.zoteroSelector,
      onSelected: this.onCitationSelected,
    });
  }

  private onCitationSelected = (citation: Entity) => {
    this.props.onChange(
      BeliefAdoption({
        citation: citation,
      })
    );
  }
}
