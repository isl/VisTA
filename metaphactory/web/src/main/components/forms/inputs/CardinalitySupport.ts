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

import { uniqueId } from 'lodash';
import * as Immutable from 'immutable';
import {
  DOM as D,
  ReactNode,
  Children,
  createElement,
  createFactory,
  cloneElement,
  ReactElement,
  ClassAttributes,
} from 'react';
import * as classnames from 'classnames';
import {Button, Popover, OverlayTrigger} from 'react-bootstrap';
const Tooltip = createFactory(Popover);
const Overlay = createFactory(OverlayTrigger);

import { Spinner } from 'platform/components/ui/spinner';
import {
  isValidChild, hasBaseDerivedRelationship, universalChildren,
} from 'platform/components/utils';

import { FieldDefinition } from '../FieldDefinition';
import {
  FieldValue, EmptyValue, CompositeValue, DataState, ErrorKind, FieldError, FinalizedValue,
} from '../FieldValues';

import {
  SingleValueInput,
  SingleValueInputProps as SingleValueProps,
  validationMessages,
} from './SingleValueInput';
import {
  MultipleValuesInput, MultipleValuesProps, ValuesWithErrors, checkCardinalityAndDuplicates,
} from './MultipleValuesInput';
import { CompositeInput } from './CompositeInput';

export interface CardinalitySupportProps extends MultipleValuesProps {
  children: ReactNode;
  /**
   * Optional argument to prevent label and description being
   * rendered above the value input(s) i.e. in most settings (default),
   * default layout / rendering will be sufficient.
   * If and only explicitly set to 'false' the header will not be rendered and
   * the static field markup components for layouting the title and description
   * might be used.
   */
  renderHeader?: boolean;
}

const COMPONENT_NAME = 'cardinality-support';
const SYNTHETIC_INPUT_KEY = 'synthetic';

type ChildInput = SingleValueInput<SingleValueProps, any>;

/**
 * Wraps {@link SingleValueInput} and exposes self as {@link MultipleValuesInput}
 * by duplicating input component for each field value.
 *
 * This component validates cardinality of field and produces corresponding errors
 * through {@link Props.onValuesChanged}.
 */
export class CardinalitySupport extends MultipleValuesInput<CardinalitySupportProps, {}> {
  /**
   * React element keys corresponding to field values, to prevent incorrect
   * virtual DOM merging when adding or deleting values.
   */
  private valueKeys: string[];

  private readonly inputs = new Map<string, ChildInput>();
  private lastRenderedDataState: DataState | undefined;

  shouldComponentUpdate(nextProps: CardinalitySupportProps, nextState: {}) {
    if (this.state !== nextState) { return true; }
    const previous = this.props;
    return !(
      this.dataState() === this.lastRenderedDataState &&
      previous.renderHeader === nextProps.renderHeader &&
      previous.definition === nextProps.definition &&
      previous.dataState === nextProps.dataState &&
      previous.errors === nextProps.errors &&
      previous.valueSet === nextProps.valueSet && (
        previous.values === nextProps.values ||
        previous.values.size === nextProps.values.size &&
        previous.values.every((item, index) => item === nextProps.values.get(index))
      )
    );
  }

  mapChildren(children: ReactNode, value: FieldValue, index: number, synthetic: boolean) {
    const key = synthetic ? SYNTHETIC_INPUT_KEY : this.valueKeys[index];
    return Children.map(children, child => {
      if (isValidChild(child)) {
        const element = child as ReactElement<any>;
        if (hasBaseDerivedRelationship(SingleValueInput, element.type)) {
          const props: SingleValueProps & ClassAttributes<ChildInput> = {
            for: this.props.for,
            definition: this.props.definition,
            dataState: synthetic ? DataState.Loading : this.props.dataState,
            value: value,
            valueSet: this.props.valueSet,
            updateValue: reducer => {
              if (synthetic) { return; }
              this.onValuesChanged(values => values.update(index, reducer));
            },
            ref: input => {
              if (input) {
                this.inputs.set(key, input);
              } else {
                this.inputs.delete(key);
              }
            },
          };
          return cloneElement(element, props);
        } else if ('children' in element.props) {
          return cloneElement(element, {}, universalChildren(
            this.mapChildren(element.props.children, value, index, synthetic)
          ));
        }
      }
      return child;
    });
  }

  render(): ReactElement<any> {
    const definition = this.props.definition;
    if (definition.maxOccurs === 0) { return D.div({}); }

    const dataState = this.props.dataState;
    this.lastRenderedDataState = this.dataState();

    const size = this.props.values.size;
    const canEdit = dataState === DataState.Ready || dataState === DataState.Verifying;
    const canAddValue = canEdit && size < definition.maxOccurs;
    const canRemoveValue = canEdit && size > definition.minOccurs && size > 0;
    const fieldLabel = definition.label ? definition.label.toLowerCase() : 'value';

    return D.div(
      {className: COMPONENT_NAME},

      this.props.renderHeader !== false ? this.renderHeader(definition) : null,
      this.renderChildren(canRemoveValue),

      canAddValue ? (
        D.a({
          className: classnames({
            [`${COMPONENT_NAME}__add-value`]: true,
            [`${COMPONENT_NAME}__add-value--first`]: size === 0,
            [`${COMPONENT_NAME}__add-value--another`]: size > 0,
          }),
          onClick: this.addNewValue,
        }, `+ Add ${fieldLabel}`)
      ) : null,

      validationMessages(this.props.errors),
    );
  }

