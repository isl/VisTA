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

import { DOM as D, Component, createFactory, createElement } from 'react';
import { List, Map, Set } from 'immutable';
import { RadioGroup, Radio } from 'react-radio-group';
import * as maybe from 'data.maybe';
import { DropdownButton as DropdownButton_, MenuItem as MenuItem_ } from 'react-bootstrap';
import * as block from 'bem-cn';
import * as classNames from 'classnames';
import * as _ from 'lodash';

import { Actions, BeliefValue } from '../../data/assertions/Actions';
import { FieldValues, FieldValue } from '../../data/fields/Model';

import { AutoCompletionInput } from 'platform/components/ui/inputs';

import '../../scss/assertions/NewAssertionsComponent.scss';

const b = block('mph-new-assertion');
const RadioGroupElement = createFactory(RadioGroup);
const DropdownButton = createFactory(DropdownButton_);
const MenuItem = createFactory(MenuItem_);

export interface Props {
  fieldValues: FieldValues;
  autosuggestion: string;
  actions: Actions;
}

interface State {
  title?: string;
  selectedBeliefs?: Map<FieldValue, Belief>;
}

enum Belief {
  AGREE, DISAGREE, NOOPINION,
}

export class NewAssertionComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      title: '',
      selectedBeliefs: Map<FieldValue, Belief>(
        props.fieldValues.map(field => [field, Belief.NOOPINION])
      ),
    };
  }

  render() {
    return D.div(
      {className: b('container')},
      D.input({
        required: true,
        className: 'form-control', placeholder: 'Title',
        onChange: event => this.setState({title: (<HTMLInputElement>event.target).value}),
      }),
      this.propositionGrid(this.props.fieldValues),
      this.newValueControls(),
      this.assertionActions()
    );
  }

  private propositionGrid(values: FieldValues) {
    const x =
        values.map(
          value =>
              RadioGroupElement(
                {
                  name: value.value.value,
                  selectedValue: this.state.selectedBeliefs.has(value) ? this.state.selectedBeliefs.get(value) : Belief.NOOPINION,
                  onChange: (newValue: Belief) => this.setState({
                    selectedBeliefs: this.state.selectedBeliefs.set(value, newValue),
                  }),
                },
                D.tr(
                  {
                    about: value.value.value,
                    title: value.label,
                    className: b('row'),
                  },
                  D.td({className: b('cell')}, D.div({className: b('value-label')}, value.label)),
                  [Belief.AGREE, Belief.DISAGREE, Belief.NOOPINION].map(
                    value =>
                      D.td(
                        {
                          className: b('cell'),
                        },
                        createElement(Radio, {
                          title: this.beliefToText(value),
                          value: value,
                        })
                      )
                  )
                )
              )
        );

    return D.table(
      {className: 'table'},
      D.thead(
        {},
        D.tr(
          {className: b('row')},
          ['', 'Agree', 'Disagree', 'No Opinion'].map(
            text => D.th({className: b('head-cell')}, text)
          )
        )
      ),
      D.tbody({}, x)
    );
  }

  private newValueControls() {
    return createElement(AutoCompletionInput, {
      query: this.props.autosuggestion,
      placeholder: 'Add new value ...',
      searchTermVariable: '_searchPattern',
      valueBindingName: '_value',
      templates: {
        empty: 'No matches for your query.',
        suggestion: '<span title="{{label.value}}">{{label.value}}</span>',
        displayKey: (x) => x['label'].value,
      },
      actions: {
        onSelected:  binding => this.props.actions.addNewValue({
          value: binding['_value'],
          label: binding['label'].value,
        }),
      },
      className: 'form-control',
    });
  }

  private assertionActions() {
    return D.div(
      {className: b('buttons')},
      D.button(
        {
          className: classNames('btn', 'btn-danger', b('cancel-button')),
          onClick: () => window.location.reload(false),
        }, 'Cancel'
      ),
      D.button(
        {
          disabled: this.isSaveButtonDisabled(),
          className: classNames('btn', 'btn-primary', b('save-button')),
          onClick: this.onSave,
        }, 'Save')
    );
  }

  /**
   * Save button is disabled if assertion title is empty, or there is no belief with opinion - agree or disagree
   */
  private isSaveButtonDisabled = () => {
    return _.isEmpty(this.state.title) || this.state.selectedBeliefs.every(b => {
      return b !== Belief.AGREE && b !== Belief.DISAGREE;
    });
  }

  private onSave = () => {
    const selectedBeliefs =
        <Set<BeliefValue>>this.state.selectedBeliefs.filter(
          belief => belief !== Belief.NOOPINION
        ).toMap().reduce(
          (acc, belief, key) => {
            switch (belief) {
            case Belief.AGREE:
              return acc.add({belief: true, value: key});
            case Belief.DISAGREE:
              return acc.add({belief: false, value: key});
            default: acc;
            }
          }, Set<BeliefValue>()
        );
    this.props.actions.createAssertion({
      beliefValues: selectedBeliefs,
      title: this.state.title,
    });
  }

  private beliefToText(belief: Belief): string {
    switch (belief) {
    case(Belief.AGREE): return 'Agree';
    case(Belief.DISAGREE): return 'Disagree';
    case(Belief.NOOPINION): return 'No Opinion';
    }
  }

}

const NewAssertion = createFactory(NewAssertionComponent);
export default NewAssertion;
