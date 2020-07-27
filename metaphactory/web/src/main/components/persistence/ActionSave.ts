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

import {DOM as D, createFactory, cloneElement, Children} from 'react';
import * as ReactBootstrap from 'react-bootstrap';
import * as Kefir from 'kefir';

import { Component, ComponentContext, ContextTypes } from 'platform/api/components';
import { GlobalEventsContextTypes, GlobalEventsContext } from 'platform/api/events';
import { VocabPlatform } from 'platform/api/rdf/vocabularies/vocabularies';
import {ldpc} from 'platform/api/services/ldp';
import { SetManagementEvents  } from 'platform/api/services/ldp-set/SetManagementEvents';
import { addToDefaultSet } from 'platform/api/services/ldp-set';
import {componentToGraph} from 'platform/api/persistence/ComponentPersistence';
import {Spinner} from 'platform/components/ui/spinner/Spinner';
import {
  ResourceLinkComponent as ResourceLinkComponent
} from 'platform/api/navigation/components/ResourceLinkComponent';

const Button = createFactory(ReactBootstrap.Button);
const Modal = createFactory(ReactBootstrap.Modal);
const ModalHeader = createFactory(ReactBootstrap.ModalHeader);
const ModalFooter = createFactory(ReactBootstrap.ModalFooter);
const ModalBody = createFactory(ReactBootstrap.ModalBody);
const FormControl = createFactory(ReactBootstrap.FormControl);
const ResourceLink = createFactory(ResourceLinkComponent);


interface Props {
  id: string
  component?: any


  /**
   * `true` if persisted component should be added to the default set of the current user
   *
   * @default false
   */
  addToDefaultSet?: boolean
}

interface State {
  show: '' | 'editor' | 'saving' | 'success'
  savedIri?: string
  label?: string
  description?: string
}

export class ActionSaveComponent extends Component<Props, State> {
  static contextTypes = {...ContextTypes, ...GlobalEventsContextTypes};
  context: ComponentContext & GlobalEventsContext;

  static defaultProps = {
    addToDefaultSet: false,
  };

  constructor(props: Props, context: any) {
    super(props, context);
    this.state = {show: ''};
    this.onClick = this.onClick.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);
  }

  onClick() {
    this.setState({show: 'editor'});
  }

  onSave() {
    this.setState({show: 'saving'});
    const graph = componentToGraph(this.props.component, this.state.label, this.state.description);
    ldpc(VocabPlatform.PersistedComponentContainer.value).addResource(graph)
      .flatMap(
        res => this.props.addToDefaultSet ?
          addToDefaultSet(res, this.props.id) : Kefir.constant(res)
      )
      .onValue(resourceIri => {
        this.context.GLOBAL_EVENTS.trigger(
          {eventType: SetManagementEvents.ItemAdded, source: this.props.id}
        );
        this.setState({show: 'success', savedIri: resourceIri.value});
      });
  }

  onCancel() {
    this.setState({
      show: '',
      savedIri: undefined,
      label: undefined,
      description: undefined,
    });
  }

  renderModal() {
    switch (this.state.show) {
      case 'editor':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Save visualization'),
          ModalBody({},
            'Label:', FormControl({
              value: this.state.label ? this.state.label : '',
              onChange: (e) => {
                const newValue = (e.target as any).value;
                this.setState({label: newValue});
              },
            }),
            'Description:', FormControl({
              type: 'textarea',
              value: this.state.description ? this.state.description : '',
              onChange: (e) => {
                const newValue = (e.target as any).value;
                this.setState({description: newValue});
              },
            })
          ),
          ModalFooter({},
            Button({disabled: !this.state.label, onClick: this.onSave}, 'OK'),
            Button({onClick: this.onCancel}, 'Cancel')
          )
        );
      case 'saving':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Saving in progress'),
          ModalBody({}, Spinner())
        );
      case 'success':
        return Modal({show: true, onHide: this.onCancel},
          ModalHeader({}, 'Success'),
          ModalBody({}, 'Visualization ',
            ResourceLink({uri: this.state.savedIri}),
            'has been saved successfully!'
          ),
          ModalFooter({},
            Button({onClick: this.onCancel}, 'OK')
          )
        );
      case '':
        return null;
    }
  }

  render() {
    if (Children.count(this.props.children) === 1) {
      const child = Children.only(this.props.children);
      return cloneElement(
        child, {...child.props, onClick: this.onClick}, ...child.props.children, this.renderModal()
      );
    }
    return Button(
      {
        title: 'Save into default set',
        onClick: this.onClick,
      },
      D.i({className: 'fa fa-save'}),
      this.renderModal()
    );
  }
}

export default ActionSaveComponent;
