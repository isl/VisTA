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

import { List } from 'immutable';
import * as React from 'react';
import { DOM as D, Component, createFactory, Props as ReactProps } from 'react';
import { Table as Table_ } from 'react-bootstrap';


import { RdfValueDisplay } from 'platform/components/utils/RdfValueDisplay';

import { Field } from '../../data/object/Model';

import { Actions } from '../../data/object/FieldsStore';

import '../../scss/assertions/FieldsView.scss';

const Table = createFactory(Table_);

export interface Props extends ReactProps<FieldsViewComponent> {
  fields: List<Field>;
  actions: Actions
}

export class FieldsViewComponent extends Component<Props, {}> {

  render() {
    return this.fieldsTable();
  }

  private fieldsTable() {
    return Table(
      {
        className: 'metaphacts-table-widget-holder',
        responsive: true,
      },
      D.thead(
        {
          role: 'header',
        },
        D.tr(
          {},
          D.th({
            bem_element: 'my',
          } as any, 'Field'),
          D.th({}, 'Value'),
          D.th({}, 'Annotations'),
          D.th({}, 'Assertions')

        )
      ),
      D.tbody(
        {},
        this.fields()
      )
    );
  }

  private fields = () => {
    return this.props.fields.map(this.renderField);
  }

  private renderField = (field: Field) => {
    return D.tr(
      {
        key: field.iri.value,
        className: 'object-page__fields__field',
      },
      D.td(
        {
          key: 'field-label-column',
        },
        React.createElement(
          RdfValueDisplay,
          {
            className: 'object-page__fields__field__label',
            data: field.iri,
          }
        )
      ),
      D.td(
        {
          key: 'field-values-column',
        }, this.fieldValuesColumn(field)
      ),
      D.td(
        {
          key: 'annotations-column',
        }, this.annotationValuesColumn(field)
      ),
      D.td(
        {
          key: 'assertions-column',
        }, this.assertionValuesColumn(field)
      )
    );
  }

  private fieldValuesColumn(field: Field) {
    return D.div(
      {
        className: 'object-page__fields__field__values',
      },
      this.fieldValues(field)
    );
  }

  private assertionValuesColumn(field: Field) {
    return [
      D.div(
        {
          className: 'object-page__fields__field__assertion__icon',
          key: 'assertion-icon-holder',
        }
      ),
      D.div(
        {
          className: 'object-page__fields__field__assertion__count',
          key: 'assertion-size-holder',
        },
        field.assertions.size
      )];
  }

  private annotationValuesColumn(field: Field) {
    return [
      D.div(
        {
          className: 'object-page__fields__field__annotation__icon',
          key: 'annotation-icon-holder',
        }
      ),
      D.div(
        {
          className: 'object-page__fields__field__annotation__count',
          key: 'annotation-size-holder',
        },
        field.annotations.size
      )];
  }

  private fieldValues(field: Field) {
    return field.values.map(value => {
      return React.createElement(
        RdfValueDisplay,
        {
          key: value.value.value,
          className: 'object-page__fields__field__values__value',
          data: value.value,
        }
      );
    });
  }
}

export const FieldsView = createFactory(FieldsViewComponent);

export default FieldsView;
