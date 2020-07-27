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

import { Component, DOM as D, createFactory } from 'react';

import CategorySelector from '../search/CategorySelector';
import RelationFacet from './RelationFacet';
import { Actions, FacetData } from '../../data/facet/FacetStore';
import { Category } from '../../data/profiles/Model';

import './Facet.scss';

export interface FacetProps {
  data: FacetData
  actions: Actions
}

export class FacetComponent extends Component<FacetProps, {}> {

  render() {
    return D.div(
      {className: 'facet'},
      // we need to show category selector only if we have more than one range
      this.props.data.categories.size > 1 ?
        D.div(
          {className: 'facet__category-selector-holder'},
          CategorySelector({
            mode: this.props.data.viewState.selectorMode,
            tupleTemplate: this.props.data.viewState.categoryTemplate,
            entities: this.props.data.categories,
            actions: {
              onValueChange: this.onCategoryChange,
            },
            selectedElement: this.props.data.viewState.category,
          })
        ) : null,
      this.renderRelations()
    );
  }

  private renderRelations() {
    return D.div(
      {className: 'facet-relations'},
      this.props.data.relations.map(
        relationEntity =>
          RelationFacet({
            key: relationEntity.iri.value,
            relation: relationEntity,
            data: this.props.data,
            actions: this.props.actions,
          })
      )
    );
  }

  private onCategoryChange = (clas: Category) => {
    this.props.actions.toggleCategory(clas);
  }
}

export const Facet = createFactory(FacetComponent);
export default Facet;
