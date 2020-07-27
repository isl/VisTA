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

import { DOM as D, ReactElement, Component, createFactory, Props as ReactProps, createElement } from 'react';
import { RadioGroup, Radio } from 'react-radio-group';
import * as block from 'bem-cn';
import * as maybe from 'data.maybe';
import * as classNames from 'classnames';
import * as _ from 'lodash';


import InferenceMakingInput from './InferenceMakingInputComponent';
import { Argument } from '../../data/arguments/Model';
import { Actions } from '../../data/arguments/Actions';
import { ObservationInput, PlaceSelectorProps } from './ObservationInputComponent';
import { BeliefAdoptionComponent, BeliefConfig } from './BeliefAdoptionComponent';

import '../../scss/assertions/NewArgumentComponent.scss';

const b = block('rs-new-argument');

export interface Config {
  // inference: {
  //   clipboard: TypedClipboardConfig
  //   logicType: ClipboardSelectorConfig
  // }
  observation: {
    placeSelectorConfig: PlaceSelectorProps
  }
  beliefAdoption: BeliefConfig
}

export interface NewArgumentProps {
  config: Config
  actions: Actions
}

interface State {
  activeArgumentType?: ArgumentType
  argument?: Data.Maybe<Argument>
  title?: Data.Maybe<string>
  note?: Data.Maybe<string>
}

enum ArgumentType {
  OBSERVATION, BELIEF_ADOPTION, INFERENCE,
}

interface RadioGroupEntry {
    type: ArgumentType
    label: string
}

export class NewArgumentComponent extends Component<NewArgumentProps, State> {
  private radioGroupEntries: RadioGroupEntry[];

  constructor(props: NewArgumentProps) {
    super(props);

    this.state = {
      activeArgumentType: null,
      argument: maybe.Nothing<Argument>(),
      note: maybe.Nothing<string>(),
      title: maybe.Nothing<string>(),
    };

    this.radioGroupEntries = [
      {
        type: ArgumentType.OBSERVATION,
        label: 'Observation',
      },
      {
        type: ArgumentType.BELIEF_ADOPTION,
        label: 'Belief Adoption',
      },
      {
        type: ArgumentType.INFERENCE,
        label: 'Inference',
      },
    ];
  }

  render() {
    return createElement(
      RadioGroup,
      {
        name: 'argumentType',
        selectedValue: this.state.activeArgumentType,
        onChange: this.onArgumentTypeChange,
      },
      D.div(
        {className: b('panel')},
        _.reduce(this.radioGroupEntries, (result, e: RadioGroupEntry) => {
          result.push(
            D.label(
              {className: b('radio-label')},
              createElement(
                Radio, {
                  value: e.type, title: e.label,
                  className: b('radio').toString(),
                }),
              e.label
            )
          );
          result.push(this.getArgumentComponent(e.type));
          return result;
        }, new Array<ReactElement<any>>())
      )
    );
  }

  private getArgumentComponent = (type: ArgumentType) => {
    if (this.state.activeArgumentType != type) {
      return D.span();
    }
    var comp;

    if (this.state.activeArgumentType === ArgumentType.INFERENCE) {
      comp = InferenceMakingInput({
        // clipboard: null as any ,//this.props.config.inference.clipboard,
       // logicType: null,//this.props.config.inference.logicType,
        onChange: i => this.setState({argument: maybe.Just(i)}),
      });
    } else if (this.state.activeArgumentType === ArgumentType.BELIEF_ADOPTION) {
      comp = D.div(
        {},
        createElement(BeliefAdoptionComponent, {
          config: this.props.config.beliefAdoption,
          onChange: i => this.setState({argument: maybe.Just(i)}),
        })
      );
    } else {
      comp = ObservationInput({
        placeSelectorProps: this.props.config.observation.placeSelectorConfig,
        onChange: o => this.setState({argument: maybe.Just(o)}),
      });
    }

    return D.div(
      {
        className: b('argument-inputs-panel'),
      },
      D.div(
        {className: b('argument-inputs').toString()},
        D.input(
          {
            className: classNames('form-control', b('title').toString()),
            placeholder: 'Title',
            onChange: this.onTitleChange,
          }
        ),
        D.textarea({
          className: classNames('form-control', b('note').toString()),
          placeholder: 'Note',
          onChange: this.onNoteChange,
        }),
        comp,
        D.button(
        {
          className: classNames('btn', 'btn-primary', b('save-button').toString()),
          disabled: this.isSaveDisabled(),
          onClick: this.onSave,
        }, 'Save')
      )
    );
  }

  private onNoteChange = (event) => {
    const value = event.target.value;
    this.setState({
      note: _.isEmpty(value) ? maybe.Nothing<string>() : maybe.Just(value),
    });
  }

  private onTitleChange = (event) => {
    const value = event.target.value;
    this.setState({
      title: _.isEmpty(value) ? maybe.Nothing<string>() : maybe.Just(value),
    });
  }

  private onArgumentTypeChange = (value: ArgumentType) => {
    this.setState({
      activeArgumentType: value,
    });
  }

  private onSave = () => {
    const argumentWithNote =
        this.state.argument.get()
          .set('note', this.state.note.get())
          .set('title', this.state.title.get());
    this.props.actions.createArgument(argumentWithNote);
  }

  private isSaveDisabled = () => {
    return this.state.argument.isNothing || this.state.note.isNothing;
  }
}

export const NewArgument = createFactory(NewArgumentComponent);
export default NewArgument;
