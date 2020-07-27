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

import * as React from 'react';
import { Children, ReactElement, ReactNode, cloneElement } from 'react';
import { Button, Modal } from 'react-bootstrap';

import { Cancellation } from 'platform/api/async';
import { Rdf } from 'platform/api/rdf';
import { getLabel } from 'platform/api/services/resource-label';
import { AutoCompletionInput } from 'platform/components/ui/inputs';

import { FieldDefinition } from '../FieldDefinition';
import { FieldValue, AtomicValue } from '../FieldValues';
import { ResourceEditorForm, ResourceEditorFormProps } from '../ResourceEditorForm';
import { AtomicValueInput, AtomicValueInputProps, validationMessages } from './SingleValueInput';

export interface AutocompleteInputProps extends AtomicValueInputProps {
  template?: string;
  placeholder?: string;
}

interface SelectValue {
  value: Rdf.Node;
  label: Rdf.Literal;
}

interface State {
  readonly nestedFormOpen?: boolean;
}

const CLASS_NAME = 'autocomplete-text-field';
const MINIMUM_LIMIT = 3;
const DEFAULT_TEMPLATE = `<span title="{{label.value}}">{{label.value}}</span>`;

export class AutocompleteInput extends AtomicValueInput<AutocompleteInputProps, State> {
  private readonly cancellation = new Cancellation();

  private persisting = this.cancellation.derive();
  private tupleTemplate: string = null;

  constructor(props: AutocompleteInputProps, context: any) {
    super(props, context);
    this.state = {nestedFormOpen: false};
    this.tupleTemplate = this.tupleTemplate || this.compileTemplate();
  }

  private compileTemplate() {
    return this.props.template ? this.props.template.replace(/\\/g, '') : DEFAULT_TEMPLATE;
  }

  render() {
    const nestedForm = getNestedForm(this.props.children);
    return (
      <div className={CLASS_NAME}>
        {this.renderSelect(nestedForm)}
        {validationMessages(FieldValue.getErrors(this.props.value))}
        {this.state.nestedFormOpen ? this.renderNestedForm(nestedForm) : null}
      </div>
    );
  }

  private renderSelect(nestedForm: ReactElement<ResourceEditorFormProps> | undefined) {
    const definition = this.props.definition;
    const rdfNode = FieldValue.asRdfNode(this.props.value);
    const placeholder = typeof this.props.placeholder === 'undefined'
      ? this.createDefaultPlaceholder(definition) : this.props.placeholder;

    return (
      <div className={`${CLASS_NAME}__main-row`}>
        <AutoCompletionInput
          key={definition.id}
          className={`${CLASS_NAME}__select`}
          autofocus={false}
          query={this.props.definition.autosuggestionPattern}
          placeholder={placeholder}
          value={FieldValue.isAtomic(this.props.value) ? {
            value: rdfNode,
            label: Rdf.literal(this.props.value.label || rdfNode.value),
          } : undefined}
          templates={{suggestion: this.tupleTemplate}}
          actions={{
            // TODO due to the typing in AutocompleteInput, this accepts only a Dictionary<Rdf.Node>
            // however, what will be passed in is a SelectValue
            onSelected: this.onChange as (val: any) => void,
          }}
          minimumInput={MINIMUM_LIMIT}
        />
        {nestedForm ? (
          <Button
            className={`${CLASS_NAME}__create-button`}
            bsStyle='default'
            onClick={this.toggleNestedForm}>
            <span className='fa fa-plus' />
            {' Create new'}
          </Button>
        ) : null}
      </div>
    );
  }

  private toggleNestedForm = () => {
    this.setState(
      (state): State => ({nestedFormOpen: !state.nestedFormOpen}),
      () => {
        if (this.state.nestedFormOpen) {
          this.persisting = this.cancellation.deriveAndCancel(this.persisting);
        }
      }
    );
  }

  private renderNestedForm(nestedForm: ReactElement<ResourceEditorFormProps>) {
    const definition = this.props.definition;
    const propsOverride: Partial<ResourceEditorFormProps> = {
      browserPersistence: false,
      subject: Rdf.iri(''),
      postAction: (subject: Rdf.Iri) => {
        this.persisting.map(getLabel(subject)).observe({
          value: label => {
            this.onChange({value: subject, label: Rdf.literal(label)});
          }
        });
      },
    };
    return (
      <Modal bsSize='large' show={true} onHide={() => this.setState({nestedFormOpen: false})}>
        <Modal.Header closeButton={true}>
          <Modal.Title>{`Create New ${definition.label || definition.id || 'Value'}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cloneElement(nestedForm, propsOverride)}
        </Modal.Body>
      </Modal>
    );
  }

  private onChange = (selected: SelectValue | null): void => {
    let value = this.props.value;
    if (selected) {
      value = AtomicValue.set(value, {
        value: selected.value,
        label: selected.label.value,
      });
    } else {
      value = FieldValue.empty;
    }
    this.setState({nestedFormOpen: false});
    this.setAndValidate(value);
  }

  private createDefaultPlaceholder(definition: FieldDefinition): string {
    return `Search and select ${(definition.label || 'entity').toLocaleLowerCase()} here...`;
  }
}

function getNestedForm(children: ReactNode): ReactElement<ResourceEditorFormProps> | undefined {
  if (Children.count(children) !== 1) {
    return undefined;
  }
  const child = Children.only(children);
  const isForm = typeof child.type === 'function' && child.type === ResourceEditorForm;
  return isForm ? child : undefined;
}

export default AutocompleteInput;
