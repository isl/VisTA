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

import * as Kefir from 'kefir';
import {
  Component, Children, ReactElement, createFactory, cloneElement, createElement,
} from 'react';
import * as maybe from 'data.maybe';

import { SparqlUtil } from 'platform/api/sparql';
import { addToDefaultSet } from 'platform/api/services/ldp-set';
import {  getOverlaySystem } from 'platform/components/ui/overlay';

import { SaveSetDialog } from 'platform/components/sets';
import { QueryService } from 'platform/api/services/ldp-query';
import { ResultContext, ResultContextTypes } from 'platform/components/semantic/search';
import { serializeSearch } from '../data/search/Serialization';


export interface SaveSearchResultActionProps {
  id: string

  /**
   * `true` if saved search should be added to the default set of the current user
   *
   * @default false
   */
  addToDefaultSet?: boolean
}

class SaveSearchResultAction extends Component<SaveSearchResultActionProps, {}> {
  static contextTypes = ResultContextTypes;
  context: ResultContext;
  dialogRef = 'save-search-dialog';

  static defaultProps = {
    addToDefaultSet: false,
  };

  constructor(props) {
    super(props);
  }

  private onSave = () => {
    getOverlaySystem().show(
      this.dialogRef,
      createElement(SaveSetDialog, {
        onSave: this.saveAsNewSearch.bind(this),
        onHide: () => getOverlaySystem().hide(this.dialogRef),
        maxSetSize: maybe.Nothing<number>(),
        title: 'Save search',
        placeholder: 'Search name',
      })
    );
  }

  private saveAsNewSearch = (name: string) => {
    return !this.context.resultQuery.isNothing ?
      QueryService().addItem({
        value: SparqlUtil.serializeQuery(this.context.resultQuery.get()),
        type: 'SELECT',
        label: name,
        structure: serializeSearch(
          this.context.baseQueryStructure.getOrElse(undefined),
          this.context.facetStructure.getOrElse(undefined)
        )
      }).flatMap(
        res => this.props.addToDefaultSet ?
          addToDefaultSet(res, this.props.id) : Kefir.constant(res)
      ).onValue(value => {
        getOverlaySystem().hide(this.dialogRef);
      }) : null;
  }

  public render() {
    const child = Children.only(this.props.children) as ReactElement<any>;
    const props = {
      onClick: this.onSave,
    };

    return cloneElement(child, props);
  }
}

export type component = SaveSearchResultAction;
export const component = SaveSearchResultAction;
export const factory = createFactory(component);
export default component;
