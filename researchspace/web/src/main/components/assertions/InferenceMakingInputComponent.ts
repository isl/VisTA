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
import { DOM as D, Component, createFactory, Props as ReactProps } from 'react';
import * as ReactSelectComponent from 'react-select';
import * as block from 'bem-cn';
import * as classNames from 'classnames';
import * as maybe from 'data.maybe';
import * as _ from 'lodash';

import { SparqlClient } from 'platform/api/sparql';
import { Rdf } from 'platform/api/rdf';

import { Entity, bindingToEntity } from '../../data/Common';
import { InferenceMaking } from '../../data/arguments/Model';

const b = block('argument-inference-making');
const ReactSelect = createFactory(ReactSelectComponent);

export interface Props {
  className?: string
  // clipboard: TypedClipboardConfig
  // logicType: ClipboardSelectorConfig
  onChange: (inference: InferenceMaking) => void;
}
export interface State {
  logicType?: Data.Maybe<Entity>;
  premises?: List<Data.Maybe<{value: Entity, type: Rdf.Iri}>>;
}

export class InferenceMakingInputComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      logicType: maybe.Nothing<Entity>(),
      premises: List.of(maybe.Nothing<{value: Entity, type: Rdf.Iri}>()),
    };
  }

  render() {
    return D.div(
      {
        className: classNames('argument-inference-making', this.props.className),
      },
      // ClipboardSelector({
      //   className: b('logic-type').toString(),
      //   config: this.props.logicType,
      //   onSelected: this.onLogicTypeSelected
      // }),
      // this.premises(),
      D.button(
        {
          className: classNames('btn', 'btn-link', b('add-premise-button').toString()),
          onClick: () =>
              this.setState({
                premises: this.state.premises.push(maybe.Nothing<{value: Entity, type: Rdf.Iri}>()),
              }),
        },
        'Add another premise...'
      )
    );
  }

  private premises() {
    // return _.map(
    //   _.range(this.state.premises.size),
    //   i =>
    //       // TypedClipboardSearchInput({
    //       //   key: i,
    //       //   className: b('clipboard-holder').toString(),
    //       //   config: this.props.clipboard,
    //       //   onSelected: (value: SelectedValue) => {
    //       //     const { uriBindingName, labelBindingName } = this.props.clipboard.resourceSelector;
    //       //     const premiseEntity =
    //       //         bindingToEntity(value.binding, uriBindingName, labelBindingName);
    //       //     const premise = {
    //       //       value: premiseEntity,
    //       //       type: value.type
    //       //     }
    //       //     const newPremises =
    //       //         this.state.premises.set(
    //       //           i, maybe.Just(premise)
    //       //         );
    //       //     this.setState({
    //       //       premises: newPremises
    //       //     });
    //       //     this.emitOnChange(newPremises, this.state.logicType);
    //       //   }
    //       // })
    // );
  }

  private onLogicTypeSelected = (value: SparqlClient.Binding) => {
    const { uriBindingName, labelBindingName } = null as any; // this.props.logicType;
    const logicType =
        maybe.Just(
          bindingToEntity(
            value, uriBindingName, labelBindingName
          )
        );
    this.setState({
      logicType: logicType,
    });
    this.emitOnChange(this.state.premises, logicType);
  }

  private emitOnChange = (premises, logicType) => {
    const complete = premises.every(p => p.isJust) && logicType.isJust;
    if (complete) {
      this.props.onChange(
        InferenceMaking({
          logicType: logicType.get(),
          premises: premises.map(m => m.get()),
        })
      );
    }
  }
}

export const InferenceMakingInput = createFactory(InferenceMakingInputComponent);
export default InferenceMakingInput;
