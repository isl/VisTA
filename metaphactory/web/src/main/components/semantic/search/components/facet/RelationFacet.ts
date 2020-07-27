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

import { PureComponent, DOM as D, createFactory, Props, createElement } from 'react';
import * as maybe from 'data.maybe';
import * as InfiniteComponent from 'react-infinite';
import * as classnames from 'classnames';
import * as nlp from 'nlp_compromise';
import * as _ from 'lodash';

import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';
import { ClearableInput } from 'platform/components/ui/inputs';

import { Resource } from '../../data/Common';
import {Actions, FacetData, FacetViewState} from '../../data/facet/FacetStore';
import { Relation } from '../../data/profiles/Model';
import * as F from '../../data/facet/Model';
import * as Model from '../../data/search/Model';

import FacetValue from './FacetValue';
import { FacetSlider, SliderRange } from './slider/FacetSlider';
import {Literal, NumericRange, DateRange} from '../../data/search/Model';

interface RelationFacetProps extends Props<RelationFacetComponent> {
  relation: Relation
  data: FacetData
  actions: Actions
}

/**
 * react-infinite component which is used to show facet values,
 * in future it can be used to implement lazy-loading of facet values
 */
const Infinite = createFactory(InfiniteComponent);

interface RelationFacetState {
  isLoading?: boolean
  filterString?: string
}

/**
 * Component which displays all facet values specific to the given relation.
 */
export class RelationFacetComponent extends PureComponent<RelationFacetProps, RelationFacetState> {
  constructor() {
    super();
    this.state = {
      isLoading: false,
    };
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      isLoading: false,
    });
  }

  render() {
    const isSelectedRelation =
      this.props.data.viewState.relation.map(
        res => res.iri.value === this.props.relation.iri.value
      ).getOrElse(false);

    return D.div(
      {className: 'facet__relation'},
      D.div(
        {
          className: 'facet__relation__header',
          onClick: this.onRelationClick().bind(this),
        },
        D.i({
          className: classnames({
            'facet__relation__header__icon--selected': isSelectedRelation,
            'facet__relation__header__icon': !isSelectedRelation,
          }),
        }),
        createElement(TemplateItem, {
          template: {
            source: this.props.data.viewState.relationTemplate,
            options: this.props.relation.tuple,
          },
        }),
        this.state.isLoading ? createElement(Spinner) : D.span({})
      ),
      isSelectedRelation && !this.state.isLoading ?
        this.renderRelationFacetBody(this.props.data.viewState) : D.div({})
    );
  }

  private renderRelationFacetBody(viewState: FacetViewState) {
    const {relationType, values} = viewState;
    if (relationType === 'resource' || relationType === 'literal') {
      return this.renderFacetValues(values as Array<Resource | Literal>, relationType);
    } else if (relationType === 'numeric-range' || relationType === 'date-range') {
      return this.renderSlider(values as Array<NumericRange | DateRange>, relationType);
    }
    return null;
  }

  private renderFacetValues(facetValues: Array<Resource | Literal>, kind: 'resource' | 'literal') {
    const rangeLabel = this.props.relation.hasRange.label;
    const filterString = this.state.filterString ? this.state.filterString : '';
    return D.div(
      {className: 'facet__relation__values'},
      createElement(ClearableInput, {
        type: 'text',
        className: 'facet__relation__values__filter',
        placeholder: `Search ${nlp.noun(rangeLabel).pluralize()}...`,
        value: filterString,
        onClear: () => this.setState({filterString: undefined}),
        onChange: (event) => {
          const value = (event.target as any).value;
          this.setState({filterString: value});
        },
      }),
      Infinite(
        {
          elementHeight: 20,
          containerHeight: 250,
        },
        facetValues.filter(facetValue => {
          const text = kind === 'resource' ? (facetValue as Resource).label : (facetValue as Literal).literal.value;
          return !filterString || text.toLowerCase().indexOf(filterString.toLowerCase()) >= 0;
        }).map(facetValue => FacetValue({
          key: kind === 'resource' ? (facetValue as Resource).iri.value : (facetValue as Literal).literal.value,
          kind: kind,
          facetValue: {
            entity: facetValue,
            tupleTemplate: this.props.data.viewState.valuesTemplate,
            selected: this.isTermSelected(facetValue),
          },
          highlight: filterString,
          actions: {
            toggleFacetValue: this.props.actions.setFacetValue(this.props.relation),
          },
        }))
      )
    );
  }

  private renderSlider(facetValues: Array<NumericRange | DateRange>, kind: 'numeric-range' | 'date-range') {
    const value = maybe.fromNullable(
      _.find(this.props.data.ast.conjuncts, c => c.relation.iri.equals(this.props.relation.iri))
    ).chain(conjunct => {
      if (_.isEmpty(conjunct.disjuncts)) {
        return maybe.Nothing<NumericRange | DateRange>();
      } else {
        return maybe.Just(_.head(conjunct.disjuncts).value);
      }
    });
    return FacetSlider({
      kind: kind,
      data: facetValues,
      value: value,
      actions: {
        toggleFacetValue: this.props.actions.setFacetValue(this.props.relation),
      },
    });
  }

  private onRelationClick() {
    return () => {
      this.setState({
        isLoading: true,
      });

      this.props.actions.toggleRelation(
        this.props.relation
      );
    };
  }

  private isTermSelected(facetValueEntity: Resource | Literal) {
    const maybeConjunct = _.find(
      this.props.data.ast.conjuncts,
      conjunct => conjunct.relation.iri.equals(this.props.relation.iri)
    );

    return maybe.fromNullable(maybeConjunct).chain(
      conjunct =>
          maybe.fromNullable(
            _.find(
              conjunct.disjuncts,
              disjunct => {
                if (Model.isLiteralDisjunct(disjunct)) {
                  return (disjunct.value.literal.equals((facetValueEntity as Literal).literal));
                } else {
                  return (disjunct.value as Resource).iri.equals((facetValueEntity as Resource).iri);
                }
              }
            )
          )
    ).cata({
      Just: () => true,
      Nothing: () => false,
    });
  }
}

export const RelationFacet = createFactory(RelationFacetComponent);
export default RelationFacet;
