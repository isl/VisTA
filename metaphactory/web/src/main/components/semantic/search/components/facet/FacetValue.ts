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

import { Component, DOM as D, Props, createFactory, createElement, MouseEvent } from 'react';

import { TemplateItem } from 'platform/components/ui/template';
import { Spinner } from 'platform/components/ui/spinner';

import { Resource } from '../../data/Common';
import {Literal} from '../../data/search/Model';

export interface FacetValueProps extends Props<FacetValueComponent> {
  kind: 'resource' | 'literal'
  facetValue: {
    entity: Resource | Literal
    selected: boolean
    tupleTemplate: {resource: string, literal: string}
  }
  highlight?: string
  actions: {
    toggleFacetValue: (term: Resource | Literal) => void
  }
}

interface FacetValueState {
  isLoading: boolean
}


/**
 * Displays facet value of Resource type.
 * It would be required to implement other facet value component
 * for other facet value kinds, e.g. date slider etc.
 */
export class FacetValueComponent extends Component<FacetValueProps, FacetValueState> {
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

  renderCheckboxLabel() {
    const {kind} = this.props;
    const template = this.props.facetValue.tupleTemplate[kind];
    return createElement(TemplateItem, {
      template: {
        source: template,
        options: {highlight: this.props.highlight, ...(this.props.facetValue.entity as any).tuple},
      },
    });
  }

  render() {
    return D.div(
      {
        className: 'facet__relation__values__value checkbox',
        onClick: this.onValueClick.bind(this),
      },
      D.label(
        {},
        D.input(
          {
            type: 'checkbox',
            className: 'checkbox',
            checked: this.props.facetValue.selected,
          }
        ),
        this.renderCheckboxLabel(),
        this.state.isLoading ? createElement(Spinner) : D.span({})
      )
    );
  }

  private onValueClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();

    // Event is fired twice, because we have input element inside label element.
    // so we need to trigger action only once.
    // The idea is to trigger it only for checkbox element.
    if (event.target['tagName'] === 'INPUT') {
      this.setState({
        isLoading: true,
      });
      this.props.actions.toggleFacetValue(
        this.props.facetValue.entity
      );
    }
  }
}

export const FacetValue = createFactory(FacetValueComponent);
export default FacetValue;