  private renderHeader = (def: FieldDefinition) => {
    const required = def.minOccurs !== 0;
    const isReady = this.props.dataState === DataState.Ready;
    return D.div({className: COMPONENT_NAME + '__header'},
      def.label
        ? D.span({className: COMPONENT_NAME + '__label'},
            def.label,
            required ? D.span({className: COMPONENT_NAME + '__label-required'}, null) : null
          )
        : null,
      def.description
        ? Overlay(
            {overlay: Tooltip({id: 'tooltip'}, def.description), trigger: ['hover', 'focus']} ,
            D.sup({className: COMPONENT_NAME + '__description-icon'})
          )
        : null,
      isReady ? null : createElement(Spinner, {
        className: `${COMPONENT_NAME}__spinner`,
        spinnerDelay: 1000,
        messageDelay: 30000,
      }),
    );
  }

  private renderChildren(canRemoveValue: boolean) {
    this.ensureValueKeys(this.props.values.size);

    const childIsInputGroup = isInputGroup(this.props.children);
    const className = childIsInputGroup
      ? `${COMPONENT_NAME}__group-instance`
      : `${COMPONENT_NAME}__single-instance`;

    const usingSyntheticInput = this.props.values.size === 0;
    if (usingSyntheticInput) {
      // add synthetic input instance to be able to validate and finalize
      // values even if there are no actual values present
      const syntheticInput = D.div(
        {
          key: SYNTHETIC_INPUT_KEY,
          className: `${className} ${COMPONENT_NAME}__synthetic-instance`,
          style: {display: 'none'}
        },
        universalChildren(this.mapChildren(
          this.props.children, FieldValue.empty, 0, true))
      );
      return [syntheticInput];
    }

    return this.props.values.map((value, index) => D.div(
      {key: this.valueKeys[index], className},
      universalChildren(
        this.mapChildren(this.props.children, value, index, false)),
      canRemoveValue
        ? createElement(Button, {
            className: COMPONENT_NAME + '__remove-value',
            onClick: () => this.removeValue(index),
          }, D.span({className: 'fa fa-times'}))
        : undefined));
  }

  private ensureValueKeys(valueCount: number) {
    if (!this.valueKeys) { this.valueKeys = []; }
    while (this.valueKeys.length < valueCount) {
      this.valueKeys.push(uniqueId());
    }
  }

  private getAnyInput(): SingleValueInput<SingleValueProps, any> {
    if (this.inputs.size === 0) { return undefined; }
    const anyInputKey = getFirst(this.inputs.keys());
    return this.inputs.get(anyInputKey);
  }

  private addNewValue = () => {
    this.onValuesChanged(() => this.props.values.push(FieldValue.empty));
  }

  private removeValue = (valueIndex: number) => {
    this.valueKeys.splice(valueIndex, 1);
    this.onValuesChanged(() => this.props.values.remove(valueIndex));
  }

  private onValuesChanged(
    reducer: (previous: Immutable.List<FieldValue>) => Immutable.List<FieldValue>
  ) {
    this.props.updateValues(previous => {
      const newValues = reducer(previous.values);
      const validated = this.validate({values: newValues, errors: previous.errors}, false);
      return validated;
    });
  }

  dataState(): DataState {
    const states = Array.from(this.inputs.keys(), key => {
      if (key === SYNTHETIC_INPUT_KEY) { return DataState.Ready; }
      return this.inputs.get(key).dataState();
    });
    return (
      states.some(s => s === DataState.Loading) ? DataState.Loading :
      states.some(s => s === DataState.Verifying) ? DataState.Verifying :
      DataState.Ready
    );
  }

  /**
   * Performs cardinality validation of field and
   * validates its values with wrapped {@link SingleValueInput}.
   */
  validate(
    {values, errors}: ValuesWithErrors,
    validateByChildInput = true
  ) {
    const otherErrors = errors.filter(e => e.kind !== ErrorKind.Input).toList();
    const cardinalityErrors = this.validateCardinality(values);
    return {
      values: validateByChildInput
        ? values.map(this.validateThoughChildInputs)
        : values,
      errors: otherErrors.concat(cardinalityErrors),
    };
  }

  private validateThoughChildInputs = (value: FieldValue) => {
    if (FieldValue.isEmpty(value)) { return value; }
    const cleanValue = FieldValue.setErrors(value, FieldError.noErrors);
    // combine errors from every child input
    return this.getAnyInput().validate(cleanValue);
  }

  private validateCardinality(values: Immutable.List<FieldValue>): Immutable.List<FieldError> {
    const anyInput = this.getAnyInput();
    const compositeInput = anyInput instanceof CompositeInput ? anyInput : undefined;
    const preparedValues = compositeInput ? values.map(v => {
      // finalize subject to distinguish composites
      return FieldValue.isComposite(v) ? compositeInput.finalizeSubject(FieldValue.empty, v) : v;
    }) : values;
    return checkCardinalityAndDuplicates(preparedValues, this.props.definition);
  }

  finalize(
    owner: EmptyValue | CompositeValue,
    values: Immutable.List<FieldValue>
  ): FinalizedValue[] {
    const anyInput = this.getAnyInput();
    const finalized = values.map(value => anyInput.finalize(owner, value)).toArray();
    // flatten finalized values
    return ([] as FinalizedValue[]).concat(...finalized);
  }
}

function isInputGroup(children: ReactNode) {
  const childCount = Children.count(children);
  if (childCount !== 1) {
    return childCount > 1;
  }
  const child = Children.toArray(children)[0];
  if (typeof child !== 'object' || typeof child.type === 'string') {
    return true;
  }
  return !hasBaseDerivedRelationship(SingleValueInput, child.type)
    || child.type === CompositeInput;
}

function getFirst<T>(items: IterableIterator<T>): T {
  const entry = items.next();
  if (entry.done) {
    throw new Error('Cannot get a first entry of an empty IterableIterator');
  }
  return entry.value;
}

export default CardinalitySupport;
