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
import * as block from 'bem-cn';
import * as classNames from 'classnames';
import * as Kefir from 'kefir';
import * as moment from 'moment';

import { Observation } from '../../data/arguments/Model';
import { Entity, bindingToEntity } from '../../data/Common';
import { SparqlClient } from 'platform/api/sparql';
// import {DateTimePickerComponent} from '../../../../common/ts/components/DateTimePickerComponent';
// import { AutoCompletionInput } from '../../../../common/ts/components/AutoCompletionInputComponent';

const b = block('argument-observation-making');
export interface PlaceSelectorProps {
  query: string
  tupleTemplate: string
  labelBindingName: string
  uriBindingName: string
  minimumInput?: number
}

export interface Props {
  className?: string
  placeSelectorProps: PlaceSelectorProps
  onChange: (o: Observation) => void
}

export class ObservationInputComponent extends Component<Props, {}> {
  private place: Kefir.Pool<Entity>;
  private time: Kefir.Pool<moment.Moment>;

  constructor(props: Props) {
    super(props);

    this.place = Kefir.pool<Entity>();
    this.time = Kefir.pool<moment.Moment>();

    Kefir.combine(
      [this.place, this.time],
      (place: Entity, time: moment.Moment) =>
          Observation({
            place: place,
            time: time,
          })
    ).onValue(
      this.props.onChange
    );
  }

  render() {
    const css_input = block(b('input'));
    return D.div(
      {
        className: classNames(b.toString(), this.props.className),
      },
      D.div({className: css_input.toString()},
        D.span({
          className: classNames('input-group-addon', css_input('addonlabel').toString()),
        }, 'When')
        // DateTimePickerComponent({
        //   className: css_input('datetimepicker').toString(),
        //   inputFormat:'MM/DD/YY',
        //   defaultText: 'Select a Date',
        //   onChange: this.onDateSelected
        // })
      ),
      D.div({className: css_input.toString()},
        D.span({
          className: css_input('addonlabel').toString(),
        }, 'Where'),
        D.div({className: css_input('placeselector').toString()}
          // AutoCompletionInput({
          //   valueBindingName: this.props.placeSelectorProps.uriBindingName,
          //   query: this.props.placeSelectorProps.query,
          //   minimumInput: this.props.placeSelectorProps.minimumInput,
          //   actions: {
          //     onSelected: this.onSelected
          //   },
          //   templates: {
          //     suggestion: this.props.placeSelectorProps.tupleTemplate
          //   },
          //   placeholder: 'Search for Location'
          // })
        )
      )
    );
  }

  private onDateSelected = (value: string) => {
    this.time.plug(
      Kefir.constant(
        // value from datepicker is unix ms timestap, see http://momentjs.com/docs/#/parsing/string-format/
        moment(value, 'x')
      )
    );
  }

  private onSelected =
      (binding: SparqlClient.Binding) => {
        this.place.plug(
          Kefir.constant(
            bindingToEntity(
              binding,
              this.props.placeSelectorProps.uriBindingName,
              this.props.placeSelectorProps.labelBindingName
            )
          )
        );
      }
}

export const ObservationInput = createFactory(ObservationInputComponent);
export default ObservationInput;
