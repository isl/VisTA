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

import {
  ReactElement, cloneElement, Children,
} from 'react';
import * as assign from 'object-assign';
import * as _ from 'lodash';

import { Component, ComponentContext } from 'platform/api/components';
import { LdpService } from 'platform/api/services/ldp';


interface IriProps {
  iri: string;
}
interface SelectionProps {
  selection: string[];
}
export type Props = IriProps | SelectionProps;

function isIriProps(props: Props): props is IriProps {
  return _.has(props, 'iri');
}
function isSelectionProps(props: Props): props is SelectionProps {
  return _.has(props, 'selection');
}

/**
 * Export LDP resource.
 * @example
 *  <mp-ldp-export-resource iri="http://example.com/resource">
 *      <button class="btn btn-default">Export resource</button>
 *  </mp-ldp-export-resource>
 */
export class ExportResourceComponent extends Component<Props, {}> {
  constructor(props: Props, context: ComponentContext) {
    super(props, context);
    this.checkProps(props);
  }

  componentWillReceiveProps(props: Props) {
    this.checkProps(props);
  }

  checkProps(props: Props) {
    if (isIriProps(props) === isSelectionProps(props)) {
      throw 'Property iri xor selection of mp-ldp-export-resource should be set';
    }
  }

  getLDPService() {
    const ldpContext = this.context.semanticContext && this.context.semanticContext.repository ?
      {repository: this.context.semanticContext.repository} : {};
    return new LdpService('', ldpContext);
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const selection = isIriProps(this.props) ? [this.props.iri] : this.props.selection;
    const exportURL = this.getLDPService().getExportURL(selection);
    return cloneElement(child, assign({}, child.props, {
      disabled: isSelectionProps(this.props) && this.props.selection.length === 0,
      onClick: () => {
        window.open(exportURL, '_blank');
      },
    }));
  }
}

export default ExportResourceComponent;
