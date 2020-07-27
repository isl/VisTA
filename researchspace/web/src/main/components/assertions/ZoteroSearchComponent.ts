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

import { Component, createFactory, createElement } from 'react';
import * as assign from 'object-assign';

import { SparqlClient } from 'platform/api/sparql';
import { Entity, bindingToEntity } from '../../data/Common';
import { BaseProps, AbstractAutoCompletionInput } from 'platform/components/ui/inputs';

import { searchCitations } from '../../data/arguments/ZoteroService';

export interface ZoteroSearchConfig extends BaseProps {
  tupleTemplate?: string
}

export interface Props {
  config: ZoteroSearchConfig
  className?: string
  onSelected: (value: Entity) => void
}

export class ZoteroSearchComponent extends Component<Props, {}> {
  render() {
    return createElement(AbstractAutoCompletionInput,
      assign({}, this.props.config, {
        className: this.props.className,
        queryFn: this.searchZotero,
        templates: {
          suggestion: this.props.config.tupleTemplate,
        },
        actions: {
          onSelected: this.onCitationSelected,
        },
      })
    );
  }

  private searchZotero(token: string) {
    return searchCitations(token);
  }

  private onCitationSelected = (citation: SparqlClient.Binding) => {
    console.log(citation);
    console.log(citation[this.props.config.valueBindingName]);
    this.props.onSelected(
      bindingToEntity(
        citation,
        this.props.config.valueBindingName,
        this.props.config.labelBindingName
      )
    );
  }
}

export const ZoteroSearch = createFactory(ZoteroSearchComponent);
export default ZoteroSearch;
